import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import { decryptInventoryCode } from "@/lib/crypto/inventory"
import { Redis } from "@upstash/redis"

const BYPASS_SIGNATURE = process.env.NODE_ENV === "development"

async function handler(req: Request) {
  try {
    // SECURITY: Verify internal trigger requests with secret header
    const internalSecret = req.headers.get("x-internal-secret")
    const body = await req.json()
    const { transactionId, validationTraceId, provider, bankTxnId, internalTrigger } = body

    if (internalTrigger) {
      const expectedSecret = process.env.INTERNAL_API_SECRET
      if (!expectedSecret) {
        console.error(`[WEBHOOK] INTERNAL_API_SECRET not configured`)
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
      }
      if (internalSecret !== expectedSecret) {
        console.error(`[WEBHOOK] REJECTED: Invalid internal secret for ${transactionId}`)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

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
    const txn = _txn as any;

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

    // 2. Verify payment with bank proxy if NOT an internal trigger
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
          password
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

    // 3. Payment Confirmed! Acquire idempotency lock to prevent double fulfillment
    let redis: Redis | null = null
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
      const lockKey = `fulfill-lock:${transactionId}`
      const acquired = await redis.set(lockKey, "1", { nx: true, ex: 60 })
      if (!acquired) {
        console.log(`[WEBHOOK] Idempotency lock already held for ${transactionId}, skipping`)
        return NextResponse.json({ success: true, message: "Already being processed" }, { status: 200 })
      }
    }

    // 4. Mark as Paid (Manual Delivery state) + store bank txn ID
    // We will upgrade this to "Completed" ONLY if we successfully auto-deliver a code.
    const updatePayload: any = { status: "Paid" }
    if (resolvedBankTxnId) {
      updatePayload.bank_txn_id = resolvedBankTxnId
    }
    const { error: updateError } = await supabase.from("transactions").update(updatePayload).eq("transaction_id", transactionId)
    if (updateError) {
      console.error(`[WEBHOOK UPDATE ERROR] TxnId: ${transactionId}:`, updateError)
    } else {
      console.log(`[WEBHOOK UPDATE] Marked ${transactionId} as Paid`)
    }
    // 4. Fulfillment: If category is digital-goods or games, claim an inventory code
    const categoriesWithInventory = ["digital-goods", "games"]
    let deliveredCode: string | null = null
    let decryptedCode: string | null = null

    if ((txn as any).product_category && categoriesWithInventory.includes((txn as any).product_category.toLowerCase())) {
      console.log(`[FULFILLMENT] Claiming inventory code for ${transactionId}...`)

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

        // DECRYPT the code before storing and emailing
        decryptedCode = decryptInventoryCode(deliveredCode as string)

        if (decryptedCode) {
          // Store the decrypted code in the transaction for admin to see
          // And upgrade the status to "Completed" since it was auto-fulfilled
          await supabase.from("transactions").update({
            giftcard_code: decryptedCode,
            status: "Completed"
          } as any).eq("transaction_id", transactionId)
        } else {
          // Fallback: store encrypted if decryption fails
          console.error(`[FULFILLMENT] Failed to decrypt code for ${transactionId}`)
          await supabase.from("transactions").update({
            giftcard_code: deliveredCode
          } as any).eq("transaction_id", transactionId)
        }
      } else {
        // OUT OF STOCK
        console.warn(`[OUT OF STOCK] No codes left for ${txn.product_name} - ${txn.amount}`)
      }
    }

    // 5. Send Email
    let userName = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = userData.name
    } else if ((txn as any).guest_user_data && (txn as any).guest_user_data.name) {
      userName = (txn as any).guest_user_data.name
    }

    try {
      if (decryptedCode) {
        // Send giftcard code email directly (skip "order placed")
        await sendGiftcardCodeEmail({
          email: txn.user_email,
          userName: userName,
          productName: txn.product_name,
          denomination: txn.amount,
          transactionId: transactionId,
          price: txn.price,
          paymentMethod: txn.payment_method,
          giftcardCode: decryptedCode,
          isGuest: !txn.user_id
        })
      } else {
        // No inventory code — send order placed email
        await sendOrderPlacedEmail({
          email: txn.user_email,
          userName: userName,
          productName: txn.product_name,
          denomination: txn.amount,
          transactionId: transactionId,
          price: txn.price,
          paymentMethod: txn.payment_method,
          isGuest: !txn.user_id
        })
      }
    } catch (emailErr) {
      console.error("Failed to send fulfillment email:", emailErr)
    }

    // 6. Discord notification for all PAID dynamic QR orders
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const title = decryptedCode 
          ? "✅ AUTO-FULFILLED - PAID ORDER" 
          : "⚠️ MANUAL DELIVERY REQUIRED - PAID ORDER";
        const color = decryptedCode ? 0x4CAF50 : 0xFF5722; // Green vs Orange

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
              ],
              timestamp: new Date().toISOString()
            }]
          })
        })
      } catch (e) {}
    }

    return NextResponse.json({ success: true, deliveredCode: !!decryptedCode }, { status: 200 })

  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Export with QStash signature verification (bypassed in dev)
export const POST = BYPASS_SIGNATURE ? handler : verifySignatureAppRouter(handler)
