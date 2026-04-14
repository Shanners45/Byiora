import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const BASE_URL = "https://www.byiora.store"

const supabase = createClient(supabaseUrl, supabaseKey)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/transactions`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/settings`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ]

  // Category routes
  const categoryRoutes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/category/topup`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/category/digital-goods`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ]

  // Dynamic product routes from Supabase
  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("slug, category, updated_at")
      .eq("is_active", true)

    if (!error && products) {
      productRoutes = products.map((product) => ({
        url: `${BASE_URL}/${product.category}/${product.slug}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.9,
      }))
    }
  } catch (e) {
    console.error("Sitemap: Error fetching products:", e)
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes]
}
