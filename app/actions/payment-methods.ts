"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyAdmin, verifySuperAdmin } from "@/app/actions/admin-utils"

export type PaymentMethodRow = {
  id: string
  name: string
  logo_url: string | null
  qr_url: string | null
  instructions: string | null
  is_enabled: boolean
  sort_order: number
  category: "static" | "nepalpay" | "fonepay" | "khalti"
}

export async function getPaymentMethodsAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized: Admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("payment_methods")
    .select("id, name, logo_url, qr_url, instructions, is_enabled, sort_order, category")
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { success: true, data: (data || []) as unknown as PaymentMethodRow[] }
}

/**
 * Fetch enabled payment methods for public (homepage) use.
 * No admin check required — only returns enabled methods.
 */
export async function getPublicPaymentMethodsAction() {
  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("payment_methods")
    .select("id, name, logo_url, qr_url, instructions, is_enabled, sort_order, category")
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { success: true, data: (data || []) as unknown as PaymentMethodRow[] }
}

const EDITABLE_FIELDS = ["name", "logo_url", "qr_url", "instructions", "is_enabled", "sort_order", "category"] as const
const CATEGORIES = ["static", "nepalpay", "fonepay", "khalti"]

/** Drops unknown columns and rejects non-https / script URLs before they reach the store. */
function sanitizePaymentMethodPatch(patch: Record<string, unknown>): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) if (key in patch) data[key] = patch[key]
  for (const key of ["logo_url", "qr_url"]) {
    const v = data[key]
    if (v === null || v === undefined || v === "") continue
    if (typeof v !== "string") return { error: `Invalid ${key}` }
    if (v.startsWith("/") && !v.startsWith("//")) continue
    try {
      if (new URL(v).protocol !== "https:") return { error: `${key} must be an https URL` }
    } catch {
      return { error: `Invalid ${key}` }
    }
  }
  if ("category" in data && !CATEGORIES.includes(String(data.category))) return { error: "Invalid category" }
  if ("is_enabled" in data && typeof data.is_enabled !== "boolean") return { error: "Invalid is_enabled" }
  return { data }
}

export async function updatePaymentMethodAction(id: string, patch: Partial<Omit<PaymentMethodRow, "id">>) {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const clean = sanitizePaymentMethodPatch(patch as Record<string, unknown>)
  if (clean.error) return { error: clean.error }
  const { error } = await serviceSupabase.from("payment_methods").update(clean.data as any).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function createPaymentMethodAction(method: Omit<PaymentMethodRow, "id">) {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }
  const clean = sanitizePaymentMethodPatch(method as Record<string, unknown>)
  if (clean.error) return { error: clean.error }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("payment_methods")
    .insert([clean.data as any])
    .select("id, name, logo_url, qr_url, instructions, is_enabled, sort_order, category")
    .single()

  if (error) return { error: error.message }
  return { success: true, data: data as unknown as PaymentMethodRow }
}

export async function deletePaymentMethodAction(id: string) {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { error } = await serviceSupabase.from("payment_methods").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Exclusive toggle: When enabling a dynamic payment method (nepalpay/fonepay),
 * disable all other methods of the same category first.
 */
export async function toggleExclusiveAction(id: string, category: string, enable: boolean) {
  if (!(await verifySuperAdmin())) return { error: "Unauthorized: Super admin access required" }

  const serviceSupabase = createServiceRoleClient()

  if (enable && (category === "nepalpay" || category === "fonepay" || category === "khalti")) {
    // Disable all other methods of the same category
    await serviceSupabase
      .from("payment_methods")
      .update({ is_enabled: false } as any)
      .eq("category" as any, category)
      .neq("id", id)
  }

  // Toggle the target method
  const { error } = await serviceSupabase
    .from("payment_methods")
    .update({ is_enabled: enable } as any)
    .eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}
