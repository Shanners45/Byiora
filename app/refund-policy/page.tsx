import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: "Refund & Return Policy | Byiora - Buy Game Gift Cards & Top-Ups Nepal",
  description: "Learn about the Refund and Return Policy at Byiora. Understand our terms for refunds on game top-ups, digital gift cards, and promotional orders in Nepal.",
  alternates: {
    canonical: `${BASE_URL}/refund-policy`,
  },
  openGraph: {
    title: "Refund & Return Policy | Byiora",
    description: "Learn about the Refund and Return Policy at Byiora.",
    url: `${BASE_URL}/refund-policy`,
    siteName: "Byiora",
    type: "website",
  },
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <BackButton className="mb-6 text-white hover:bg-white/10" />

        <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">
              Refund & Return Policy
            </h1>
            <p className="text-gray-500 text-sm font-medium">Last Updated: September 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              This Refund and Return Policy applies to all purchases, digital gift cards, and direct game top-ups made through Byiora (<a href="https://www.byiora.com.np" className="text-brand-sky-blue hover:underline">byiora.com.np</a>). By completing a transaction on our platform, you acknowledge and agree to the terms below.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Digital Goods Notice & Finality of Sales</h2>
              <p>
                Byiora distributes non-tangible, digital products (including digital gift cards, game activation codes, and direct in-game top-ups). Due to the nature of digital goods, codes can be redeemed immediately upon delivery and in-game currencies are permanently credited to game servers. Consequently, <strong>all sales are final</strong> once a digital code has been delivered or an in-game top-up has been credited.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Direct-to-Account & In-Game UID Top-Ups</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Customer Accuracy:</strong> Customers are solely responsible for providing accurate Player IDs (UID), Zone/Server IDs, or required account credentials.</li>
                <li><strong>Irreversible Fulfillment:</strong> Once in-game items or currencies have been successfully credited to the player details submitted, the transaction is irreversible and cannot be canceled, refunded, or transferred.</li>
                <li><strong>Unfulfilled Orders:</strong> If an order cannot be processed due to invalid or unverified account identifiers, fulfillment will be placed on hold until corrected details are provided, or a full refund will be issued upon request.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Incomplete Payments & Underpayments</h2>
              <p className="mb-2">
                Orders are fulfilled exclusively upon receipt of the full invoiced amount:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>If a payment received is less than the required order total, automated fulfillment will be held.</li>
                <li>Customers may contact support to complete the outstanding balance to release the order.</li>
                <li>Alternatively, customers may request a refund of the underpaid amount, which will be processed back to the originating payment source within standard banking processing times.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Promotional Codes & Discounted Orders</h2>
              <p className="mb-2">
                Where an order placed with a promotional code or voucher is eligible for cancellation or refund:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The refund amount will strictly equal the <strong>actual monetary amount paid</strong> by the customer.</li>
                <li>Promotional discounts, coupons, and vouchers carry zero cash surrender value and are not refundable as cash.</li>
                <li>If an order is canceled due to an inventory shortage on Byiora's part, customer support may reissue a promotional voucher where applicable.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Delayed & Expired Payment Sessions</h2>
              <p>
                Electronic payment sessions must be completed within the active checkout window. If payment is completed after a session has expired, the order is subject to manual verification. Upon verifying settlement, Byiora will either fulfill the order or issue a full refund to the customer.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Non-Refundable Circumstances</h2>
              <p className="mb-2">Refunds or exchanges will not be granted under the following circumstances:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Change of mind or accidental purchases.</li>
                <li>Purchasing products for an incorrect platform, operating system, or geographical region.</li>
                <li>Device or hardware incompatibility.</li>
                <li>Suspensions, penalties, or bans applied to the customer's gaming account by third-party game publishers.</li>
                <li>Incorrect player or account details entered by the customer where fulfillment has completed.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Eligible Circumstances for Refund or Replacement</h2>
              <p className="mb-2">A replacement or refund may be issued under the following conditions:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Defective Code:</strong> The delivered digital code is proven to have been invalid or redeemed prior to the timestamp of dispatch.</li>
                <li><strong>Unfulfillment:</strong> Payment was successfully received, but Byiora is unable to fulfill the digital product due to stock unavailability or technical disruption.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Verification & Claim Procedure</h2>
              <p className="mb-2">
                Claims regarding defective keys or unfulfilled orders must be submitted to <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a> within 24 hours of purchase, including:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>The relevant Order ID and Payment Reference.</li>
                <li>Clear, uncropped screenshots showing the redemption error on the official platform.</li>
                <li>Claims are subject to verification with authorized distribution channels. If publisher records show redemption occurred after delivery, the claim will be denied.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">9. Payment Disputes & Abuse</h2>
              <p>
                Filing fraudulent disputes, chargebacks, or false defect claims after receiving valid digital goods is considered a violation of our terms. Byiora reserves the right to terminate accounts, restrict future purchases, and take appropriate legal measures in accordance with the Electronic Transactions Act, 2063.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">10. Customer Support</h2>
              <p>
                For questions regarding orders, payments, or product redemption, please contact our support team at <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
