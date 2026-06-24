import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/lib/product-categories"

const BASE_URL = "https://www.byiora.com.np"

interface Props {
  params: Promise<{ category: string; slug: string }>
  children: React.ReactNode
}

// Strip HTML tags for clean text in meta descriptions
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  try {
    // NOTE: Supabase TS inference can degrade to `never` if generated DB types
    // are missing/partial. We type the result explicitly for correctness.
    const { data: product, error } = await (supabase as any)
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    const typedProduct = product as Product | null

    if (error || !typedProduct) {
      return {
        title: "Product Not Found",
        description: "The product you are looking for does not exist.",
      }
    }

    const categoryLabel = typedProduct.category === "topup" ? "Top-Up" : "Gift Card"
    const title = `Buy ${typedProduct.name} in Nepal | Byiora`

    // Build a rich meta description with pricing info
    const cleanDesc = typedProduct.description ? stripHtml(typedProduct.description).slice(0, 120) : ''
    const priceInfo = typedProduct.denominations && typedProduct.denominations.length > 0
      ? ` Starting from Rs. ${typedProduct.denominations[0].price}.`
      : ''
    const description = cleanDesc
      ? `${cleanDesc}${priceInfo} Pay via eSewa, Khalti or Fonepay. Instant delivery in Nepal.`
      : `Buy ${typedProduct.name} ${categoryLabel} instantly in Nepal.${priceInfo} Secure payment with eSewa, Khalti, Fonepay. Fast digital delivery by Byiora.`

    const productUrl = `${BASE_URL}/en-np/${slug}`

    return {
      title,
      description: description.slice(0, 160),
      alternates: {
        canonical: productUrl,
      },
      openGraph: {
        title,
        description: description.slice(0, 160),
        url: productUrl,
        siteName: "Byiora",
        images: typedProduct.logo
          ? [
            {
              url: typedProduct.logo,
              width: 600,
              height: 600,
              alt: `Buy ${typedProduct.name} in Nepal – Byiora`,
            },
          ]
          : [],
        type: "website",
      },

    }
  } catch {
    return {
      title: "Product",
      description: "Browse premium gift cards and game top-ups on Byiora.",
    }
  }
}

// Separate async component for JSON-LD — wrapped in Suspense so it doesn't
// block the layout from rendering {children} immediately.
async function ProductJsonLd({ slug }: { slug: string }) {
  const supabase = await createClient()

  try {
    const { data: product } = await (supabase as any)
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    const typedProduct = product as Product | null
    if (!typedProduct) return null

    const productUrl = `${BASE_URL}/en-np/${slug}`
    const cleanDesc = typedProduct.description ? stripHtml(typedProduct.description).slice(0, 300) : `Buy ${typedProduct.name} in Nepal with instant delivery.`

    const productSchema: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: typedProduct.name,
      description: cleanDesc,
      image: typedProduct.logo || `${BASE_URL}/icon.png`,
      url: productUrl,
      brand: {
        "@type": "Brand",
        name: "Byiora",
      },
      offers: typedProduct.denominations && typedProduct.denominations.length > 0
        ? typedProduct.denominations.map((d: any) => ({
          "@type": "Offer",
          price: d.price,
          priceCurrency: "NPR",
          availability: "https://schema.org/InStock",
          seller: {
            "@type": "Organization",
            name: "Byiora",
          },
        }))
        : undefined,
    }

    const faqSchema = typedProduct.faqs && typedProduct.faqs.length > 0
      ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: typedProduct.faqs.map((faq: any) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: stripHtml(faq.answer),
          },
        })),
      }
      : null

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
        />
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
          />
        )}
      </>
    )
  } catch {
    return null
  }
}

async function ProductHiddenTitle({ slug }: { slug: string }) {
  const supabase = await createClient()

  try {
    const { data: product } = await (supabase as any)
      .from("products")
      .select("name")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (product) {
      return <h1 className="sr-only">{product.name}</h1>
    }
  } catch {
    return null
  }
  return null
}

export default async function ProductLayout({ params, children }: Props) {
  const { slug } = await params

  return (
    <>
      {/* JSON-LD streams in asynchronously — does NOT block {children} from
          rendering, so the route transition is instant and loading.tsx
          shows immediately instead of the old page staying visible. */}
      <Suspense fallback={null}>
        <ProductJsonLd slug={slug} />
        <ProductHiddenTitle slug={slug} />
      </Suspense>
      {children}
    </>
  )
}
