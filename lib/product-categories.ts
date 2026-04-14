import { supabase } from "./supabase"
import { createServiceRoleClient } from "./supabase/service-role"

export interface Product {
  id: string
  name: string
  slug: string
  logo: string
  category: "topup" | "digital-goods"
  isNew?: boolean
  hasUpdate?: boolean
  isActive?: boolean
  description?: string
  denom_icon_url?: string
  ribbon_text?: string
  denominations?: Array<{
    price: string
    label: string
    icon_url?: string
    bestseller?: boolean
  }>
  faqs?: Array<{
    question: string
    answer: string
  }>
}

// Note: We used to have fallback arrays here, but they were removed for bundle optimization.
// All data is now purely fetched from the database.

// Cache for products
let productsCache: Product[] = []
let lastFetch = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Check if Supabase is properly configured
function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// Get all products from Supabase with fallback
export async function getAllProducts(useServiceRole = false): Promise<Product[]> {
  const now = Date.now()

  // Return cached data if it's still fresh (only for non-service role calls)
  if (!useServiceRole && productsCache.length > 0 && now - lastFetch < CACHE_DURATION) {
    return productsCache
  }

  // If Supabase is not configured, return fallback data
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured, using fallback data")
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    productsCache = fallbackProducts
    lastFetch = now
    return fallbackProducts
  }

  try {
    // Use Service Role for admin operations to bypass RLS
    const client = useServiceRole ? createServiceRoleClient() : supabase
    const { data, error } = await client.from("products").select("*").order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching products:", error)
      // If we have cached data, return it; otherwise return fallback
      if (productsCache.length > 0) {
        return productsCache
      }
      console.warn("Using fallback data due to Supabase error")
      const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
      return fallbackProducts
    }

    // Transform Supabase data to our Product interface
    const products: Product[] = data.map((product: any) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      logo: product.logo,
      category: product.category,
      isNew: product.is_new,
      hasUpdate: product.has_update,
      isActive: product.is_active,
      description: product.description,
      denom_icon_url: product.denom_icon_url || undefined,
      ribbon_text: product.ribbon_text || undefined,
      denominations: product.denominations || [],
      faqs: product.faqs || [],
    }))

    // Update cache
    productsCache = products
    lastFetch = now

    return products
  } catch (error) {
    console.error("Error fetching products:", error)
    // Return cached data if available, otherwise fallback
    if (productsCache.length > 0) {
      return productsCache
    }
    console.warn("Using fallback data due to network error")
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    return fallbackProducts
  }
}

// Get featured gift cards (first 6 products with category digital-goods)
export async function getFeaturedGiftCards(): Promise<Product[]> {
  const allProducts = await getAllProducts()
  return allProducts.filter((product) => product.category === "digital-goods" && product.isActive !== false).slice(0, 6)
}

// Get web store games (products with category topup or remaining digital-goods)
export async function getWebStoreGames(): Promise<Product[]> {
  const allProducts = await getAllProducts()
  const featured = await getFeaturedGiftCards()
  const featuredIds = featured.map((p) => p.id)

  return allProducts
    .filter(
      (product) => product.isActive !== false && (product.category === "topup" || !featuredIds.includes(product.id)),
    )
    .slice(0, 4)
}

// Get product by ID
export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    return fallbackProducts.find((product) => product.id === id) || null
  }

  try {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single()

    if (error) {
      console.error("Error fetching product:", error)
      // Try fallback data
      const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
      return fallbackProducts.find((product) => product.id === id) || null
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      logo: data.logo,
      category: data.category,
      isNew: data.is_new,
      hasUpdate: data.has_update,
      isActive: data.is_active,
      description: data.description,
      denom_icon_url: data.denom_icon_url || undefined,
      ribbon_text: data.ribbon_text || undefined,
      denominations: data.denominations || [],
      faqs: data.faqs || [],
    }
  } catch (error) {
    console.error("Error fetching product:", error)
    // Try fallback data
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    return fallbackProducts.find((product) => product.id === id) || null
  }
}

