import { Facebook, Twitter, Instagram, Clock, Shield, CreditCard, Headphones } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

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
                    className="text-brand-charcoal hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Facebook className="h-5 w-5" />
                  </Button>
                </a>
                <a href="https://twitter.com/byiora" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:text-sky-500 hover:bg-sky-50"
                  >
                    <Twitter className="h-5 w-5" />
                  </Button>
                </a>
                <a href="https://www.instagram.com/byiora" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-brand-charcoal hover:text-pink-500 hover:bg-pink-50"
                  >
                    <Instagram className="h-5 w-5" />
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
              <a href="#" className="hover:text-brand-sky-blue">
                Terms & Conditions
              </a>
              <a href="#" className="hover:text-brand-sky-blue">
                Privacy Policy
              </a>
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
