"use client"

import { useState, useEffect } from "react"
import { getAllProducts, type Product } from "@/lib/product-categories"
import Image from "next/image"

interface SearchResultsProps {
  query: string
  onItemClick: (category: string, slug: string) => void
}

export function SearchResults({ query, onItemClick }: SearchResultsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      .slice(0, 6) // Limit to 6 results

    setFilteredProducts(filtered)
  }, [query, products])

  if (isLoading) {
    return (
      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 p-4 z-50">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-brand-sky-blue border-t-transparent"></div>
          <span className="ml-2 text-sm text-gray-500">Searching...</span>
        </div>
      </div>
    )
  }

  if (!query.trim() || filteredProducts.length === 0) {
    return null
  }

  return (
    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50 max-h-96 overflow-y-auto">
      <div className="p-2">
        <div className="text-xs text-gray-500 px-3 py-2 border-b">
          {filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""} found
        </div>
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-md transition-colors"
            onClick={() => onItemClick(product.category, product.slug)}
          >
            <div className="w-10 h-10 relative rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
              <Image
                src={product.logo || "/placeholder.svg?height=40&width=40"}
                alt={product.name}
                fill
                className="object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{product.name}</div>
              <div className="text-sm text-gray-500 truncate">
                {product.description || `${product.category === "topup" ? "Top-up" : "Digital Goods"}`}
              </div>
            </div>
            <div className="text-xs text-gray-400">{product.category === "topup" ? "Top-up" : "Gift Card"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
