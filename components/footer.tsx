import { Facebook, Instagram, Youtube, Clock, Shield, CreditCard, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"

export function Footer() {
  return (
    <footer>
      {/* Purple Section */}
      <div className="footer-purple py-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-wider">BYIORA</h2>
            <h3 className="text-xl md:text-2xl font-semibold mb-4">WHY TOP UP ON BYIORA?</h3>
            <p className="text-white/90 max-w-4xl mx-auto text-sm md:text-base leading-relaxed">
              Millions of gamers count on Byiora every month for a seamless purchase experience when buying game credits
              or vouchers - No registration or log-in is required, and purchases are added to your game account
              instantly. Top-up PUBG Mobile and more now!
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
                  When you top-up on Byiora, your purchase is delivered directly to your game account as soon as your
                  payment is complete.
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
                  Our friendly customer support team is always available to assist you.{" "}
                  <a href="/contact" className="underline hover:text-yellow-300">
                    Contact us!
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Yellow Section */}
      <div className="footer-yellow py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Need help? */}
            <div>
              <h3 className="font-bold text-brand-charcoal mb-4">Need help?</h3>
              <a href="/contact">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white"
                >
                  📧 Contact Us
                </Button>
              </a>
            </div>

            {/* Country */}
            <div>
              <h3 className="font-bold text-brand-charcoal mb-4">Country</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇳🇵</span>
                <span className="text-brand-charcoal font-medium">Nepal</span>
              </div>
            </div>

            {/* Stay updated */}
            <div>
              <h3 className="font-bold text-brand-charcoal mb-4">Stay updated with us:</h3>
              <div className="flex space-x-2">
                <a href="https://www.facebook.com/byiora" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:bg-blue-50"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </Button>
                </a>

                <a href="https://www.instagram.com/byiora" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:bg-pink-50"
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
                  </Button>
                </a>

                <a href="https://wa.me/9779842864103" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:bg-green-50"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.665-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.012c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-gray-100 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-light-gray">
            <div className="flex flex-wrap gap-4">
              <span>© 2026 Copyright Byiora</span>
              <Link href="/terms-and-conditions" className="hover:text-brand-sky-blue">
                Terms & Conditions
              </Link>
              <Link href="/privacy-policy" className="hover:text-brand-sky-blue">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="hover:text-brand-sky-blue">
                Refund Policy
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 relative">
                <Image
                  src="/logo-final.png"
                  alt="Byiora Logo"
                  width={80}
                  height={24}
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
