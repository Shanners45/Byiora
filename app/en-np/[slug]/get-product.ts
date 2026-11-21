import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/lib/product-categories"

// One DB read per request, shared by metadata, JSON-LD, the 404 check and the page.
export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  const supabase = await createClient({ readOnly: true })
  const { data, error } = await (supabase as any)
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error // a DB hiccup must not look like "product does not exist"
  return (data as Product | null) ?? null
})
