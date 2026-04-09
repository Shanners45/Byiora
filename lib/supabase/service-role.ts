import { createClient } from '@supabase/supabase-js'
import { Database } from '../supabase'

/**
 * Service Role Client for Admin Operations
 * 
 * This client uses the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
 * ONLY use this for trusted server-side admin operations.
 * 
 * SECURITY WARNING:
 * - Never expose this client to the browser
 * - Only use in Server Actions or API routes that verify admin authentication
 * - The SERVICE_ROLE_KEY has full database access - treat it like a root password
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key')
}

/**
 * Creates a Supabase client with Service Role privileges.
 * This bypasses RLS - use only for admin operations.
 */
export function createServiceRoleClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase Service Role not configured. Check environment variables.')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
