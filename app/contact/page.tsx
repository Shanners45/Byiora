import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { ContactForm } from "@/components/contact-form"
import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: { absolute: "Contact Us | Byiora - Game Top-Up & Gift Card Support Nepal" },
  description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form. We reply Sunday to Friday, 9 AM to 6 PM Nepal time.",
  alternates: {
    canonical: `${BASE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Us | Byiora - Game Top-Up & Gift Card Support Nepal",
    description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form. We reply Sunday to Friday, 9 AM to 6 PM Nepal time.",
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
    title: "Contact Us | Byiora - Game Top-Up & Gift Card Support Nepal",
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

        <section className="mt-12 max-w-3xl mx-auto text-white/80 space-y-3 text-sm md:text-base leading-relaxed">
          <h2 className="text-xl md:text-2xl font-semibold text-white">Before you contact us</h2>
          <p>
            We reply by email and WhatsApp from Sunday to Friday, 9 AM to 6 PM Nepal time. Messages sent outside these hours
            are answered on the next working day.
          </p>
          <p>
            To help us sort out an order quickly, include your order ID, the email you used at checkout, and a screenshot of any
            error message. For a game top-up, also include the Player ID you entered.
          </p>
          <p>
            Payments are made in NPR by scanning a QR with eSewa, Khalti, Fonepay or your bank app. If money left your account but
            the order still shows as pending, send us the payment reference and time of payment; we match it against the bank record
            and complete or refund the order.
          </p>
          <p>
            If a gift card code shows as invalid or already used, report it within 24 hours of purchase, as set out in our{" "}
            <a href="/refund-policy" className="text-yellow-300 underline">Refund Policy</a>. Most cards are region-locked,
            so check that your account region matches the card before redeeming.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  )
}
