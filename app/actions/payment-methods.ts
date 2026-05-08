"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyAdmin } from "@/app/actions/admin-utils"

export type PaymentMethodRow = {
  id: string
  name: string
  logo_url: string | null
  qr_url: string | null
  instructions: string | null
  is_enabled: boolean
  sort_order: number
}

export async function getPaymentMethodsAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized: Admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("payment_methods")
    .select("id, name, logo_url, qr_url, instructions, is_enabled, sort_order")
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { success: true, data: (data || []) as PaymentMethodRow[] }
}

export async function updatePaymentMethodAction(id: string, patch: Partial<Omit<PaymentMethodRow, "id">>) {
  if (!(await verifyAdmin())) return { error: "Unauthorized: Admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { error } = await serviceSupabase.from("payment_methods").update(patch).eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function createPaymentMethodAction(method: Omit<PaymentMethodRow, "id">) {
  if (!(await verifyAdmin())) return { error: "Unauthorized: Admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { data, error } = await serviceSupabase
    .from("payment_methods")
    .insert([method])
    .select("id, name, logo_url, qr_url, instructions, is_enabled, sort_order")
    .single()

  if (error) return { error: error.message }
  return { success: true, data: data as PaymentMethodRow }
}

export async function deletePaymentMethodAction(id: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized: Admin access required" }

  const serviceSupabase = createServiceRoleClient()
  const { error } = await serviceSupabase.from("payment_methods").delete().eq("id", id)
  if (error) return { error: error.message }
  return { success: true }
}

