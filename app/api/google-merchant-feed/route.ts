import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // Cache for 1 hour

function escapeXml(unsafe: string): string {
  if (!unsafe) return ""
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function stripHtml(html: string): string {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim()
}

/**
 * Google Merchant Center Dynamic Product Feed (RSS 2.0 XML)
 *
 * Automatically pulls all active products and denominations from Supabase
 * and outputs standard Google Shopping XML format.
 *
 * Usage in Google Merchant Center:
 * 1. Add Product Source -> Scheduled fetch
 * 2. Feed URL: https://www.byiora.com.np/api/google-merchant-feed
 * 3. Schedule: Daily (e.g. 00:00)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const currency = (searchParams.get("currency") || "NPR").toUpperCase()
    const targetCountry = (searchParams.get("country") || "NP").toUpperCase()
    const siteUrl = "https://www.byiora.com.np"

    const supabase = await createClient()
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)

    if (error) {
      console.error("[GMC Feed] Database error:", error)
      return new Response("Failed to load products", { status: 500 })
    }

    const items: string[] = []

    for (const p of products || []) {
      const denoms = Array.isArray(p.denominations) ? p.denominations : []
      const productDescription = stripHtml(p.description || `Buy ${p.name} instant digital delivery online at Byiora.`)
      const productLink = `${siteUrl}/en-np/${p.slug}`
      const imageLink = p.logo || `${siteUrl}/icon.png`

      if (denoms.length === 0) {
        // Single product entry
        items.push(`    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(productDescription)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:availability>${p.is_active ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>0.00 ${currency}</g:price>
      <g:brand>Byiora</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>53</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
      <g:shipping>
        <g:country>${targetCountry}</g:country>
        <g:service>Digital Delivery</g:service>
        <g:price>0.00 ${currency}</g:price>
      </g:shipping>
    </item>`)
      } else {
        // Output each denomination as a purchasable variant item
        denoms.forEach((denom: any, idx: number) => {
          const rawPrice = String(denom.price || "0").replace(/,/g, "").trim()
          const parsedPrice = parseFloat(rawPrice) || 0
          const formattedPrice = `${parsedPrice.toFixed(2)} ${currency}`
          const isItemInStock = denom.in_stock !== false && p.is_active !== false
          const itemTitle = `${p.name} - ${denom.label}`
          const itemId = `${p.id}-${idx + 1}`

          items.push(`    <item>
      <g:id>${escapeXml(itemId)}</g:id>
      <g:item_group_id>${escapeXml(p.id)}</g:item_group_id>
      <g:title>${escapeXml(itemTitle)}</g:title>
      <g:description>${escapeXml(productDescription)}</g:description>
      <g:link>${escapeXml(productLink)}</g:link>
      <g:image_link>${escapeXml(denom.icon_url || imageLink)}</g:image_link>
      <g:availability>${isItemInStock ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${formattedPrice}</g:price>
      <g:brand>Byiora</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>53</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
      <g:shipping>
        <g:country>${targetCountry}</g:country>
        <g:service>Digital Delivery</g:service>
        <g:price>0.00 ${currency}</g:price>
      </g:shipping>
    </item>`)
        })
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Byiora Products Feed</title>
    <link>${siteUrl}</link>
    <description>Official Google Merchant Center Product Feed for Byiora</description>
${items.join("\n")}
  </channel>
</rss>`

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    })
  } catch (err: any) {
    console.error("[GMC Feed] Unexpected error:", err)
    return new Response("Internal Server Error", { status: 500 })
  }
}
