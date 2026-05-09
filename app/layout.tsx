import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Nunito } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth-context"
import { NotificationProvider } from "@/lib/notification-context"

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
})

const BASE_URL = "https://www.byiora.store"

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Byiora – Buy Game Top-Up & Gift Cards in Nepal | Instant Delivery",
    template: "%s",
  },
  description:
    "Nepal's #1 platform for game top-ups & gift cards. Buy Steam, PUBG UC, Valorant Points, Free Fire Diamonds, Netflix & more. Pay via eSewa, Khalti, Fonepay. Instant digital delivery.",
  keywords: [
    "gift cards Nepal",
    "game top-up Nepal",
    "buy gift card Nepal",
    "Steam gift card Nepal",
    "PUBG UC Nepal",
    "PUBG UC buy Nepal",
    "Free Fire diamonds Nepal",
    "Valorant points Nepal",
    "Netflix gift card Nepal",
    "Spotify gift card Nepal",
    "digital vouchers Nepal",
    "instant delivery Nepal",
    "eSewa gift card",
    "Khalti gift card",
    "Fonepay gaming",
    "online game recharge Nepal",
    "Byiora",
    "byiora.store",
  ],
  authors: [{ name: "Byiora" }],
  creator: "Byiora",
  publisher: "Byiora",
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Byiora",
    title: "Byiora – Buy Game Top-Up & Gift Cards in Nepal | Instant Delivery",
    description:
      "Buy premium game top-ups and gift cards in Nepal instantly. Secure local payments with eSewa, Khalti, and Fonepay QR. Instant digital delivery.",
    images: [
      {
        url: `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
        width: 1200,
        height: 630,
        alt: "Byiora – Buy Game Top-Up & Gift Cards in Nepal",
      },
    ],
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "google-site-verification": "o2300boFV4PQ7SS2-y1WgXrcUqKe5xYD6RCGTktNnDU",
  },
}

// Organization JSON-LD for sitewide structured data
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Byiora",
  url: BASE_URL,
  logo: `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
  description: "Nepal's trusted platform for game top-ups & digital gift cards with instant delivery.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${BASE_URL}/contact`,
    availableLanguage: ["English", "Nepali"],
  },
  sameAs: [],
  areaServed: {
    "@type": "Country",
    name: "Nepal",
  },
}

// WebSite JSON-LD for sitelinks search box
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Byiora",
  url: BASE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={BASE_URL} />
        {/* Preconnect to critical third-party origins for faster resource loading */}
        <link rel="preconnect" href="https://tkovigthghwpwbtjikyp.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tkovigthghwpwbtjikyp.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body className={nunito.className}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <Toaster richColors position="top-right" />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
