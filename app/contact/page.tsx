import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BackButton } from "@/components/back-button"
import { ContactForm } from "@/components/contact-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us | Byiora - 24/7 Game Support Nepal",
  description: "Need help with a game top-up or gift card? Contact Byiora support via WhatsApp, email, or our contact form. We're here to help you 24/7.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-purple">
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