// Get product by slug
export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    return fallbackProducts.find((product) => product.slug === slug) || null
  }

  try {
    const { data, error } = await supabase.from("products").select("*").eq("slug", slug).single()

    if (error) {
      console.error("Error fetching product by slug:", error)
      // Try fallback data
      const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
      return fallbackProducts.find((product) => product.slug === slug) || null
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      logo: data.logo,
      category: data.category,
      isNew: data.is_new,
      hasUpdate: data.has_update,
      isActive: data.is_active,
      description: data.description,
      denom_icon_url: data.denom_icon_url || undefined,
      ribbon_text: data.ribbon_text || undefined,
      denominations: data.denominations || [],
      faqs: data.faqs || [],
    }
  } catch (error) {
    console.error("Error fetching product by slug:", error)
    // Try fallback data
    const fallbackProducts = [...fallbackFeaturedGiftCards, ...fallbackWebStoreGames]
    return fallbackProducts.find((product) => product.slug === slug) || null
  }
}

// Delete product
export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured")
  }

  try {
    // Use Service Role to bypass RLS for admin operations
    const serviceSupabase = createServiceRoleClient()
    const { error } = await serviceSupabase.from("products").delete().eq("id", id)

    if (error) {
      console.error("Error deleting product:", error)
      throw new Error(error.message || "Failed to delete product")
    }

    // Clear cache to force refresh
    productsCache = []
    lastFetch = 0

    console.log(`Product ${id} deleted`)
  } catch (error) {
    console.error("Error deleting product:", error)
    throw error
  }
}

// Update product status
export async function updateProductStatus(id: string, isActive: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured")
  }

  try {
    // Use Service Role to bypass RLS for admin operations
    const serviceSupabase = createServiceRoleClient()
    const { error } = await serviceSupabase
      .from("products")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating product status:", error)
      throw new Error(error.message || "Failed to update product status")
    }

    // Clear cache to force refresh
    productsCache = []
    lastFetch = 0

    console.log(`Product ${id} status updated to ${isActive ? "active" : "inactive"}`)
  } catch (error) {
    console.error("Error updating product status:", error)
    throw error
  }
}

// Update product
export async function updateProduct(id: string, updatedProduct: Partial<Product>): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured")
  }

  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    // Map our Product interface to Supabase columns
    if (updatedProduct.name !== undefined) updateData.name = updatedProduct.name
    if (updatedProduct.logo !== undefined) updateData.logo = updatedProduct.logo
    if (updatedProduct.category !== undefined) updateData.category = updatedProduct.category
    if (updatedProduct.description !== undefined) updateData.description = updatedProduct.description
    if (updatedProduct.isActive !== undefined) updateData.is_active = updatedProduct.isActive
    if (updatedProduct.isNew !== undefined) updateData.is_new = updatedProduct.isNew
    if (updatedProduct.hasUpdate !== undefined) updateData.has_update = updatedProduct.hasUpdate
    if (updatedProduct.denominations !== undefined) updateData.denominations = updatedProduct.denominations
    if (updatedProduct.faqs !== undefined) updateData.faqs = updatedProduct.faqs
    // Extra fields not in the typed interface but valid Supabase columns
    const extra = updatedProduct as any
    if ('slug' in extra) updateData.slug = extra.slug
    if ('denom_icon_url' in extra) updateData.denom_icon_url = extra.denom_icon_url
    if ('ribbon_text' in extra) updateData.ribbon_text = extra.ribbon_text

    // Use Service Role to bypass RLS for admin operations
    const serviceSupabase = createServiceRoleClient()
    const { error } = await serviceSupabase.from("products").update(updateData).eq("id", id)

    if (error) {
      console.error("Error updating product:", error)
      throw new Error("Failed to update product")
    }

    // Clear cache to force refresh
    productsCache = []
    lastFetch = 0

    console.log(`Product ${id} updated`)
  } catch (error) {
    console.error("Error updating product:", error)
    throw error
  }
}

// Legacy exports for backward compatibility
export const featuredGiftCards: Product[] = []
export const webStoreGames: Product[] = []
export const allProducts: Product[] = []

// Initialize legacy arrays (for components that still use them)
export async function initializeLegacyArrays() {
  const featured = await getFeaturedGiftCards()
  const webStore = await getWebStoreGames()

  featuredGiftCards.length = 0
  featuredGiftCards.push(...featured)

  webStoreGames.length = 0
  webStoreGames.push(...webStore)

  allProducts.length = 0
  allProducts.push(...featured, ...webStore)
}
