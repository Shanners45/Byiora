import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const BASE_URL = "https://www.byiora.store"

// Create a lightweight client for metadata generation (server-side only)
const supabase = createClient(supabaseUrl, supabaseKey)

interface Props {
  params: Promise<{ category: string; slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params

  try {
    const { data: product, error } = await supabase
      .from("products")
      .select("name, description, logo, category, slug")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (error || !product) {
      return {
        title: "Product Not Found",
        description: "The product you are looking for does not exist.",
      }
    }

    const categoryLabel = product.category === "topup" ? "Top-Up" : "Gift Card"
    const title = `Buy ${product.name} in Nepal`
    const description =
      product.description ||
      `Buy ${product.name} instantly on Byiora. Secure payments, instant delivery in Nepal.`

    const productUrl = `${BASE_URL}/${category}/${slug}`

    return {
      title,
      description,
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        title: `${title} | Byiora`,
        description,
        url: productUrl,
        siteName: "Byiora",
        images: product.logo
          ? [
            {
              url: product.logo,
              width: 600,
              height: 600,
              alt: `${product.name} – Byiora`,
            },
          ]
          : [],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Byiora`,
        description,
        images: product.logo ? [product.logo] : [],
      },
    }
  } catch {
    return {
      title: "Product",
      description: "Browse premium gift cards and game top-ups on Byiora.",
    }
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
