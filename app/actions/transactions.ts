"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendOrderPlacedEmail } from "@/lib/email/resend"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"

interface TransactionData {
  product: string
  amount: string
  price: string
  status: "Completed" | "Failed" | "Processing" | "Cancelled"
  paymentMethod: string
  email: string
  productId?: string
  productCategory?: string
  guestData?: any
  userId?: string | null
}

/**
 * Adds a new transaction (for both guest and authenticated users)
 * Uses Service Role to bypass RLS and allow returning inserted data
 */
export async function addTransactionAction(transactionData: TransactionData): Promise<{ success: boolean; transactionId?: string; error?: string; data?: any }> {
  try {
    // SECURITY: Per-IP rate limiting to prevent order spam (5 orders/min per IP)
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await rateLimit(`order:${ip}`, { windowMs: 60_000, max: 5 })
    if (!rl.ok) {
      return { success: false, error: "Too many orders. Please wait a moment and try again." }
    }

    const serviceSupabase = createServiceRoleClient()

    const productId = transactionData.productId || transactionData.product.toLowerCase().replace(/\s+/g, "-")
    
    // SECURITY: Validate price against the database to prevent tampering
    const { data: productData, error: productError } = await serviceSupabase
      .from("products")
      .select("denominations")
      .eq("id", productId)
      .single()
      
    let denominations = productData?.denominations

    if (productError || !denominations) {
      // Fallback to slug search if id lookup fails
      const { data: slugProduct, error: slugError } = await serviceSupabase
        .from("products")
        .select("denominations")
        .eq("slug", productId)
        .single()
        
      if (slugError || !slugProduct) {
        return { success: false, error: "Product not found or unavailable." }
      }
      denominations = slugProduct.denominations
    }
    
    // Find matching denomination and set verified price
    const matchedDenom = denominations?.find(
      (d: any) => d.label === transactionData.amount
    )
    
    if (!matchedDenom) {
      return { success: false, error: "Invalid product denomination." }
    }
    
    const verifiedPrice = matchedDenom.price.toString()
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const random = crypto.randomUUID().split("-")[0].toUpperCase().substring(0, 5)
    const transactionId = `BYI-${yy}${mm}${dd}-${random}`

    const insertPayload: any = {
      user_id: transactionData.userId || null,
      product_id: productId,
      product_name: transactionData.product,
      amount: transactionData.amount,
      price: verifiedPrice,
      status: "Processing",
      payment_method: transactionData.paymentMethod,
      transaction_id: transactionId,
      user_email: transactionData.email,
      guest_user_data: transactionData.guestData || null,
    }

    if (transactionData.productCategory) {
      insertPayload.product_category = transactionData.productCategory
    }

    let data: any = null
    let error: any = null

    const result = await serviceSupabase
      .from("transactions")
      .insert([insertPayload])
      .select()
      .single()

    data = result.data
    error = result.error

    // Retry without product_category if that column doesn't exist
    if (error && error.message?.includes("product_category")) {
      const { product_category, ...payloadWithoutCategory } = insertPayload
      const retryResult = await serviceSupabase
        .from("transactions")
        .insert([payloadWithoutCategory])
        .select()
        .single()

      data = retryResult.data
      error = retryResult.error
    }

    if (error) {
      console.error("Error adding transaction:", error)
      return { success: false, error: error.message || error.code || "Failed to add transaction" }
    }

    let userName = undefined
    if (transactionData.userId) {
      const { data: userData } = await serviceSupabase
        .from("users")
        .select("name")
        .eq("id", transactionData.userId)
        .single()
      if (userData?.name) {
        userName = userData.name
      }
    }

    // Send order-placed email (non-blocking)
    try {
      sendOrderPlacedEmail({
        email: transactionData.email,
        userName,
        productName: transactionData.product,
        denomination: transactionData.amount,
        transactionId,
        price: verifiedPrice,
        paymentMethod: transactionData.paymentMethod,
        isGuest: !transactionData.userId,
      }).catch((e) => console.error("Order placed email error (non-blocking):", e))
    } catch (e) {
      console.error("Order placed email trigger failed (non-blocking):", e)
    }

    // Send Discord Webhook Notification
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        const embed = {
          title: "🚨 NEW ORDER RECEIVED!",
          color: 0x00BCD4, // Match the brand color
          fields: [
            { name: "Transaction ID", value: transactionId, inline: true },
            { name: "Status", value: "Processing", inline: true },
            { name: "Product", value: transactionData.product, inline: false },
            { name: "Amount", value: transactionData.amount, inline: true },
            { name: "Price", value: `Rs. ${verifiedPrice}`, inline: true },
            { name: "Email", value: transactionData.email, inline: false },
            { name: "Payment Method", value: transactionData.paymentMethod, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "Byiora Order System" }
        }

        if (transactionData.guestData && transactionData.guestData.userId) {
          embed.fields.push({ name: "User ID / Account", value: transactionData.guestData.userId, inline: true })
        }

        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        })
      } catch (webhookError) {
        // Fail silently as requested
        console.error("Discord Webhook Error:", webhookError)
      }
    }

    return { success: true, transactionId, data }
  } catch (error: any) {
    console.error("Add transaction error:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
