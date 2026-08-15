"use server"

import { verifyTurnstileToken } from "@/lib/captcha"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { decryptBankCredentials } from "./payment-credentials"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

// Rate limit for polling (30 req/min)
let ratelimit: Ratelimit | null = null
// Strict rate limit for QR generation (3 per 10 min per IP)
let qrRatelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "byiora:poll",
  })
  qrRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(6, "10 m"),
    prefix: "byiora:qr-gen",
  })
}

// Unified Payment Proxy URL (serves both NepalPay and Fonepay)
const PAYMENT_PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
const PROXY_SECRET = process.env.INTERNAL_API_SECRET!
if (!PROXY_SECRET) {
  throw new Error("INTERNAL_API_SECRET environment variable is not set")
}

const QR_EXPIRY_MINUTES = 5

function getProxyEndpoints(category: string) {
  if (category === "fonepay") {
    return { qr: "/api/trigger-fonepay-qr", verify: "/api/verify-fonepay-transaction" }
  }
  return { qr: "/api/trigger-nepalpay-qr", verify: "/api/verify-nepalpay-transaction" }
}

/**
 * Gets or generates a QR code payload for a transaction.
 * Uses payment_methods.category from DB instead of name string matching.
 */
export async function getOrGenerateQRAction(transactionId: string) {
  try {
    const supabase = createServiceRoleClient()

    // SECURITY: Rate limit QR generation (6 per 10 min per IP)
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
    if (qrRatelimit) {
      const { success } = await qrRatelimit.limit(`qr-gen:${ip}`)
      if (!success) {
        // Clean up the abandoned transaction row so it doesn't clutter the DB
        await supabase.from("transactions").delete().eq("transaction_id", transactionId)
        return { success: false, error: "Too many payment requests. Please wait a few minutes and try again." }
      }
    }

    // 1. Fetch transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found" }
    }

    // SECURITY: For registered users, verify the session user owns this transaction
    if (txn.user_id) {
      const { createClient } = await import("@/lib/supabase/server")
      const userSupabase = await createClient()
      const { data: { user } } = await userSupabase.auth.getUser()
      if (!user || user.id !== txn.user_id) {
        return { success: false, error: "Unauthorized" }
      }
    }

    // 1b. INDUSTRY STANDARD STATE MACHINE: If order is Paid, Completed, or has bank_txn_id, NEVER expire or fail
    if (txn.status === "Completed" || txn.status === "Paid" || txn.bank_txn_id) {
      const resolvedStatus = (txn.status === "Payment Failed" && txn.bank_txn_id) ? "Paid" : txn.status
      return { 
        success: true, 
        status: resolvedStatus, 
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        amount: txn.price,
        price: txn.price
      }
    }

    const currentStatus = txn.status as string;
    if (["Failed", "Cancelled", "Payment Failed", "Refunded"].includes(currentStatus)) {
      return { 
        success: false, 
        error: `Transaction is ${currentStatus.toLowerCase()}`, 
        status: currentStatus, 
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        amount: txn.price,
        price: txn.price
      }
    }

    const typedTxn = txn as any;

    // 2. Get payment method category from DB
    const { data: methodData } = await supabase
      .from("payment_methods")
      .select("category, name")
      .eq("name", txn.payment_method)
      .single()

    const paymentCategory = (methodData as any)?.category || typedTxn.payment_category || "static"
    const paymentMethodName = (methodData as any)?.name || txn.payment_method

    // 3. Static payment — return static QR
    if (paymentCategory === "static") {
      const { data: staticMethod } = await supabase
        .from("payment_methods")
        .select("qr_url, instructions")
        .eq("name", txn.payment_method)
        .single()

      return {
        success: true,
        isStatic: true,
        staticQrUrl: (staticMethod as any)?.qr_url,
        instructions: (staticMethod as any)?.instructions,
        amount: txn.price,
        price: txn.price,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        paymentMethodName,
        paymentCategory,
        isGuest: !txn.user_id
      }
    }

    // 3b. Khalti uses redirect-based payment, not QR — shouldn't be on checkout page
    if (paymentCategory === "khalti") {
      if ((txn.status as string) === "Paid" || (txn.status as string) === "Completed") {
        return { 
          success: false, 
          error: "Transaction is already completed", 
          status: "Completed", 
          isGuest: !txn.user_id,
          product: txn.product_name,
          productName: txn.product_name,
          denomination: txn.amount,
          amount: txn.price,
          price: txn.price
        }
      }
      return { 
        success: false, 
        error: "This order is no longer active", 
        status: txn.status,
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        amount: txn.price,
        price: txn.price
      }
    }

    // 4. Dynamic payment — check cached QR (less than 5 mins old)
    if (typedTxn.qr_payload && typedTxn.validation_trace_id) {
      const qrAge = (new Date().getTime() - new Date(typedTxn.updated_at).getTime()) / 1000 / 60
      if (qrAge < (QR_EXPIRY_MINUTES - 1)) {
        return {
          success: true,
          qrString: typedTxn.qr_payload,
          validationTraceId: typedTxn.validation_trace_id,
          amount: txn.price,
          product: txn.product_name,
          denomination: txn.amount,
          expiresIn: Math.floor(QR_EXPIRY_MINUTES * 60 - qrAge * 60),
          paymentMethodName,
          paymentCategory,
          isGuest: !txn.user_id,
          status: txn.status,
          failureRemarks: txn.failure_remarks
        }
      }

      // SECURITY: One-shot QR lock — QR existed but is expired. Lock the order permanently ONLY IF UNPAID.
      // Database atomic guard: Never overwrite if status is Paid/Completed or if bank_txn_id exists
      await supabase
        .from("transactions")
        .update({
          status: "Payment Failed",
          failure_remarks: "QR code expired (server-side enforcement)",
          encrypted_checkout_data: null
        } as any)
        .eq("transaction_id", transactionId)
        .in("status", ["Payment Pending", "Processing"])
        .is("bank_txn_id", null)

      return { 
        success: false, 
        error: "Payment session expired", 
        status: "Payment Failed", 
        isGuest: !txn.user_id,
        productName: txn.product_name,
        amount: txn.amount,
        price: txn.price
      }
    }

    // 5. Generate fresh QR via proxy
    const credsRes = await supabase
      .from("payment_credentials")
      .select("*")
      .eq("provider", paymentCategory)
      .single() as any

    if (credsRes.error || !credsRes.data) {
      await supabase.from("transactions").delete().eq("transaction_id", transactionId)
      return { success: false, error: `${paymentCategory} credentials not configured by Admin` }
    }

    const username = await decryptBankCredentials(credsRes.data.encrypted_username)
    const password = await decryptBankCredentials(credsRes.data.encrypted_password)

    if (!username || !password) {
      await supabase.from("transactions").delete().eq("transaction_id", transactionId)
      return { success: false, error: "Failed to decrypt bank credentials" }
    }

    const proxyUrl = PAYMENT_PROXY_URL
    const endpoints = getProxyEndpoints(paymentCategory)

    const proxyPayload: any = {
      username,
      password,
      amount: Math.round(parseFloat(String(txn.price).replace(/,/g, ''))),
      remarks: transactionId,
      transactionId: transactionId // Pass our internal ID so the proxy can identify the WS callback
    }

    // Use globally cached token from Redis if available
    let redisClient: Redis | null = null
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
      try {
        const cachedToken = await redisClient.get<string>(`payment_token:${paymentCategory}`)
        if (cachedToken) {
          proxyPayload.token = cachedToken
        }
      } catch (e) {
        console.error("Redis token fetch error:", e)
      }
    }

    // Fallback to transaction-level token if needed
    if (!proxyPayload.token && typedTxn.cached_token) {
      proxyPayload.token = typedTxn.cached_token
    }

    console.log(`[QR GENERATION] Triggering proxy for ${transactionId} via ${paymentCategory}...`)

    const tryGenerateQR = async (payload: any) => {
      const resp = await fetch(`${proxyUrl}${endpoints.qr}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": PROXY_SECRET
        },
        body: JSON.stringify(payload),
        cache: 'no-store'
      })
      return await resp.json()
    }

    let proxyData = await tryGenerateQR(proxyPayload)

    // If it failed and we used a token, maybe the token was invalid/expired. Try again without token.
    if (!proxyData.success && proxyPayload.token) {
      console.log(`[QR GENERATION] Token might be expired, retrying without token...`)
      delete proxyPayload.token
      proxyData = await tryGenerateQR(proxyPayload)
    }

    if (!proxyData.success) {
      // Clean up the abandoned transaction row so it doesn't clutter the DB
      await supabase.from("transactions").delete().eq("transaction_id", transactionId)
      return { success: false, error: proxyData.message || "Proxy failed to generate QR" }
    }

    // Save the new token to Redis if proxy returned one
    if (proxyData.token && redisClient && proxyData.token !== proxyPayload.token) {
      try {
        // Cache for 48 hours based on NepalPay session lifetimes
        await redisClient.set(`payment_token:${paymentCategory}`, proxyData.token, { ex: 60 * 60 * 48 })
      } catch (e) {
        console.error("Redis token save error:", e)
      }
    }

    // 6. Cache QR in database
    await supabase.from("transactions").update({
      qr_payload: proxyData.qrString,
      validation_trace_id: proxyData.validationTraceId,
      payment_category: paymentCategory,
      updated_at: new Date().toISOString()
    } as any).eq("transaction_id", transactionId)

    // 7. Schedule QStash Webhook if available
    if (process.env.QSTASH_TOKEN && process.env.QSTASH_URL) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

      // 7a. Background payment polling (retries every 15s, up to 10 times)
      // Runs for all dynamic QR payments (NepalPay & Fonepay) as a reliable polling fallback
      if (paymentCategory !== "static" && proxyData.validationTraceId) {
        try {
          const webhookUrl = `${siteUrl}/api/webhooks/qstash`
          await fetch(`${process.env.QSTASH_URL}/v2/publish/${webhookUrl}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
              "Content-Type": "application/json",
              "Upstash-Retries": "10",
              "Upstash-Delay": "15s",
            },
            body: JSON.stringify({
              transactionId,
              validationTraceId: proxyData.validationTraceId,
              provider: paymentCategory
            })
          })
          console.log(`[QSTASH] Scheduled background polling for ${transactionId} (${paymentCategory})`)
        } catch (e) {
          console.error("Failed to schedule QStash polling:", e)
        }
      }

      // 7b. Guaranteed expiry fallback — fires once after 6 minutes
      // This ensures stale orders get cleaned up even if the user closes their browser
      try {
        const cronUrl = `${siteUrl}/api/cron/expire-stale-orders`
        const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
        await fetch(`${process.env.QSTASH_URL}/v2/publish/${cronUrl}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
            "Content-Type": "application/json",
            "Upstash-Delay": "360s",   // 6 minutes — 1 min buffer after the 5-min QR expiry
            "Upstash-Retries": "2",
            "Upstash-Method": "GET",
            "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({})
        })
        console.log(`[QSTASH] Scheduled expiry fallback for ${transactionId} in 6 minutes`)
      } catch (e) {
        console.error("Failed to schedule QStash expiry fallback:", e)
      }
    }

    return {
      success: true,
      qrString: proxyData.qrString,
      validationTraceId: proxyData.validationTraceId,
      amount: txn.price,
      product: txn.product_name,
      denomination: txn.amount,
      expiresIn: QR_EXPIRY_MINUTES * 60,
      paymentMethodName,
      paymentCategory,
      isGuest: !txn.user_id,
      status: txn.status,
      failureRemarks: txn.failure_remarks
    }

  } catch (error: any) {
    console.error("QR Generation error:", error)
    return { success: false, error: error.message || "Failed to generate QR" }
  }
}

/**
 * Checks payment status via Proxy server
 */
export async function verifyPaymentAction(transactionId: string, validationTraceId: string, provider: string) {
  try {
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1"
    if (ratelimit) {
      const { success } = await ratelimit.limit(`verify-payment:${ip}`)
      if (!success) {
        return { success: false, rateLimited: true, message: "Rate limit exceeded" }
      }
    }

    const supabase = createServiceRoleClient()

    // Ensure it's not already completed
    const { data: txn } = await supabase.from("transactions").select("status, price").eq("transaction_id", transactionId).single()
    if (txn && txn.status === "Completed") {
      return { success: true, completed: true }
    }

    const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", provider).single() as any
    if (!credsRes.data) return { success: false, error: "Credentials missing" }

    const username = await decryptBankCredentials(credsRes.data.encrypted_username)
    const password = await decryptBankCredentials(credsRes.data.encrypted_password)

    if (!username || !password) return { success: false, error: "Failed to decrypt bank credentials" }

    const proxyUrl = PAYMENT_PROXY_URL
    const endpoints = getProxyEndpoints(provider)

    const response = await fetch(`${proxyUrl}${endpoints.verify}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": PROXY_SECRET
      },
      body: JSON.stringify({
        nqrTxnId: validationTraceId,
        username,
        password
      }),
      cache: 'no-store'
    })

    const proxyData = await response.json()

    if (proxyData.success && proxyData.data?.status === "SUCCESS") {
      // SECURITY: Validate paid amount matches order amount (anti-underpayment fraud)
      const rawPaidAmount = proxyData.data.raw?.amount || proxyData.data.raw?.transactionAmount
      if (rawPaidAmount && txn?.price) {
        const paidAmount = parseInt(rawPaidAmount)
        const expectedAmount = Math.round(parseFloat(String(txn.price).replace(/,/g, '')))
        if (paidAmount > 0 && paidAmount < expectedAmount) {
          console.error(`[VERIFY FRAUD ALERT] Amount mismatch for ${transactionId}: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`)
          await supabase.from("transactions").update({
            status: "Payment Failed",
            failure_remarks: `Amount discrepancy: Expected Rs. ${expectedAmount}, received Rs. ${paidAmount}`
          } as any).eq("transaction_id", transactionId)
          return { success: false, error: "Amount mismatch detected" }
        }
      }

      const host = headersList.get("host") || "localhost:3000"
      const protocol = host.includes("localhost") ? "http" : "https"
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

      const fulfillRes = await fetch(`${siteUrl}/api/webhooks/qstash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": PROXY_SECRET
        },
        body: JSON.stringify({
          transactionId,
          validationTraceId,
          provider,
          bankTxnId: proxyData.data.bankTxnId || proxyData.data.txnId,
          internalTrigger: true
        })
      })

      if (fulfillRes.ok) {
        // Fetch the final status set by the webhook
        const { data: finalTxn } = await supabase.from("transactions").select("status").eq("transaction_id", transactionId).single()
        return { success: true, completed: true, status: finalTxn?.status || "Completed" }
      }
    }

    return { success: false, completed: false }
  } catch (error: any) {
    console.error("Verify payment error:", error)
    return { success: false, error: error.message || "Verification failed" }
  }
}

/**
 * User-initiated payment verification using their phone number.
 * Server-side only — searches NepalPay/Fonepay transaction list by phone + amount + remarks.
 * Used when QR expires but user believes they already paid.
 */
export async function verifyPaymentByPhoneAction(transactionId: string, phoneNumber: string, captchaToken?: string) {
  try {
    // Rate limit
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1"
    if (ratelimit) {
      const { success } = await ratelimit.limit(`phone-verify:${ip}`)
      if (!success) {
        return { success: false, error: "Too many attempts. Please wait a moment." }
      }
    }

    // Captcha validation
    if (!captchaToken) {
      return { success: false, error: "Security check required" }
    }
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, ip)
    if (!isCaptchaValid) {
      return { success: false, error: "Security validation failed" }
    }

    // Validate phone
    const cleanPhone = phoneNumber.replace(/\D/g, "")
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { success: false, error: "Invalid phone number" }
    }

    const supabase = createServiceRoleClient()

    // Fetch the transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found" }
    }

    // Only allow verification on unpaid/pending/failed transactions within 24 hours
    if (txn.status === "Completed" || txn.status === "Paid") {
      return { success: true, alreadyCompleted: true }
    }
    const createdAtTime = new Date(txn.created_at).getTime()
    const isWithin24Hours = Date.now() - createdAtTime <= 24 * 60 * 60 * 1000
    if (!isWithin24Hours) {
      return { success: false, error: "Payment verification window (24 hours) has expired for this transaction." }
    }
    if (!["Payment Failed", "Payment Pending", "Processing"].includes(txn.status as string)) {
      return { success: false, error: "This transaction is no longer eligible for verification" }
    }

    const typedTxn = txn as any
    const paymentCategory = typedTxn.payment_category || "nepalpay"

    if (paymentCategory === "static") {
      return { success: false, error: "Phone verification is only available for NepalPay/Fonepay payments" }
    }

    // Get credentials
    const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", paymentCategory).single() as any
    if (!credsRes.data) return { success: false, error: "Payment provider credentials not found" }

    const username = await decryptBankCredentials(credsRes.data.encrypted_username)
    const password = await decryptBankCredentials(credsRes.data.encrypted_password)
    if (!username || !password) return { success: false, error: "Decryption failed" }

    // Call proxy to get transaction list and search by phone + amount + remarks
    const proxyUrl = PAYMENT_PROXY_URL
    const endpoints = getProxyEndpoints(paymentCategory)

    const response = await fetch(`${proxyUrl}${endpoints.verify}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": PROXY_SECRET
      },
      body: JSON.stringify({
        nqrTxnId: typedTxn.validation_trace_id || "",
        username,
        password,
        // Extra fields for phone-based matching
        phoneNumber: cleanPhone,
        amount: parseInt(txn.price),
        remarks: transactionId
      }),
      cache: 'no-store'
    })

    const proxyData = await response.json()

    if (proxyData.success && proxyData.data?.status === "SUCCESS") {
      // Payment found! Fulfill the order
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${(await headers()).get("host") || "localhost:3000"}`

      const fulfillRes = await fetch(`${siteUrl}/api/webhooks/qstash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": PROXY_SECRET
        },
        body: JSON.stringify({
          transactionId,
          validationTraceId: typedTxn.validation_trace_id,
          provider: paymentCategory,
          bankTxnId: proxyData.data.bankTxnId || proxyData.data.txnId,
          internalTrigger: true
        })
      })

      if (fulfillRes.ok) {
        return { success: true, verified: true }
      } else {
        const errorText = await fulfillRes.text()
        console.error("Webhook fulfillment failed:", errorText)
        return { success: false, error: "Internal error processing the payment" }
      }
    }

    return {
      success: false,
      error: "No matching payment found."
    }
  } catch (error: any) {
    console.error("Phone verification error:", error)
    return { success: false, error: "Verification failed. Please try again." }
  }
}

