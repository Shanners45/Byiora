import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../supabase'
import { MERCHANT_AUTH_COOKIE } from './cookies'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined
let merchantClient: ReturnType<typeof createBrowserClient<Database>> | undefined

/** `merchant: true` for merchant-portal pages: separate session cookie from admin/customers. */
export function createClient(options?: { merchant?: boolean }) {
  if (options?.merchant) {
    // isSingleton: false, or @supabase/ssr hands back the one shared (non-merchant) client.
    merchantClient ??= createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: false, cookieOptions: { name: MERCHANT_AUTH_COOKIE } }
    )
    return merchantClient
  }
  if (client) return client

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
