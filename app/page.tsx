import { createClient } from "@/lib/supabase/server"
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
  const supabase = await createClient()

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
      .map((id: string) => (prods || []).find((p: any) => p.id === id))
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
        <HomeContent categories={categories} banners={banners} />
      </main>

      <Footer />
    </div>
  )
}