/**
 * Fallback to explicitly fail a transaction if the frontend timer reaches 0.
 * This is primarily for immediate feedback locally since QStash/Cron might not fire immediately.
 */
export async function expireTransactionAction(transactionId: string) {
  try {
    const supabase = createServiceRoleClient()

    // SECURITY: Verify ownership — only the transaction's owner can trigger expiry
    const { createClient } = await import("@/lib/supabase/server")
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    // Verify it is still in an unpaid state (Payment Pending or Processing for dynamic QR) and NO payment received
    const { data: txn } = await supabase.from("transactions").select("*").eq("transaction_id", transactionId).single()
    if (!txn || !["Payment Pending", "Processing"].includes(txn.status as string) || (txn as any).payment_category === "static" || txn.bank_txn_id) {
      return { success: false }
    }

    // For registered users, verify the authenticated user owns this transaction
    if (txn.user_id && (!user || user.id !== txn.user_id)) {
      return { success: false, error: "Unauthorized" }
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "Payment Failed",
        failure_remarks: "QR code expired without payment confirmation (Client Timeout)",
        encrypted_checkout_data: null
      } as any)
      .eq("transaction_id", transactionId)
      .in("status", ["Payment Pending", "Processing"])
      .is("bank_txn_id", null)

    if (updateError) return { success: false }

    // Send Payment Failed Email
    const { sendOrderPlacedEmail } = await import("@/lib/email/resend")
    const { generateGuestVerificationToken } = await import("@/app/actions/checkout-encryption")

    let userName = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = userData.name
    } else if ((txn as any).guest_user_data && (txn as any).guest_user_data.name) {
      userName = (txn as any).guest_user_data.name
    }

    let customMsg = "We noticed your payment session expired and your order has been marked as <strong>Payment Failed</strong>."
    let actionBtn: { label: string; url: string; subtext?: string } | undefined = undefined

    // Add verification button below order summary for dynamic QR payments
    const isDynamic = (txn as any).payment_category === "nepalpay" || (txn as any).payment_category === "fonepay"
    if (isDynamic) {
      if (txn.user_id) {
        customMsg += "<br/><br/>If you have already paid but your order timed out, you can securely verify your payment from your Transaction History."
        actionBtn = {
          label: "Verify in Transaction History",
          url: "https://www.byiora.com.np/transactions",
          subtext: "Click the Verify Payment button next to this order within 24 hours."
        }
      } else {
        // Guest user logic with magic link
        const rawToken = await generateGuestVerificationToken(transactionId)
        const token = encodeURIComponent(rawToken)
        customMsg += "<br/><br/>If you have already paid but your order timed out, please click the secure link below to verify your payment and fulfill your order."
        actionBtn = {
          label: "Verify Payment Securely",
          url: `https://www.byiora.com.np/verify-guest?token=${token}`,
          subtext: "This secure link will expire in exactly 24 hours."
        }
      }
    }

    try {
      await sendOrderPlacedEmail({
        email: txn.user_email,
        userName: userName,
        productName: txn.product_name,
        denomination: txn.amount,
        transactionId: transactionId,
        price: txn.price,
        paymentMethod: txn.payment_method,
        isGuest: !txn.user_id,
        status: "Payment Failed",
        customMessage: customMsg,
        subjectOverride: `Order Failed: ${txn.product_name}`,
        actionButton: actionBtn
      })
    } catch (e) {
      console.error("Failed to send failed email:", e)
    }

    return { success: true }
  } catch (error) {
    console.error("Expire transaction error:", error)
    return { success: false }
  }
}

