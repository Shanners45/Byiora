import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: "Privacy Policy | Byiora - Buy Game Gift Cards & Top-Ups Nepal",
  description: "Read our Privacy Policy to understand how Byiora collects, uses, and protects your information when purchasing digital game top-ups and gift cards in Nepal.",
  alternates: {
    canonical: `${BASE_URL}/privacy-policy`,
  },
  openGraph: {
    title: "Privacy Policy | Byiora",
    description: "Read our Privacy Policy to understand how Byiora collects, uses, and protects your information.",
    url: `${BASE_URL}/privacy-policy`,
    siteName: "Byiora",
    type: "website",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <BackButton className="mb-6 text-white hover:bg-white/10" />

        <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">
              Privacy Policy
            </h1>
            <p className="text-gray-500 text-sm font-medium">Last Updated: September 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              At Byiora (<a href="https://www.byiora.com.np" className="text-brand-sky-blue hover:underline">byiora.com.np</a>), we respect your privacy and are committed to safeguarding your personal data. This Privacy Policy describes the information we collect, how it is handled, and how your privacy is protected when you use our digital platform.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
              <p className="mb-2">We collect only information necessary to provide our digital distribution services, process payments, and ensure platform security:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Contact Information:</strong> Email address and, for registered users, account name. A phone number may be collected when provided for order verification.</li>
                <li><strong>Gaming Account Information:</strong> Player IDs (UID), Zone/Server IDs, or related in-game identifiers required to fulfill top-ups.</li>
                <li><strong>Temporary Account Credentials:</strong> For select top-up services requiring direct account access, necessary login credentials provided by the customer.</li>
                <li><strong>Technical & Log Data:</strong> Standard connection and device information, including IP address, browser type, and system telemetry, processed strictly for security monitoring and fraud prevention.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Protection of In-Game Login Credentials</h2>
              <p>
                Where direct-login top-up services require temporary credentials, Byiora applies industry-standard encryption protocols during transmission and storage. Access is restricted strictly to authorized fulfillment operations. All temporary login credentials are permanently deleted from our systems once fulfillment is completed or the order is canceled.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Payment Information</h2>
              <p>
                Byiora does not collect, record, or store payment card details, bank passwords, or PINs. Payments are processed directly through licensed third-party payment aggregators in Nepal (such as Fonepay, NepalPay, and Khalti). We receive only transaction verification references and settlement confirmations from these providers.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. How We Use Your Information</h2>
              <p className="mb-2">We process personal information for the following legitimate purposes:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Order Fulfillment:</strong> To deliver purchased digital codes, gift cards, and in-game top-ups to the designated email or game account.</li>
                <li><strong>Customer Support:</strong> To resolve order inquiries, underpayments, and redemption questions.</li>
                <li><strong>Platform Security:</strong> To detect and prevent fraudulent transactions, automated bot activity, and abuse of promotional programs.</li>
                <li><strong>Promotional Communications:</strong> With your consent, to provide updates on offers and new products. Customers may opt out of promotional messages at any time.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Sharing & Disclosure</h2>
              <p className="mb-2">Byiora does not sell, rent, or trade your personal information. Data is shared only under the following limited conditions:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>With payment processors to verify and settle transactions.</li>
                <li>With authorized distribution partners and game publishers strictly to process direct account top-ups.</li>
                <li>When required by applicable Nepalese law, court order, or official regulatory investigation.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security & Storage</h2>
              <p>
                We employ standard administrative, technical, and physical safeguards to protect personal data against unauthorized access, loss, or alteration. All electronic communications on Byiora are secured using HTTPS encryption.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Your Rights</h2>
              <p>
                You may request access to, correction of, or deletion of your registered account information by contacting our support team at <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a>, subject to applicable record-keeping requirements under Nepalese law.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Contact Us</h2>
              <p>
                If you have questions regarding this Privacy Policy, please reach out to us at <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
