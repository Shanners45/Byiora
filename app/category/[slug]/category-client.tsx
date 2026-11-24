"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Package, Frown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CategorySkeleton } from "@/components/category-skeleton"
import { getAllProducts, Product } from "@/lib/product-categories"
import Image from "next/image"
import Link from "next/link"

// Valid category slugs — keep in sync with the DB CHECK constraint
const VALID_CATEGORIES: Record<string, string> = {
  "digital-goods": "Digital Gift Cards",
  "topup": "Game Top-ups",
  "games": "Games",
  "direct-login": "Direct Login",
}

const priceOf = (d: { price?: unknown }) => parseFloat(String(d?.price ?? "").replace(/,/g, ""))

/** Cheapest pack, not whichever denomination happens to be listed first. */
function lowestPrice(product: Product): string {
  const prices = (product.denominations || []).map(priceOf).filter((n) => Number.isFinite(n) && n > 0)
  return prices.length ? Math.min(...prices).toLocaleString("en-IN") : String(product.denominations?.[0]?.price ?? "")
}

/** Products with every pack sold out go last (stable, so admin order is kept otherwise). */
function sortInStockFirst(list: Product[]): Product[] {
  const soldOut = (p: Product) => (p.denominations || []).length > 0 && (p.denominations || []).every((d: any) => d.in_stock === false)
  return [...list].sort((a, b) => Number(soldOut(a)) - Number(soldOut(b)))
}

// Category intros: helpful, verifiable copy for shoppers and search/AI crawlers.
const CATEGORY_INTROS: Record<string, string[]> = {
  "digital-goods": [
    "Buy digital gift cards in Nepal and pay in rupees with eSewa, Khalti or any Fonepay QR, with no international card needed. Byiora stocks cards for gaming, shopping and apps, including Steam, Google Play, App Store, PlayStation, Xbox Game Pass, Nintendo eShop, Amazon, Roblox, Valorant and Discord Nitro, plus software keys such as Windows, Microsoft Office and Norton 360.",
    "Each card works only in the region shown on its product page. Many of our codes are India (INR) region, so check that your account uses the same country before you buy: region mismatches are not refundable. Prices are in NPR, and the card's face value is listed next to each price.",
    "After payment is confirmed, your code is emailed to you and saved in your order history. Every product page has step-by-step instructions for adding the code to your account. If a code shows an error, contact us within 24 hours with your order ID and a screenshot and our team will look into it, as set out in our Refund Policy.",
  ],
  topup: [
    "Top up your favourite games in Nepal without sharing your password. Byiora credits in-game currency straight to your account using your Player ID (UID), plus a server or zone ID for some games. Available top-ups include PUBG Mobile UC, Free Fire diamonds, Genshin Impact, Clash of Clans and EA SPORTS FC Mobile.",
    "Pick your game and amount, enter your Player ID, and pay in NPR by scanning the QR with eSewa, Khalti or your bank app. Each product page shows where to find your ID. Copy it carefully: once currency is credited to the ID you entered, it cannot be reversed.",
    "Packs marked Out of Stock cannot be ordered until they are restocked. If an order cannot be completed because the Player ID is invalid, it is held until you send the correct details, or refunded in full on request.",
  ],
  games: [
    "Buy official PC game keys in Nepal and pay in rupees through eSewa, Khalti or Fonepay QR. Our catalogue includes Grand Theft Auto V, Minecraft and Red Dead Redemption 2, all as GLOBAL keys.",
    "Every key activates on a specific platform or launcher, which is stated on its product page. Check the platform and make sure your PC meets the game's minimum requirements before you buy, because keys bought for the wrong platform or an incompatible device cannot be refunded.",
    "After payment is confirmed, your key is emailed to you and saved in your order history together with activation steps. If a key shows an activation error, send us your order ID and a screenshot of the error within 24 hours and our team will look into it.",
  ],
  "direct-login": [
    "Some subscriptions cannot be bought with a code or a player ID, so Byiora activates them directly on your account. This category covers ChatGPT, Claude, Netflix and Prime Video plans, paid in Nepali rupees with eSewa, Khalti or Fonepay QR.",
    "To order, choose a plan, pay, and enter the account email and password requested on the product page. Our team signs in, activates the plan and confirms by email, usually during support hours (Sunday to Friday, 9 AM to 6 PM Nepal time). Change your password once the plan is active.",
    "Direct-login orders are processed by hand, so they take longer than instant code delivery. Each product page lists the plan length and what is included. Questions before ordering? Message us on WhatsApp.",
  ],
}

