import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { fulfillOrderDirectly, handlePartialPayment } from "@/lib/fulfillment"

/**
 * Fonepay WebSocket Webhook
 * Called by the payment proxy when Fonepay's WebSocket sends a VERIFIED message.
 * Handles QR scan detection, bank verification, then delegates to fulfillOrderDirectly.
 */
export async function POST(req: Request) {
  try {
    // SECURITY: Verify internal secret
    const internalSecret = req.headers.get("x-internal-secret")
    const expectedSecret = process.env.INTERNAL_API_SECRET
    if (!expectedSecret || internalSecret !== expectedSecret) {
      console.error(`[FONEPAY-WS] REJECTED: Invalid internal secret`)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { transactionId, validationTraceId, provider, event, fonepayData } = body

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transactionId" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Determine if this is an intermediate QR scan event vs a completed payment event
    let isScanEvent = event === "QR_SCANNED" || event === "SCANNED"
    if (!isScanEvent && fonepayData) {
      let innerStatus = fonepayData.transactionStatus
      if (typeof innerStatus === "string") {
        try { innerStatus = JSON.parse(innerStatus) } catch (e) {}
      }
      const isPaid = (innerStatus?.success === true && (innerStatus?.message === "SUCCESS" || innerStatus?.message === "PAID" || innerStatus?.status === "SUCCESS")) || fonepayData.status === "SUCCESS" || fonepayData.event === "PAID" || fonepayData.event === "SUCCESS"
      const hasScanFlag = innerStatus?.qrVerified === true || innerStatus?.message === "VERIFIED" || innerStatus?.status === "VERIFIED" || innerStatus?.isScanned === true || fonepayData.event === "QR_SCANNED" || fonepayData.event === "SCANNED" || fonepayData.status === "VERIFIED" || fonepayData.qrVerified === true
      if (hasScanFlag && !isPaid) {
        isScanEvent = true
      }
    }

    // Handle intermediate QR_SCANNED event from WebSocket
    if (isScanEvent) {
      console.log(`[FONEPAY-WS] 📷 QR SCANNED event for ${transactionId}`)
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "QR Scanned"
      } as any)
        .eq("transaction_id", transactionId)
        .in("status", ["Payment Pending"])
      return NextResponse.json({ success: true, message: "QR Scanned status updated" }, { status: 200 })
    }

    console.log(`[FONEPAY-WS] Received VERIFIED for ${transactionId}`)

    // 1. Fetch transaction
    const { data: _txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()
    const txn = _txn as any

    if (txnError || !txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Already completed? Skip.
    if (["Completed", "Paid"].includes(txn.status)) {
      return NextResponse.json({ success: true, message: "Already processed" }, { status: 200 })
    }

    // Not in a valid pending state? Skip.
    if (!["Payment Pending", "Processing"].includes(txn.status)) {
      return NextResponse.json({ success: true, message: `Transaction is ${txn.status}. Skipping.` }, { status: 200 })
    }

    // 2. Verify the payment with Fonepay settlement API to get the bank txn ID
    let resolvedBankTxnId: string | null = null
    let bankVerified = false
    try {
      const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
      const PROXY_SECRET = process.env.INTERNAL_API_SECRET!

      // Session Token Architecture: Try cached session token first
      let sessionToken: string | null = null
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const { Redis } = await import("@upstash/redis")
          const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
          sessionToken = await redis.get<string>(`payment_token:fonepay`)
        } catch {}
      }

      const verifyPayload: any = {
        nqrTxnId: validationTraceId || txn.validation_trace_id,
        amount: parseInt(txn.price),
        remarks: transactionId,
        orderCreatedAt: txn.created_at
      }
      if (sessionToken) {
        verifyPayload.sessionToken = sessionToken
      }

      const makeRequest = async (payload: any) => {
        const resp = await fetch(`${PROXY_URL}/api/verify-fonepay-transaction`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": PROXY_SECRET
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
          signal: AbortSignal.timeout(10000)
        })
        return await resp.json()
      }

      let verifyData = await makeRequest(verifyPayload)

      // If session expired, fall back to credentials
      if (verifyData.sessionExpired) {
        const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", "fonepay").single() as any
        if (credsRes.data) {
          const username = await decryptBankCredentials(credsRes.data.encrypted_username)
          const password = await decryptBankCredentials(credsRes.data.encrypted_password)
          if (username && password) {
            verifyPayload.username = username
            verifyPayload.password = password
            verifyData = await makeRequest(verifyPayload)
          }
        }
      }

      if (verifyData.success && verifyData.data?.status === "SUCCESS") {
        resolvedBankTxnId = verifyData.data.bankTxnId || verifyData.data.txnId || null
        bankVerified = true

        // SECURITY: Validate paid amount matches order amount (anti-underpayment fraud)
        const rawPaidAmount = verifyData.data.paidAmount
        if (rawPaidAmount) {
          const paidAmount = parseInt(rawPaidAmount)
          const expectedAmount = Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
          if (paidAmount > 0 && paidAmount < expectedAmount) {
            console.error(`[FONEPAY-WS FRAUD ALERT] Amount mismatch for ${transactionId}: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`)
            await handlePartialPayment({
              transactionId,
              expectedAmount,
              paidAmount,
              productName: txn.product_name,
              userEmail: txn.user_email,
              source: "Fonepay WS",
            })
            return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
          }
        }
      }
    } catch (e: any) {
      console.error(`[FONEPAY-WS] Verification fetch failed:`, e.message)
      // SECURITY: Do NOT fulfill without bank confirmation. Mark as Processing for cron/QStash to verify later.
      // Guard: only update if still in a pending state (never overwrite Paid/Completed)
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "WS VERIFIED received but bank API unreachable — pending cron verification"
      } as any)
        .eq("transaction_id", transactionId)
        .in("status", ["Payment Pending", "Processing"])
      return NextResponse.json({ success: true, message: "Queued for cron verification" }, { status: 200 })
    }

    // If bank API was reachable but payment not confirmed, don't fulfill
    if (!bankVerified) {
      console.log(`[FONEPAY-WS] WS event received but bank did not confirm payment for ${transactionId}`)
      // Guard: only update if still in a pending state (never overwrite Paid/Completed)
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "WS event received, bank verification pending"
      } as any)
        .eq("transaction_id", transactionId)
        .in("status", ["Payment Pending", "Processing"])
      return NextResponse.json({ success: true, message: "Bank verification pending" }, { status: 200 })
    }

    // 3. Bank confirmed — delegate to the single source of truth for fulfillment
    const fulfillResult = await fulfillOrderDirectly({
      transactionId,
      validationTraceId: validationTraceId || txn.validation_trace_id,
      provider: provider || "fonepay",
      bankTxnId: resolvedBankTxnId,
      source: "Fonepay WS",
    })

    if (!fulfillResult.success) {
      return NextResponse.json({ error: fulfillResult.error || "Fulfillment failed" }, { status: 500 })
    }

    console.log(`[FONEPAY-WS] ✅ Fulfilled ${transactionId} successfully`)
    return NextResponse.json({ success: true, deliveredCode: fulfillResult.deliveredCode }, { status: 200 })

  } catch (error: any) {
    console.error("[FONEPAY-WS] Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

