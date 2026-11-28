import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import { decryptInventoryCode } from "@/lib/crypto/inventory"
import { Redis } from "@upstash/redis"
import { resetFailureStrikes } from "@/lib/security/strike-counter"
import { packTitle } from "@/lib/denominations"

interface FulfillOrderParams {
  transactionId: string
  validationTraceId?: string
  provider?: string
  bankTxnId?: string | null
  source?: string
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
  provider,
  bankTxnId,
  source,
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

    // A Paid/Completed order is finished UNLESS its inventory code was never
    // delivered (crash or claim failure after payment). Those orders resume at
    // the claim step instead of being reported as "already processed".
    const inventoryCategories = ["digital-goods", "games"]
    const awaitsInventoryCode = Boolean(
      txn.product_category &&
      inventoryCategories.includes(String(txn.product_category).toLowerCase()) &&
      txn.product_category !== "direct-login" &&
      txn.product_category !== "topup" &&
      !txn.encrypted_checkout_data &&
      parseFloat(txn.price || "0") > 0
    )
    const isResume = ["Completed", "Paid"].includes(txn.status)
    if (isResume && !(awaitsInventoryCode && !txn.giftcard_code)) {
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
        const acquired = await redis.set(lockKey, "1", { nx: true, ex: 300 })
        if (!acquired) {
          console.log(`[FULFILLMENT] Idempotency lock already held for ${transactionId}, skipping`)
          return { success: true, message: "Already being processed" }
        }
      } catch (lockErr) {
        console.warn("[FULFILLMENT] Redis lock warning:", lockErr)
      }
    }

    if (!isResume) {
      // 3. Optimistic DB Lock: Atomically update status to Paid ONLY if eligible
      // This prevents TOCTOU race conditions — two concurrent calls can't both succeed
      const updatePayload: any = {
        status: "Paid",
        failure_remarks: null
      }
      if (bankTxnId) {
        updatePayload.bank_txn_id = bankTxnId
      }
      const { data: updatedRows, error: updateError } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("transaction_id", transactionId)
        .in("status", ["Payment Pending", "Processing", "Payment Failed", "Cancelled", "Failed"])
        .select("transaction_id")

      if (updateError) {
        console.error(`[FULFILLMENT ERROR] Failed to update status to Paid for ${transactionId}:`, updateError)
        return { success: false, error: `Failed to mark order as paid: ${updateError.message}` }
      }

      // If no rows were updated, the order was already processed by another concurrent call
      if (!updatedRows || updatedRows.length === 0) {
        console.log(`[FULFILLMENT] Optimistic lock: ${transactionId} already processed, skipping`)
        return { success: true, message: "Already processed", alreadyProcessed: true }
      }
    }

    if (!isResume) {
      // Reset any failure strikes for this buyer since payment succeeded
      resetFailureStrikes({
        email: txn.user_email,
        ip: (txn.guest_user_data as any)?.ip,
      }).catch(() => {})

      // Mark this buyer as trusted for higher rate limits on future orders
      const { markTrustedBuyer } = await import("@/lib/security/spam-detection")
      markTrustedBuyer({
        userId: txn.user_id,
        ip: (txn.guest_user_data as any)?.ip,
      }).catch(() => {})
    }

    // 4. Fulfillment: Claim inventory gift card code if applicable
    // Direct-login and topup categories NEVER have inventory codes — they require manual admin fulfillment!
    const isManualCategory = 
      txn.product_category === "direct-login" || 
      txn.product_category === "topup" ||
      Boolean(txn.encrypted_checkout_data)

    const isFreePromoOrder = source === "promo_100_free" || parseFloat(txn.price || "0") <= 0
    const categoriesWithInventory = ["digital-goods", "games"]
    let deliveredCode: string | null = null
    let decryptedCode: string | null = null

    // SECURITY: Never automatically release inventory gift card codes for 100% free promo orders.
    // They must be manually reviewed and fulfilled by the store administrator to protect inventory.
    if (!isFreePromoOrder && !isManualCategory && txn.product_category && categoriesWithInventory.includes(txn.product_category.toLowerCase())) {
      console.log(`[FULFILLMENT] Claiming inventory code for ${transactionId}...`)

      const { data: claimData, error: claimError } = await supabase.rpc("claim_gift_card", {
        p_product_id: txn.product_id,
        p_denomination_label: txn.amount,
        // The pack's permanent id: titles can repeat across a product's categories.
        p_denomination_id: txn.denomination_id || null,
        p_transaction_id: transactionId,
        p_user_id: txn.user_id || txn.user_email
      } as any)

      if (claimError) {
        console.error("[FULFILLMENT] RPC claim error:", claimError)
        // Stay resumable: the order is Paid but has no code, so a later
        // verification or cron pass retries the claim instead of reporting success.
        return { success: false, error: `Inventory claim failed: ${claimError.message}` }
      } else if (claimData && (claimData as any).length > 0 && (claimData as any)[0].encrypted_code) {
        deliveredCode = (claimData as any)[0].encrypted_code
        decryptedCode = decryptInventoryCode(deliveredCode as string)
        // That may have been the last code for this pack: tell staff on Discord so it gets restocked.
        const { alertIfSoldOut } = await import("@/lib/inventory-alerts")
        await alertIfSoldOut({ productId: txn.product_id, label: txn.amount, denominationId: txn.denomination_id, productName: txn.product_name, soldVia: `Storefront order ${transactionId}` })

        if (decryptedCode) {
          await supabase.from("transactions").update({
            giftcard_code: decryptedCode,
            status: "Completed",
            encrypted_checkout_data: null
          } as any).eq("transaction_id", transactionId)
        } else {
          console.error(`[FULFILLMENT] Failed to decrypt code for ${transactionId}`)
          await supabase.from("transactions").update({
            giftcard_code: deliveredCode
          } as any).eq("transaction_id", transactionId)
        }
      } else {
        console.warn(`[FULFILLMENT OUT OF STOCK] No codes left for ${txn.product_name} - ${packTitle(txn)}`)
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
          denomination: packTitle(txn),
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
          denomination: packTitle(txn),
          transactionId: transactionId,
          price: txn.price,
          paymentMethod: txn.payment_method,
          isGuest: !txn.user_id
        })
      }
    } catch (emailErr) {
      console.error("[FULFILLMENT] Failed to send email:", emailErr)
    }

    // 5b. In-App Notification for registered users
    if (txn.user_id) {
      try {
        const notifTitle = decryptedCode
          ? "Order Completed! 🎉"
          : "Order Confirmed! 🎉"
        const notifMessage = decryptedCode
          ? `Your order for ${txn.product_name} (${packTitle(txn)}) is complete! Check your email or transaction history for your gift card code.`
          : `Your order for ${txn.product_name} (${packTitle(txn)}) has been confirmed. You can track its status in your transaction history.`

        await supabase.from("notifications").insert({
          title: notifTitle,
          message: notifMessage,
          type: "success",
          user_id: txn.user_id,
          is_read: false,
        })
      } catch (notifErr) {
        console.error("[FULFILLMENT] Failed to insert notification:", notifErr)
      }
    }

    // 6. Discord Webhook Notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const sourceTag = source ? ` (${source})` : (provider ? ` (${provider.toUpperCase()})` : "")
        const title = decryptedCode 
          ? `✅ AUTO-FULFILLED${sourceTag} - PAID ORDER` 
          : `⚠️ MANUAL DELIVERY REQUIRED${sourceTag} - PAID ORDER`
        const color = decryptedCode ? 0x4CAF50 : 0xFF5722

        const fields: any[] = [
          { name: "Order ID", value: transactionId, inline: true },
          { name: "Bank Txn ID", value: bankTxnId || "N/A", inline: true },
          { name: "Product", value: txn.product_name, inline: false },
          { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
          { name: "Email", value: txn.user_email || "N/A", inline: true },
          { name: "Payment Method", value: txn.payment_method || "N/A", inline: true },
        ]
        if (txn.promo_code) {
          const discountInfo = txn.discount_amount ? ` (-Rs. ${txn.discount_amount})` : ""
          fields.push({
            name: "Promo Code",
            value: `${txn.promo_code}${discountInfo}`,
            inline: true,
          })
        }
        if (isManualCategory) {
          fields.push({
            name: "Type",
            value: txn.product_category === "direct-login" ? "Direct Login (Credentials in Admin Dashboard)" : "Manual Top-Up",
            inline: false
          })
        }
        if (source) {
          fields.push({ name: "Source", value: source, inline: true })
        }

        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title,
              color,
              fields,
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

/**
 * Handles partial payment / underpayment detection:
 * 1. Marks transaction as "Payment Failed" with clear failure_remarks (amount received).
 * 2. Guarded with atomic status check so already paid/completed orders are never overwritten.
 * 3. Sends a dedicated Discord alert with partial payment details.
 */
export async function handlePartialPayment({
  transactionId,
  expectedAmount,
  paidAmount,
  productName,
  userEmail,
  source,
}: {
  transactionId: string
  expectedAmount: number
  paidAmount: number
  productName?: string
  userEmail?: string
  source?: string
}) {
  try {
    // Count each underpaid order once (verification can report it repeatedly).
    const { getRedis } = await import("@/lib/redis")
    const firstReport = await getRedis()?.set(`autoban:partial-seen:${transactionId}`, "1", { nx: true, ex: 7 * 86400 })
    if (firstReport) {
      const { recordAbuse } = await import("@/lib/security/auto-ban")
      await recordAbuse("partial_payment", { email: userEmail })
    }

    const supabase = createServiceRoleClient()
    const remarks = `Partial payment: Received Rs. ${paidAmount} of Rs. ${expectedAmount}`

    await supabase
      .from("transactions")
      .update({
        status: "Payment Failed",
        failure_remarks: remarks,
        updated_at: new Date().toISOString()
      } as any)
      .eq("transaction_id", transactionId)
      .in("status", ["Payment Pending", "Processing"])

    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const shortfall = expectedAmount - paidAmount
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🚨 PARTIAL PAYMENT DETECTED - PAYMENT FAILED",
              color: 0xE53935,
              description: `⚠️ Customer paid **Rs. ${paidAmount}** instead of required **Rs. ${expectedAmount}** (Shortfall: Rs. ${shortfall}). Order marked as **Payment Failed**.`,
              fields: [
                { name: "Order ID", value: transactionId, inline: true },
                { name: "Amount Expected", value: `Rs. ${expectedAmount}`, inline: true },
                { name: "Amount Received", value: `Rs. ${paidAmount}`, inline: true },
                { name: "Shortfall", value: `Rs. ${shortfall}`, inline: true },
                { name: "Product", value: productName || "N/A", inline: false },
                { name: "Customer Email", value: userEmail || "N/A", inline: true },
                { name: "Source", value: source || "Dynamic QR", inline: true },
              ],
              timestamp: new Date().toISOString()
            }]
          })
        })
      } catch (e) {}
    }
  } catch (err: any) {
    console.error("[PARTIAL PAYMENT] Handler error:", err)
  }
}

