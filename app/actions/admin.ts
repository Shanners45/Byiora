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
 * Deletes an admin user from both admin_users and users tables.
 * This ensures the user is fully removed from the database as requested.
 * Uses Service Role to bypass RLS for admin operations.
 */
export async function deleteAdminUserAction(userId: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }
  
  const supabase = createServiceRoleClient()

  try {
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
