import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms and Conditions | Byiora - Buy Game Gift Cards Nepal",
  description: "Read the Terms and Conditions for using Byiora's platform to buy game top-ups and digital gift cards in Nepal.",
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
            <p className="text-gray-500 text-sm font-medium">Last Updated: April 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              Welcome to Byiora! These Terms and Conditions outline the rules and regulations for the use of Byiora's website and services. By accessing this website and purchasing our digital goods, you accept these terms and conditions in full.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. General Provisions</h2>
              <p>
                Byiora is a digital goods and game voucher platform operating within Nepal. By placing an order, you confirm that you have read, understood, and agree to be bound by these terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. User Accounts and Guest Checkout</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Checkout Options:</strong> You may purchase digital goods through a registered account or via Guest Checkout.</li>
                <li><strong>Account Accuracy:</strong> Whether registering an account or checking out as a guest, you are solely responsible for providing a correct and accessible email address. Byiora is not responsible for digital keys sent to an incorrect email address provided by the user.</li>
                <li><strong>Security:</strong> If you create an account, you are responsible for maintaining the confidentiality of your login credentials.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Age Requirements</h2>
              <p>
                While creating an account on Byiora does not have a strict age limit, certain digital goods and game keys (such as mature-rated games) carry age restrictions established by the game publishers. By purchasing an age-restricted product, you certify that you meet the minimum age requirement to play that game, or that you have obtained consent from a parent or legal guardian.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Delivery of Digital Goods</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Processing Time:</strong> We pride ourselves on speed. Delivery of digital keys is typically "almost instant." However, to protect against fraud, all orders are subject to automated and manual backend security checks.</li>
                <li><strong>Delays:</strong> In the event your transaction is flagged for review, delivery may be temporarily delayed until our team verifies the purchase. We reserve the right to withhold delivery if a transaction appears suspicious.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Refund and Return Policy (Strictly Enforced)</h2>
              <p className="mb-2">Due to the nature of digital goods, all sales are final.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>No Returns:</strong> Once a digital key, gift card, or voucher code has been emailed to you or viewed on your screen, it cannot be returned, exchanged, or refunded.</li>
                <li><strong>Exceptions:</strong> A refund or replacement will only be issued if you can definitively prove the digital key was invalid before it was delivered to you. You must contact our support team within 24 hours of purchase if you encounter an issue with a key.</li>
                <li><strong>Used Keys:</strong> We maintain strict logs of when keys are dispatched. Claims of "the key was already used" will be investigated with the publisher. If the publisher confirms the key was redeemed after our system delivered it to you, no refund will be provided.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Pricing and Payments</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Currency:</strong> All prices are listed in Nepalese Rupees (NPR).</li>
                <li><strong>Payment Gateways:</strong> All payments are processed securely through authorized third-party gateways (e.g., eSewa, Khalti, Fonepay). Byiora does not handle or store any of your direct financial or banking information.</li>
                <li><strong>Order Cancellation:</strong> We reserve the right to cancel any order due to pricing errors, suspected fraud, or stock unavailability. If an order is canceled by us after payment, a full refund will be issued.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Governing Law</h2>
              <p>
                These terms and conditions are governed by and construed in accordance with the laws of Nepal, including the Electronic Transactions Act, 2063. Any disputes relating to these terms and conditions will be subject to the exclusive jurisdiction of the courts of Nepal.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
