import { createClient } from "@/lib/supabase/server"

/**
 * Shared utility to verify the current user is an admin.
 * Used across multiple server actions to prevent duplicate code.
 */
export async function verifyAdmin(): Promise<boolean> {
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
