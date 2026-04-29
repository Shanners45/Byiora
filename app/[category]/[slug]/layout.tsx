import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"

const BASE_URL = "https://www.byiora.store"

interface Props {
  params: Promise<{ category: string; slug: string }>
  children: React.ReactNode
}

// Strip HTML tags for clean text in meta descriptions
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const supabase = await createClient()

  try {
    const { data: product, error } = await supabase
      .from("products")
      .select("name, description, logo, category, slug, denominations")
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
    const title = `Buy ${product.name} in Nepal – Instant Delivery | Byiora`

    // Build a rich meta description with pricing info
    const cleanDesc = product.description ? stripHtml(product.description).slice(0, 120) : ''
    const priceInfo = product.denominations && product.denominations.length > 0
      ? ` Starting from Rs. ${product.denominations[0].price}.`
      : ''
    const description = cleanDesc
      ? `${cleanDesc}${priceInfo} Pay via eSewa, Khalti or Fonepay. Instant delivery in Nepal.`
      : `Buy ${product.name} ${categoryLabel} instantly in Nepal.${priceInfo} Secure payment with eSewa, Khalti, Fonepay. Fast digital delivery by Byiora.`

    const productUrl = `${BASE_URL}/${category}/${slug}`

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
        images: product.logo
          ? [
            {
              url: product.logo,
              width: 600,
              height: 600,
              alt: `Buy ${product.name} in Nepal – Byiora`,
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

export default async function ProductLayout({ params, children }: Props) {
  const { category, slug } = await params
  const supabase = await createClient()

  // Fetch product data for JSON-LD structured data
  let jsonLd = null
  try {
    const { data: product } = await supabase
      .from("products")
      .select("name, description, logo, category, slug, denominations, faqs")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    if (product) {
      const productUrl = `${BASE_URL}/${category}/${slug}`
      const cleanDesc = product.description ? stripHtml(product.description).slice(0, 300) : `Buy ${product.name} in Nepal with instant delivery.`

      // Build Product schema
      const productSchema: any = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: cleanDesc,
        image: product.logo || `${BASE_URL}/icon.png`,
        url: productUrl,
        brand: {
          "@type": "Brand",
          name: "Byiora",
        },
        offers: product.denominations && product.denominations.length > 0
          ? product.denominations.map((d: any) => ({
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

      // Build FAQPage schema if FAQs exist
      const faqSchema = product.faqs && product.faqs.length > 0
        ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: product.faqs.map((faq: any) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: stripHtml(faq.answer),
            },
          })),
        }
        : null

      jsonLd = { productSchema, faqSchema }
    }
  } catch {
    // Structured data is optional — don't break the page
  }

  return (
    <>
      {jsonLd?.productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.productSchema).replace(/</g, '\\u003c') }}
        />
      )}
      {jsonLd?.faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.faqSchema).replace(/</g, '\\u003c') }}
        />
      )}
      {children}
    </>
  )
}
