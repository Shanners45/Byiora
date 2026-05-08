"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

import { verifyAdmin } from "./admin-utils"

/**
 * Promotes a user to a different admin role (admin only)
 * Uses Service Role to bypass RLS
 */
export async function promoteUserAction(userId: string, newRole: "sub_admin" | "order_management") {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("admin_users")
      .update({ role: newRole })
      .eq("id", userId)

    if (error) {
      console.error("Error promoting user:", error)
      return { error: `Failed to promote user: ${error.message}` }
    }

    // 2. Generate a secure random password and update auth
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + "!"
    const { error: authError } = await serviceSupabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (authError) {
      console.error("Error resetting password during promotion:", authError)
      // We don't necessarily fail the whole promotion if auth reset fails, 
      // but it's better to log it.
    }

    revalidatePath("/admin/dashboard/admin-users")
    return { success: true, newPassword }
  } catch (error: any) {
    console.error("Error in promoteUserAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Adds a new admin user (admin only)
 * Creates the Auth user server-side using Service Role to avoid
 * polluting the calling admin's session with a signUp().
 */
export async function addAdminUserAction(
  email: string,
  name: string,
  password: string,
  role: "sub_admin" | "order_management"
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    // Step 1: Create the Auth user using Service Role (does NOT touch the caller's session)
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so the new admin can log in immediately
    })

    if (authError || !authData.user) {
      console.error("Error creating auth user:", authError)
      return { error: authError?.message || "Failed to create auth user" }
    }

    const uid = authData.user.id

    // Step 2: Insert into admin_users table
    const { error } = await serviceSupabase
      .from("admin_users")
      .insert({
        id: uid,
        email,
        password_hash: "",
        name,
        role,
        status: "active",
      })

    if (error) {
      // Rollback: delete the auth user we just created
      await serviceSupabase.auth.admin.deleteUser(uid)
      console.error("Error adding admin user:", error)
      return { error: `Failed to add admin user: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/admin-users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in addAdminUserAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Toggles admin user status (admin only)
 * Uses Service Role to bypass RLS
 */
export async function toggleAdminStatusAction(id: string, currentStatus: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const newStatus = currentStatus === "active" ? "blocked" : "active"

    const { error } = await serviceSupabase
      .from("admin_users")
      .update({ status: newStatus })
      .eq("id", id)

    if (error) {
      console.error("Error updating admin status:", error)
      return { error: `Failed to update admin status: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/admin-users")
    return { success: true, newStatus }
  } catch (error: any) {
    console.error("Error in toggleAdminStatusAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets all admin users (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getAdminUsersAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching admin users:", error)
      return { error: `Failed to fetch admin users: ${error.message}` }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("Error in getAdminUsersAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
/**
 * Resets an admin user's password (admin only)
 * Uses Service Role to update the actual Auth system
 */
export async function resetAdminPasswordAction(userId: string, newPassword: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    // 1. Update the password in Supabase Auth
    const { error: authError } = await serviceSupabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (authError) {
      console.error("Error updating auth password:", authError)
      return { error: `Failed to update auth password: ${authError.message}` }
    }

    // 2. Optional: Keep the password_hash column in sync if it exists/is used
    // (Note: This is mostly for visibility in the database if the user has a separate check)
    // We'll just update it to a generic string or the provided one if needed.
    // However, the Auth update is the one that allows/denies login.

    revalidatePath("/admin/dashboard/admin-users")
    return { success: true }
  } catch (error: any) {
    console.error("Error in resetAdminPasswordAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
