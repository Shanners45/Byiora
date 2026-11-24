import { createClient } from "@supabase/supabase-js"
import type { Database } from "../supabase"

/**
 * Anonymous, cookie-free Supabase client for public catalogue reads (products, banners).
 * Reading cookies makes Next.js render a page per visitor; this client doesn't, so product
 * and category pages can be cached at Vercel's edge and served without running a function.
 * Only use it for data every visitor may see (RLS still applies as the anon role).
 */
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
