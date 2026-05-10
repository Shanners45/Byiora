"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Shield, HelpCircle, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { getProductBySlug } from "@/lib/product-categories"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { ProductSkeleton } from "@/components/product-skeleton"
import { FaqAccordion } from "@/components/faq-accordion"
import { sanitizeHtml } from "@/lib/sanitize"
import { encryptCheckoutData } from "@/app/actions/checkout-encryption"
interface PaymentMethod {
  id: string
  name: string
  logo_url: string | null
  qr_url: string | null
  instructions: string | null
  is_enabled: boolean
}


export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addTransaction, user } = useAuth()
  const { sendNotification } = useNotifications()
  const [selectedDenomination, setSelectedDenomination] = useState("")
  const [selectedPayment, setSelectedPayment] = useState("")
  const [email, setEmail] = useState(user?.email || "")

  // Auto-fill email when user is logged in
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user?.email])
  const [userId, setUserId] = useState("")
  const [selectedServer, setSelectedServer] = useState("")
  const [checkoutFieldValues, setCheckoutFieldValues] = useState<Record<string, string>>({})
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const supabase = createClient()
  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [notFound, setNotFound] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [faqExpanded, setFaqExpanded] = useState(false)
  const DESC_LIMIT = 600
  const FAQ_LIMIT = 3

  const categorySlug = (params.category as string | undefined) ?? ""
  const productSlug = params.slug as string

  const giftCard = {
    name: product?.name || "Gift Card",
    description: product?.description || "Digital Gift Card",
    denominations: product?.denominations || [],
    instructions: "Purchased codes will be sent to your email.",
  }

  // Reset scroll position on mount — scroll behavior belongs here, not in skeleton components
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const productData = await getProductBySlug(productSlug)

        // Validate that the product's category matches the URL category
        if (productData && categorySlug && productData.category !== categorySlug) {
          setNotFound(true)
          setProduct(null)
        } else {
          setProduct(productData)
          setNotFound(!productData)
        }
      } catch (error) {
        console.error("Error loading product:", error)
        setNotFound(true)
      } finally {
        setIsLoading(false)
      }
    }

    const loadPaymentMethods = async () => {
      try {
        const { data, error } = await supabase
          .from("payment_methods")
          .select("*")
          .eq("is_enabled", true)
          .order("sort_order", { ascending: true })

        if (!error && data) {
          setPaymentMethods(data)
        }
      } catch (error) {
        console.error("Error loading payment methods:", error)
      }
    }

    Promise.all([loadProduct(), loadPaymentMethods()])
  }, [productSlug, categorySlug])

  const isTopupProduct = product?.category === "topup"
  const isDirectLoginProduct = product?.category === "direct-login"
  const checkoutFields = product?.checkout_fields || []



  if (isLoading) {
    return <ProductSkeleton />
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-brand-purple flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Product Not Found</h1>
          <p className="text-white/70 mb-6">The product you&apos;re looking for doesn&apos;t exist or has been moved.</p>
          <Button onClick={() => router.push("/")} className="bg-brand-sky-blue hover:bg-brand-sky-blue/80">
            Go Back Home
          </Button>
        </div>
      </div>
    )
  }

  const handlePaymentMethodSelect = (paymentId: string) => {
    setSelectedPayment(paymentId)
    const paymentMethod = paymentMethods.find((p) => p.id === paymentId)
    if (paymentMethod) {
      setSelectedPaymentMethod(paymentMethod)
    }
  }

  const handlePurchase = async () => {
    // Validate checkout fields for direct-login and topup
    const missingCheckoutField = (isDirectLoginProduct || isTopupProduct) && checkoutFields.some(
      (f: any) => f.required && !checkoutFieldValues[f.key]?.trim()
    )

    const hasServers = product.servers && product.servers.length > 0
    const missingServer = isTopupProduct && hasServers && !selectedServer

    if (!selectedDenomination || !selectedPayment || !email || (isTopupProduct && !userId) || missingServer || missingCheckoutField) {
      if (missingServer) {
        toast.error("Please select a server")
      } else {
        toast.error("Please complete all required fields")
      }
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsProcessing(true)

    const selectedDenom = giftCard.denominations.find((d: any) => d.label === selectedDenomination)
    const paymentMethodName = paymentMethods.find((p) => p.id === selectedPayment)?.name || selectedPayment

    try {
      // Add transaction and keep it as "Processing" - no status updates
      const transactionId = await addTransaction({
        product: `${giftCard.name}`,
        amount: selectedDenom?.label || selectedDenomination,
        price: `${selectedDenom?.price}`,
        status: "Processing", // Always keep as Processing
        paymentMethod: paymentMethodName,
        email: email,
        productId: product?.id || productSlug,
        productCategory: product?.category || (isTopupProduct ? "topup" : isDirectLoginProduct ? "direct-login" : "digital-goods"),
        guestData: isTopupProduct ? { userId, server: selectedServer } : null,
      })

      // Encrypt checkout field values
      if ((isDirectLoginProduct || isTopupProduct) && Object.keys(checkoutFieldValues).length > 0) {
        try {
          await encryptCheckoutData(transactionId, checkoutFieldValues)
        } catch (encryptError) {
          console.error("Failed to encrypt checkout data:", encryptError)
          toast.error("Failed to secure your login details. Please try again.")
          setIsProcessing(false)
          return
        }
      }

      // Order placed email is sent server-side (non-blocking) during transaction creation.

      // Simulate payment processing time, then close dialog and show notifications
      setTimeout(async () => {
        setIsProcessing(false)
        setShowQRDialog(false)

        if (user) {
          // Send DB notification AFTER dialog closes so the toast popup is visible
          // The notification context automatically fires a toast for us
          try {
            await sendNotification({
              title: "Order Placed Successfully! 🎉",
              message: `Your order for ${giftCard.name} (${selectedDenom?.label}) has been placed and is being processed.`,
              type: "success",
              userId: user.id,
            })
          } catch (notifError) {
            console.error("Failed to send notification:", notifError)
          }
        } else {
          // Fallback toast for guest users who do not rely on the notification context
          toast.success("Order Placed Successfully! 🎉", {
            description: `Your order for ${giftCard.name} (${selectedDenom?.label}) has been placed and is being processed.`,
          })
        }

        // Reset form after successful order
        setSelectedDenomination("")
        setSelectedPayment("")
        setUserId("")
        setSelectedServer("")
        if (!user) setEmail("") // Only reset email if not logged in
        setCheckoutFieldValues({})
        setMarketingConsent(false)
        setSmsConsent(false)
      }, 2000)
    } catch (error: any) {
      console.error("Error adding transaction:", error)
      setIsProcessing(false)
      setShowQRDialog(false)
      toast.error(error?.message || "Failed to process order. Please try again.")
    }
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.logo,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: "Byiora",
    },
    offers: giftCard.denominations.map((denom: any) => ({
      "@type": "Offer",
      name: `${product.name} - ${denom.label}`,
      url: `https://www.byiora.store/en-np/${productSlug}`,
      priceCurrency: "NPR",
      price: parseFloat(String(denom.price).replace(/,/g, "")) || 0,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "NP",
        returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        merchantReturnLink: "https://www.byiora.store/refund-policy",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "NP",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 0,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 0,
            unitCode: "DAY",
          },
        },
        shippingRate: {
          "@type": "MonetaryAmount",
          value: 0,
          currency: "NPR",
        },
      },
    })),
  }

  return (
    <div className="min-h-screen bg-brand-purple">
      {/* Product JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6 text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Image — always first */}
          <div className="lg:col-span-1 space-y-6 order-1">
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="w-full h-48 relative mb-4 rounded-lg overflow-hidden">
                <Image
                  src={product.logo || "/placeholder.svg?height=200&width=400"}
                  alt={giftCard.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw"
                  priority
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=200&width=400"
                  }}
                />
              </div>
              <h1 className="text-2xl font-bold text-brand-charcoal mb-2">{giftCard.name}</h1>
            </div>

            {/* Description & FAQ — visible on desktop only in this column */}
            <div className="hidden lg:block space-y-6">
              {/* Description Card */}
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h3 className="font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                  Description
                </h3>
                <div
                  className={`prose-rich-text text-brand-light-gray text-sm leading-relaxed ${!descExpanded && giftCard.description.length > DESC_LIMIT ? 'line-clamp-[8]' : ''}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(giftCard.description) }}
                />
                {giftCard.description.length > DESC_LIMIT && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-brand-sky-blue text-sm font-semibold mt-2 hover:underline">
                    {descExpanded ? "View Less" : "View More"}
                  </button>
                )}
              </div>

              {product.faqs && product.faqs.length > 0 ? (
                <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                  <h3 className="font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                    Frequently Asked Questions (FAQs)
                  </h3>
                  <div className="space-y-4">
                    <FaqAccordion faqs={product.faqs} />
                  </div>
                </div>
              ) : (
                <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                  <h3 className="font-semibold text-brand-charcoal mb-2">How it works:</h3>
                  <p className="text-sm text-brand-light-gray">{giftCard.instructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Purchase Form */}
          <div className="lg:col-span-2 space-y-6 order-2">
            {/* Step 1: User ID (for topup products only) */}
            {isTopupProduct && (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#00BCD4] text-white flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <h2 className="text-xl font-semibold text-brand-charcoal">
                    {product.servers && product.servers.length > 0 ? "Enter User ID and Server" : "Enter User ID"}
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userId" className="text-brand-charcoal font-semibold text-base">
                      Enter User ID *
                    </Label>
                    <div className="flex flex-row items-center gap-2 mt-2">
                      <div className="relative flex-1 min-w-0">
                        <Input
                          id="userId"
                          type="text"
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
                          placeholder="User ID"
                          required
                          autoComplete="off"
                          className="bg-white border-gray-200 text-brand-charcoal placeholder:text-gray-400 focus:ring-[#00BCD4] focus:border-[#00BCD4] w-full h-10 text-sm"
                        />
                      </div>

                      {product.servers && product.servers.length > 0 && (
                        <div className="w-28 md:w-48 flex-shrink-0">
                          <Select value={selectedServer} onValueChange={setSelectedServer}>
                            <SelectTrigger className="bg-white border-gray-200 text-brand-charcoal focus:ring-[#00BCD4] focus:border-[#00BCD4] h-10 text-sm">
                              <SelectValue placeholder="Server" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-100 shadow-xl">
                              {product.servers.map((server: { id: string; name: string }) => (
                                <SelectItem key={server.id} value={server.name} className="focus:bg-gray-100 focus:text-brand-charcoal cursor-pointer">
                                  {server.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {product.uid_guide_image && (
                        <div className="relative group/uid cursor-help flex-shrink-0">
                          <HelpCircle className="h-5 w-5 text-[#00BCD4] hover:text-[#00BCD4]/80 transition-colors" />
                          <div className="absolute bottom-full right-0 mb-3 w-[280px] md:w-[400px] max-w-[calc(100vw-40px)] p-2 bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 group-hover/uid:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-2 group-hover/uid:translate-y-0 z-[100]">
                            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                              <Image
                                src={product.uid_guide_image}
                                alt="ID Guide"
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                            <div className="absolute -bottom-2 right-2 w-4 h-4 bg-white border-r border-b border-gray-100 rotate-45" />
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-brand-light-gray mt-2">
                      {product.uid_instructions || "To find your User ID, click on your avatar, you can find your User ID under your Nickname."}
                    </p>
                  </div>
                </div>
              </div>
            )}



            {/* Step 1 or 2: Select Voucher */}
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${(isTopupProduct && userId && (product.servers && product.servers.length > 0 ? selectedServer : true)) || (!isTopupProduct)
                  ? "bg-[#00BCD4] text-white"
                  : "bg-gray-200 text-brand-light-gray"
                  }`}>
                  {isTopupProduct ? "2" : "1"}
                </div>
                <h2 className="text-xl font-semibold text-brand-charcoal">Select voucher</h2>
              </div>

              {(() => {
                const renderDenominationCard = (denom: any) => {
                  const isSelected = selectedDenomination === denom.label;
                  const cat = product?.denomination_categories?.find((c: any) => c.id === denom.categoryId);
                  // If category exists, only use category icon (no fallback to product icon)
                  // If no category, use product icon
                  const iconUrl = denom.categoryId ? cat?.icon_url : product?.denom_icon_url;
                  const hasIcon = !!iconUrl;
                  const isOutOfStock = denom.in_stock === false;

                  return (
                    <div key={denom.label} className={`relative ${isSelected && hasIcon ? "z-10" : ""}`}>
                      {denom.bestseller && (
                        <div className="absolute -top-3 -left-2 z-20 bg-gradient-to-r from-[#FF6B93] to-[#8B5CF6] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider">
                          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                          Best Seller
                        </div>
                      )}
                      <RadioGroupItem value={denom.label} id={denom.label} className="peer sr-only" disabled={isOutOfStock} />
                      <Label
                        htmlFor={denom.label}
                        className={`group flex flex-col overflow-hidden rounded-2xl transition-all h-full ${isOutOfStock
                          ? "cursor-not-allowed opacity-40 border border-gray-300 bg-gray-100 grayscale hover:border-gray-400 hover:shadow-[0_0_10px_rgba(156,163,175,0.4)]"
                          : isSelected
                            ? "cursor-pointer border-2 border-[#00BCD4] shadow-[0_0_15px_rgba(0,188,212,0.4)]"
                            : "cursor-pointer border border-gray-200 hover:border-[#00BCD4] hover:shadow-[0_0_10px_rgba(0,188,212,0.2)]"
                          }`}
                      >
                        {hasIcon ? (
                          <>
                            <div className={`px-3 py-4 flex-1 flex flex-col items-center justify-center ${isOutOfStock ? 'bg-gray-50/50' : ''}`}>
                              <div className="text-gray-900 font-bold text-base md:text-lg text-center mb-2">
                                {denom.label}
                              </div>
                              <div className="w-16 h-16 relative bg-transparent flex items-center justify-center">
                                {/* Using plain <img> instead of Next.js <Image> to guarantee
                                    loading on real phones (2x/3x DPR). Next.js image
                                    optimization can silently fail for Supabase URLs on
                                    actual mobile devices. */}
                                <img
                                  src={iconUrl}
                                  alt={denom.label}
                                  width={64}
                                  height={64}
                                  className="object-contain w-full h-full"
                                />
                              </div>
                            </div>
                            <div className={`p-3 text-right transition-colors ${isOutOfStock ? "bg-gray-200/50" : isSelected ? "bg-[#e5e7eb]" : "bg-[#f3f4f6] group-hover:bg-[#e5e7eb]"}`}>
                              <div className="text-[10px] text-[#FFA6C9] font-medium uppercase mb-0.5 tracking-wide">
                                From
                              </div>
                              <div className="text-[#FF6B93] font-bold text-base md:text-xl leading-none">
                                Rs. {denom.price}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={`px-3 py-3 flex-1 flex items-center justify-center text-center ${isOutOfStock ? 'bg-gray-50/50' : ''}`}>
                              <div className="text-black font-extrabold text-base md:text-xl leading-tight w-full max-w-[120px]">
                                {denom.label}
                              </div>
                            </div>
                            <div className={`px-3 pt-4 pb-3 text-right flex flex-col justify-end min-h-[56px] transition-colors ${isOutOfStock ? "bg-gray-200/50" : isSelected ? "bg-[#e5e7eb]" : "bg-[#f3f4f6] group-hover:bg-[#e5e7eb]"}`}>
                              <div className="text-[10px] text-[#FFA6C9] font-medium uppercase mb-0.5 tracking-wide">From</div>
                              <div className="text-[#FF6B93] font-extrabold text-base md:text-xl leading-none">
                                Rs. {denom.price}
                              </div>
                            </div>
                          </>
                        )}
                      </Label>
                    </div>
                  );
                };

                return (
                  <RadioGroup value={selectedDenomination} onValueChange={setSelectedDenomination}>
                    {product?.denomination_categories && product.denomination_categories.length > 0 ? (
                      <div className="relative">
                        {/* Sticky Category Tabs */}
                        <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md py-3 -mx-2 px-2 sm:-mx-0 sm:px-0 mb-6 border-b border-gray-100 flex overflow-x-auto gap-2 shadow-sm rounded-t-lg hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          <style dangerouslySetInnerHTML={{__html: `
                            .hide-scrollbar::-webkit-scrollbar { display: none; }
                          `}} />
                          {product.denomination_categories.map((cat: any) => {
                            const hasDenoms = giftCard.denominations.some((d: any) => d.categoryId === cat.id);
                            if (!hasDenoms) return null;
                            const icon = cat.icon_url;
                            return (
                              <button
                                key={`tab-${cat.id}`}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const el = document.getElementById(`cat-${cat.id}`);
                                  if (el) {
                                    const y = el.getBoundingClientRect().top + window.scrollY - 140;
                                    window.scrollTo({ top: y, behavior: 'smooth' });
                                  }
                                }}
                                className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full border border-gray-200 bg-gray-50 text-brand-charcoal hover:bg-[#00BCD4] hover:text-white hover:border-[#00BCD4] transition-colors font-medium text-sm shadow-sm"
                              >
                                {icon && <img src={icon} alt={cat.name} className="w-5 h-5 object-contain" />}
                                {cat.name}
                              </button>
                            );
                          })}
                          {(() => {
                            const hasUncategorized = giftCard.denominations.some((d: any) => !d.categoryId);
                            if (!hasUncategorized) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const el = document.getElementById(`cat-uncategorized`);
                                  if (el) {
                                    const y = el.getBoundingClientRect().top + window.scrollY - 140;
                                    window.scrollTo({ top: y, behavior: 'smooth' });
                                  }
                                }}
                                className="flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full border border-gray-200 bg-gray-50 text-brand-charcoal hover:bg-[#00BCD4] hover:text-white hover:border-[#00BCD4] transition-colors font-medium text-sm shadow-sm"
                              >
                                Other Options
                              </button>
                            );
                          })()}
                        </div>

                        <div className="space-y-8">
                          {product.denomination_categories.map((cat: any) => {
                            const catDenoms = giftCard.denominations.filter((d: any) => d.categoryId === cat.id)
                            if (catDenoms.length === 0) return null

                            const icon = cat.icon_url;

                            return (
                              <div key={cat.id} id={`cat-${cat.id}`} className="space-y-4 scroll-mt-[140px]">
                                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                                  {icon && (
                                    <img src={icon} alt={cat.name} className="w-8 h-8 object-contain" />
                                  )}
                                  <div>
                                    <h3 className="font-semibold text-brand-charcoal text-lg">{cat.name}</h3>
                                    {cat.description && <p className="text-sm text-gray-500">{cat.description}</p>}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  {catDenoms.map((denom: any) => renderDenominationCard(denom))}
                                </div>
                              </div>
                            )
                          })}
                          {(() => {
                            const uncategorized = giftCard.denominations.filter((d: any) => !d.categoryId)
                            if (uncategorized.length === 0) return null
                            return (
                              <div id="cat-uncategorized" className="space-y-4 scroll-mt-[140px]">
                                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                  <h3 className="font-semibold text-brand-charcoal text-lg">Other Options</h3>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  {uncategorized.map((denom: any) => renderDenominationCard(denom))}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {giftCard.denominations.map((denom: any) => renderDenominationCard(denom))}
                      </div>
                    )}
                  </RadioGroup>
                );
              })()}
            </div>

            {/* Step 2 or 3 Alternative: Checkout fields */}
            {(isDirectLoginProduct || isTopupProduct) && checkoutFields.length > 0 && (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${selectedDenomination ? "bg-[#00BCD4] text-white" : "bg-gray-200 text-brand-light-gray"
                    }`}>
                    {isTopupProduct ? "3" : "2"}
                  </div>
                  <h2 className="text-xl font-semibold text-brand-charcoal">
                    Account Details
                  </h2>
                </div>

                <div className="space-y-4">
                  {checkoutFields.map((field: any) => (
                    <div key={field.key}>
                      <Label htmlFor={field.key} className="font-semibold text-base text-brand-charcoal flex items-center gap-2 mb-2">
                        {field.label} {field.required && "*"}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.type}
                        value={checkoutFieldValues[field.key] || ""}
                        onChange={(e) => setCheckoutFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        required={field.required}
                        autoComplete={field.type === "password" ? "new-password" : "off"}
                        className="bg-white border-gray-200 text-brand-charcoal placeholder:text-gray-400 focus:ring-[#00BCD4] focus:border-[#00BCD4]"
                      />
                      {field.type === "password" && (
                        <p className="text-xs text-brand-light-gray mt-2 flex gap-1">
                          <span>Temporary access is required for delivery. We recommend changing your password after the order is complete.</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 or 4: Enter Details / Contact Information */}
            <div className="glassmorphism p-6 rounded-lg shadow-md border bg-white border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${((isDirectLoginProduct || isTopupProduct) && checkoutFields.length > 0)
                    ? (selectedDenomination && !checkoutFields.some((f: any) => f.required && !checkoutFieldValues[f.key]?.trim()) ? "bg-[#00BCD4] text-white" : "bg-gray-200 text-brand-light-gray")
                    : (selectedDenomination ? "bg-[#00BCD4] text-white" : "bg-gray-200 text-brand-light-gray")
                    }`}
                >
                  {isTopupProduct ? (checkoutFields.length > 0 ? "4" : "3") : (isDirectLoginProduct && checkoutFields.length > 0 ? "3" : "2")}
                </div>
                <h2 className="text-xl font-semibold text-brand-charcoal">
                  Contact Information
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="font-semibold text-base text-brand-charcoal">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    autoComplete="off"
                    className="bg-white border-gray-200 text-brand-charcoal placeholder:text-gray-400 focus:ring-[#00BCD4] focus:border-[#00BCD4]"
                  />

                  <p className="text-xs mt-1 text-brand-light-gray">
                    {isTopupProduct
                      ? "Make sure your email address is correct, we will use it to send your order confirmation and status updates."
                      : "Make sure your email address is correct, we will use it to send your order confirmation and status updates."}
                  </p>
                </div>
              </div>
            </div>



            {/* Step 4 or 5: Select Payment */}
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${selectedDenomination && email && (!isTopupProduct || (userId && (product.servers && product.servers.length > 0 ? selectedServer : true))) && (!(isDirectLoginProduct || isTopupProduct) || !checkoutFields.some((f: any) => f.required && !checkoutFieldValues[f.key]?.trim()))
                    ? "bg-[#00BCD4] text-white"
                    : "bg-gray-200 text-brand-light-gray"
                    }`}
                >
                  {isTopupProduct ? (checkoutFields.length > 0 ? "5" : "4") : (isDirectLoginProduct && checkoutFields.length > 0 ? "4" : "3")}
                </div>
                <h2 className="text-xl font-semibold text-brand-charcoal">Select payment</h2>
              </div>

              <RadioGroup value={selectedPayment} onValueChange={handlePaymentMethodSelect}>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="relative">
                      <RadioGroupItem value={method.id} id={method.id} className="peer sr-only" />
                      <Label
                        htmlFor={method.id}
                        className={`flex items-center gap-3 p-4 bg-white border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${selectedPayment === method.id
                          ? "border-brand-sky-blue bg-brand-sky-blue/5 shadow-lg"
                          : "border-gray-200"
                          }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={method.logo_url || "/placeholder.svg"}
                          alt={method.name}
                          style={{ width: '40px', height: '40px', objectFit: 'contain', flexShrink: 0 }}
                        />
                        <span className="text-brand-charcoal font-medium flex-1">{method.name}</span>
                        {selectedPayment === method.id && (
                          <div className="w-5 h-5 bg-brand-sky-blue rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              <Button
                onClick={() => setShowQRDialog(true)}
                disabled={!selectedDenomination || !selectedPayment || !email || (isTopupProduct && (!userId || (product.servers && product.servers.length > 0 && !selectedServer))) || ((isDirectLoginProduct || isTopupProduct) && checkoutFields.some((f: any) => f.required && !checkoutFieldValues[f.key]?.trim()))}
                className="w-full mt-6 bg-[#00BCD4] hover:bg-[#00BCD4]/90 text-white py-3 text-lg font-semibold"
              >
                Proceed to Payment
              </Button>

              <div className="mt-4 text-xs text-brand-light-gray leading-relaxed">
                By clicking "Proceed to Payment", I acknowledge that the purchase of this virtual item will be a license for its use, subject to the publisher providing this service and to their end user license agreement that I accepted.
                <br /><br />
                Furthermore:
                <br />
                (i) I acknowledge that I have read, understand and agree to Byiora's <Link href="/terms-and-conditions" className="text-brand-sky-blue hover:underline">Terms & Conditions</Link> and <Link href="/privacy-policy" className="text-brand-sky-blue hover:underline">Privacy Policy</Link>, and
                <br />
                (ii) I understand and agree that all sales are final and non-refundable. For more details, please view our <Link href="/refund-policy" className="text-brand-sky-blue hover:underline">Refund Policy</Link>.
              </div>
            </div>
          </div>

          {/* Description & FAQ — mobile only, appears below payment */}
          <div className="lg:hidden space-y-6 order-3">
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <h3 className="font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                Description
              </h3>
              <div
                className={`prose-rich-text text-brand-light-gray text-sm leading-relaxed ${!descExpanded && giftCard.description.length > DESC_LIMIT ? 'line-clamp-4' : ''}`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(giftCard.description) }}
              />
              {giftCard.description.length > DESC_LIMIT && (
                <button onClick={() => setDescExpanded(!descExpanded)} className="text-brand-sky-blue text-sm font-semibold mt-2 hover:underline">
                  {descExpanded ? "View Less" : "View More"}
                </button>
              )}
            </div>

            {product.faqs && product.faqs.length > 0 ? (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h3 className="font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                  Frequently Asked Questions
                </h3>
                <div className="space-y-4">
                  <FaqAccordion faqs={product.faqs} />
                </div>
              </div>
            ) : (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h3 className="font-semibold text-brand-charcoal mb-2">How it works:</h3>
                <p className="text-sm text-brand-light-gray">{giftCard.instructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Payment Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Complete Payment - {selectedPaymentMethod?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                {selectedPaymentMethod?.qr_url ? (
                  <img
                    src={selectedPaymentMethod.qr_url}
                    alt="Payment QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <QrCode className="h-16 w-16 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Scan this QR code with your {selectedPaymentMethod?.name} app
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800">
                  📝 {selectedPaymentMethod?.instructions || "In remarks, please enter your name"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Product:</span>
                <span className="font-medium">{giftCard.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">
                  {selectedDenomination && giftCard.denominations.find((d: any) => d.label === selectedDenomination)?.label}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Price:</span>
                <span className="font-medium text-lg text-brand-sky-blue">
                  {selectedDenomination &&
                    `Rs. ${giftCard.denominations.find((d: any) => d.label === selectedDenomination)?.price}`}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowQRDialog(false)}
                className="flex-1"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="flex-1 bg-[#00BCD4] hover:bg-[#00BCD4]/90 text-white"
              >
                {isProcessing ? "Processing..." : "I've Made Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  )
}
