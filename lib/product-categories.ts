import { supabase } from "./supabase"

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

export async function getAllProducts(): Promise<Product[]> {
  const now = Date.now()

  // Return cached data if it's still fresh
  if (productsCache.length > 0 && now - lastFetch < CACHE_DURATION) {
    return productsCache
  }

  // If Supabase is not configured, return fallback data
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured, using empty array")
    return []
  }

  try {
    const client = supabase
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
    console.warn("Using empty array due to network error")
    return []
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

// Legacy exports and unused code removed

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