/**
 * Explicitly cancel a transaction by the user.
 */
export async function cancelTransactionAction(transactionId: string) {
  try {
    const supabase = createServiceRoleClient()

    const { data: txn } = await supabase.from("transactions").select("*").eq("transaction_id", transactionId).single()
    if (!txn || !["Payment Pending", "Processing"].includes(txn.status as string) || txn.bank_txn_id) {
      return { success: false, error: "Cannot cancel this transaction" }
    }

    // SECURITY: Verify ownership — only the transaction's owner can cancel
    if (txn.user_id) {
      const { createClient } = await import("@/lib/supabase/server")
      const userSupabase = await createClient()
      const { data: { user } } = await userSupabase.auth.getUser()
      if (!user || user.id !== txn.user_id) {
        return { success: false, error: "Unauthorized" }
      }
    }

    const { error: cancelError } = await supabase
      .from("transactions")
      .update({
        status: "Payment Failed",
        failure_remarks: "Cancelled by user",
        encrypted_checkout_data: null
      } as any)
      .eq("transaction_id", transactionId)
      .in("status", ["Payment Pending", "Processing"])
      .is("bank_txn_id", null)

    if (cancelError) return { success: false, error: "Could not cancel transaction" }

    // --- Send Cancellation Email ---
    const { sendOrderPlacedEmail } = await import("@/lib/email/resend")

    let userName = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = userData.name
    } else if ((txn as any).guest_user_data && (txn as any).guest_user_data.name) {
      userName = (txn as any).guest_user_data.name
    }

    const customMsg = "You have cancelled your order for <strong>" + txn.product_name + "</strong>."

    try {
      await sendOrderPlacedEmail({
        email: txn.user_email,
        userName: userName,
        productName: txn.product_name,
        denomination: txn.amount,
        transactionId: transactionId,
        price: txn.price,
        paymentMethod: txn.payment_method,
        isGuest: !txn.user_id,
        status: "Order Cancelled",
        customMessage: customMsg,
        subjectOverride: `Order Cancelled: ${txn.product_name}`
      })
    } catch (e) {
      console.error("Failed to send cancellation email:", e)
    }

    return { success: true }
  } catch (error) {
    console.error("Cancel transaction error:", error)
    return { success: false, error: "An error occurred while cancelling" }
  }
}
