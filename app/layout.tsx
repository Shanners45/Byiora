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
    default: "Byiora | Premium Game Top-Up Nepal",
    template: "%s | Byiora",
  },
  description:
    "Nepal's trusted platform for game top-ups & gift cards. Buy Steam, PUBG, and Valorant with instant digital delivery. Pay securely via eSewa, Khalti, or Fonepay.",
  keywords: [
    "gift cards Nepal",
    "game top-up Nepal",
    "Steam gift card Nepal",
    "PUBG UC Nepal",
    "Free Fire diamonds Nepal",
    "Netflix gift card",
    "digital vouchers",
    "instant delivery",
    "Byiora",
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
    title: "Byiora | Premium Digital Game Top-Up Nepal",
    description:
      "Buy premium game top-ups and gift cards in Nepal instantly. Secure local payments with eSewa, Khalti, and Fonepay QR.",
    images: [
      {
        url: `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
        width: 1200,
        height: 630,
        alt: "Byiora | Premium Digital Gift Cards & Game Top-Up",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Byiora | Premium Digital Game Top-Up Nepal",
    description:
      "Buy game top-ups and gift cards in Nepal instantly. Pay securely with eSewa, Khalti, or Fonepay.",
    images: [
      `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
    ],
    creator: "@byiora",
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icon.png",
  },
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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
