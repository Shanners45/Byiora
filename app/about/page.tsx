import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: { absolute: "About Byiora – Gift Cards & Game Top-Ups in Nepal" },
  description:
    "Byiora is a Nepal-registered store (PAN 151285437) for gift cards, game top-ups and game keys, paid in NPR with eSewa, Khalti or Fonepay QR.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: { url: `${BASE_URL}/about`, title: "About Byiora", siteName: "Byiora", images: [`${BASE_URL}/byiora-logo-full.png`] },
}

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Byiora",
  url: `${BASE_URL}/about`,
  mainEntity: { "@type": "Organization", name: "Byiora", url: BASE_URL, taxID: "151285437" },
}

// Only facts that are verifiable elsewhere on the site (footer PAN, contact page,
// refund policy, checkout). Keep it that way: no unprovable superlatives.
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd).replace(/</g, "\\u003c") }} />
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-3xl text-white/85 leading-relaxed">
        <BackButton className="mb-6 text-white hover:bg-white/10" />
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">About Byiora</h1>

        <div className="space-y-5 text-base md:text-lg">
          <p>
            Byiora is an online store in Nepal for digital gift cards, game top-ups, game keys and subscriptions. We exist so
            gamers and shoppers in Nepal can buy Steam, Google Play, PlayStation, Amazon, PUBG Mobile UC, Free Fire diamonds
            and more in Nepalese rupees, without an international card.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-2">Who we are</h2>
          <p>
            Byiora is a registered business in Nepal, PAN 151285437. You can reach our support team by email at{" "}
            <a href="mailto:support@byiora.com.np" className="text-yellow-300 underline">support@byiora.com.np</a> or on{" "}
            <a href="https://wa.me/9779842864103" target="_blank" rel="noopener noreferrer" className="text-yellow-300 underline">WhatsApp (+977-9842864103)</a>,
            Sunday to Friday, 9 AM to 6 PM Nepal time.
          </p>

          <h2 className="text-2xl font-semibold text-white pt-2">How it works</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Prices are in NPR. You pay by scanning a QR with eSewa, Khalti, Fonepay or your bank app.</li>
            <li>Gift card and game key codes are emailed to you after payment is confirmed and saved in your order history.</li>
            <li>Game top-ups are credited to the Player ID you enter; direct-login subscriptions are activated by our team.</li>
            <li>Each product page states its region. Many gift cards are India (INR) region, so check before you buy.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-white pt-2">If something goes wrong</h2>
          <p>
            If a code is invalid or already used, report it within 24 hours with your order ID and a screenshot. Our{" "}
            <Link href="/refund-policy" className="text-yellow-300 underline">Refund Policy</Link> explains exactly what we can
            replace or refund. You can also read customer reviews on{" "}
            <a href="https://www.trustpilot.com/review/byiora.com.np" target="_blank" rel="noopener noreferrer" className="text-yellow-300 underline">Trustpilot</a>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
