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
 * Gets dashboard stats (admin only)
 * Uses Service Role to bypass RLS and access all data
 */
export async function getDashboardStatsAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    // Load users count
    const { count: usersCount } = await serviceSupabase
      .from("users")
      .select("*", { count: "exact", head: true })

    // Load products count
    const { count: productsCount } = await serviceSupabase
      .from("products")
      .select("*", { count: "exact", head: true })

    // Load transactions for recent orders display
    const { data: transactions, error: transactionsError } = await serviceSupabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })

    if (transactionsError) {
      console.error("Error loading transactions:", transactionsError)
    }

    // Separately load ONLY completed transactions for revenue accuracy
    const { data: completedTransactions, error: completedError } = await serviceSupabase
      .from("transactions")
      .select("price,product_name")
      .eq("status", "Completed")

    if (completedError) {
      console.error("Error loading completed transactions:", completedError)
    }

    // Calculate stats
    const totalOrders = transactions?.length || 0
    // Sum price from ALL completed transactions (includes guest orders where user_id is null)
    const totalRevenue = completedTransactions
      ?.reduce((sum, t) => {
        const cleanPrice = String(t.price).replace(/,/g, '')
        const parsed = Number.parseFloat(cleanPrice)
        return sum + (isNaN(parsed) ? 0 : parsed)
      }, 0) || 0
    const recentOrders = transactions?.slice(0, 5) || []

    // Load top products
    const { data: products } = await serviceSupabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .limit(5)

    return {
      success: true,
      stats: {
        totalUsers: usersCount || 0,
        totalProducts: productsCount || 0,
        totalOrders,
        totalRevenue,
        recentOrders,
        topProducts: products || [],
      }
    }
  } catch (error: any) {
    console.error("Error in getDashboardStatsAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets all transactions for orders page (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getAllTransactionsAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading transactions:", error)
      return { error: `Failed to load transactions: ${error.message}` }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error in getAllTransactionsAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets all users for admin users page (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getAllUsersAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading users:", error)
      return { error: `Failed to load users: ${error.message}` }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error in getAllUsersAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets all products for admin products page (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getAllProductsAdminAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error loading products:", error)
      return { error: `Failed to load products: ${error.message}` }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error in getAllProductsAdminAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets all notifications for admin notifications page (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getAllNotificationsAction() {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("notifications")
      .select(`
        *,
        users (
          name,
          email
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading notifications:", error)
      return { error: `Failed to load notifications: ${error.message}` }
    }

    return { success: true, data: data || [] }
  } catch (error: any) {
    console.error("Error in getAllNotificationsAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Sends a notification (admin only)
 * Uses Service Role to bypass RLS
 */
export async function sendNotificationAction(
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error",
  userId: string | null
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
          title: title.trim(),
          message: message.trim(),
          type,
          user_id: userId,
        },
      ])

    if (error) {
      console.error("Error sending notification:", error)
      return { error: `Failed to send notification: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in sendNotificationAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Deletes a notification (admin only)
 * Uses Service Role to bypass RLS
 */
export async function deleteNotificationAction(id: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("notifications")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting notification:", error)
      return { error: `Failed to delete notification: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/notifications")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteNotificationAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
