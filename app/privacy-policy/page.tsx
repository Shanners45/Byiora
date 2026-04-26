"use client"

import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPolicyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide mb-3">
              Privacy Policy
            </h1>
            <p className="text-gray-500 text-sm font-medium">Last Updated: April 2026</p>
          </div>

          <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
            <p>
              At Byiora, we respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains what information we collect, how we use it, and how we keep it safe when you use our platform.
            </p>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
              <p className="mb-2">We believe in data minimization. We only collect the absolute minimum information required to deliver your digital goods and provide customer support.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Guest Checkout:</strong> We collect only your Email Address.</li>
                <li><strong>Registered Accounts:</strong> We collect your Name and Email Address.</li>
                <li><strong>What We DO NOT Collect:</strong> We do not track your IP address, device fingerprints, browsing behavior, or physical location.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. Payment Information</h2>
              <p>
                Byiora does not collect, process, or store your financial information. When you make a purchase, your payment is handled entirely by secure, authorized third-party payment providers (such as eSewa, Khalti, or Fonepay). We only receive a transaction ID and a confirmation of success or failure from these providers.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
              <p className="mb-2">We use your Name and Email Address for the following purposes:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Order Fulfillment:</strong> To instantly email you the digital game keys or gift cards you have purchased.</li>
                <li><strong>Customer Support:</strong> To assist you with any questions regarding your past orders.</li>
                <li><strong>Marketing & Promotions:</strong> To send you exclusive promotional offers, discount codes, and updates about new products on Byiora.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. Marketing Opt-Out</h2>
              <p>
                You have the right to opt out of our marketing communications at any time. Every promotional email we send will include an "Unsubscribe" link at the bottom. Even if you opt out of marketing emails, you will still receive mandatory transactional emails containing your purchased digital keys.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. Information Sharing</h2>
              <p className="mb-2">We will never sell, rent, or trade your personal information to third parties. Your information is only shared in the following limited circumstances:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>With our secure payment gateway partners strictly for the purpose of validating a transaction.</li>
                <li>If required by law, court order, or government regulation within Nepal.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your Name and Email Address from unauthorized access, alteration, or disclosure. Your data is stored securely in our database, which is protected by modern encryption and strict access controls.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">7. Your Rights</h2>
              <p>
                You have the right to request access to the personal data we hold about you. If you have a registered account, you can update your Name and Email Address at any time. You may also contact our support team to request the deletion of your account and personal data from our systems.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
