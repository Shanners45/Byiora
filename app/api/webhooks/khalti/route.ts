import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { sendOrderPlacedEmail, sendGiftcardCodeEmail } from "@/lib/email/resend"
import crypto from "crypto"

/**
 * Decrypt an inventory code using the INVENTORY_ENCRYPTION_KEY.
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pidx = searchParams.get("pidx")
  const purchase_order_id = searchParams.get("purchase_order_id")
  const status = searchParams.get("status")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (!pidx || !purchase_order_id) {
    return NextResponse.redirect(`${siteUrl}/?error=missing_params`)
  }

  try {
    const supabase = createServiceRoleClient()

    // 1. Fetch transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", purchase_order_id)
      .single()

    if (txnError || !txn) {
      console.error(`[KHALTI] Transaction not found: ${purchase_order_id}`)
      return NextResponse.redirect(`${siteUrl}/?error=txn_not_found`)
    }

    const isGuest = !txn.user_id
    const successRedirect = isGuest
      ? `${siteUrl}/?paid=success`
      : `${siteUrl}/transactions?paid=success`
    const failRedirect = isGuest
      ? `${siteUrl}/`
      : `${siteUrl}/transactions`

    // Already completed/paid? Redirect to success.
    if (txn.status === "Completed" || txn.status === "Paid") {
      return NextResponse.redirect(successRedirect)
    }

    // If Khalti sent back a cancelled/failed status in the query param, handle it immediately
    if (status === "User canceled") {
      await supabase
        .from("transactions")
        .update({
          status: "Payment Failed",
          failure_remarks: "Khalti: User canceled payment",
          updated_at: new Date().toISOString()
        } as any)
        .eq("transaction_id", purchase_order_id)
      return NextResponse.redirect(failRedirect)
    }

    // 2. Fetch Khalti credentials
    const credsRes = await supabase.from("payment_credentials").select("encrypted_username").eq("provider", "khalti").single() as any
    if (!credsRes.data || !credsRes.data.encrypted_username) {
      console.error(`[KHALTI] Credentials not found`)
      return NextResponse.redirect(failRedirect)
    }

    const secretKey = (await decryptBankCredentials(credsRes.data.encrypted_username))?.trim()
    if (!secretKey) {
      console.error(`[KHALTI] Failed to decrypt secret key`)
      return NextResponse.redirect(failRedirect)
    }

    // 3. Verify with Khalti Lookup API
    const isLive = secretKey.toLowerCase().startsWith("live_")
    const lookupUrl = isLive 
      ? "https://khalti.com/api/v2/epayment/lookup/" 
      : "https://dev.khalti.com/api/v2/epayment/lookup/"

    console.log(`[KHALTI] Verifying pidx=${pidx} for txn=${purchase_order_id}`)

    const authHeader = secretKey.startsWith("Key ") ? secretKey : `Key ${secretKey}`

    const makeLookupCall = async (targetUrl: string) => {
      const resp = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ pidx })
      })
      const data = await resp.json().catch(() => ({}))
      return { ok: resp.ok, status: resp.status, data }
    }

    let verifyRes = await makeLookupCall(lookupUrl)

    if (!verifyRes.ok && (verifyRes.status === 401 || verifyRes.status === 404)) {
      const alternateLookupUrl = lookupUrl.includes("dev.khalti.com")
        ? "https://khalti.com/api/v2/epayment/lookup/"
        : "https://dev.khalti.com/api/v2/epayment/lookup/"
      console.log(`[KHALTI LOOKUP] Retrying lookup with alternate URL: ${alternateLookupUrl}`)
      verifyRes = await makeLookupCall(alternateLookupUrl)
    }

    const verifyData = verifyRes.data
    console.log(`[KHALTI] Lookup response:`, verifyData.status, verifyData.transaction_id || verifyData.tidx || verifyData.idx)

    if (verifyData.status === "Completed") {
      const resolvedBankTxnId = verifyData.transaction_id || verifyData.tidx || verifyData.bank_txn_id || verifyData.idx || pidx

      // A. Mark as Paid in DB
      await supabase
        .from("transactions")
        .update({
          status: "Paid",
          validation_trace_id: pidx,
          bank_txn_id: resolvedBankTxnId,
          updated_at: new Date().toISOString()
        } as any)
        .eq("transaction_id", purchase_order_id)

      // B. Fulfillment: Claim inventory code if applicable (digital-goods / games)
      const categoriesWithInventory = ["digital-goods", "games"]
      let deliveredCode: string | null = null
      let decryptedCode: string | null = null

      if (txn.product_category && categoriesWithInventory.includes(txn.product_category.toLowerCase())) {
        console.log(`[KHALTI] Claiming inventory code for ${purchase_order_id}...`)

        const { data: claimData, error: claimError } = await supabase.rpc("claim_gift_card", {
          p_product_id: txn.product_id,
          p_denomination_label: txn.amount,
          p_transaction_id: purchase_order_id,
          p_user_id: txn.user_id || txn.user_email
        } as any)

        if (claimError) {
          console.error("[KHALTI] RPC claim error:", claimError)
        } else if (claimData && (claimData as any).length > 0 && (claimData as any)[0].encrypted_code) {
          deliveredCode = (claimData as any)[0].encrypted_code
          decryptedCode = decryptInventoryCodeSync(deliveredCode as string)

          if (decryptedCode) {
            await supabase.from("transactions").update({
              giftcard_code: decryptedCode,
              status: "Completed"
            } as any).eq("transaction_id", purchase_order_id)
          } else {
            console.error(`[KHALTI] Failed to decrypt code for ${purchase_order_id}`)
            await supabase.from("transactions").update({
              giftcard_code: deliveredCode
            } as any).eq("transaction_id", purchase_order_id)
          }
        } else {
          console.warn(`[KHALTI] No codes left for ${txn.product_name} - ${txn.amount}`)
        }
      }

      // C. Send Customer Email
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
            transactionId: purchase_order_id,
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
            transactionId: purchase_order_id,
            price: txn.price,
            paymentMethod: txn.payment_method,
            isGuest: !txn.user_id
          })
        }
      } catch (emailErr) {
        console.error("[KHALTI] Failed to send fulfillment email:", emailErr)
      }

      // D. Send Discord Notification
      if (process.env.DISCORD_WEBHOOK_URL) {
        try {
          const title = decryptedCode
            ? "✅ AUTO-FULFILLED (Khalti) - PAID ORDER"
            : "⚠️ MANUAL DELIVERY REQUIRED (Khalti) - PAID ORDER"
          const color = decryptedCode ? 0x4CAF50 : 0xFF5722

          await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title,
                color,
                fields: [
                  { name: "Order ID", value: purchase_order_id, inline: true },
                  { name: "Bank Txn ID", value: resolvedBankTxnId || "N/A", inline: true },
                  { name: "Product", value: txn.product_name, inline: false },
                  { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
                  { name: "Source", value: "Khalti Gateway", inline: true },
                ],
                timestamp: new Date().toISOString()
              }]
            })
          })
        } catch (e) {}
      }

      console.log(`[KHALTI] ✅ Successfully updated DB status to Paid/Completed for ${purchase_order_id}`)
      return NextResponse.redirect(successRedirect)

    } else if (verifyData.status === "Refunded" || verifyData.status === "Expired" || verifyData.status === "User canceled") {
      await supabase
        .from("transactions")
        .update({
          status: "Payment Failed",
          failure_remarks: `Khalti status: ${verifyData.status}`,
          updated_at: new Date().toISOString()
        } as any)
        .eq("transaction_id", purchase_order_id)
      return NextResponse.redirect(failRedirect)

    } else if (verifyData.status === "Pending" || verifyData.status === "Initiated") {
      return NextResponse.redirect(failRedirect)
    }

    console.warn(`[KHALTI] Unknown status: ${verifyData.status}`)
    return NextResponse.redirect(failRedirect)

  } catch (error: any) {
    console.error("[KHALTI] Callback error:", error)
    return NextResponse.redirect(`${siteUrl}/`)
  }
}
