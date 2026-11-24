import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: { absolute: "About Us | Byiora – Gift Cards & Game Top-Ups in Nepal" },
  description:
    "About Byiora: a Nepal-registered store (PAN 151285437) for gift cards, game top-ups, game keys and subscriptions, plus a Merchant Portal for resellers. Pay in NPR with eSewa, Khalti or Fonepay QR.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: { url: `${BASE_URL}/about`, title: "About Us | Byiora", siteName: "Byiora", images: [`${BASE_URL}/byiora-logo-full.png`] },
}

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Us – Byiora",
  url: `${BASE_URL}/about`,
  mainEntity: { "@type": "Organization", name: "Byiora", url: BASE_URL, taxID: "151285437" },
}

const link = "text-[#6B3FA0] font-semibold underline underline-offset-2 hover:text-[#5A3588]"

// Only facts that are verifiable elsewhere on the site (footer PAN, contact page,
// refund policy, checkout, merchant portal). Keep it that way: no unprovable superlatives.
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd).replace(/</g, "\\u003c") }} />
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <BackButton className="mb-6 text-white hover:bg-white/10" />

        <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">About Us</h1>
            <p className="text-gray-500 text-sm font-medium">Byiora · Registered in Nepal · PAN 151285437</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              Byiora is an online store in Nepal for digital gift cards, game top-ups, game keys and subscriptions. We make it
              easy for gamers and shoppers in Nepal to buy Steam, Google Play, PlayStation, Amazon, PUBG Mobile UC, Free Fire
              diamonds and more in Nepalese rupees, without an international card.
            </p>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Who we are</h2>
              <p>
                Byiora is a registered business in Nepal, PAN 151285437. You can reach our support team by email at{" "}
                <a href="mailto:support@byiora.com.np" className={link}>support@byiora.com.np</a> or on{" "}
                <a href="https://wa.me/9779842864103" target="_blank" rel="noopener noreferrer" className={link}>WhatsApp (+977-9842864103)</a>,
                Sunday to Friday, 9 AM to 6 PM Nepal time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">How it works</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Prices are in NPR. You pay by scanning a QR with eSewa, Khalti, Fonepay or your bank app.</li>
                <li>Gift card and game key codes are emailed to you once your payment is confirmed, and saved in your order history.</li>
                <li>Game top-ups are sent to the Player ID you enter; subscriptions are activated on your account by our team.</li>
                <li>Each product page shows its region. Many gift cards are India (INR) region, so check the region before you buy.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Byiora Merchant Portal</h2>
              <p>
                Resellers, shops and gaming businesses can buy from Byiora at wholesale prices through the{" "}
                <a href="https://merchant.byiora.com.np" className={link}>Byiora Merchant Portal</a>:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>A prepaid NPR wallet you top up with Fonepay. There are no setup or monthly fees.</li>
                <li>Order codes from the merchant catalogue in a few clicks, or in bulk.</li>
                <li>
                  Connect your own website or app through our REST API and order webhooks. The{" "}
                  <a href="https://merchant.byiora.com.np/docs" className={link}>API documentation</a> is public.
                </li>
                <li>Secure accounts with two-factor authentication, plus order, wallet and revenue reports in one dashboard.</li>
              </ul>
              <p className="mt-3">
                Merchant accounts are opened on request. Email{" "}
                <a href="mailto:support@byiora.com.np" className={link}>support@byiora.com.np</a> with your business name to get started.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">If you need help with an order</h2>
              <p>
                If a code shows an error or a top-up hasn&apos;t arrived, contact us within 24 hours with your order ID and a screenshot
                and our team will look into it. Our <Link href="/refund-policy" className={link}>Refund Policy</Link> explains when we
                replace or refund an order. You can also read customer reviews on{" "}
                <a href="https://www.trustpilot.com/review/byiora.com.np" target="_blank" rel="noopener noreferrer" className={link}>Trustpilot</a>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
