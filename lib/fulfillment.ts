import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import { decryptInventoryCode } from "@/lib/crypto/inventory"
import { Redis } from "@upstash/redis"

interface FulfillOrderParams {
  transactionId: string
  validationTraceId?: string
  provider?: string
  bankTxnId?: string | null
}

/**
 * Fulfills a paid order directly on the server without needing an internal HTTP roundtrip.
 * Handles:
 * 1. Idempotency locking via Redis
 * 2. Marking transaction as Paid / Completed
 * 3. Auto-claiming digital inventory code (if digital goods/games)
 * 4. Sending delivery email (code email or order confirmation)
 * 5. Sending Discord notification
 */
export async function fulfillOrderDirectly({
  transactionId,
  bankTxnId,
}: FulfillOrderParams) {
  try {
    const supabase = createServiceRoleClient()

    // 1. Fetch transaction record
    const { data: _txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()
    const txn = _txn as any

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found" }
    }

    if (["Completed", "Paid"].includes(txn.status)) {
      return { success: true, message: "Transaction already processed", alreadyProcessed: true }
    }

    // 2. Idempotency lock via Upstash Redis to avoid double fulfillment
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        const lockKey = `fulfill-lock:${transactionId}`
        const acquired = await redis.set(lockKey, "1", { nx: true, ex: 60 })
        if (!acquired) {
          console.log(`[FULFILLMENT] Idempotency lock already held for ${transactionId}, skipping`)
          return { success: true, message: "Already being processed" }
        }
      } catch (lockErr) {
        console.warn("[FULFILLMENT] Redis lock warning:", lockErr)
      }
    }

    // 3. Mark as Paid (Manual delivery baseline) + record bank txn ID
    const updatePayload: any = { 
      status: "Paid",
      failure_remarks: null
    }
    if (bankTxnId) {
      updatePayload.bank_txn_id = bankTxnId
    }
    const { error: updateError } = await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("transaction_id", transactionId)

    if (updateError) {
      console.error(`[FULFILLMENT ERROR] Failed to update status to Paid for ${transactionId}:`, updateError)
    }

    // 4. Fulfillment: Claim inventory gift card code if applicable
    const categoriesWithInventory = ["digital-goods", "games"]
    let deliveredCode: string | null = null
    let decryptedCode: string | null = null

    if (txn.product_category && categoriesWithInventory.includes(txn.product_category.toLowerCase())) {
      console.log(`[FULFILLMENT] Claiming inventory code for ${transactionId}...`)

      const { data: claimData, error: claimError } = await supabase.rpc("claim_gift_card", {
        p_product_id: txn.product_id,
        p_denomination_label: txn.amount,
        p_transaction_id: transactionId,
        p_user_id: txn.user_id || txn.user_email
      } as any)

      if (claimError) {
        console.error("[FULFILLMENT] RPC claim error:", claimError)
      } else if (claimData && (claimData as any).length > 0 && (claimData as any)[0].encrypted_code) {
        deliveredCode = (claimData as any)[0].encrypted_code
        decryptedCode = decryptInventoryCode(deliveredCode as string)

        if (decryptedCode) {
          await supabase.from("transactions").update({
            giftcard_code: decryptedCode,
            status: "Completed"
          } as any).eq("transaction_id", transactionId)
        } else {
          console.error(`[FULFILLMENT] Failed to decrypt code for ${transactionId}`)
          await supabase.from("transactions").update({
            giftcard_code: deliveredCode
          } as any).eq("transaction_id", transactionId)
        }
      } else {
        console.warn(`[FULFILLMENT OUT OF STOCK] No codes left for ${txn.product_name} - ${txn.amount}`)
      }
    }

    // 5. Send Email Confirmation
    let userName = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = userData.name
    } else if (txn.guest_user_data && txn.guest_user_data.name) {
      userName = txn.guest_user_data.name
    }

    try {
      if (decryptedCode) {
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
      console.error("[FULFILLMENT] Failed to send email:", emailErr)
    }

    // 6. Discord Webhook Notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const title = decryptedCode 
          ? "✅ AUTO-FULFILLED - PAID ORDER" 
          : "⚠️ MANUAL DELIVERY REQUIRED - PAID ORDER"
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
                { name: "Bank Txn ID", value: bankTxnId || "N/A", inline: true },
                { name: "Product", value: txn.product_name, inline: false },
                { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
              ],
              timestamp: new Date().toISOString()
            }]
          })
        })
      } catch (e) {}
    }

    return { success: true, deliveredCode: !!decryptedCode }
  } catch (error: any) {
    console.error("[FULFILLMENT CRITICAL ERROR]:", error)
    return { success: false, error: error.message || "Failed to fulfill order" }
  }
}
