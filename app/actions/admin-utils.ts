"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Shared utility to verify the current user is an admin.
 * Used across multiple server actions to prevent duplicate code.
 */
export type AdminSession = {
  id: string
  name: string
  email: string
  role: "admin" | "sub_admin" | "order_management"
  status: "active" | "blocked"
}

export async function getAdminSessionAction(): Promise<{ success: true; data: AdminSession } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Unauthorized" }
  
  // Use Service Role to bypass RLS for verification
  // This is safe because we are searching by the verified user.id from auth.getUser()
  const serviceSupabase = createServiceRoleClient()
  const { data: adminUser, error } = await serviceSupabase
    .from('admin_users')
    .select('id, name, email, role, status')
    .eq('id', user.id)
    .single()
  
  if (error || !adminUser) return { success: false, error: "Forbidden" }
  if (adminUser.status !== "active") return { success: false, error: "Blocked" }

  return { success: true, data: adminUser as AdminSession }
}

export async function verifyAdmin(): Promise<boolean> {
  const result = await getAdminSessionAction()
  return result.success
}
