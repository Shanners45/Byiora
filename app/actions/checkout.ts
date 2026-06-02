"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getPaymentCredentialsAction, decryptBankCredentials } from "./payment-credentials"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { headers } from "next/headers"

// Rate limit for polling
let ratelimit: Ratelimit | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 requests per minute
  })
}

// Proxy Server URL
const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
const PROXY_SECRET = process.env.INTERNAL_API_SECRET || "dev-secret-key"

/**
 * Gets or generates a QR code payload for a transaction
 */
export async function getOrGenerateQRAction(transactionId: string) {
  try {
    const supabase = createServiceRoleClient()

    // 1. Fetch transaction
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (txnError || !txn) {
      return { success: false, error: "Transaction not found" }
    }

    if (txn.status !== "Processing") {
      return { success: false, error: "Transaction is already completed or cancelled", status: txn.status }
    }
    
    // Cast to any because Supabase types might not be updated with the newest columns
    const typedTxn = txn as any;

    // 2. Check if cached QR is valid (less than 15 mins old)
    if (typedTxn.qr_payload && typedTxn.validation_trace_id) {
      // Check if it's less than 15 mins since created_at or updated_at (we can use updated_at to track when QR was generated)
      const qrAge = (new Date().getTime() - new Date(typedTxn.updated_at).getTime()) / 1000 / 60
      if (qrAge < 14) {
        return { 
          success: true, 
          qrString: typedTxn.qr_payload,
          validationTraceId: typedTxn.validation_trace_id,
          amount: typedTxn.price,
          product: typedTxn.product_name,
          expiresIn: Math.floor(15 * 60 - qrAge * 60)
        }
      }
    }

    // 3. Needs new QR. Get credentials.
    const methodLower = txn.payment_method.toLowerCase()
    const isNepalPay = methodLower.includes("nepalpay") || methodLower.includes("nepal pay")
    const isFonepay = methodLower.includes("fonepay")
    
    if (!isNepalPay && !isFonepay) {
      // STATIC PAYMENT METHOD FALLBACK
      const { data: methodData, error: methodError } = await supabase
        .from("payment_methods")
        .select("qr_url, instructions")
        .eq("name", txn.payment_method)
        .single()

      if (methodError || !methodData) {
        return { success: false, error: "Payment method details not found" }
      }

      return {
        success: true,
        isStatic: true,
        staticQrUrl: methodData.qr_url,
        instructions: methodData.instructions,
        amount: txn.price,
        product: txn.product_name
      }
    }

    const providerKey = isNepalPay ? "nepalpay" : "fonepay"
    
    const credsRes = await supabase.from("payment_credentials").select("*").eq("provider", providerKey).single() as any
    if (credsRes.error || !credsRes.data) {
      return { success: false, error: `${providerKey} credentials not configured by Admin` }
    }

    const username = await decryptBankCredentials(credsRes.data.encrypted_username)
    const password = await decryptBankCredentials(credsRes.data.encrypted_password)

    if (!username || !password) {
      return { success: false, error: "Failed to decrypt bank credentials" }
    }

    // 4. Generate QR via proxy
    const proxyPayload = {
      username,
      password,
      amount: parseInt(txn.price),
      remarks: transactionId
    }

    const endpoint = isNepalPay ? "/api/trigger-nepalpay-qr" : "/api/trigger-fonepay-qr" // Fallback if fonepay added later
    
    console.log(`[QR GENERATION] Triggering proxy for ${transactionId} via ${providerKey}...`)
    
    const response = await fetch(`${PROXY_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": PROXY_SECRET
      },
      body: JSON.stringify(proxyPayload),
      cache: 'no-store'
    })

    const proxyData = await response.json()

    if (!proxyData.success) {
      return { success: false, error: proxyData.message || "Proxy failed to generate QR" }
    }

    // 5. Cache it in database
    await supabase.from("transactions").update({
      qr_payload: proxyData.qrString,
      validation_trace_id: proxyData.validationTraceId,
      updated_at: new Date().toISOString()
    }).eq("transaction_id", transactionId)

    // 6. Schedule QStash Webhook if available (Fire and Forget)
    if (process.env.QSTASH_TOKEN && process.env.QSTASH_URL) {
      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/webhooks/qstash`
        await fetch(`${process.env.QSTASH_URL}/v2/publish/${webhookUrl}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
            "Content-Type": "application/json",
            "Upstash-Retries": "15", // Retry 15 times
            "Upstash-Delay": "10s", // Every 10s
          },
          body: JSON.stringify({
            transactionId: transactionId,
            validationTraceId: proxyData.validationTraceId,
            provider: providerKey
          })
        })
        console.log(`[QSTASH] Scheduled background polling for ${transactionId}`)
      } catch (e) {
        console.error("Failed to schedule QStash:", e)
      }
    }

    return { 
      success: true, 
      qrString: proxyData.qrString,
      validationTraceId: proxyData.validationTraceId,
      amount: txn.price,
      product: txn.product_name,
      expiresIn: 15 * 60
    }

  } catch (error: any) {
    console.error("QR Generation error:", error)
    return { success: false, error: error.message || "Failed to generate QR" }
  }
}

/**
 * Checks payment status via Proxy
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

    const endpoint = provider === "nepalpay" ? "/api/verify-nepalpay-transaction" : "/api/verify-fonepay-transaction"

    const response = await fetch(`${PROXY_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": PROXY_SECRET
      },
      body: JSON.stringify({
        nqrTxnId: validationTraceId, // Proxy expects validationTraceId in this field
        username,
        password
      }),
      cache: 'no-store'
    })

    const proxyData = await response.json()

    if (proxyData.success && proxyData.data?.status === "SUCCESS") {
      // Payment found in bank logs!
      // NOTE: We could fulfill it here, but QStash will also do it.
      // Doing it here provides instant UI feedback if the user keeps tab open.
      
      // Let's call our internal webhook function directly to deduplicate logic
      const fulfillRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/webhooks/qstash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          validationTraceId,
          provider,
          internalTrigger: true // Bypasses QStash signature verification for internal calls
        })
      })

      if (fulfillRes.ok) {
        return { success: true, completed: true }
      }
    }

    return { success: false, completed: false }
  } catch (error: any) {
    console.error("Verify payment error:", error)
    return { success: false, error: error.message || "Verification failed" }
  }
}
