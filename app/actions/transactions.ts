"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"

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
    const serviceSupabase = createServiceRoleClient()

    const productId = transactionData.productId || transactionData.product.toLowerCase().replace(/\s+/g, "-")
    
    // SECURITY: Validate price against the database to prevent tampering
    const { data: productData, error: productError } = await serviceSupabase
      .from("products")
      .select("denominations")
      .eq("id", productId)
      .single()
      
    if (productError || !productData) {
      // Fallback to slug search if id lookup fails
      const { data: slugProduct, error: slugError } = await serviceSupabase
        .from("products")
        .select("denominations")
        .eq("slug", productId)
        .single()
        
      if (slugError || !slugProduct) {
        return { success: false, error: "Product not found or unavailable." }
      }
      productData.denominations = slugProduct.denominations
    }
    
    // Find matching denomination and set verified price
    const matchedDenom = productData.denominations?.find(
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
    const random = Math.random().toString(36).substring(2, 7).toUpperCase()
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

    return { success: true, transactionId, data }
  } catch (error: any) {
    console.error("Add transaction error:", error)
    return { success: false, error: error.message || "An unexpected error occurred" }
  }
}
