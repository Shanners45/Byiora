import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '../supabase'

/**
 * readOnly: never write auth cookies. Use it in Server Actions that only read
 * the session. Middleware already refreshes tokens, and a cookie write inside an
 * action makes Next re-render the page the action started on, which yanks the
 * user back there if they navigated away while it was in flight.
 */
export async function createClient(options?: { readOnly?: boolean }) {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          if (options?.readOnly) return
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
