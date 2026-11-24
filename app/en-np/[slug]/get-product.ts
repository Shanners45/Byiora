import { cache } from "react"
import { createPublicClient } from "@/lib/supabase/public"
import type { Product } from "@/lib/product-categories"

// One DB read per request, shared by metadata, JSON-LD, the 404 check and the page.
export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  // Cookie-free so the page can be cached (ISR); products are public data.
  const supabase = createPublicClient()
  const { data, error } = await (supabase as any)
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()
  if (error) throw error // a DB hiccup must not look like "product does not exist"
  return (data as Product | null) ?? null
})

export interface RelatedProduct {
  id: string
  name: string
  slug: string
  logo: string
  ribbon_text?: string
  isOutOfStock: boolean
}

const soldOut = (p: any) => Array.isArray(p.denominations) && p.denominations.length > 0 && p.denominations.every((d: any) => d.in_stock === false)

/**
 * Up to `limit` other products to show under a product: same category first, in-stock first, then
 * in-stock products from other categories if the category is small. Gives out-of-stock pages a way on.
 */
export const getRelatedProducts = cache(async (product: Product, limit = 6): Promise<RelatedProduct[]> => {
  const supabase = createPublicClient()
  const { data } = await (supabase as any)
    .from("products")
    .select("id, name, slug, logo, category, ribbon_text, denominations")
    .eq("is_active", true)
    .neq("id", product.id)
  const rows: any[] = (data || []).filter((p: any) => p.slug && p.logo)
  const rank = (p: any) => (p.category === product.category ? 0 : 2) + (soldOut(p) ? 1 : 0)
  return rows
    .filter((p) => p.category === product.category || !soldOut(p))
    .sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug, logo: p.logo, ribbon_text: p.ribbon_text || undefined, isOutOfStock: soldOut(p) }))
})
