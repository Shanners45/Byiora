"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Verifies the current user is an admin
 */
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  
  if (!adminUser) return false
  return true
}

/**
 * Updates transaction status (admin only)
 * Uses Service Role to bypass RLS
 */
export async function updateTransactionStatusAction(
  transactionId: string,
  newStatus: "Completed" | "Failed" | "Processing",
  remarks?: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const updatePayload: any = { status: newStatus }
    if (remarks !== undefined) updatePayload.failure_remarks = remarks

    const { error } = await serviceSupabase
      .from("transactions")
      .update(updatePayload)
      .eq("transaction_id", transactionId)

    if (error) {
      console.error("Error updating transaction status:", error)
      return { error: `Failed to update status: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/orders")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateTransactionStatusAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Sends giftcard code and marks order as completed (admin only)
 * Uses Service Role to bypass RLS
 */
export async function sendGiftcardCodeAction(
  transactionId: string,
  code: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("transactions")
      .update({
        giftcard_code: code,
        status: "Completed",
      })
      .eq("id", transactionId)

    if (error) {
      console.error("Error sending giftcard code:", error)
      return { error: `Failed to send giftcard code: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/orders")
    return { success: true }
  } catch (error: any) {
    console.error("Error in sendGiftcardCodeAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets transaction details by ID (admin only)
 * Uses Service Role to bypass RLS and access any transaction
 */
export async function getTransactionByIdAction(transactionId: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single()

    if (error) {
      console.error("Error fetching transaction:", error)
      return { error: `Failed to fetch transaction: ${error.message}` }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("Error in getTransactionByIdAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Inserts notification for user (admin only)
 * Uses Service Role to bypass RLS
 */
export async function insertNotificationAction(
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error",
  userId: string
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("notifications")
      .insert([
        {
          title,
          message,
          type,
          user_id: userId,
          is_read: false,
        },
      ])

    if (error) {
      console.error("Error inserting notification:", error)
      return { error: `Failed to send notification: ${error.message}` }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error in insertNotificationAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
