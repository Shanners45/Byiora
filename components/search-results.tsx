"use client"

import { useState, useEffect, useCallback } from "react"
import { getAllProducts, type Product } from "@/lib/product-categories"
import Image from "next/image"
import { useRouter } from "next/navigation"

interface SearchResultsProps {
  query: string
  onItemClick: (category: string, slug: string) => void
}

function SearchSkeleton() {
  return (
    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 p-3 z-50 space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-md animate-pulse">
          <div className="w-10 h-10 bg-gray-200 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
          <div className="h-3 w-14 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  )
}

export function SearchResults({ query, onItemClick }: SearchResultsProps) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [navigating, setNavigating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const allProducts = await getAllProducts()
        setProducts(allProducts)
      } catch (error) {
        console.error("Error loading products for search:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([])
      return
    }
    const filtered = products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          product.description?.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 6)
    setFilteredProducts(filtered)
  }, [query, products])

  const handleClick = useCallback(
    (product: Product) => {
      setActiveId(product.id)
      setNavigating(true)
      // Notify parent (closes search bar etc.)
      onItemClick(product.category, product.slug)
    },
    [onItemClick],
  )

  if (isLoading) return <SearchSkeleton />

  if (!query.trim() || filteredProducts.length === 0) return null

  return (
    <>
      {/* Full-screen skeleton overlay triggered on click */}
      {navigating && (
        <div className="fixed inset-0 z-[200] bg-brand-purple flex flex-col">
          {/* Fake header */}
          <div className="h-16 bg-brand-white/10 border-b border-white/10" />
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
              {/* Left image skeleton */}
              <div className="bg-white/10 rounded-2xl h-80" />
              {/* Right content skeleton */}
              <div className="lg:col-span-2 space-y-4">
                <div className="h-8 w-2/3 bg-white/10 rounded" />
                <div className="h-4 w-full bg-white/10 rounded" />
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-white/10 rounded-xl" />
                  ))}
                </div>
                <div className="h-12 w-full bg-white/10 rounded-xl mt-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-96 overflow-y-auto">
        <div className="p-2">
          <div className="text-xs text-gray-500 px-3 py-2 border-b">
            {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""} found
          </div>
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-md transition-colors ${
                activeId === product.id ? "bg-gray-100" : ""
              }`}
              onClick={() => handleClick(product)}
            >
              <div className="w-10 h-10 relative rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                <Image
                  src={product.logo || "/placeholder.svg?height=40&width=40"}
                  alt={product.name}
                  fill
                  className="object-contain"
                  sizes="40px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{product.name}</div>
                <div className="text-sm text-gray-500 truncate">
                  {product.description || `${product.category === "topup" ? "Top-up" : "Digital Goods"}`}
                </div>
              </div>
              <div className="text-xs text-gray-400 flex-shrink-0">
                {product.category === "topup" ? "Top-up" : "Gift Card"}
              </div>
              {activeId === product.id && (
                <div className="w-4 h-4 border-2 border-brand-sky-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
