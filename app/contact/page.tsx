"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Mail, MessageCircle, Facebook, Instagram, Twitter, Clock, Send, ChevronRight, ArrowLeft } from "lucide-react"

const CONTACT_DETAILS = {
  email: "support@byiora.store",
  whatsapp: "+977-9800000000", // Replace with real number
  whatsappLink: "https://wa.me/9779800000000",
  facebook: "https://www.facebook.com/byiora",
  instagram: "https://www.instagram.com/byiora",
  twitter: "https://twitter.com/byiora",
  supportHours: "Sun – Fri, 9 AM – 6 PM NPT",
}

export default function ContactPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [sending, setSending] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all required fields.")
      return
    }
    setSending(true)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send message")
      }

      toast.success("Message sent! We'll get back to you shortly.")
      setForm({ name: "", email: "", subject: "", message: "" })
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast.error(error.message || "Something went wrong. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-6 text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        {/* Page heading */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-widest mb-3">
            Contact Us
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
            Have a question or need help with an order? We&apos;re here for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* ── Left: contact channels ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* WhatsApp */}
            <a
              href={CONTACT_DETAILS.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-2xl px-5 py-4 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                {/* WhatsApp icon via SVG */}
                <svg viewBox="0 0 32 32" className="h-5 w-5 fill-purple-600">
                  <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.675 4.799 1.848 6.789L2 30l7.394-1.824A13.937 13.937 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.45 11.45 0 0 1-5.832-1.59l-.418-.248-4.385 1.082 1.1-4.27-.272-.44A11.493 11.493 0 0 1 4.5 16C4.5 9.649 9.649 4.5 16 4.5S27.5 9.649 27.5 16 22.351 27.5 16 27.5zm6.29-8.617c-.345-.172-2.04-1.006-2.356-1.12-.316-.115-.547-.172-.778.172-.23.345-.893 1.12-1.094 1.351-.201.23-.402.258-.747.086-.345-.172-1.456-.537-2.773-1.712-1.025-.913-1.717-2.04-1.918-2.385-.201-.345-.021-.531.151-.703.155-.154.345-.402.518-.603.172-.201.229-.345.344-.575.115-.23.057-.431-.029-.603-.086-.172-.778-1.876-1.066-2.57-.28-.675-.565-.583-.778-.594l-.662-.011c-.23 0-.603.086-.918.431s-1.208 1.18-1.208 2.876 1.237 3.336 1.409 3.566c.172.23 2.436 3.72 5.903 5.213.824.356 1.467.569 1.969.728.827.264 1.58.227 2.175.138.664-.1 2.04-.834 2.327-1.638.287-.804.287-1.493.201-1.638-.086-.144-.316-.23-.662-.402z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">WhatsApp</p>
                <p className="text-slate-800 font-semibold text-sm">{CONTACT_DETAILS.whatsapp}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 ml-auto transition-colors" />
            </a>

            {/* Email */}
            <a
              href={`mailto:${CONTACT_DETAILS.email}`}
              className="group flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-2xl px-5 py-4 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Email</p>
                <p className="text-slate-800 font-semibold text-sm truncate">{CONTACT_DETAILS.email}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 ml-auto transition-colors" />
            </a>

            {/* Facebook */}
            <a
              href={CONTACT_DETAILS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-2xl px-5 py-4 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Facebook className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Facebook</p>
                <p className="text-slate-800 font-semibold text-sm">Byiora</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 ml-auto transition-colors" />
            </a>

            {/* Instagram */}
            <a
              href={CONTACT_DETAILS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-2xl px-5 py-4 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Instagram className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Instagram</p>
                <p className="text-slate-800 font-semibold text-sm">@byiora</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 ml-auto transition-colors" />
            </a>

            {/* Twitter / X */}
            <a
              href={CONTACT_DETAILS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-2xl px-5 py-4 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Twitter className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Twitter / X</p>
                <p className="text-slate-800 font-semibold text-sm">@byiora</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 ml-auto transition-colors" />
            </a>

            {/* Support hours */}
            <div className="flex items-center gap-4 bg-white border border-slate-200 shadow-sm rounded-2xl px-5 py-4">
              <div className="w-11 h-11 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Support Hours</p>
                <p className="text-slate-800 font-semibold text-sm">{CONTACT_DETAILS.supportHours}</p>
              </div>
            </div>
          </div>

          {/* ── Right: contact form ── */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow-md border border-slate-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-purple-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Send us a message</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Your name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Subject
                  </label>
                  <Input
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Order issue, refund, general enquiry…"
                    className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your issue or question in detail…"
                    rows={6}
                    className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-brand-purple hover:bg-brand-purple/90 text-white font-semibold h-11 gap-2"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Sending email…" : "Send Message"}
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  Your message will be sent to{" "}
                  <span className="text-gray-500 font-mono">{CONTACT_DETAILS.email}</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
