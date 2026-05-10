import { createClient } from "@/lib/supabase/client"

export interface Product {
  id: string
  name: string
  slug: string
  logo: string
  category: "topup" | "digital-goods" | "games" | "direct-login"
  isNew?: boolean
  hasUpdate?: boolean
  isActive?: boolean
  description?: string | null
  denom_icon_url?: string | null
  ribbon_text?: string | null
  denominations?: Array<{
    price: string
    label: string
    icon_url?: string
    bestseller?: boolean
    in_stock?: boolean
    categoryId?: string
  }>
  denomination_categories?: Array<{
    id: string
    name: string
    icon_url?: string
    description?: string
  }>
  faqs?: Array<{
    question: string
    answer: string
  }>
  checkout_fields?: Array<{
    key: string
    label: string
    type: "text" | "email" | "password"
    required: boolean
  }>
  uid_instructions?: string | null
  uid_guide_image?: string | null
  servers?: Array<{ id: string; name: string }>
}

// Note: We used to have fallback arrays here, but they were removed for bundle optimization.
// All data is now purely fetched from the database.

// Check if Supabase is properly configured
function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function getAllProducts(): Promise<Product[]> {
  // If Supabase is not configured, return fallback data
  if (!isSupabaseConfigured()) {
    console.warn("Supabase not configured, using empty array")
    return []
  }

  try {
    const client = createClient()
    const { data, error } = await client.from("products").select("*").order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching products:", error)
      console.warn("Using empty array due to Supabase error")
      return []
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
      denomination_categories: product.denomination_categories || [],
      faqs: product.faqs || [],
      checkout_fields: product.checkout_fields || [],
      uid_instructions: product.uid_instructions || null,
      uid_guide_image: product.uid_guide_image || null,
      servers: product.servers || [],
    }))

    return products
  } catch (error) {
    console.error("Error fetching products:", error)
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
  const allProducts = await getAllProducts()
  return allProducts.find(p => p.id === id) || null
}

// Get product by slug
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const allProducts = await getAllProducts()
  return allProducts.find(p => p.slug === slug) || null
}

// Legacy exports and unused code removed
