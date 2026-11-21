import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

const BASE_URL = "https://www.byiora.com.np"
// Bump when the legal pages actually change; a request-time lastmod tells crawlers nothing.
const LEGAL_UPDATED = new Date("2026-11-20")

// priority/changefreq are omitted: Google ignores them. Auth pages are noindex and excluded.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient({ readOnly: true })
  const { data: products, error } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("is_active", true)

  // Fail instead of serving a sitemap silently missing every product; crawlers retry later.
  if (error || !products) throw new Error(`Sitemap: could not load products: ${error?.message ?? "no data"}`)

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/en-np/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : LEGAL_UPDATED,
  }))
  // Home and category listings change when products change.
  const catalogUpdated = new Date(
    Math.max(LEGAL_UPDATED.getTime(), ...products.map((p) => (p.updated_at ? new Date(p.updated_at).getTime() : 0)))
  )

  return [
    { url: BASE_URL, lastModified: catalogUpdated },
    ...["topup", "digital-goods", "games", "direct-login"].map((c) => ({
      url: `${BASE_URL}/category/${c}`,
      lastModified: catalogUpdated,
    })),
    ...["about", "contact", "terms-and-conditions", "privacy-policy", "refund-policy"].map((p) => ({
      url: `${BASE_URL}/${p}`,
      lastModified: LEGAL_UPDATED,
    })),
    ...productRoutes,
  ]
}
