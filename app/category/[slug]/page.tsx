import CategoryPage from "./category-client"
import { createPublicClient } from "@/lib/supabase/public"
import { mapProductRow } from "@/lib/product-categories"

// Cached at the edge, refreshed in the background at most every 5 minutes.
export const revalidate = 300
// No pages are pre-built: each is rendered on its first visit, then served from the cache.
export async function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let initialProducts = null
  try {
    const supabase = createPublicClient()
    const { data, error } = await (supabase as any)
      .from("products")
      .select("*")
      .eq("category", slug)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
    if (!error && data) initialProducts = data.map(mapProductRow)
  } catch {
    // Fall back to the browser fetch.
  }
  return <CategoryPage initialProducts={initialProducts} />
}
