"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { supabase } from "@/lib/supabase"
import { LoadingScreen } from "@/components/loading-screen"
import Image from "next/image"
import Link from "next/link"

interface Product {
  id: string
  name: string
  slug: string
  logo: string
  category: string
  description?: string
  is_new?: boolean
  has_update?: boolean
  ribbon_text?: string
  denominations?: Array<{
    price: string
    label: string
  }>
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.slug as string
  
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryName, setCategoryName] = useState("")

  // Map category slugs to display names
  const categoryDisplayNames: Record<string, string> = {
    "digital-goods": "Digital Gift Cards",
    "topup": "Game Top-ups",
    "gift-cards": "Gift Cards",
    "games": "Games",
  }

  useEffect(() => {
    const loadProducts = async () => {
      try {
        // Set category name
        setCategoryName(
          categoryDisplayNames[categorySlug] || 
          categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1).replace(/-/g, " ")
        )

        // Fetch products for this category
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("category", categorySlug)
          .eq("is_active", true)
          .order("created_at", { ascending: true })

        if (error) {
          console.error("Error fetching products:", error)
          // Try fallback data
          const fallbackProducts = getFallbackProducts(categorySlug)
          setProducts(fallbackProducts)
        } else {
          setProducts(data || [])
        }
      } catch (error) {
        console.error("Error loading products:", error)
        const fallbackProducts = getFallbackProducts(categorySlug)
        setProducts(fallbackProducts)
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [categorySlug])

  // Fallback products when Supabase is not available
  const getFallbackProducts = (category: string): Product[] => {
    const allFallbackProducts: Product[] = [
      {
        id: "steam",
        name: "Steam",
        slug: "steam",
        logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-raJlby6bwgAtegf2vFVs2cg9HdD6co.png",
        category: "digital-goods",
        description: "Steam Gift Cards are the perfect way to give the gift of games to your friends and family.",
        denominations: [
          { price: "5", label: "$5 Gift Card" },
          { price: "10", label: "$10 Gift Card" },
          { price: "25", label: "$25 Gift Card" },
          { price: "50", label: "$50 Gift Card" },
          { price: "100", label: "$100 Gift Card" },
        ],
      },
      {
        id: "netflix",
        name: "Netflix",
        slug: "netflix",
        logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-z7JNMzDqDR1vsaUcrYVQgPUMMK44Mp.png",
        category: "digital-goods",
        description: "Give the gift of entertainment with Netflix Gift Cards.",
        denominations: [
          { price: "15", label: "$15 Gift Card" },
          { price: "25", label: "$25 Gift Card" },
          { price: "50", label: "$50 Gift Card" },
        ],
      },
      {
        id: "pubg",
        name: "PUBG Mobile",
        slug: "pubg-mobile",
        logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-6OM16bzJeXfUELJMqjmDEWeuA4MD0U.png",
        category: "topup",
        description: "Buy PUBG Mobile UC voucher in seconds!",
        denominations: [
          { price: "0.99", label: "60 UC" },
          { price: "4.99", label: "325 UC" },
          { price: "9.99", label: "660 UC" },
        ],
      },
      {
        id: "free-fire",
        name: "Free Fire",
        slug: "free-fire",
        logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-2ttcNnBkFPWohceY14WxQatH1Nuapj.png",
        category: "topup",
        description: "Purchase Free Fire Diamonds instantly!",
        denominations: [
          { price: "0.99", label: "100 Diamonds" },
          { price: "4.99", label: "520 Diamonds" },
        ],
      },
      {
        id: "cod-mobile",
        name: "COD:M Web Store",
        slug: "cod-m-web-store",
        logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-lFTQEUECc5MwgnRVRsVoTIiCHL5eQ5.png",
        category: "topup",
        description: "Get COD Mobile CP instantly!",
        denominations: [
          { price: "0.99", label: "80 CP" },
          { price: "4.99", label: "400 CP" },
        ],
      },
      {
        id: "mobile-legends",
        name: "Mobile Legends",
        slug: "mobile-legends",
        logo: "/placeholder.svg?height=80&width=80",
        category: "topup",
        description: "Buy Mobile Legends Diamonds at the best prices!",
        denominations: [
          { price: "1.99", label: "86 Diamonds" },
          { price: "3.99", label: "172 Diamonds" },
        ],
      },
    ]

    return allFallbackProducts.filter(p => p.category === category)
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push("/")} 
          className="mb-6 text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
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
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/${product.category}/${product.slug}`}
                className="group"
              >
                <div className="relative bg-gray-800 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden h-full">
                  {/* Background gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Ribbon badge */}
                  {product.ribbon_text ? (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[10px] font-bold px-2 py-1 rounded shadow z-10 uppercase tracking-wide">
                      {product.ribbon_text}
                    </div>
                  ) : product.is_new ? (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded transform -rotate-12 z-10">
                      NEW
                    </div>
                  ) : null}

                  {/* Icon container */}
                  <div className="relative aspect-square bg-gray-700 rounded-lg flex items-center justify-center mb-3 group-hover:bg-gray-600 transition-colors overflow-hidden">
                    <div className="w-full h-full relative group-hover:scale-110 transition-transform duration-300">
                      <Image
                        src={product.logo || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="relative z-10">
                    <h3 className="font-semibold text-white text-sm md:text-base text-center group-hover:text-yellow-300 transition-colors">
                      {product.name}
                    </h3>
                  </div>

                  {/* Price range */}
                  {product.denominations && product.denominations.length > 0 && (
                    <div className="mt-2 text-center">
                      <span className="text-xs text-white/60">
                        From{" "}
                        <span className="text-[#FF6B93] font-semibold">
                          Rs. {product.denominations[0].price}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
