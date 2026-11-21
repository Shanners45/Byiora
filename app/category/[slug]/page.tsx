import CategoryPage from "./category-client"
import { createClient } from "@/lib/supabase/server"
import { mapProductRow } from "@/lib/product-categories"

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let initialProducts = null
  try {
    const supabase = await createClient({ readOnly: true })
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
