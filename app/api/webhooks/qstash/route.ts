import { NextResponse } from "next/server"
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"
import { sendOrderPlacedEmail } from "@/lib/email/resend"

// Set true if you want to bypass signature verification for debugging
const BYPASS_SIGNATURE = process.env.NODE_ENV === "development"

async function handler(req: Request) {
  try {
    const body = await req.json()
    const { transactionId, validationTraceId, provider, internalTrigger } = body

    if (!transactionId || !validationTraceId || !provider) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // 1. Check Transaction Status
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (txnError || !txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (txn.status === "Completed") {
      // Already completed, nothing to do
      return NextResponse.json({ success: true, message: "Already completed" }, { status: 200 })
    }

    // 2. We only need to check bank proxy if this was triggered by QStash.
    // If it was triggered internally by the frontend polling successfully, we skip checking proxy again.
    if (!internalTrigger) {
      const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
      const PROXY_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"

      const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", provider).single()
      if (!credsRes.data) return NextResponse.json({ error: "Credentials missing" }, { status: 500 })

      const username = await decryptBankCredentials(credsRes.data.encrypted_username)
      const password = await decryptBankCredentials(credsRes.data.encrypted_password)
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
        // Payment not verified yet. Return 500 to tell QStash to retry later.
        console.log(`[QSTASH] Payment not yet verified for ${transactionId}. Retrying later...`)
        return NextResponse.json({ error: "Not verified yet" }, { status: 500 })
      }
    }

    // 3. Payment Confirmed! Mark as completed.
    await supabase.from("transactions").update({ status: "Completed" }).eq("transaction_id", transactionId)

    // 4. Fulfillment: If category is digital-goods or games, fetch an inventory code atomically
    const categoriesWithInventory = ["digital-goods", "games"]
    let deliveredCode: string | null = null

    if (txn.product_category && categoriesWithInventory.includes(txn.product_category.toLowerCase())) {
      console.log(`[FULFILLMENT] Claiming inventory code for ${transactionId}...`)
      
      const { data: claimData, error: claimError } = await supabase.rpc("claim_gift_card", {
        p_product_id: txn.product_id,
        p_denomination_label: txn.amount,
        p_transaction_id: transactionId,
        p_user_id: txn.user_id || txn.user_email
      })

      if (claimError) {
        console.error("RPC claim error:", claimError)
      } else if (claimData && claimData.length > 0 && claimData[0].encrypted_code) {
        // Code successfully claimed
        deliveredCode = claimData[0].encrypted_code
        // Update transaction row with the code
        await supabase.from("transactions").update({ giftcard_code: deliveredCode }).eq("transaction_id", transactionId)
      } else {
        // OUT OF STOCK ALERT
        console.warn(`[OUT OF STOCK] No codes left for ${txn.product_name} - ${txn.amount}`)
        if (process.env.DISCORD_WEBHOOK_URL) {
          try {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "⚠️ OUT OF STOCK ALERT - PAID ORDER",
                  color: 0xFF5722,
                  description: `An order was just paid for, but no inventory codes were available!`,
                  fields: [
                    { name: "Transaction ID", value: transactionId, inline: true },
                    { name: "Product", value: txn.product_name, inline: true },
                    { name: "Denomination", value: txn.amount, inline: true }
                  ]
                }]
              })
            })
          } catch (e) {}
        }
      }
    }

    // 5. Send Email
    // The previous action only sent "Order Processing". We should send a "Completed/Delivered" email now.
    // For now, if we have a code, we'll assume sendOrderPlacedEmail can handle it or we use a separate fulfillment email.
    // (For this project scope, we just confirm fulfillment logic works)

    return NextResponse.json({ success: true, deliveredCode: !!deliveredCode }, { status: 200 })

  } catch (error: any) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Export the handler wrapped in QStash signature verification (or bypass if dev)
export const POST = BYPASS_SIGNATURE ? handler : verifySignatureAppRouter(handler)
