"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"

import { verifyAdmin } from "./admin-utils"

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

    const [
      { count: usersCount },
      { count: productsCount },
      { data: transactions, error: transactionsError },
      { data: completedTransactions, error: completedError },
      { data: products }
    ] = await Promise.all([
      serviceSupabase.from("users").select("*", { count: "exact", head: true }),
      serviceSupabase.from("products").select("*", { count: "exact", head: true }),
      serviceSupabase.from("transactions").select("*").order("created_at", { ascending: false }),
      serviceSupabase.from("transactions").select("price,product_name").eq("status", "Completed"),
      serviceSupabase.from("products").select("*").eq("is_active", true).limit(5)
    ])

    if (transactionsError) {
      console.error("Error loading transactions:", transactionsError)
    }

    if (completedError) {
      console.error("Error loading completed transactions:", completedError)
    }

    // Calculate stats
    const totalOrders = transactions?.length || 0
    const totalRevenue = completedTransactions
      ?.reduce((sum, t) => {
        const cleanPrice = String(t.price).replace(/,/g, '')
        const parsed = Number.parseFloat(cleanPrice)
        return sum + (isNaN(parsed) ? 0 : parsed)
      }, 0) || 0
    const recentOrders = transactions?.slice(0, 5) || []

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
      .select("*, users(id, name)")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading transactions:", error)
      return { error: `Failed to load transactions: ${error.message}` }
    }

    const transactionsList: any[] = data || []

    // Background auto-sync: Check if any Paid/Completed Khalti transactions were refunded via Khalti App/Portal
    const paidKhaltiTxns = transactionsList.filter(
      (t: any) =>
        (t.status === "Paid" || t.status === "Completed") &&
        (t.payment_category === "khalti" || t.payment_method?.toLowerCase().includes("khalti")) &&
        (t.validation_trace_id || t.bank_txn_id)
    )

    if (paidKhaltiTxns.length > 0) {
      try {
        const { decryptBankCredentials } = await import("./payment-credentials")
        const credsRes = await serviceSupabase
          .from("payment_credentials")
          .select("encrypted_username")
          .eq("provider", "khalti")
          .single() as any

        if (credsRes.data?.encrypted_username) {
          const secretKey = (await decryptBankCredentials(credsRes.data.encrypted_username))?.trim()
          if (secretKey) {
            const isLive = secretKey.toLowerCase().startsWith("live_")
            const lookupUrl = isLive ? "https://khalti.com/api/v2/epayment/lookup/" : "https://dev.khalti.com/api/v2/epayment/lookup/"
            const authHeader = secretKey.startsWith("Key ") ? secretKey : `Key ${secretKey}`

            for (const txn of paidKhaltiTxns.slice(0, 5)) {
              const pidx = txn.validation_trace_id || (txn.bank_txn_id?.startsWith("pidx") ? txn.bank_txn_id : null)
              if (!pidx) continue

              try {
                const resp = await fetch(lookupUrl, {
                  method: "POST",
                  headers: { "Authorization": authHeader, "Content-Type": "application/json" },
                  body: JSON.stringify({ pidx })
                })
                const resData = await resp.json().catch(() => ({}))

                if (resData && (resData.status === "Refunded" || resData.status === "REFUNDED" || resData.refunded || resData.status === "Partial Refunded")) {
                  const refundNote = resData.refund_amount ? `Khalti Refunded (Portal): Rs. ${resData.refund_amount / 100}` : "Khalti Refunded (Portal)"
                  await serviceSupabase
                    .from("transactions")
                    .update({ status: "Refunded", failure_remarks: refundNote, updated_at: new Date().toISOString() } as any)
                    .eq("transaction_id", txn.transaction_id)

                  txn.status = "Refunded"
                  txn.failure_remarks = refundNote
                }
              } catch (lookupErr) {
                // Ignore individual fetch errors
              }
            }
          }
        }
      } catch (syncErr) {
        console.error("Khalti refund sync error:", syncErr)
      }
    }

    return { success: true, data: transactionsList }
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
      .order("created_at", { ascending: false })

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

    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteNotificationAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
