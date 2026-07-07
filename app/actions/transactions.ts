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
  status: string
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
    // SECURITY: Per-IP rate limiting (3 orders per 10 minutes per IP)
    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await rateLimit(`order:${ip}`, { windowMs: 600_000, max: 6 })
    if (!rl.ok) {
      return { success: false, error: "Too many orders. Please wait a few minutes and try again." }
    }

    // SECURITY: Per-user daily limit (30 orders per day for logged-in users)
    if (transactionData.userId) {
      const userRl = await rateLimit(`order-user:${transactionData.userId}`, { windowMs: 86_400_000, max: 30 })
      if (!userRl.ok) {
        return { success: false, error: "You have reached the maximum number of orders for today. Please try again tomorrow." }
      }
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

    let actualUserId = transactionData.userId || null;
    let actualUserName = undefined;

    if (actualUserId) {
      const { data: userData } = await serviceSupabase
        .from("users")
        .select("name")
        .eq("id", actualUserId)
        .single()
      if (userData?.name) {
        actualUserName = userData.name
      }
    } else if (transactionData.email) {
      const { data: userData } = await serviceSupabase
        .from("users")
        .select("id, name")
        .eq("email", transactionData.email.toLowerCase().trim())
        .single()
      if (userData) {
        actualUserId = userData.id;
        actualUserName = userData.name;
      }
    }

    // Look up the payment method category from the database
    let paymentCategory = "static"
    const { data: pmData } = await serviceSupabase
      .from("payment_methods")
      .select("category")
      .eq("name", transactionData.paymentMethod)
      .single()
    if (pmData && (pmData as any).category) {
      paymentCategory = (pmData as any).category
    }

    const isDynamic = paymentCategory === "nepalpay" || paymentCategory === "fonepay"

    // Static payments start as Processing, Dynamic as Payment Pending
    const initialStatus = isDynamic ? "Payment Pending" : "Processing"

    const insertPayload: any = {
      user_id: actualUserId,
      product_id: productId,
      product_name: transactionData.product,
      amount: transactionData.amount,
      price: verifiedPrice,
      status: initialStatus,
      payment_method: transactionData.paymentMethod,
      transaction_id: transactionId,
      user_email: transactionData.email,
      guest_user_data: transactionData.guestData || null,
      payment_category: paymentCategory,
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

    // User name already resolved above

    // Send order-placed email (DEFERRED)
    // As per new logic, we do NOT send the Order Placed email at checkout creation.
    // Emails are only sent after the payment is successfully verified.

    // Send Discord Webhook Notification
    if (process.env.DISCORD_WEBHOOK_URL && (!isDynamic || transactionData.productCategory === "direct-login")) {
      try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        const embed = {
          title: "🚨 NEW ORDER RECEIVED!",
          color: 0x00BCD4, // Match the brand color
          fields: [
            { name: "Order ID", value: transactionId, inline: true },
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

// This function clones an expired transaction and creates a new one
// so the user can re-try checking out
export async function reorderTransactionAction(oldTransactionId: string) {
  try {
    const supabase = createServiceRoleClient()
    const { data: oldTxn, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", oldTransactionId)
      .single()
    
    if (fetchError || !oldTxn) {
      return { success: false, error: "Original transaction not found" }
    }

    // Generate a new transaction ID with standard format
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const random = crypto.randomUUID().split("-")[0].toUpperCase().substring(0, 5)
    const newTransactionId = `BYI-${yy}${mm}${dd}-${random}`

    // Create new payload based on the old transaction
    const oldTxnAny = oldTxn as any;
    const newStatus = oldTxnAny.payment_category === "nepalpay" || oldTxnAny.payment_category === "fonepay" 
      ? "Payment Pending" 
      : "Processing"

    const insertPayload = {
      user_id: oldTxn.user_id,
      product_id: oldTxn.product_id,
      product_name: oldTxn.product_name,
      amount: oldTxn.amount,
      price: oldTxn.price,
      status: newStatus,
      payment_method: oldTxn.payment_method,
      payment_category: oldTxnAny.payment_category,
      transaction_id: newTransactionId,
      user_email: oldTxn.user_email,
      guest_user_data: oldTxn.guest_user_data,
      product_category: oldTxn.product_category,
    }

    // Use service client to bypass RLS
    const serviceSupabase = createServiceRoleClient()
    const { data: newTxn, error: insertError } = await serviceSupabase
      .from("transactions")
      .insert([insertPayload as any])
      .select()
      .single()

    if (insertError) {
      return { success: false, error: "Failed to create new transaction" }
    }

    // Send Discord alert
    const isDynamicReorder = oldTxnAny.payment_category === "nepalpay" || oldTxnAny.payment_category === "fonepay"
    if (process.env.DISCORD_WEBHOOK_URL && (!isDynamicReorder || oldTxn.product_category === "direct-login")) {
      try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        const embed = {
          title: "🔄 REORDER PLACED!",
          color: 0x00BCD4,
          fields: [
            { name: "Old Txn", value: oldTransactionId, inline: true },
            { name: "New Txn", value: newTransactionId, inline: true },
            { name: "Product", value: oldTxn.product_name, inline: false },
            { name: "Amount", value: oldTxn.amount, inline: true },
          ],
          timestamp: new Date().toISOString()
        }
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        })
      } catch (e) {}
    }

    return { success: true, transactionId: newTransactionId }
  } catch (error: any) {
    console.error("Reorder transaction error:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
