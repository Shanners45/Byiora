import { createClient } from "@/lib/supabase/server"

export interface ServerProduct {
  id: string
  name: string
  slug: string
  logo: string
  category: "topup" | "digital-goods"
  is_new?: boolean
  has_update?: boolean
  is_active?: boolean
  description?: string
  denom_icon_url?: string
  ribbon_text?: string
  denominations?: Array<{
    price: string
    label: string
    icon_url?: string
    bestseller?: boolean
  }>
  faqs?: Array<{
    question: string
    answer: string
  }>
}

/**
 * Fetch a single product by slug using the SERVER Supabase client.
 * This runs only in Server Components / generateMetadata.
 */
export async function getProductBySlugServer(slug: string): Promise<ServerProduct | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (error || !data) return null
    return data as ServerProduct
  } catch {
    return null
  }
}

/**
 * Fetch payment methods using the SERVER Supabase client.
 */
export async function getPaymentMethodsServer() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })

    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
