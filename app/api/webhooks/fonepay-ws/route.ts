import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import crypto from "crypto"

/**
 * Decrypt an inventory code using the INVENTORY_ENCRYPTION_KEY.
 * Inline here to avoid importing server-action with headers() dependency.
 */
function decryptInventoryCodeSync(encryptedBlob: string): string | null {
  try {
    const key = process.env.INVENTORY_ENCRYPTION_KEY
    if (!key) return null

    const parts = encryptedBlob.split(":")
    if (parts.length !== 3) return null

    const [ivHex, authTagHex, ciphertext] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return null
  }
}

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
    const { transactionId, validationTraceId, provider, event } = body

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transactionId" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    if (event === "QR_SCANNED") {
      console.log(`[FONEPAY-WS] Marking ${transactionId} as Processing (QR Scanned)...`)
      await supabase.from("transactions").update({
        status: "Processing",
        failure_remarks: "QR Scanned (Payment Verifying...)"
      } as any).eq("transaction_id", transactionId)
      return NextResponse.json({ success: true, message: "Marked as Processing" }, { status: 200 })
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
            cache: 'no-store'
          })

          const verifyData = await response.json()
          if (verifyData.success && verifyData.data?.status === "SUCCESS") {
            resolvedBankTxnId = verifyData.data.bankTxnId || verifyData.data.txnId || null
          }
        }
      }
    } catch (e: any) {
      console.error(`[FONEPAY-WS] Verification fetch failed:`, e.message)
      // Continue anyway — the WebSocket VERIFIED message is authoritative
    }

    // 3. Mark as Paid
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
        decryptedCode = decryptInventoryCodeSync(deliveredCode as string)

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
