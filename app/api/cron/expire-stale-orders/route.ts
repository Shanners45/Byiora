import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"

const PROXY_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"

/**
 * Cron job: Runs every 5 minutes.
 * 1. Find all "Payment Pending" transactions older than 5 minutes.
 * 2. For each: do ONE FINAL bank verification check.
 *    - If payment found → mark Completed, fulfill, send email.
 *    - If not found → mark Payment Failed.
 * 3. Discord alert for any suspicious expirations (had a validation_trace_id).
 * 
 * Also handles archiving: Move "Failed" orders older than 24h to "Archived".
 */
export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET || "dev-secret-key"
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const results = { expired: 0, recovered: 0, archived: 0, errors: 0 }

  try {
    // ============================================
    // PART 1: Expire stale "Payment Pending" orders (>5 min old)
    // ============================================
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: staleOrders, error: staleError } = await supabase
      .from("transactions")
      .select("*")
      .eq("status" as any, "Payment Pending")
      .lt("created_at", fiveMinAgo)

    if (staleError) {
      console.error("[CRON] Error fetching stale orders:", staleError)
    }

    for (const txn of (staleOrders || [])) {
      const typedTxn = txn as any

      // Skip if it already has a bank_txn_id (payment was received)
      if (typedTxn.bank_txn_id) continue

      // If it has a validation_trace_id, do ONE FINAL verification
      if (typedTxn.validation_trace_id && typedTxn.payment_category && typedTxn.payment_category !== "static") {
        try {
          const category = typedTxn.payment_category
          const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", category).single() as any

          if (credsRes.data) {
            const username = await decryptBankCredentials(credsRes.data.encrypted_username)
            const password = await decryptBankCredentials(credsRes.data.encrypted_password)

            if (username && password) {
              const PROXY_URL = category === "fonepay"
                ? (process.env.FONEPAY_PROXY_URL || "http://localhost:3002")
                : (process.env.PAYMENT_PROXY_URL || "http://localhost:3001")
              const endpoint = category === "nepalpay" ? "/api/verify-nepalpay-transaction" : "/api/verify-fonepay-transaction"

              const response = await fetch(`${PROXY_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-internal-secret": PROXY_SECRET },
                body: JSON.stringify({
                  nqrTxnId: typedTxn.validation_trace_id,
                  username,
                  password
                }),
              })

              const proxyData = await response.json()

              if (proxyData.success && proxyData.data?.status === "SUCCESS") {
                // PAYMENT FOUND! Recover the order
                console.log(`[CRON] 🎉 RECOVERED payment for ${txn.transaction_id}`)

                const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/webhooks/qstash`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-internal-secret": INTERNAL_SECRET
                  },
                  body: JSON.stringify({
                    transactionId: txn.transaction_id,
                    validationTraceId: typedTxn.validation_trace_id,
                    provider: category,
                    bankTxnId: proxyData.data.bankTxnId || proxyData.data.txnId,
                    internalTrigger: true
                  })
                })

                results.recovered++
                continue // Don't expire this one
              }
            }
          }
        } catch (e) {
          console.error(`[CRON] Error verifying ${txn.transaction_id}:`, e)
          results.errors++
        }

        // Payment not found but had a trace_id — suspicious, send Discord alert
        if (process.env.DISCORD_WEBHOOK_URL) {
          try {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                embeds: [{
                  title: "⚠️ ORDER EXPIRED WITH QR TRACE",
                  color: 0xFFA726,
                  description: "This order had a QR code generated but no payment was detected. User may have paid but verification failed.",
                  fields: [
                    { name: "Transaction ID", value: txn.transaction_id, inline: true },
                    { name: "Product", value: txn.product_name, inline: true },
                    { name: "Amount", value: `Rs. ${txn.price}`, inline: true },
                    { name: "Email", value: txn.user_email, inline: false },
                    { name: "Trace ID", value: typedTxn.validation_trace_id, inline: false }
                  ],
                  timestamp: new Date().toISOString()
                }]
              })
            })
          } catch (e) {}
        }
      }

      // Mark as Payment Failed
      await supabase.from("transactions").update({
        status: "Payment Failed",
        failure_remarks: "QR code expired without payment confirmation"
      } as any).eq("transaction_id", txn.transaction_id)

      results.expired++
    }

    // ============================================
    // PART 2: Archive "Failed" orders older than 24 hours
    // ============================================
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: failedOrders, error: failedError } = await supabase
      .from("transactions")
      .select("transaction_id")
      .eq("status", "Failed")
      .lt("updated_at", twentyFourHoursAgo)

    if (!failedError && failedOrders) {
      for (const order of failedOrders) {
        await supabase.from("transactions").update({
          status: "Archived"
        } as any).eq("transaction_id", order.transaction_id)
        results.archived++
      }
    }

    // ============================================
    // PART 3: Archive "Payment Failed" orders older than 24 hours
    // ============================================
    const { data: expiredOrders, error: expiredError } = await supabase
      .from("transactions")
      .select("transaction_id")
      .eq("status" as any, "Payment Failed")
      .lt("updated_at", twentyFourHoursAgo)

    if (!expiredError && expiredOrders) {
      for (const order of expiredOrders) {
        await supabase.from("transactions").update({
          status: "Archived"
        } as any).eq("transaction_id", order.transaction_id)
        results.archived++
      }
    }

    console.log(`[CRON] Results: ${results.recovered} recovered, ${results.expired} expired, ${results.archived} archived, ${results.errors} errors`)

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("[CRON] Fatal error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
