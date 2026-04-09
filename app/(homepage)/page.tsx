"use client"

import { useRouter } from "next/navigation"
import { BannerCarousel } from "@/components/banner-carousel"
import { GiftCard } from "@/components/gift-card"
import { LoadingScreen } from "@/components/loading-screen"
import { LoadingOverlay } from "@/components/loading-overlay"
import { Badge } from "@/components/ui/badge"
import { getFeaturedGiftCards, getWebStoreGames, type Product } from "@/lib/product-categories"
import { useEffect, useState } from "react"

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showLoading, setShowLoading] = useState(true)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [featuredCards, setFeaturedCards] = useState<Product[]>([])
  const [webStoreGames, setWebStoreGames] = useState<Product[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)

  // Load products from Supabase
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const [featured, webStore] = await Promise.all([getFeaturedGiftCards(), getWebStoreGames()])
        setFeaturedCards(featured)
        setWebStoreGames(webStore)
      } catch (error) {
        console.error("Error loading products:", error)
      } finally {
        setProductsLoaded(true)
      }
    }

    loadProducts()
  }, [])

  // Handle initial loading screen
  useEffect(() => {
    setMounted(true)

    // Hide loading screen after products are loaded or after 2 seconds max
    const timer = setTimeout(() => {
      setShowLoading(false)
    }, 2000)

    if (productsLoaded) {
      setShowLoading(false)
      clearTimeout(timer)
    }

    return () => clearTimeout(timer)
  }, [productsLoaded])

  const handleLoadingComplete = () => {
    setShowLoading(false)
  }

  // Show custom loading screen only initially
  if (showLoading && !mounted) {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  // Don't render until mounted
  if (!mounted) {
    return null
  }

  return (
    <HomeContent
      loadingOverlayVisible={showLoadingOverlay}
      setLoadingOverlayVisible={setShowLoadingOverlay}
      featuredCards={featuredCards}
      webStoreGames={webStoreGames}
    />
  )
}

function HomeContent({
  loadingOverlayVisible,
  setLoadingOverlayVisible,
  featuredCards,
  webStoreGames,
}: {
  loadingOverlayVisible: boolean
  setLoadingOverlayVisible: (visible: boolean) => void
  featuredCards: Product[]
  webStoreGames: Product[]
}) {
  const router = useRouter()

  const handleGiftCardClick = (product: Product) => {
    console.log(`Navigating to product: ${product.id}`)
    setLoadingOverlayVisible(true)

    // Simulate loading delay
    setTimeout(() => {
      setLoadingOverlayVisible(false)
      router.push(`/${product.category}/${product.slug}`)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      <LoadingOverlay isLoading={loadingOverlayVisible} />

      <div className="container mx-auto px-4 py-8">
        {/* Hero Banner */}
        <section className="mb-12">
          <BannerCarousel />
        </section>

        {/* Featured Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <Badge className="bg-[#A8F1FF] text-brand-charcoal font-semibold">NEW</Badge>
              Featured Gift Cards
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {featuredCards.map((card) => (
              <GiftCard key={card.id} {...card} onClick={() => handleGiftCardClick(card)} />
            ))}
          </div>
        </section>

        {/* Most Popular Section */}
        <section className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">MOST POPULAR</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {webStoreGames.map((game) => (
              <div key={game.id} className="relative">
                <GiftCard {...game} onClick={() => handleGiftCardClick(game)} />
                {game.hasUpdate && (
                  <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs">NEW UPDATE</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
