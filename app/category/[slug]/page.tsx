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

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categorySlug = params.slug as string
  
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [categoryName, setCategoryName] = useState("")
  const [isInvalidCategory, setIsInvalidCategory] = useState(false)

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
  }, [categorySlug])

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
          onClick={() => router.back()} 
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
                  ) : product.isNew ? (
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
