import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import type { Metadata } from "next"

const BASE_URL = "https://www.byiora.com.np"

export const metadata: Metadata = {
  title: "Terms and Conditions | Byiora - Buy Game Gift Cards Nepal",
  description: "Read the Terms and Conditions for using Byiora's platform to buy game top-ups and digital gift cards in Nepal.",
  alternates: {
    canonical: `${BASE_URL}/terms-and-conditions`,
  },
  openGraph: {
    title: "Terms and Conditions | Byiora",
    description: "Read the Terms and Conditions for using Byiora's platform to buy game top-ups and digital gift cards in Nepal.",
    url: `${BASE_URL}/terms-and-conditions`,
    siteName: "Byiora",
    type: "website",
  },
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <BackButton className="mb-6 text-white hover:bg-white/10" />

        <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">
              Terms and Conditions
            </h1>
            <p className="text-gray-500 text-sm font-medium">Last Updated: September 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              Welcome to Byiora! These Terms and Conditions govern your access to and use of Byiora's website (<a href="https://www.byiora.com.np" className="text-brand-sky-blue hover:underline">byiora.com.np</a>) and our digital gaming and voucher distribution services. By browsing our website, creating an account, placing an order, or redeeming a promotional voucher, you agree to be bound by these Terms and Conditions.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. General Provisions</h2>
              <p>
                Byiora is an online digital gaming distribution platform operating in Nepal. We facilitate the purchase of digital game activation codes, gift cards, and direct in-game account top-ups (including in-game credits, points, and items). By placing an order, you represent that you have legal capacity to enter into binding agreements.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. User Accounts & Platform Integrity</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Checkout Methods:</strong> You may purchase products through a registered user account or via guest checkout.</li>
                <li><strong>Contact Accuracy:</strong> You are responsible for providing an accurate and accessible email address during checkout. All digital vouchers, keys, and order updates are delivered electronically to the contact details provided. Byiora is not responsible for misdelivery resulting from customer data entry errors.</li>
                <li><strong>Account Confidentiality:</strong> Registered users are responsible for maintaining the confidentiality of their credentials and for all activities conducted under their account.</li>
                <li><strong>Platform Security & Abuse:</strong> To protect platform integrity, Byiora utilizes automated security screening and verification controls. The use of automated bots, unauthorized scripts, disposable email services, or any fraudulent manipulation during checkout or voucher redemption is strictly prohibited and may result in immediate cancellation of orders and account restriction.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Age & Publisher Restrictions</h2>
              <p>
                Certain games and digital content carry age ratings or publisher-specific terms. By purchasing restricted content, you confirm that you meet the necessary age requirements or have obtained appropriate parental or guardian consent.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Delivery of Digital Goods & Game Top-Ups</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Digital Voucher Delivery:</strong> Digital codes and gift cards are delivered electronically following successful payment confirmation, displayed on-screen and transmitted via email.</li>
                <li><strong>Direct-to-Account Top-Ups:</strong> For top-ups credited directly to your game account, you are solely responsible for ensuring the accuracy of the Player ID (UID), Server/Zone ID, or required login details submitted. Once in-game currency or items are successfully credited to the specified player account, the delivery is final, complete, and irreversible.</li>
                <li><strong>Security Verifications:</strong> Orders flagged by automated security or payment verification filters may be held temporarily for review. Byiora reserves the right to cancel and refund any order that fails security validation.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Promotional Codes & Vouchers</h2>
              <p className="mb-2">
                Byiora may periodically offer promotional codes, discount vouchers, or special offers. The following general terms apply to all promotions:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Terms & Eligibility:</strong> Promotional codes are subject to specific promotional terms, eligibility criteria, qualifying order requirements, and validity periods as defined by Byiora.</li>
                <li><strong>Non-Transferable & No Cash Value:</strong> Promotional codes, discounts, and vouchers have zero cash surrender value and are non-transferable. They cannot be exchanged for cash, credited to bank accounts, or applied retroactively to previous transactions.</li>
                <li><strong>Redemption Limits:</strong> Unless explicitly stated otherwise, promotional codes are limited to one redemption per customer or household and cannot be combined with other concurrent offers.</li>
                <li><strong>Right of Revocation:</strong> Byiora reserves the right to modify, cancel, or suspend any promotional campaign or discount at any time. Any fraudulent redemption, unauthorized duplication, or manipulation of promotional vouchers will result in order cancellation and revocation of promotional benefits.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Pricing & Payments</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Currency:</strong> All prices are displayed and billed in Nepalese Rupees (NPR).</li>
                <li><strong>Payment Gateways:</strong> Payments are processed through authorized digital payment providers and electronic banking channels in Nepal. Byiora does not store your direct banking passwords, PINs, or sensitive payment credentials.</li>
                <li><strong>Incomplete & Underpayments:</strong> Orders require full settlement of the billed amount before digital items or top-ups can be released. Partial payments or underpayments will cause the order to remain on hold until the balance is settled or a refund is processed according to our Refund Policy.</li>
                <li><strong>Payment Windows:</strong> Electronic payment sessions have designated time limits. Payments submitted after session expiry may require manual reconciliation by our support team before fulfillment or refund.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Refund and Return Policy</h2>
              <p>
                Due to the non-tangible, irreversible nature of digital game codes, gift cards, and direct in-game top-ups, all sales are final once delivered. For full details regarding defect investigations, underpayments, and refund terms, please consult our <a href="/refund-policy" className="text-brand-sky-blue font-semibold hover:underline">Refund & Return Policy</a>, which is incorporated herein by reference.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. Governing Law & Dispute Resolution</h2>
              <p>
                These Terms and Conditions are governed by and construed in accordance with the laws of Nepal, including the Electronic Transactions Act, 2063 and applicable digital commerce regulations. Any disputes arising out of or related to these terms shall be subject to the exclusive jurisdiction of the competent courts of Nepal.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
