import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

const CATEGORY_META: Record<string, { title: string; description: string; name: string }> = {
  "digital-goods": {
    name: "Digital Gift Cards",
    title: "Buy Digital Gift Cards in Nepal | Steam, Netflix & More | Byiora",
    description: "Buy international and gaming gift cards in Nepal instantly. Steam, Google Play, Apple, Netflix, Spotify and more with local payment via eSewa, Khalti, Fonepay.",
  },
  "topup": {
    name: "Game Top-ups",
    title: "Online Game Recharge & Top-Up Nepal | PUBG, Valorant, Free Fire | Byiora",
    description: "Instant in-game currency top-up in Nepal. Buy PUBG UC, Free Fire Diamonds, Valorant Points, Mobile Legends Diamonds with eSewa, Khalti, and Fonepay QR.",
  },
  "games": {
    name: "Games",
    title: "Buy PC & Console Games in Nepal | Instant Digital Delivery | Byiora",
    description: "Browse and buy top digital PC and console games in Nepal. Fast delivery, 100% genuine keys, secure local payments.",
  },
  "direct-login": {
    name: "Direct Login Recharge",
    title: "Direct Account Top-Up & Subscriptions Nepal | Byiora",
    description: "Direct account top-up services in Nepal. Safe, secure, and delivered quickly with local payment options.",
  },
}

interface Props {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const meta = CATEGORY_META[slug] || {
    name: "Products",
    title: "Browse Products | Byiora Nepal",
    description: "Discover genuine game top-ups and digital gift cards in Nepal with instant delivery on Byiora.",
  }

  const categoryUrl = `${BASE_URL}/category/${slug}`
  const imageUrl = `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: categoryUrl,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: categoryUrl,
      siteName: "Byiora",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [imageUrl],
    },
  }
}

export default async function CategoryLayout({ params, children }: Props) {
  const { slug } = await params
  const meta = CATEGORY_META[slug]

  const collectionSchema = meta
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: meta.name,
        description: meta.description,
        url: `${BASE_URL}/category/${slug}`,
        isPartOf: {
          "@type": "WebSite",
          name: "Byiora",
          url: BASE_URL,
        },
      }
    : null

  const breadcrumbSchema = meta
    ? {
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
            name: meta.name,
            item: `${BASE_URL}/category/${slug}`,
          },
        ],
      }
    : null

  return (
    <>
      {collectionSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema).replace(/</g, "\\u003c") }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }}
        />
      )}
      {children}
    </>
  )
}
