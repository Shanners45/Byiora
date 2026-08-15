import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import type { Product } from "@/lib/product-categories"

const BASE_URL = "https://www.byiora.com.np"

interface Props {
  params: Promise<{ slug: string }>
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
    const { data: product, error } = await (supabase as any)
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single()

    const typedProduct = product as Product | null

    if (error || !typedProduct) {
      return {
        title: "Product Not Found | Byiora",
        description: "The product you are looking for does not exist or has been moved.",
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
    const imageUrl = typedProduct.logo || `${BASE_URL}/byiora-logo-full.png`

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
        locale: "en_US",
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 600,
            height: 600,
            alt: `Buy ${typedProduct.name} in Nepal – Byiora`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: description.slice(0, 160),
        images: [imageUrl],
      },
    }
  } catch {
    return {
      title: "Product | Byiora",
      description: "Browse premium gift cards and game top-ups on Byiora in Nepal.",
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
          name: `${typedProduct.name} - ${d.label || d.amount || ''}`,
          price: parseFloat(String(d.price).replace(/,/g, "")) || 0,
          priceCurrency: "NPR",
          availability: d.in_stock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          url: productUrl,
          seller: {
            "@type": "Organization",
            name: "Byiora",
          },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "NP",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
            merchantReturnLink: `${BASE_URL}/refund-policy`,
          },
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingDestination: {
              "@type": "DefinedRegion",
              addressCountry: "NP",
            },
            deliveryTime: {
              "@type": "ShippingDeliveryTime",
              handlingTime: {
                "@type": "QuantitativeValue",
                minValue: 0,
                maxValue: 0,
                unitCode: "DAY",
              },
              transitTime: {
                "@type": "QuantitativeValue",
                minValue: 0,
                maxValue: 0,
                unitCode: "DAY",
              },
            },
            shippingRate: {
              "@type": "MonetaryAmount",
              value: 0,
              currency: "NPR",
            },
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

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: BASE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: typedProduct.category === "topup" ? "Game Top-ups" : "Digital Gift Cards",
          item: `${BASE_URL}/category/${typedProduct.category || "digital-goods"}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: typedProduct.name,
          item: productUrl,
        },
      ],
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }}
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
      <Suspense fallback={null}>
        <ProductJsonLd slug={slug} />
        <ProductHiddenTitle slug={slug} />
      </Suspense>
      {children}
    </>
  )
}
