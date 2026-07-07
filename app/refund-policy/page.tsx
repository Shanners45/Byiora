import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refund & Return Policy | Byiora - Buy Game Gift Cards Nepal",
  description: "Learn about the Refund and Return Policy at Byiora. Understand our terms for refunds on game top-ups and digital gift cards in Nepal.",
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
            <p className="text-gray-500 text-sm font-medium">Last Updated: April 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              This Refund and Return Policy applies to all purchases made on Byiora (byiora.com.np). By completing a purchase on our platform, you explicitly acknowledge and legally agree to the terms set forth below.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Digital Goods Notice</h2>
              <p>
                Byiora sells digital, non-tangible, irrevocable goods (including but not limited to digital game keys, gift cards, and software activation codes). Unlike physical goods, digital codes can be duplicated, viewed, and compromised the second they are delivered. Therefore, we operate under a strict, industry-standard policy for digital retail.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. All Sales Are Final</h2>
              <p>
                Absolutely no refunds, returns, or exchanges will be granted once a digital product code has been delivered to your email or viewed on your screen. Once a digital key has been exposed to a customer, its security is permanently compromised, and Byiora cannot revoke or resell the item. By confirming your purchase, you agree to waive any right to a "cooling-off period" or standard return window.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. Strictly Non-Refundable Circumstances</h2>
              <p className="mb-2">Under no circumstances will Byiora issue a refund, partial refund, or replacement for any of the following reasons:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Change of Mind:</strong> You purchased the product and later decided you no longer want it.</li>
                <li><strong>Wrong Platform/Region:</strong> You purchased a key for the wrong console (e.g., buying a PC key instead of PlayStation) or the wrong geographical region (e.g., buying a US-only key when you reside in Nepal). It is your sole responsibility to read the product description, platform, and region locks before purchasing.</li>
                <li><strong>Hardware Incompatibility:</strong> Your PC or device does not meet the minimum system requirements to run the software or game.</li>
                <li><strong>Account Bans:</strong> Your gaming account is suspended, banned, or terminated by the game publisher (e.g., Rockstar, Steam, Epic Games) for violating their Terms of Service.</li>
                <li><strong>Accidental Purchase:</strong> You or someone else with access to your device/payment method made the purchase by mistake.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. The Sole Exceptions for a Refund/Replacement</h2>
              <p className="mb-2">Byiora will only issue a replacement key (or a full refund if a replacement is out of stock) under these specific, verifiable conditions:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Defective Key Prior to Delivery:</strong> The digital key provided is invalid, revoked, or proven to have been redeemed before the exact timestamp it was delivered to you by our system.</li>
                <li><strong>Failure to Deliver:</strong> Your payment was successfully captured by our gateway (eSewa, Khalti, Fonepay), but our system completely failed to generate and deliver your order due to an inventory shortage or technical error.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Verification Process & Burden of Proof</h2>
              <p className="mb-2">If you claim a key is defective, you must contact us at <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a> within 24 hours of delivery. To process an investigation, you must provide:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Your exact Order ID and Bank Transaction ID (if applicable).</li>
                <li>Uncropped, full-screen screenshots showing the error message on the official redemption platform (e.g., Steam, Rockstar Launcher).</li>
                <li><strong>Publisher Verification:</strong> Byiora will contact the official game publisher or our global distributor to verify the exact date and time the key was redeemed. If the publisher's logs show the key was redeemed AFTER the timestamp our system delivered it to you, your claim will be immediately denied, and no refund will be issued.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Fraudulent Disputes and Chargebacks</h2>
              <p className="mb-2">
                Any attempt to bypass this policy by filing a fraudulent dispute, chargeback, or reversal through your bank, eSewa, Khalti, Fonepay, or Nepal Clearing House Ltd. (NCHL) will be treated as digital theft.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>If you initiate a chargeback for a delivered, working key, your Byiora account will be permanently banned.</li>
                <li>We reserve the right to forward your IP address, device information, and transaction logs to the relevant payment provider, local authorities, and the Cyber Bureau of Nepal Rastra Bank under the Electronic Transactions Act, 2063.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Contact Us</h2>
              <p>
                For any technical issues regarding the redemption of your legally purchased digital keys, please contact our support team at <a href="mailto:support@byiora.com.np" className="text-brand-sky-blue hover:underline">support@byiora.com.np</a>. We are committed to assisting you in getting your valid products working.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
