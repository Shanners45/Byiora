"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { BannerCarousel } from "@/components/banner-carousel"
import { GiftCard } from "@/components/gift-card"

interface HomepageCategory {
  id: string
  title: string
  products: any[]
}

interface Banner {
  id: string
  image_url: string
  link_url: string
  title: string
}

interface HomeContentProps {
  categories: HomepageCategory[]
  banners: Banner[]
}

export function HomeContent({ categories, banners }: HomeContentProps) {
  const router = useRouter()
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleGiftCardClick = (card: any) => {
    if (card.category && card.slug) {
      router.push(`/en-np/${card.slug}`)
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

  // Desktop: 2 rows of 6 = 12 items. Mobile: 6 items.
  const DESKTOP_MAX = 12
  const MOBILE_MAX = 6

  return (
    <>
      {/* Hero Banner */}
      <section className="mb-12">
        <BannerCarousel banners={banners} />
      </section>

      {/* Category Sections */}
      {categories.map(
        (category) => {
          const maxVisible = isMobile ? MOBILE_MAX : DESKTOP_MAX
          const isExpanded = expandedCategories[category.id]
          const hasMore = category.products.length > maxVisible

          return category.products.length > 0 && (
            <section key={category.id} className="mb-12">
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-8 rounded-full bg-brand-sky-blue flex-shrink-0" />
                <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wide">
                  {category.title}
                </h2>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                {category.products
                  .slice(0, isExpanded ? undefined : maxVisible)
                  .map((card) => (
                    <GiftCard
                      key={card.id}
                      {...card}
                      ribbon_text={card.ribbon_text}
                      onClick={() => handleGiftCardClick(card)}
                    />
                  ))}
              </div>

              {/* View All / Show Less button */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="inline-flex items-center gap-1.5 text-white font-bold text-base underline underline-offset-4 hover:text-brand-sky-blue transition-colors"
                  >
                    {isExpanded ? "Show Less" : "View All"}
                  </button>
                </div>
              )}
            </section>
          )
        },
      )}
    </>
  )
}
