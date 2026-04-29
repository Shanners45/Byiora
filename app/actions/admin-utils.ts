import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Shared utility to verify the current user is an admin.
 * Used across multiple server actions to prevent duplicate code.
 */
export async function verifyAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  
  // Use Service Role to bypass RLS for verification
  // This is safe because we are searching by the verified user.id from auth.getUser()
  const serviceSupabase = createServiceRoleClient()
  const { data: adminUser } = await serviceSupabase
    .from('admin_users')
    .select('id, role')
    .eq('id', user.id)
    .single()
  
  if (!adminUser) return false
  return true
}
