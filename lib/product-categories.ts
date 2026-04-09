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

// Fallback data with placeholder images that will definitely work
const fallbackFeaturedGiftCards: Product[] = [
  {
    id: "steam",
    name: "Steam",
    slug: "steam",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-raJlby6bwgAtegf2vFVs2cg9HdD6co.png",
    category: "digital-goods",
    isActive: true,
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
    isActive: true,
    description: "Give the gift of entertainment with Netflix Gift Cards. Perfect for movie and TV show lovers.",
    denominations: [
      { price: "15", label: "$15 Gift Card" },
      { price: "25", label: "$25 Gift Card" },
      { price: "50", label: "$50 Gift Card" },
      { price: "100", label: "$100 Gift Card" },
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    slug: "spotify",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qWxEs4ypXyyfc6pXQTiN2CNtEEMfoM.png",
    category: "digital-goods",
    isActive: true,
    description: "Give the gift of music with Spotify Gift Cards. Perfect for music lovers.",
    denominations: [
      { price: "10", label: "$10 Gift Card" },
      { price: "30", label: "$30 Gift Card" },
      { price: "60", label: "$60 Gift Card" },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    slug: "amazon",
    logo: "/placeholder.svg?height=80&width=80",
    category: "digital-goods",
    isActive: true,
    description: "Amazon Gift Cards - the perfect gift for any occasion. Shop millions of items on Amazon.",
    denominations: [
      { price: "10", label: "$10 Gift Card" },
      { price: "25", label: "$25 Gift Card" },
      { price: "50", label: "$50 Gift Card" },
      { price: "100", label: "$100 Gift Card" },
    ],
  },
  {
    id: "apple",
    name: "Apple",
    slug: "apple",
    logo: "/placeholder.svg?height=80&width=80",
    category: "digital-goods",
    isActive: true,
    description:
      "Apple Gift Cards can be used for purchases at any Apple Store, on the Apple Store app, apple.com, the App Store, iTunes, Apple Music, Apple TV+, Apple News+, Apple Books, Apple Arcade, iCloud+, Apple Fitness+, Apple One and other Apple properties.",
    denominations: [
      { price: "10", label: "$10 Gift Card" },
      { price: "25", label: "$25 Gift Card" },
      { price: "50", label: "$50 Gift Card" },
      { price: "100", label: "$100 Gift Card" },
    ],
  },
  {
    id: "google-play",
    name: "Google Play",
    slug: "google-play",
    logo: "/placeholder.svg?height=80&width=80",
    category: "digital-goods",
    isActive: true,
    description:
      "Google Play Gift Cards can be used to purchase apps, games, music, movies, TV shows, and books on Google Play.",
    denominations: [
      { price: "10", label: "$10 Gift Card" },
      { price: "25", label: "$25 Gift Card" },
      { price: "50", label: "$50 Gift Card" },
      { price: "100", label: "$100 Gift Card" },
    ],
  },
]

const fallbackWebStoreGames: Product[] = [
  {
    id: "pubg",
    name: "PUBG Mobile",
    slug: "pubg-mobile",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-6OM16bzJeXfUELJMqjmDEWeuA4MD0U.png",
    category: "topup",
    isActive: true,
    description:
      "Buy PUBG Mobile UC voucher in seconds! Simply select your preferred UC amount, choose your preferred payment method, complete the payment, and you will receive your voucher code via email.",
    denominations: [
      { price: "0.99", label: "60 UC" },
      { price: "4.99", label: "325 UC" },
      { price: "9.99", label: "660 UC" },
      { price: "24.99", label: "1800 UC" },
      { price: "49.99", label: "3850 UC" },
      { price: "99.99", label: "8100 UC" },
    ],
  },
  {
    id: "cod-mobile",
    name: "COD:M Web Store",
    slug: "cod-m-web-store",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-lFTQEUECc5MwgnRVRsVoTIiCHL5eQ5.png",
    category: "topup",
    isActive: true,
    description: "Get COD Mobile CP instantly! Top up your account and enjoy premium features.",
    denominations: [
      { price: "0.99", label: "80 CP" },
      { price: "4.99", label: "400 CP" },
      { price: "9.99", label: "800 CP" },
      { price: "24.99", label: "2000 CP" },
    ],
  },
  {
    id: "free-fire",
    name: "Free Fire",
    slug: "free-fire",
    logo: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-2ttcNnBkFPWohceY14WxQatH1Nuapj.png",
    category: "topup",
    isActive: true,
    description: "Purchase Free Fire Diamonds instantly! Get the best deals on diamonds for your Free Fire account.",
    denominations: [
      { price: "0.99", label: "100 Diamonds" },
      { price: "4.99", label: "520 Diamonds" },
      { price: "9.99", label: "1080 Diamonds" },
      { price: "19.99", label: "2200 Diamonds" },
    ],
  },
  {
    id: "mobile-legends",
    name: "Mobile Legends",
    slug: "mobile-legends",
    logo: "/placeholder.svg?height=80&width=80",
    category: "topup",
    isActive: true,
    description: "Buy Mobile Legends Diamonds at the best prices! Power up your gameplay with instant delivery.",
    denominations: [
      { price: "1.99", label: "86 Diamonds" },
      { price: "3.99", label: "172 Diamonds" },
      { price: "5.99", label: "257 Diamonds" },
      { price: "11.99", label: "514 Diamonds" },
      { price: "23.99", label: "1028 Diamonds" },
    ],
  },
]

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
