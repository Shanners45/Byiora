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

function getProxyUrl(_category: string) {
  return PAYMENT_PROXY_URL
}

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

    if (txn.status === "Completed") {
      return { 
        success: false, 
        error: "Transaction is already completed", 
        status: "Completed", 
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        amount: txn.amount,
        price: txn.price
      }
    }

    const currentStatus = txn.status as string;
    if (["Failed", "Cancelled", "Payment Failed", "Archived", "Refunded"].includes(currentStatus)) {
      return { 
        success: false, 
        error: `Transaction is ${currentStatus.toLowerCase()}`, 
        status: currentStatus, 
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
        amount: txn.amount,
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
        product: txn.product_name,
        denomination: txn.amount,
        paymentMethodName,
        paymentCategory,
        isGuest: !txn.user_id
      }
    }

    // 3b. Khalti uses redirect-based payment, not QR — shouldn't be on checkout page
    if (paymentCategory === "khalti") {
      if ((txn.status as string) === "Paid" || (txn.status as string) === "Completed") {
        return { success: false, error: "Transaction is already completed", status: "Completed", isGuest: !txn.user_id }
      }
      return { 
        success: false, 
        error: "This order is no longer active", 
        isGuest: !txn.user_id 
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
          isGuest: !txn.user_id
        }
      }

      // SECURITY: One-shot QR lock — QR existed but is expired. Lock the order permanently.
      // This prevents infinite QR regeneration via page refresh.
      await supabase.from("transactions").update({
        status: "Payment Failed",
        failure_remarks: "QR code expired (server-side enforcement)"
      } as any).eq("transaction_id", transactionId)
      return { 
        success: false, 
        error: "Payment session expired", 
        status: "Payment Failed", 
        isGuest: !txn.user_id,
        product: txn.product_name,
        productName: txn.product_name,
        denomination: txn.amount,
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

    const proxyUrl = getProxyUrl(paymentCategory)
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
      // Skip for Fonepay — the proxy's WebSocket handles real-time verification
      if (paymentCategory !== "fonepay") {
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
          console.log(`[QSTASH] Scheduled background polling for ${transactionId}`)
        } catch (e) {
          console.error("Failed to schedule QStash polling:", e)
        }
      } else {
        console.log(`[FONEPAY] Skipping QStash polling for ${transactionId} — WebSocket handles verification`)
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
      isGuest: !txn.user_id
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
    const { data: txn } = await supabase.from("transactions").select("status").eq("transaction_id", transactionId).single()
    if (txn && txn.status === "Completed") {
      return { success: true, completed: true }
    }

    const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", provider).single() as any
    if (!credsRes.data) return { success: false, error: "Credentials missing" }

    const username = await decryptBankCredentials(credsRes.data.encrypted_username)
    const password = await decryptBankCredentials(credsRes.data.encrypted_password)

    if (!username || !password) return { success: false, error: "Failed to decrypt bank credentials" }

    const proxyUrl = getProxyUrl(provider)
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
      // Payment found! Call the webhook to fulfill
      const INTERNAL_SECRET = PROXY_SECRET
      const host = headersList.get("host") || "localhost:3000"
      const protocol = host.includes("localhost") ? "http" : "https"
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

      const fulfillRes = await fetch(`${siteUrl}/api/webhooks/qstash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET
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

    // Only allow verification on Payment Failed transactions
    if (txn.status === "Completed" || txn.status === "Paid") {
      return { success: true, alreadyCompleted: true }
    }
    if ((txn.status as string) !== "Payment Failed") {
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
    const proxyUrl = getProxyUrl(paymentCategory)
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
      const INTERNAL_SECRET = PROXY_SECRET
      const headersList = await headers()
      const host = headersList.get("host") || "localhost:3000"
      const protocol = host.includes("localhost") ? "http" : "https"
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

      const fulfillRes = await fetch(`${siteUrl}/api/webhooks/qstash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET
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

    // Verify it is still pending before expiring
    const { data: txn } = await supabase.from("transactions").select("*").eq("transaction_id", transactionId).single()
    if (!txn || (txn.status as string) !== "Payment Pending") {
      return { success: false }
    }

    await supabase.from("transactions").update({
      status: "Payment Failed",
      failure_remarks: "QR code expired without payment confirmation (Client Timeout)"
    } as any).eq("transaction_id", transactionId)

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

    // Add verification button text
    const isDynamic = (txn as any).payment_category === "nepalpay" || (txn as any).payment_category === "fonepay"
    if (isDynamic) {
      if (txn.user_id) {
        customMsg += "<br/><br/>If you have already paid but your order still failed, please verify your payment. "
        customMsg += `<a href="https://www.byiora.com.np/transactions" style="color: #6B3FA0; font-weight: 600;">Go to your Transaction History</a>, and click the <strong>Verify Payment</strong> button.`
      } else {
        // Guest user logic with magic link
        const rawToken = await generateGuestVerificationToken(transactionId)
        const token = encodeURIComponent(rawToken)
        customMsg += "<br/><br/>If you have already paid but your order still failed, please click the secure link below to verify your payment. "
        customMsg += `This link will expire in exactly 24 hours.<br/><br/>`
        customMsg += `<div style="text-align: center;"><a href="https://www.byiora.com.np/verify-guest?token=${token}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Verify Payment Securely</a></div>`
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
        customMessage: customMsg
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
 * Sends a "Your order was cancelled" email that still includes a magic-link
 * safety net so users who paid before cancelling can recover.
 */
export async function cancelTransactionAction(transactionId: string) {
  try {
    const supabase = createServiceRoleClient()

    const { data: txn } = await supabase.from("transactions").select("*").eq("transaction_id", transactionId).single()
    if (!txn || !["Payment Pending", "Processing"].includes(txn.status as string)) {
      return { success: false, error: "Cannot cancel this transaction" }
    }

    await supabase.from("transactions").update({
      status: "Payment Failed",
      failure_remarks: "Cancelled by user"
    } as any).eq("transaction_id", transactionId)

    // --- Send Cancellation Email ---
    const { sendOrderPlacedEmail } = await import("@/lib/email/resend")
    const { generateGuestVerificationToken } = await import("@/app/actions/checkout-encryption")

    let userName = undefined
    if (txn.user_id) {
      const { data: userData } = await supabase.from("users").select("name").eq("id", txn.user_id).single()
      if (userData) userName = userData.name
    } else if ((txn as any).guest_user_data && (txn as any).guest_user_data.name) {
      userName = (txn as any).guest_user_data.name
    }

    let customMsg = "You have cancelled your order for <strong>" + txn.product_name + "</strong>."

    // Add safety-net verification link for dynamic QR payments
    const isDynamic = (txn as any).payment_category === "nepalpay" || (txn as any).payment_category === "fonepay"
    if (isDynamic) {
      customMsg += "<br/><br/><strong>Already paid before cancelling?</strong> Don't worry — you can still verify your payment."
      if (txn.user_id) {
        customMsg += ` <a href="https://www.byiora.com.np/transactions" style="color: #6B3FA0; font-weight: 600;">Go to your Transaction History</a> and click the <strong>Verify Payment</strong> button.`
      } else {
        // Guest user — generate magic link
        const rawToken = await generateGuestVerificationToken(transactionId)
        const token = encodeURIComponent(rawToken)
        customMsg += `<br/><br/>`
        customMsg += `<div style="text-align: center;"><a href="https://www.byiora.com.np/verify-guest?token=${token}" style="display: inline-block; background-color: #6B3FA0; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Verify Payment Securely</a></div>`
        customMsg += `<p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 8px;">This link expires in 24 hours.</p>`
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
