import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs"
import { recordAbuse, getLockMinutes } from "@/lib/security/auto-ban"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/lib/crypto/bank"
import { fulfillOrderDirectly, handlePartialPayment, flagOrderForManualReview } from "@/lib/fulfillment"
import { isWalletTopupRef, settleFonepayTopup } from "@/lib/merchant/fonepay"

const BYPASS_SIGNATURE = process.env.NODE_ENV === "development"

async function handler(req: Request) {
  try {
    const body = await req.json()
    const { transactionId, validationTraceId, bankTxnId } = body

    if (!transactionId || !validationTraceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Merchant wallet top-up: verified against the bank using the session stored on the top-up, not the body.
    if (isWalletTopupRef(transactionId)) {
      const status = await settleFonepayTopup(transactionId)
      // 500 keeps QStash retrying while the QR can still be paid.
      if (status === "awaiting_payment" || status === "error") return NextResponse.json({ error: "Not paid yet" }, { status: 500 })
      return NextResponse.json({ success: true, status }, { status: 200 })
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

    // Bind the callback to the payment session stored on the order, and take
    // the provider from that record rather than from the message body.
    const storedTraceId = txn.validation_trace_id as string | null
    const provider = txn.payment_category as string | null
    if (!storedTraceId || storedTraceId !== validationTraceId || !provider) {
      return NextResponse.json({ error: "Payment session mismatch" }, { status: 400 })
    }

    const allowedStatuses = ["Payment Pending", "Processing"]
    if (!allowedStatuses.includes(txn.status)) {
      return NextResponse.json({ success: true, message: `Transaction is in ${txn.status} state. Stopping polling.` }, { status: 200 })
    }

    // 2. Verify payment with the bank proxy. Every callback is verified against
    // the bank — there is no caller-asserted "already verified" path.
    let resolvedBankTxnId = bankTxnId || null

    const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
    const PROXY_SECRET = process.env.INTERNAL_API_SECRET!

    const endpoint = provider === "nepalpay" ? "/api/verify-nepalpay-transaction" : "/api/verify-fonepay-transaction"

    // Session Token Architecture: Try cached session token first
    let sessionToken: string | null = null
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const { Redis } = await import("@upstash/redis")
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        sessionToken = await redis.get<string>(`payment_token:${provider}`)
      } catch {}
    }

    const verifyPayload: any = {
      nqrTxnId: validationTraceId,
      remarks: transactionId,
      amount: Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
    }
    if (sessionToken) {
      verifyPayload.sessionToken = sessionToken
    }

    const makeRequest = async (payload: any) => {
      const resp = await fetch(`${PROXY_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": PROXY_SECRET },
        body: JSON.stringify(payload),
      })
      return await resp.json()
    }

    let proxyData = await makeRequest(verifyPayload)

    // If session expired, fall back to credentials
    if (proxyData.sessionExpired) {
      const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", provider).single() as any
      if (credsRes.data) {
        const username = await decryptBankCredentials((credsRes.data as any).encrypted_username)
        const password = await decryptBankCredentials((credsRes.data as any).encrypted_password)
        if (username && password) {
          verifyPayload.username = username
          verifyPayload.password = password
          proxyData = await makeRequest(verifyPayload)
        }
      }
    }

    if (proxyData.needsReview) {
      // Stripped-remarks candidate: stop polling and hand it to a human.
      await flagOrderForManualReview({
        transactionId,
        provider,
        bankTxnId: proxyData.data?.bankTxnId || proxyData.data?.txnId,
        paidAmount: proxyData.data?.paidAmount,
      })
      return NextResponse.json({ success: false, needsReview: true }, { status: 200 })
    }

    if (!proxyData.success || proxyData.data?.status !== "SUCCESS") {
      console.log(`[QSTASH] Payment not yet verified for ${transactionId}. Retrying later...`)
      return NextResponse.json({ error: "Not verified yet" }, { status: 500 })
    }

    // SECURITY: Validate paid amount matches order amount (anti-underpayment fraud)
    const rawPaidAmount = proxyData.data.paidAmount
    if (rawPaidAmount) {
      const paidAmount = parseInt(rawPaidAmount)
      const expectedAmount = Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
      if (paidAmount > 0 && paidAmount < expectedAmount) {
        console.error(`[FRAUD ALERT] Amount mismatch for ${transactionId}: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`)
        await handlePartialPayment({
          transactionId,
          expectedAmount,
          paidAmount,
          productName: txn.product_name,
          userEmail: txn.user_email,
          source: `QStash (${provider.toUpperCase()})`,
        })
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
      }
    }

    resolvedBankTxnId = proxyData.data.bankTxnId || proxyData.data.txnId || null

    // 3. Fulfill the order directly (idempotency, claim inventory, send email, notify discord)
    const fulfillResult = await fulfillOrderDirectly({
      transactionId,
      validationTraceId,
      provider,
      bankTxnId: resolvedBankTxnId,
      source: `QStash (${provider.toUpperCase()})`,
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
const verified = verifySignatureAppRouter(handler)

// Forged calls (bad signature) count toward the webhook-probe auto-block.
async function guarded(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
  if (await getLockMinutes("webhook_probe", { ip })) return new Response("Forbidden", { status: 403 })
  const res = await verified(req as any)
  if (res.status === 401 || res.status === 403) await recordAbuse("webhook_probe", { ip })
  return res
}

export const POST = BYPASS_SIGNATURE ? handler : guarded
