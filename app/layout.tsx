import type React from "react"
import { Suspense } from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import { Nunito } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth-context"
import { NotificationProvider } from "@/lib/notification-context"
import { GlobalAnnouncement } from "@/components/global-announcement"
import { PostHogProvider } from "@/components/analytics/PostHogProvider"
import { PresenceTracker } from "@/lib/presence"

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
})

const BASE_URL = "https://www.byiora.com.np"

export const viewport: Viewport = {
  themeColor: "#6B3FA0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Byiora – Buy Game Top-Ups & Gift Cards in Nepal",
    template: "%s | Byiora",
  },
  description:
    "Buy premium game top-ups and gift cards in Nepal instantly. Pay securely with eSewa, Khalti, Fonepay QR or mobile banking. Instant digital delivery.",
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
    "byiora.com.np",
  ],
  authors: [{ name: "Byiora", url: BASE_URL }],
  creator: "Byiora",
  publisher: "Byiora",
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Byiora",
    title: "Byiora – Buy Game Top-Ups & Gift Cards in Nepal",
    description:
      "Buy premium game top-ups and gift cards in Nepal instantly. Pay securely with eSewa, Khalti, Fonepay QR or mobile banking. Instant digital delivery.",
    images: [
      {
        url: `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
        width: 1200,
        height: 630,
        alt: "Byiora – Buy Game Top-Up & Gift Cards in Nepal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Byiora – Buy Game Top-Ups & Gift Cards in Nepal",
    description:
      "Buy premium game top-ups and gift cards in Nepal instantly. Pay securely with eSewa, Khalti, Fonepay QR or mobile banking. Instant digital delivery.",
    images: [`https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/icon.png",
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
  logo: `${BASE_URL}/byiora-logo-full.png`,
  description: "Nepal's trusted platform for game top-ups & digital gift cards with instant delivery.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${BASE_URL}/contact`,
    availableLanguage: ["English", "Nepali"],
  },
  sameAs: [
    "https://www.facebook.com/byiora",
    "https://www.instagram.com/byiora",
    "https://www.youtube.com/@byiora",
    "https://www.trustpilot.com/review/byiora.com.np",
  ],
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
        {/* Preconnect to critical third-party origins for faster resource loading */}
        <link rel="preconnect" href="https://tkovigthghwpwbtjikyp.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tkovigthghwpwbtjikyp.supabase.co" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            // Dev chunks keep their names while changing, so a cache-first worker
            // serves stale code ("module factory is not available"). Production only;
            // in dev, remove any worker and cache left over from earlier runs.
            __html: process.env.NODE_ENV === "production" ? `
              if ('serviceWorker' in navigator) {
                if (location.hostname.indexOf('merchant.') === 0) {
                  // The storefront's offline cache must not run on the merchant portal.
                  navigator.serviceWorker.getRegistrations().then(function(rs) { rs.forEach(function(r) { r.unregister(); }); });
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').catch(function() {});
                  });
                  // Lost connection: reload so the worker shows the offline page (it reloads back here once online).
                  // Not on checkout or admin, where a reload could interrupt a payment or unsaved work.
                  window.addEventListener('offline', function() {
                    if (navigator.serviceWorker.controller && !/^\\/(checkout|admin)(\\/|$)/.test(location.pathname)) location.reload();
                  });
                }
              }
            ` : `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(rs) { rs.forEach(function(r) { r.unregister(); }); });
              }
              if (window.caches) caches.keys().then(function(ks) { ks.forEach(function(k) { caches.delete(k); }); });
            `,
          }}
        />
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
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
        <AuthProvider>
          <PresenceTracker />
          <NotificationProvider>
            <GlobalAnnouncement />
            {children}
            <Toaster richColors position="top-right" />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
