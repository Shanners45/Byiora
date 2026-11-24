import type { Metadata } from "next"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProduct } from "./get-product"
import { brandOf } from "@/lib/product-categories"

const BASE_URL = "https://www.byiora.com.np"

// Product pages are cached at the edge (ISR). Saving a product in admin refreshes its page at once
// (revalidatePath in app/actions/products.ts); this is the safety net for anything else.
export const revalidate = 300
// No pages are pre-built: each is rendered on its first visit, then served from the cache.
export async function generateStaticParams() {
  return []
}

interface Props {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

// Strip HTML tags for clean text in meta descriptions
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

// What top-up buyers actually search for ("pubg uc", "free fire diamonds").
const TOPUP_CURRENCY: [RegExp, string][] = [
  [/pubg/i, "UC"],
  [/free\s*fire/i, "Diamonds"],
  [/genshin/i, "Genesis Crystals"],
  [/clash of clans/i, "Gems"],
  [/fc mobile/i, "FC Points"],
]

/** "Buy PUBG Mobile UC Top-Up in Nepal"; other categories keep "Buy <name> in Nepal". */
function productTitle(name: string, category?: string): string {
  if (category !== "topup") return `Buy ${name} in Nepal`
  const clean = name.replace(/\s*\(UID\)/gi, "").replace(/\btop-?up\b/gi, "").replace(/\s+/g, " ").trim()
  const currency = TOPUP_CURRENCY.find(([re]) => re.test(name))?.[1]
  return `Buy ${clean}${currency ? ` ${currency}` : ""} Top-Up in Nepal`
}

/**
 * One-sentence product summary for the meta description and schema. Built from the product's own data
 * (pack count, in-stock price, delivery method) so each page differs and never promises what it can't do:
 * no "instant" for team-activated products, no "from Rs. X" when everything is out of stock.
 */
function productSummary(p: { name: string; category?: string; denominations?: any[] }): string {
  const denoms: any[] = p.denominations || []
  const priceOf = (d: any) => parseFloat(String(d.price).replace(/,/g, ""))
  const inStock = denoms.filter((d) => d.in_stock !== false).map(priceOf).filter((n) => Number.isFinite(n) && n > 0)
  const delivery =
    p.category === "topup" ? "sent to your player ID after payment"
      : p.category === "direct-login" ? "activated on your account by our team"
        : "code emailed to you after payment"
  if (denoms.length > 0 && inStock.length === 0) {
    return `${p.name} in Nepal, paid in NPR with eSewa, Khalti or Fonepay QR. Currently out of stock: message us on WhatsApp to hear when it's back.`
  }
  const options = denoms.length > 1 ? `${denoms.length} options from ` : ""
  const price = inStock.length ? `: ${options}Rs. ${Math.min(...inStock).toLocaleString("en-IN")}` : ""
  return `${p.name} in Nepal${price}. Pay in NPR with eSewa, Khalti or Fonepay QR; ${delivery}.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  try {
    const typedProduct = await getProduct(slug)

    if (!typedProduct) {
      return {
        title: "Product Not Found",
        description: "The product you are looking for does not exist or has been moved.",
      }
    }

    // The root layout's "%s | Byiora" template adds the brand.
    const title = productTitle(typedProduct.name, typedProduct.category)

    // Product descriptions hold redemption steps, not a summary, so the meta
    // description is built from structured fields: what's on offer, price, how it's delivered.
    const description = productSummary(typedProduct)

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
      title: "Product",
      description: "Browse premium gift cards and game top-ups on Byiora in Nepal.",
    }
  }
}

// Separate async component for JSON-LD — wrapped in Suspense so it doesn't
// block the layout from rendering {children} immediately.
async function ProductJsonLd({ slug }: { slug: string }) {
  try {
    const typedProduct = await getProduct(slug)
    if (!typedProduct) return null

    const productUrl = `${BASE_URL}/en-np/${slug}`
    // DB descriptions are redemption steps; schema wants a product summary.
    const cleanDesc = productSummary(typedProduct)
    const denoms: any[] = typedProduct.denominations || []
    const prices = denoms.map((d) => parseFloat(String(d.price).replace(/,/g, ""))).filter((n) => Number.isFinite(n) && n > 0)
    const anyInStock = denoms.some((d) => d.in_stock !== false)

    const productSchema: any = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: typedProduct.name,
      description: cleanDesc,
      image: typedProduct.logo || `${BASE_URL}/icon.png`,
      url: productUrl,
      sku: typedProduct.id,
      itemCondition: "https://schema.org/NewCondition",
      brand: {
        "@type": "Brand",
        name: brandOf(typedProduct.name),
      },
      // One price range instead of a repeated Offer per pack (7–11 per product).
      offers: prices.length
        ? {
          "@type": "AggregateOffer",
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: prices.length,
          priceCurrency: "NPR",
          availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: productUrl,
          seller: { "@type": "Organization", name: "Byiora", url: BASE_URL },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "NP",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
            merchantReturnLink: `${BASE_URL}/refund-policy`,
          },
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingDestination: { "@type": "DefinedRegion", addressCountry: "NP" },
            deliveryTime: {
              "@type": "ShippingDeliveryTime",
              handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
              transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
            },
            shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "NPR" },
          },
        }
        : undefined,
    }

    const faqSchema = typedProduct.faqs && typedProduct.faqs.length > 0
      ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: typedProduct.faqs.map((faq: any) => ({
          "@type": "Question",
          name: String(faq.question || "").replace(/^\s*(?:\d+[.)]|Q:)\s*/i, ""),
          acceptedAnswer: {
            "@type": "Answer",
            text: stripHtml(faq.answer).replace(/^\s*A:\s*/i, ""),
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

export default async function ProductLayout({ params, children }: Props) {
  const { slug } = await params
  // Real 404 instead of a 200 "not found" page, so search engines drop dead URLs.
  const exists = await getProduct(slug).then(Boolean, () => true)
  if (!exists) notFound()

  return (
    <>
      <Suspense fallback={null}>
        <ProductJsonLd slug={slug} />
      </Suspense>
      {children}
    </>
  )
}
