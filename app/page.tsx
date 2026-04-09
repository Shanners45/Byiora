"use client"

import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { BannerCarousel } from "@/components/banner-carousel"
import { GiftCard } from "@/components/gift-card"
import { Footer } from "@/components/footer"
import { LoadingScreen } from "@/components/loading-screen"
import { LoadingOverlay } from "@/components/loading-overlay"
import { supabase } from "@/lib/supabase"
import { useEffect, useState } from "react"

interface HomepageCategory {
  id: string
  title: string
  products: any[]
}

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [showLoading, setShowLoading] = useState(true)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [categories, setCategories] = useState<HomepageCategory[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const { data: cats, error: catErr } = await supabase
          .from("homepage_categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })

        if (catErr || !cats) return

        const { data: prods } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)

        if (!prods) return

        const mappedCategories = cats.map(cat => {
          const catProducts = (cat.product_ids || []).map((id: string) => prods.find(p => p.id === id)).filter(Boolean)
          return { ...cat, products: catProducts }
        })

        setCategories(mappedCategories)
      } catch (error) {
        console.error("Error loading products:", error)
      } finally {
        setProductsLoaded(true)
      }
    }

    loadProducts()
  }, [])

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => setShowLoading(false), 2000)
    if (productsLoaded) {
      setShowLoading(false)
      clearTimeout(timer)
    }
    return () => clearTimeout(timer)
  }, [productsLoaded])

  if (showLoading) {
    return <LoadingScreen onComplete={() => setShowLoading(false)} />
  }

  if (!mounted) {
    return null
  }

  return (
    <HomeContent
      loadingOverlayVisible={showLoadingOverlay}
      setLoadingOverlayVisible={setShowLoadingOverlay}
      categories={categories}
    />
  )
}

function HomeContent({
  loadingOverlayVisible,
  setLoadingOverlayVisible,
  categories,
}: {
  loadingOverlayVisible: boolean
  setLoadingOverlayVisible: (visible: boolean) => void
  categories: HomepageCategory[]
}) {
  const router = useRouter()
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const handleGiftCardClick = (card: any) => {
    // Use category and slug if available, otherwise fall back to id-based URL
    if (card.category && card.slug) {
      router.push(`/${card.category}/${card.slug}`)
    } else {
      router.push(`/gift-card/${card.id}`)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }

  // Show max 2 rows of 6 = 12 items; show "View All" if more
  const ITEMS_PER_ROW = 6
  const MAX_VISIBLE = ITEMS_PER_ROW * 2

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />
      <LoadingOverlay isLoading={loadingOverlayVisible} />

      <main className="container mx-auto px-4 py-8">
        <section className="mb-12">
          <BannerCarousel />
        </section>

        {categories.map((category) => (
          category.products.length > 0 && (
            <section key={category.id} className="mb-12">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 rounded-full bg-brand-sky-blue flex-shrink-0" />
                <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wide">
                  {category.title}
                </h2>
              </div>

              {/* 2-row grid, max 12 items unless expanded */}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                {category.products
                  .slice(0, expandedCategories[category.id] ? undefined : MAX_VISIBLE)
                  .map((card) => (
                    <GiftCard key={card.id} {...card} ribbon_text={card.ribbon_text} onClick={() => handleGiftCardClick(card)} />
                  ))}
              </div>

              {/* View All link below grid — only if more than 12 items */}
              {category.products.length > MAX_VISIBLE && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="inline-flex items-center gap-1.5 text-white font-bold text-base underline underline-offset-4 hover:text-brand-sky-blue transition-colors"
                  >
                    {expandedCategories[category.id] ? "Show Less" : "View All"}
                  </button>
                </div>
              )}
            </section>
          )
        ))}
      </main>

      <Footer />
    </div>
  )
}
