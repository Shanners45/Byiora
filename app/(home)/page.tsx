import { createClient } from "@supabase/supabase-js"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HomeContent } from "@/components/home-content"

interface HomepageCategory {
  id: string
  title: string
  product_ids: string[]
  products: any[]
}

interface Banner {
  id: string
  image_url: string
  link_url: string
  title: string
}

const BASE_URL = "https://www.byiora.com.np"

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch categories, products, and banners in parallel — all on the server
  const [{ data: cats }, { data: prods }, { data: bannerData }] = await Promise.all([
    supabase
      .from("homepage_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true),
    supabase
      .from("banners")
      .select("id, image_url, link_url, title")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ])

  // Map categories to their products
  const categories: HomepageCategory[] = (cats || []).map((cat: any) => {
    const catProducts = (cat.product_ids || [])
      .map((id: string) => {
        const p = (prods || []).find((p: any) => p.id === id)
        if (p) {
          const isOutOfStock = p.denominations && p.denominations.length > 0 && p.denominations.every((d: any) => d.in_stock === false)
          return { ...p, isOutOfStock }
        }
        return null
      })
      .filter(Boolean)
    return { ...cat, products: catProducts }
  })

  // Banners fallback
  const banners: Banner[] =
    bannerData && bannerData.length > 0
      ? bannerData
      : [
          { id: "1", image_url: "/images/banner-1.jpeg", link_url: "", title: "Banner 1" },
          { id: "2", image_url: "/images/banner-2.png", link_url: "", title: "Banner 2" },
          { id: "3", image_url: "/images/banner-3.png", link_url: "", title: "Banner 3" },
        ]

  // ItemList Schema for home page top products
  const homeItemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Popular Game Top-Ups & Gift Cards in Nepal",
    itemListElement: (prods || []).slice(0, 20).map((product: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: `${BASE_URL}/en-np/${product.slug}`,
      image: product.logo || `${BASE_URL}/byiora-logo-full.png`,
    })),
  }

  return (
    <div className="min-h-screen bg-brand-purple home-layout no-scrollbar">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeItemListSchema).replace(/</g, "\\u003c") }}
      />
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Visually hidden, but in the HTML for search engines, AI crawlers and screen readers. */}
        <div className="sr-only">
          <h1>Buy Game Top-Ups and Gift Cards in Nepal</h1>
          <p>Pay with eSewa, Khalti or Fonepay QR. Codes are emailed to you automatically after payment.</p>
        </div>
        <HomeContent categories={categories} banners={banners} />

        {/* Checkable facts for search engines and AI answers; visually hidden by request. */}
        <section className="sr-only">
          <h2>How buying on Byiora works</h2>
          <ol>
            <li>
              <p>1. Pick a product</p>
              <p>Choose a gift card, game top-up or game key and the amount you need. For top-ups, enter your Player ID; each product page shows where to find it.</p>
            </li>
            <li>
              <p>2. Pay using eSewa, Khalti or Fonepay</p>
              <p>Scan the QR with eSewa, Khalti, Fonepay or your bank app. No international card or PayPal account is needed.</p>
            </li>
            <li>
              <p>3. Get it by email</p>
              <p>Once payment is confirmed, your code is emailed to you and kept in your order history; top-ups are credited to your game ID.</p>
            </li>
          </ol>
          <p>
            Byiora is a Nepal-registered business (PAN 151285437). Support replies by email and WhatsApp, Sunday to Friday, 9 AM to 6 PM Nepal time.
            Problems with a code? Read our <a href="/refund-policy">Refund Policy</a>, or see what customers say on{" "}
            <a href="https://www.trustpilot.com/review/byiora.com.np" target="_blank" rel="noopener noreferrer">Trustpilot</a>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
