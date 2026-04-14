"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
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

  const handleGiftCardClick = (card: any) => {
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
    <>
      {/* Hero Banner */}
      <section className="mb-12">
        <BannerCarousel initialBanners={banners} />
      </section>

      {/* Category Sections */}
      {categories.map(
        (category) =>
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
                    <GiftCard
                      key={card.id}
                      {...card}
                      ribbon_text={card.ribbon_text}
                      onClick={() => handleGiftCardClick(card)}
                    />
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
          ),
      )}
    </>
  )
}