/**
 * Parks an order for human reconciliation when the bank reports a payment that
 * cannot be tied to this order with certainty (e.g. the banking app stripped
 * the remarks/order ID). Never marks the order paid and never claims inventory:
 * only an exact trace/remarks/receipt match may fulfil an order.
 */
export async function flagOrderForManualReview({
  transactionId,
  provider,
  bankTxnId,
  paidAmount,
  reason = "stripped_remarks",
}: {
  transactionId: string
  provider: string
  bankTxnId?: string | null
  paidAmount?: string | number | null
  /** stripped_remarks: auto-check found an amount/time-only match. paid_before_order: a manual claim's reference
   *  points to a payment made before this order was created. */
  reason?: "stripped_remarks" | "paid_before_order"
}) {
  try {
    const supabase = createServiceRoleClient()
    const why =
      reason === "paid_before_order"
        ? `the customer's reference matches a ${provider} payment made before this order was created`
        : `a ${provider} payment with stripped remarks may match this order`
    const remarks = `Manual review required: ${why} (bank ref ${bankTxnId || "unknown"}, amount Rs. ${paidAmount ?? "unknown"}). Not auto-fulfilled.`

    await supabase
      .from("transactions")
      .update({ failure_remarks: remarks, updated_at: new Date().toISOString() } as any)
      .eq("transaction_id", transactionId)
      // Manual claims usually arrive after the QR expired, so failed orders are flagged too.
      .in("status", ["Payment Pending", "Processing", "Payment Failed"])
      .is("bank_txn_id", null)

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: "🟡 PAYMENT NEEDS MANUAL RECONCILIATION",
            color: 0xFFB300,
            description:
              reason === "paid_before_order"
                ? "A customer's manual claim gave a bank reference for a payment made **before** this order was created. The order was **not** auto-fulfilled. Check in the Fonepay dashboard which order that payment was for, and fulfil manually only if it is genuinely this one."
                : "A bank payment with stripped remarks could not be matched to an order ID. The order was **not** auto-fulfilled. Verify in the bank dashboard and fulfil manually if it is genuine.",
            fields: [
              { name: "Order ID", value: transactionId, inline: true },
              { name: "Provider", value: provider.toUpperCase(), inline: true },
              { name: "Bank Ref", value: String(bankTxnId || "unknown"), inline: true },
              { name: "Paid Amount", value: `Rs. ${paidAmount ?? "unknown"}`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }]
        }),
      })
    }
  } catch (err: any) {
    console.error("[MANUAL REVIEW] Failed to flag order:", err)
  }
}

