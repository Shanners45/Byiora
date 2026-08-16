import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { fulfillOrderDirectly } from "@/lib/fulfillment"

const BYPASS_SIGNATURE = process.env.NODE_ENV === "development"

async function handler(req: Request) {
  try {
    const body = await req.json()
    const { transactionId, validationTraceId, provider, bankTxnId, internalTrigger } = body

    if (!transactionId || !validationTraceId || !provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // 1. Check Transaction Status
    const { data: _txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()
    const txn = _txn as any

    if (txnError || !txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (["Completed", "Paid"].includes(txn.status)) {
      return NextResponse.json({ success: true, message: "Transaction already processed" }, { status: 200 })
    }

    const allowedStatuses = internalTrigger ? ["Payment Pending", "Processing", "Payment Failed"] : ["Payment Pending", "Processing"]
    if (!allowedStatuses.includes(txn.status)) {
      return NextResponse.json({ success: true, message: `Transaction is in ${txn.status} state. Stopping polling.` }, { status: 200 })
    }

    // 2. Verify payment with bank proxy if NOT already verified by caller
    let resolvedBankTxnId = bankTxnId || null

    if (!internalTrigger) {
      const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
      const PROXY_SECRET = process.env.INTERNAL_API_SECRET!

      const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", provider).single() as any
      if (!credsRes.data) return NextResponse.json({ error: "Credentials missing" }, { status: 500 })

      const username = await decryptBankCredentials((credsRes.data as any).encrypted_username)
      const password = await decryptBankCredentials((credsRes.data as any).encrypted_password)
      if (!username || !password) return NextResponse.json({ error: "Decrypt failed" }, { status: 500 })

      const endpoint = provider === "nepalpay" ? "/api/verify-nepalpay-transaction" : "/api/verify-fonepay-transaction"

      const response = await fetch(`${PROXY_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": PROXY_SECRET },
        body: JSON.stringify({
          nqrTxnId: validationTraceId,
          username,
          password,
          remarks: transactionId,
          amount: Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
        }),
      })

      const proxyData = await response.json()

      if (!proxyData.success || proxyData.data?.status !== "SUCCESS") {
        console.log(`[QSTASH] Payment not yet verified for ${transactionId}. Retrying later...`)
        return NextResponse.json({ error: "Not verified yet" }, { status: 500 })
      }

      // SECURITY: Validate paid amount matches order amount (anti-underpayment fraud)
      const rawPaidAmount = proxyData.data.raw?.amount || proxyData.data.raw?.transactionAmount
      if (rawPaidAmount) {
        const paidAmount = parseInt(rawPaidAmount)
        const expectedAmount = Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
        if (paidAmount > 0 && paidAmount < expectedAmount) {
          console.error(`[FRAUD ALERT] Amount mismatch for ${transactionId}: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`)
          await supabase.from("transactions").update({
            status: "Payment Failed",
            failure_remarks: `Amount discrepancy: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`
          } as any).eq("transaction_id", transactionId)
          return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
        }
      }

      resolvedBankTxnId = proxyData.data.bankTxnId || proxyData.data.txnId || null
    }

    // 3. Fulfill the order directly (idempotency, claim inventory, send email, notify discord)
    const fulfillResult = await fulfillOrderDirectly({
      transactionId,
      validationTraceId,
      provider,
      bankTxnId: resolvedBankTxnId,
    })

    if (!fulfillResult.success) {
      return NextResponse.json({ error: fulfillResult.error || "Fulfillment failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, deliveredCode: fulfillResult.deliveredCode }, { status: 200 })

  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Export with QStash signature verification (bypassed in dev)
export const POST = BYPASS_SIGNATURE ? handler : verifySignatureAppRouter(handler)
