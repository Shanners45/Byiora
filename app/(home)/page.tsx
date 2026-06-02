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

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <h1 className="sr-only">
            Buy Game Top-Ups and Gift Cards in Nepal
          </h1>
          <p className="sr-only">
            Instant digital delivery for popular games, entertainment, and online services.
          </p>
        <HomeContent categories={categories} banners={banners} />
      </main>

      <Footer />
    </div>
  )
}
