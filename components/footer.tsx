import { Clock, Shield, CreditCard, Headphones, Mail, BadgeCheck } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

/** simple: skip the purple "Why top up on Byiora?" block (used on the sign-in/sign-up pages). */
export function Footer({ simple = false }: { simple?: boolean } = {}) {
  return (
    <footer className="w-full">
      {/* Purple Section */}
      {!simple && (
      <div className="footer-purple py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-wider">BYIORA</h2>
            <h3 className="text-xl md:text-2xl font-semibold mb-4">WHY TOP UP ON BYIORA?</h3>
            <p className="text-white/90 max-w-4xl mx-auto text-sm md:text-base leading-relaxed">
              Buy gift cards, game top-ups and game keys in Nepal and pay using eSewa, Khalti or Fonepay.
              Gift card codes are emailed to you after payment, top-ups go straight to your player ID, and every
              order stays in your transaction history.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Easy and Fast */}
            <div className="footer-feature-box">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">Easy and Fast</h4>
                <p className="text-white/80 text-sm">It only takes a few seconds to complete a purchase on Byiora.</p>
              </div>
            </div>

            {/* Instant Delivery */}
            <div className="footer-feature-box">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">Instant Delivery</h4>
                <p className="text-white/80 text-sm">
                  As soon as your payment is confirmed, codes are emailed to you and top-ups are sent to your player ID.
                </p>
              </div>
            </div>

            {/* Convenient Payment Methods */}
            <div className="footer-feature-box">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">Convenient Payment Methods</h4>
                <p className="text-white/80 text-sm">
                  To ensure your convenience, we have partnered with the most popular providers in Nepal.
                </p>
              </div>
            </div>

            {/* Customer Support */}
            <div className="footer-feature-box">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Headphones className="h-6 w-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white mb-2">Customer Support</h4>
                <p className="text-white/80 text-sm">
                  Our support team is here Sunday to Friday, 9 AM to 6 PM Nepal time.{" "}
                  <a href="/contact" className="underline hover:text-yellow-300">
                    Contact us!
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Yellow Section: help, country, socials. Two columns on phones so it reads as one tidy block. */}
      <div className="footer-yellow py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 md:grid-cols-3">
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">Need help?</h3>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-sm transition hover:bg-gray-100"
              >
                <Mail className="h-4 w-4" />
                Contact us
              </Link>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">Based in</h3>
              <div className="flex items-center gap-2">
                <Image src="/images/nepal-flag.svg" alt="Nepal flag" width={20} height={20} className="h-5 w-5 object-contain" />
                <span className="font-semibold text-brand-charcoal">Nepal</span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-charcoal/90">
                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                PAN 151285437
              </p>
            </div>

            <div className="col-span-2 md:col-span-1">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">Follow us</h3>
              <div className="flex gap-3">
                <a
                  href="https://www.facebook.com/byiora"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Byiora on Facebook"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm transition hover:bg-white "
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                </a>
                <a
                  href="https://www.instagram.com/byiora"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Byiora on Instagram"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm transition hover:bg-white "
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <defs>
                        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#f09433"/>
                          <stop offset="0.25" stopColor="#e6683c"/>
                          <stop offset="0.5" stopColor="#dc2743"/>
                          <stop offset="0.75" stopColor="#cc2366"/>
                          <stop offset="1" stopColor="#bc1888"/>
                        </linearGradient>
                      </defs>
                      <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.169a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                    </svg>
                </a>
                <a
                  href="https://wa.me/9779842864103"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with Byiora on WhatsApp"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm transition hover:bg-white "
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.665-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: company and legal links, with the Byiora logo. */}
      <div className="border-t border-gray-200 bg-white py-4">
        <div className="container mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 md:flex-row md:justify-between">
          <nav aria-label="Legal and company" className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-gray-600 md:justify-start">
            {/* Laptop: copyright sits to the left of the links. On phones it goes under the logo instead. */}
            <span className="hidden pr-2 text-gray-500 md:inline">© 2026 Copyright Byiora</span>
            <Link href="/about" className="px-2 py-2 hover:text-brand-sky-blue">About Us</Link>
            <Link href="/terms-and-conditions" className="px-2 py-2 hover:text-brand-sky-blue">Terms &amp; Conditions</Link>
            <Link href="/privacy-policy" className="px-2 py-2 hover:text-brand-sky-blue">Privacy Policy</Link>
            <Link href="/refund-policy" className="px-2 py-2 hover:text-brand-sky-blue">Refund Policy</Link>
            <a href="https://www.trustpilot.com/review/byiora.com.np" target="_blank" rel="noopener noreferrer" className="px-2 py-2 hover:text-brand-sky-blue">
              Reviews on Trustpilot
            </a>
          </nav>
          <div className="flex flex-col items-center gap-1">
            <Image src="/logo-final.png" alt="Byiora" width={80} height={24} className="h-6 w-auto object-contain" unoptimized />
            <span className="text-xs text-gray-500 md:hidden">© 2026 Copyright Byiora</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
