import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "@/app/actions/payment-credentials"

const PROXY_SECRET = process.env.INTERNAL_API_SECRET!
if (!PROXY_SECRET) {
  throw new Error("INTERNAL_API_SECRET environment variable is not set")
}

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
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  
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

      // Khalti secure link stays active for 2 hours (120 minutes)
      const isKhaltiTxn = typedTxn.payment_category === "khalti" || typedTxn.payment_method?.toLowerCase().includes("khalti")
      if (isKhaltiTxn) {
        const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).getTime()
        const createdAtTime = new Date(typedTxn.created_at).getTime()
        if (createdAtTime > twoHoursAgo) {
          // Still active within 2 hour window — do not expire yet
          continue
        }
      }

      let recovered = false

      // If it has a validation_trace_id, do ONE FINAL verification
      if (typedTxn.validation_trace_id && typedTxn.payment_category && typedTxn.payment_category !== "static") {
        try {
          const category = typedTxn.payment_category
          const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", category).single() as any

          if (credsRes.data) {
            const username = await decryptBankCredentials(credsRes.data.encrypted_username)
            const password = await decryptBankCredentials(credsRes.data.encrypted_password)

            if (username && password) {
              const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
              const endpoint = category === "nepalpay" ? "/api/verify-nepalpay-transaction" : "/api/verify-fonepay-transaction"

              try {
                const response = await fetch(`${PROXY_URL}${endpoint}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-internal-secret": PROXY_SECRET },
                  body: JSON.stringify({
                    nqrTxnId: typedTxn.validation_trace_id,
                    username,
                    password
                  }),
                  signal: AbortSignal.timeout(8000) // 8 second timeout to avoid hanging
                })

                const proxyData = await response.json()

                if (proxyData.success && proxyData.data?.status === "SUCCESS") {
                  // PAYMENT FOUND! Recover the order
                  console.log(`[CRON] 🎉 RECOVERED payment for ${txn.transaction_id}`)

                  const INTERNAL_SECRET = PROXY_SECRET
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
                  recovered = true
                }
              } catch (fetchErr) {
                // Proxy server is unreachable (ECONNREFUSED) or timed out — this is expected if proxy is down
                console.warn(`[CRON] Proxy unreachable for ${txn.transaction_id}, skipping verification and marking as failed.`)
                results.errors++
              }
            }
          }
        } catch (e) {
          console.error(`[CRON] Error during credential lookup for ${txn.transaction_id}:`, e)
          results.errors++
        }

        // Discord alert for orders that had a QR trace but no payment found
        if (!recovered && process.env.DISCORD_WEBHOOK_URL) {
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
                    { name: "Order ID", value: txn.transaction_id, inline: true },
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

      // If payment was recovered, skip marking as failed
      if (recovered) continue

      // Mark as Payment Failed
      await supabase.from("transactions").update({
        status: "Payment Failed",
        failure_remarks: "QR code expired without payment confirmation"
      } as any).eq("transaction_id", txn.transaction_id)

      // Send Payment Failed email for nepalpay and fonepay
      if (typedTxn.payment_category === "nepalpay" || typedTxn.payment_category === "fonepay") {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          const userName = typedTxn.guest_user_data?.name || typedTxn.user_email?.split('@')[0] || "Customer"
          await fetch(`${siteUrl}/api/send-order-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-secret": PROXY_SECRET },
            body: JSON.stringify({
              email: typedTxn.user_email,
              userName: userName,
              productName: typedTxn.product_name,
              denomination: typedTxn.amount,
              status: "Payment Failed",
              transactionId: typedTxn.transaction_id,
              remarks: "QR code expired without payment confirmation",
              isGuest: !typedTxn.user_id,
              isDynamic: true
            })
          })
        } catch (emailErr) {
          console.error(`[CRON] Failed to send Payment Failed email for ${txn.transaction_id}:`, emailErr)
        }
      }

      results.expired++
    }

    // ============================================
    // PART 2: Archive dead orders older than 24 hours
    // ============================================
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: deadOrders, error: deadError } = await supabase
      .from("transactions")
      .select("transaction_id")
      .in("status", ["Failed", "Payment Failed", "Cancelled"])
      .lt("updated_at", twentyFourHoursAgo)

    if (!deadError && deadOrders) {
      for (const order of deadOrders) {
        await supabase.from("transactions").update({
          status: "Archived"
        } as any).eq("transaction_id", order.transaction_id)
        results.archived++
      }
    }

    // ============================================
    // PART 3: Alert for static orders stuck in Processing > 48 hours
    // ============================================
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: stuckOrders, error: stuckError } = await supabase
      .from("transactions")
      .select("transaction_id, product_name, price, user_email, created_at")
      .eq("status", "Processing")
      .eq("payment_category", "static")
      .lt("created_at", fortyEightHoursAgo)

    if (!stuckError && stuckOrders && stuckOrders.length > 0 && process.env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "⏳ ORDERS STUCK IN PROCESSING",
              color: 0xEAB308, // Yellow
              description: `There are **${stuckOrders.length}** static order(s) waiting for manual fulfillment for over 48 hours!`,
              fields: stuckOrders.slice(0, 5).map(txn => ({
                name: `Order ID: ${txn.transaction_id}`,
                value: `${txn.product_name} - Rs. ${txn.price} (${txn.user_email})`,
                inline: false
              })),
              timestamp: new Date().toISOString()
            }]
          })
        })
      } catch (e) {}
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
