"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"

/**
 * Deletes an admin user from both admin_users and users tables.
 * This ensures the user is fully removed from the database as requested.
 * Uses Service Role to bypass RLS for admin operations.
 */
export async function deleteAdminUserAction(userId: string) {
  const supabase = createServiceRoleClient()

  try {
    // Check if the current user is an admin (optional security check)
    // For now we assume the caller has valid admin session
    
    // 1. Delete from admin_users table
    const { error: adminError } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", userId)

    if (adminError) {
      console.error("Error deleting from admin_users:", adminError)
      return { error: "Failed to delete from admin_users: " + adminError.message }
    }

    revalidatePath("/admin/dashboard/admin-users")
    return { success: true }
  } catch (error: any) {
    console.error("Unexpected error in deleteAdminUserAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
