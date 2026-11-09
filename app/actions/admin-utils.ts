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
  try {
    const supabase = await createClient()
    const { data, error: userError } = await supabase.auth.getUser()
    if (userError || !data?.user) return { success: false, error: "Unauthorized" }
    const user = data.user
    
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
  } catch (err) {
    return { success: false, error: "Unauthorized" }
  }
}

export async function verifyAdmin(): Promise<boolean> {
  const result = await getAdminSessionAction()
  return result.success
}

/**
 * Strict check: Only full Super Admins (role === "admin")
 * Use for user management, role promotion, password resets, and bank credentials.
 */
export async function verifySuperAdmin(): Promise<boolean> {
  const result = await getAdminSessionAction()
  return result.success && result.data.role === "admin"
}

/**
 * Allows the signed-in admin to update ONLY their own display name.
 * Role/status changes remain super-admin-only via admin-users.ts.
 */
export async function updateOwnAdminNameAction(name: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  const cleanName = name?.trim()
  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    return { success: false, error: "Name must be between 2 and 80 characters." }
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("admin_users")
    .update({ name: cleanName, updated_at: new Date().toISOString() })
    .eq("id", session.data.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

