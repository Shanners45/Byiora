import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { ContactForm } from "@/components/contact-form"
import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: "Contact Us | Byiora - 24/7 Game Support Nepal",
  description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form. We're here to help you 24/7.",
  alternates: {
    canonical: `${BASE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Us | Byiora - 24/7 Game Support Nepal",
    description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form. We're here to help you 24/7.",
    url: `${BASE_URL}/contact`,
    siteName: "Byiora",
    type: "website",
    images: [
      {
        url: `https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`,
        width: 1200,
        height: 630,
        alt: "Contact Byiora Support",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | Byiora - 24/7 Game Support Nepal",
    description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form.",
    images: [`https://tkovigthghwpwbtjikyp.supabase.co/storage/v1/object/public/product-images/byiora-logo-full.png`],
  },
}

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Byiora",
  url: `${BASE_URL}/contact`,
  description: "Customer support and contact page for Byiora game recharge and gift cards in Nepal.",
  mainEntity: {
    "@type": "Organization",
    name: "Byiora",
    url: BASE_URL,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${BASE_URL}/contact`,
      availableLanguage: ["English", "Nepali"],
    },
  },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd).replace(/</g, "\\u003c") }}
      />
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <BackButton className="mb-6 text-white hover:bg-white/10" />

        {/* Page heading */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-widest mb-3">
            Contact Us
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
            Have a question or need help with an order? We&apos;re here for you.
          </p>
        </div>

        <ContactForm />
      </main>

      <Footer />
    </div>
  )
}
