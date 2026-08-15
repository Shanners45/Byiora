import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import { decryptInventoryCode } from "@/lib/crypto/inventory"
import { Redis } from "@upstash/redis"

/**
 * Fonepay WebSocket Webhook
 * Called by the payment proxy when Fonepay's WebSocket sends a VERIFIED message.
 * This triggers the same fulfillment pipeline as the QStash webhook.
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
      } as any).eq("transaction_id", transactionId)
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

      const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", "fonepay").single() as any
      if (credsRes.data) {
        const username = await decryptBankCredentials(credsRes.data.encrypted_username)
        const password = await decryptBankCredentials(credsRes.data.encrypted_password)

        if (username && password) {
          const response = await fetch(`${PROXY_URL}/api/fonepay/verify-transaction`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": PROXY_SECRET
            },
            body: JSON.stringify({
              nqrTxnId: validationTraceId || txn.validation_trace_id,
              username,
              password,
              amount: parseInt(txn.price),
              remarks: transactionId
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(10000)
          })

          const verifyData = await response.json()
          if (verifyData.success && verifyData.data?.status === "SUCCESS") {
            resolvedBankTxnId = verifyData.data.bankTxnId || verifyData.data.txnId || null
            bankVerified = true

            // SECURITY: Validate paid amount matches order amount (anti-underpayment fraud)
            const rawPaidAmount = verifyData.data.raw?.transactionAmount || verifyData.data.raw?.amount
            if (rawPaidAmount) {
              const paidAmount = parseInt(rawPaidAmount)
              const expectedAmount = Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
              if (paidAmount > 0 && paidAmount < expectedAmount) {
                console.error(`[FONEPAY-WS FRAUD ALERT] Amount mismatch for ${transactionId}: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`)
                await supabase.from("transactions").update({
                  status: "Payment Failed",
                  failure_remarks: `Amount discrepancy: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`
                } as any).eq("transaction_id", transactionId)
                return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.error(`[FONEPAY-WS] Verification fetch failed:`, e.message)
      // SECURITY: Do NOT fulfill without bank confirmation. Mark as Processing for cron/QStash to verify later.
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "WS VERIFIED received but bank API unreachable — pending cron verification"
      } as any).eq("transaction_id", transactionId)
      return NextResponse.json({ success: true, message: "Queued for cron verification" }, { status: 200 })
    }

    // If bank API was reachable but payment not confirmed, don't fulfill
    if (!bankVerified) {
      console.log(`[FONEPAY-WS] WS event received but bank did not confirm payment for ${transactionId}`)
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "WS event received, bank verification pending"
      } as any).eq("transaction_id", transactionId)
      return NextResponse.json({ success: true, message: "Bank verification pending" }, { status: 200 })
    }

    // 3. Mark as Paid (bank confirmed) — Acquire idempotency lock to prevent double fulfillment
    let redis: Redis | null = null
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
      const lockKey = `fulfill-lock:${transactionId}`
      const acquired = await redis.set(lockKey, "1", { nx: true, ex: 60 })
      if (!acquired) {
        console.log(`[FONEPAY-WS] Idempotency lock already held for ${transactionId}, skipping`)
        return NextResponse.json({ success: true, message: "Already being processed" }, { status: 200 })
      }
    }

    const updatePayload: any = { status: "Paid" }
    if (resolvedBankTxnId) {
      updatePayload.bank_txn_id = resolvedBankTxnId
    }
    await supabase.from("transactions").update(updatePayload).eq("transaction_id", transactionId)

    // 4. Fulfillment: Claim inventory code if applicable
    const categoriesWithInventory = ["digital-goods", "games"]
    let deliveredCode: string | null = null
    let decryptedCode: string | null = null

    if (txn.product_category && categoriesWithInventory.includes(txn.product_category.toLowerCase())) {
      console.log(`[FONEPAY-WS] Claiming inventory code for ${transactionId}...`)

      const { data: claimData, error: claimError } = await supabase.rpc("claim_gift_card", {
        p_product_id: txn.product_id,
        p_denomination_label: txn.amount,
        p_transaction_id: transactionId,
        p_user_id: txn.user_id || txn.user_email
      } as any)

      if (claimError) {
        console.error("RPC claim error:", claimError)
      } else if (claimData && (claimData as any).length > 0 && (claimData as any)[0].encrypted_code) {
        deliveredCode = (claimData as any)[0].encrypted_code
        decryptedCode = decryptInventoryCode(deliveredCode as string)

        if (decryptedCode) {
          await supabase.from("transactions").update({
            giftcard_code: decryptedCode,
            status: "Completed"
          } as any).eq("transaction_id", transactionId)
        } else {
          console.error(`[FONEPAY-WS] Failed to decrypt code for ${transactionId}`)
          await supabase.from("transactions").update({
            giftcard_code: deliveredCode
          } as any).eq("transaction_id", transactionId)
        }
      } else {
        console.warn(`[FONEPAY-WS] No codes left for ${txn.product_name} - ${txn.amount}`)
      }
    }

    // 5. Send Email
    let userName: string | undefined = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = (userData as any).name
    } else if (txn.guest_user_data && txn.guest_user_data.name) {
      userName = txn.guest_user_data.name
    }

    try {
      if (decryptedCode) {
        await sendGiftcardCodeEmail({
          email: txn.user_email,
          userName,
          productName: txn.product_name,
          denomination: txn.amount,
          transactionId,
          price: txn.price,
          paymentMethod: txn.payment_method,
          giftcardCode: decryptedCode,
          isGuest: !txn.user_id
        })
      } else {
        await sendOrderPlacedEmail({
          email: txn.user_email,
          userName,
          productName: txn.product_name,
          denomination: txn.amount,
          transactionId,
          price: txn.price,
          paymentMethod: txn.payment_method,
          isGuest: !txn.user_id
        })
      }
    } catch (emailErr) {
      console.error("Failed to send fulfillment email:", emailErr)
    }

    // 6. Discord notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const title = decryptedCode
          ? "✅ AUTO-FULFILLED (Fonepay WS) - PAID ORDER"
          : "⚠️ MANUAL DELIVERY REQUIRED (Fonepay WS) - PAID ORDER"
        const color = decryptedCode ? 0x4CAF50 : 0xFF5722

        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title,
              color,
              fields: [
                { name: "Order ID", value: transactionId, inline: true },
                { name: "Bank Txn ID", value: resolvedBankTxnId || "N/A", inline: true },
                { name: "Product", value: txn.product_name, inline: false },
                { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
                { name: "Source", value: "Fonepay WebSocket (Real-time)", inline: true },
              ],
              timestamp: new Date().toISOString()
            }]
          })
        })
      } catch (e) {}
    }

    console.log(`[FONEPAY-WS] ✅ Fulfilled ${transactionId} successfully`)
    return NextResponse.json({ success: true, deliveredCode: !!decryptedCode }, { status: 200 })

  } catch (error: any) {
    console.error("[FONEPAY-WS] Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