export default function CategoryPage({ initialProducts = null }: { initialProducts?: Product[] | null }) {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.slug as string

  // Server-rendered list and heading: the HTML has the H1 and product names up front.
  const [products, setProducts] = useState<Product[]>(initialProducts ?? [])
  const [isLoading, setIsLoading] = useState(!initialProducts && Boolean(VALID_CATEGORIES[categorySlug]))
  const [categoryName, setCategoryName] = useState(VALID_CATEGORIES[categorySlug] ?? "")
  const [isInvalidCategory, setIsInvalidCategory] = useState(!VALID_CATEGORIES[categorySlug])

  // Reset scroll position on mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    // Validate category slug first
    if (!VALID_CATEGORIES[categorySlug]) {
      setIsInvalidCategory(true)
      setIsLoading(false)
      return
    }

    setCategoryName(VALID_CATEGORIES[categorySlug])
    if (initialProducts) return

    const loadProducts = async () => {
      try {
        const allProducts = await getAllProducts()
        const categoryProducts = allProducts.filter(
          (p) => p.category === categorySlug && p.isActive !== false
        )
        setProducts(categoryProducts)
      } catch (error) {
        console.error("Error loading products:", error)
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [categorySlug, initialProducts])

  if (isLoading) {
    return <CategorySkeleton />
  }

  // Invalid category → Oops! page
  if (isInvalidCategory) {
    return (
      <div className="min-h-screen bg-brand-purple flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 mt-10">
          <Frown className="h-20 w-20 text-white/60 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-3">Oops!</h1>
          <p className="text-white/60 text-center max-w-sm mb-8">
            Either this page does not exist or we ran into an issue.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-brand-sky-blue hover:bg-brand-sky-blue/80 px-8 py-3 text-base font-semibold rounded-full"
          >
            Back to page
          </Button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          asChild
          className="mb-6 text-white hover:bg-white/10"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{categoryName}</h1>
          <p className="text-white/70">
            Browse our selection of {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-white/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No products found</h2>
            <p className="text-white/60 mb-6">
              There are no products available in this category yet.
            </p>
            <Button 
              onClick={() => router.push("/")}
              className="bg-brand-sky-blue hover:bg-brand-sky-blue/80"
            >
              Browse All Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {sortInStockFirst(products).map((product, index) => (
              <Link
                key={product.id}
                href={`/en-np/${product.slug}`}
                className="group"
              >
                <div className="relative bg-gray-800 rounded-xl p-2.5 sm:p-3 md:p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden h-full flex flex-col justify-between">
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4DA8DA]/20 to-[#80D8C3]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Ribbon badge */}
                  {product.ribbon_text ? (
                    <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shadow z-10 uppercase tracking-wide">
                      {product.ribbon_text}
                    </div>
                  ) : product.isNew ? (
                    <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-yellow-400 text-black text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transform -rotate-12 z-10">
                      NEW
                    </div>
                  ) : null}

                  {/* Icon container */}
                  <div className="relative aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-gray-600 transition-colors overflow-hidden">
                    <div className="w-full h-full relative group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src={product.logo || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1200px) 22vw, 18vw"
                        priority={index < 2}
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="relative z-10 flex-1 flex items-center justify-center min-h-[2rem] sm:min-h-[2.5rem]">
                    <h2 className="font-semibold text-white text-[11px] sm:text-xs md:text-sm lg:text-base text-center group-hover:text-yellow-300 transition-colors leading-tight line-clamp-3 break-words">
                      {product.name}
                    </h2>
                  </div>

                  {/* Price range */}
                  {product.denominations && product.denominations.length > 0 && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-white/60">
                        From{" "}
                        <span className="text-[#FF6B93] font-semibold">
                          Rs. {lowestPrice(product)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {CATEGORY_INTROS[categorySlug] && (
          <section className="mt-12 max-w-3xl text-white/80 space-y-3 text-sm sm:text-base leading-relaxed">
            <h2 className="text-xl font-semibold text-white">About {categoryName}</h2>
            {CATEGORY_INTROS[categorySlug].map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
