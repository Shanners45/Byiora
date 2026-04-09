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
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const insertPayload: any = {
      user_id: transactionData.userId || null,
      product_id: productId,
      product_name: transactionData.product,
      amount: transactionData.amount,
      price: transactionData.price,
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
