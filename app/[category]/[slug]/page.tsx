"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Shield, HelpCircle, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { getProductBySlug } from "@/lib/product-categories"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { LoadingScreen } from "@/components/loading-screen"

interface PaymentMethod {
  id: string
  name: string
  logo_url: string
  qr_url: string
  instructions: string
  is_enabled: boolean
}

const giftCardData = {
  steam: {
    name: "Steam Gift Card",
    description: "Steam Gift Cards are the perfect way to give the gift of games to your friends and family.",
    denominations: [
      { value: "5", price: "5", label: "Rs. 5 Gift Card" },
      { value: "10", price: "10", label: "Rs. 10 Gift Card" },
      { value: "25", price: "25", label: "Rs. 25 Gift Card" },
      { value: "50", price: "50", label: "Rs. 50 Gift Card" },
      { value: "100", price: "100", label: "Rs. 100 Gift Card" },
    ],
    instructions:
      "Simply select your preferred amount, choose your payment method, complete the payment, and you will receive your voucher code via email.",
  },
  pubg: {
    name: "PUBG Mobile UC",
    description:
      "Buy PUBG Mobile UC voucher in seconds! Simply select your preferred UC amount, choose your preferred payment method, complete the payment, and you will receive your voucher code via email.",
    denominations: [
      { value: "60", price: "0.99", label: "60 UC" },
      { value: "325", price: "4.99", label: "325 UC" },
      { value: "660", price: "9.99", label: "660 UC" },
      { value: "1800", price: "24.99", label: "1800 UC" },
      { value: "3850", price: "49.99", label: "3850 UC" },
      { value: "8100", price: "99.99", label: "8100 UC" },
    ],
    instructions: "PUBG Mobile UC voucher codes sold have at least 7 days validity from the date of purchase.",
  },
  netflix: {
    name: "Netflix Gift Card",
    description: "Give the gift of entertainment with Netflix Gift Cards. Perfect for movie and TV show lovers.",
    denominations: [
      { value: "15", price: "15", label: "Rs. 15 Gift Card" },
      { value: "25", price: "25", label: "Rs. 25 Gift Card" },
      { value: "50", price: "50", label: "Rs. 50 Gift Card" },
      { value: "100", price: "100", label: "Rs. 100 Gift Card" },
    ],
    instructions:
      "Netflix Gift Cards can be redeemed on any Netflix account in the same country where it was purchased.",
  },
  "cod-mobile": {
    name: "COD Mobile CP",
    description: "Get COD Mobile CP instantly! Top up your account and enjoy premium features.",
    denominations: [
      { value: "80", price: "0.99", label: "80 CP" },
      { value: "400", price: "4.99", label: "400 CP" },
      { value: "800", price: "9.99", label: "800 CP" },
      { value: "2000", price: "24.99", label: "2000 CP" },
    ],
    instructions: "COD Mobile CP will be added directly to your account after payment confirmation.",
  },
  "free-fire": {
    name: "Free Fire Diamonds",
    description: "Purchase Free Fire Diamonds instantly! Get the best deals on diamonds for your Free Fire account.",
    denominations: [
      { value: "100", price: "0.99", label: "100 Diamonds" },
      { value: "520", price: "4.99", label: "520 Diamonds" },
      { value: "1080", price: "9.99", label: "1080 Diamonds" },
      { value: "2200", price: "19.99", label: "2200 Diamonds" },
    ],
    instructions: "Free Fire Diamonds will be credited to your account within minutes of payment.",
  },
  "mobile-legends": {
    name: "Mobile Legends Diamonds",
    description: "Buy Mobile Legends Diamonds at the best prices! Power up your gameplay with instant delivery.",
    denominations: [
      { value: "86", price: "1.99", label: "86 Diamonds" },
      { value: "172", price: "3.99", label: "172 Diamonds" },
      { value: "257", price: "5.99", label: "257 Diamonds" },
      { value: "514", price: "11.99", label: "514 Diamonds" },
      { value: "1028", price: "23.99", label: "1028 Diamonds" },
    ],
    instructions: "Mobile Legends Diamonds will be added to your account immediately after successful payment.",
  },
  amazon: {
    name: "Amazon Gift Card",
    description: "Amazon Gift Cards - the perfect gift for any occasion. Shop millions of items on Amazon.",
    denominations: [
      { value: "10", price: "10", label: "Rs. 10 Gift Card" },
      { value: "25", price: "25", label: "Rs. 25 Gift Card" },
      { value: "50", price: "50", label: "Rs. 50 Gift Card" },
      { value: "100", price: "100", label: "Rs. 100 Gift Card" },
    ],
    instructions: "Amazon Gift Cards can be used to purchase millions of items on Amazon.com.",
  },
  apple: {
    name: "Apple Gift Card",
    description:
      "Apple Gift Cards can be used for purchases at any Apple Store, on the Apple Store app, apple.com, the App Store, iTunes, Apple Music, Apple TV+, Apple News+, Apple Books, Apple Arcade, iCloud+, Apple Fitness+, Apple One and other Apple properties.",
    denominations: [
      { value: "10", price: "10", label: "Rs. 10 Gift Card" },
      { value: "25", price: "25", label: "Rs. 25 Gift Card" },
      { value: "50", price: "50", label: "Rs. 50 Gift Card" },
      { value: "100", price: "100", label: "Rs. 100 Gift Card" },
    ],
    instructions: "Apple Gift Cards can be used for all Apple services and products.",
  },
  "google-play": {
    name: "Google Play Gift Card",
    description:
      "Google Play Gift Cards can be used to purchase apps, games, music, movies, TV shows, and books on Google Play.",
    denominations: [
      { value: "10", price: "10", label: "Rs. 10 Gift Card" },
      { value: "25", price: "25", label: "Rs. 25 Gift Card" },
      { value: "50", price: "50", label: "Rs. 50 Gift Card" },
      { value: "100", price: "100", label: "Rs. 100 Gift Card" },
    ],
    instructions: "Google Play Gift Cards can be used for all Google Play purchases.",
  },
}



export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { addTransaction, user } = useAuth()
  const { sendNotification } = useNotifications()
  const [selectedDenomination, setSelectedDenomination] = useState("")
  const [selectedPayment, setSelectedPayment] = useState("")
  const [email, setEmail] = useState(user?.email || "")
  const [userId, setUserId] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [notFound, setNotFound] = useState(false)

  const categorySlug = params.category as string
  const productSlug = params.slug as string

  const giftCardOrig = giftCardData[productSlug as keyof typeof giftCardData] || ({} as any)
  const giftCard = {
    name: product?.name || giftCardOrig.name || "Gift Card",
    description: product?.description || giftCardOrig.description || "Digital Gift Card",
    denominations: product?.denominations?.length > 0 ? product.denominations : (giftCardOrig.denominations || []),
    instructions: giftCardOrig.instructions || "Purchased codes will be sent to your email.",
  }

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const productData = await getProductBySlug(productSlug)
        
        // Validate that the product's category matches the URL category
        if (productData && productData.category !== categorySlug) {
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

    loadProduct()
    loadPaymentMethods()
  }, [productSlug, categorySlug])

  const isTopupProduct = product?.category === "topup"

  console.log("Product detail page rendered for:", productSlug, "in category:", categorySlug)

  if (isLoading) {
    return <LoadingScreen />
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
    console.log("Purchase initiated:", {
      productSlug,
      giftCard: productSlug,
      denomination: selectedDenomination,
      payment: selectedPayment,
      email,
      userId: isTopupProduct ? userId : undefined,
    })

    if (!selectedDenomination || !selectedPayment || !email || (isTopupProduct && !userId)) {
      toast.error("Please complete all required fields")
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
        productCategory: product?.category || (isTopupProduct ? "topup" : "digital-goods"),
        guestData: isTopupProduct ? { userId } : null,
      })

      // Send email confirmation using Resend API
      try {
        await fetch('/api/send-order-placed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            userName: user?.name || email.split("@")[0],
            productName: giftCard.name,
            denomination: selectedDenom?.label || selectedDenomination,
            transactionId: transactionId,
          })
        })
      } catch (emailError) {
        console.error("Failed to send email:", emailError)
        // Don't fail the order if email fails
      }

      // Send notification to user if logged in
      if (user) {
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
      }

      // Simulate payment processing time
      setTimeout(() => {
        setIsProcessing(false)
        setShowQRDialog(false)

        // Always show success message - order stays as "Processing" for admin to manage
        toast.success(
          "🎉 Order placed successfully! Your order is being processed and you will receive your voucher code via email soon.",
        )

        // Reset form after successful order
        setSelectedDenomination("")
        setSelectedPayment("")
        setUserId("")
        if (!user) setEmail("") // Only reset email if not logged in
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

  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push("/")} className="mb-6 text-white hover:bg-white/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="w-full h-48 relative mb-4 rounded-lg overflow-hidden">
                <Image
                  src={product.logo || "/placeholder.svg?height=200&width=400"}
                  alt={giftCard.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=200&width=400"
                  }}
                />
              </div>
              <h1 className="text-2xl font-bold text-brand-charcoal mb-2">{giftCard.name}</h1>
            </div>

            {/* Description Card */}
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <h3 className="font-semibold text-brand-charcoal mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                Description
              </h3>
              <p className="text-brand-light-gray text-sm whitespace-pre-wrap leading-relaxed">{giftCard.description}</p>
            </div>

            {product.faqs && product.faqs.length > 0 ? (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h3 className="font-semibold text-brand-charcoal mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-brand-sky-blue rounded-full inline-block"></span>
                  Frequently Asked Questions
                </h3>
                <div className="space-y-4">
                  {product.faqs.map((faq: any, index: number) => (
                    <div key={index} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <h4 className="font-medium text-sm text-brand-charcoal mb-1">{faq.question}</h4>
                      <p className="text-xs text-brand-light-gray whitespace-pre-wrap">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <h3 className="font-semibold text-brand-charcoal mb-2">How it works:</h3>
                <p className="text-sm text-brand-light-gray">{giftCard.instructions}</p>
              </div>
            )}
          </div>

          {/* Purchase Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: User ID (for topup products only) */}
            {isTopupProduct && (
              <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#00BCD4] text-white flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <h2 className="text-xl font-semibold text-brand-charcoal">Enter User ID</h2>
                  <HelpCircle className="h-5 w-5 text-brand-light-gray" />
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userId" className="text-brand-charcoal font-semibold text-base">
                      User ID *
                    </Label>
                    <Input
                      id="userId"
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="Enter User ID"
                      required
                      className="bg-white border-gray-200 text-brand-charcoal placeholder:text-gray-400 focus:ring-[#00BCD4] focus:border-[#00BCD4]"
                    />
                    <p className="text-xs text-brand-light-gray mt-2">
                      To find your User ID, click on your avatar on the top left corner, under Basic Info, you can find
                      your User ID under your Nickname.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Select Voucher */}
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#00BCD4] text-white flex items-center justify-center text-sm font-semibold">
                  {isTopupProduct ? "2" : "1"}
                </div>
                <h2 className="text-xl font-semibold text-brand-charcoal">Select voucher</h2>
              </div>

              <RadioGroup value={selectedDenomination} onValueChange={setSelectedDenomination}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {giftCard.denominations.map((denom: any) => {
                    const isSelected = selectedDenomination === denom.label;
                    const hasIcon = !!(product.denom_icon_url);

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
                        <RadioGroupItem value={denom.label} id={denom.label} className="peer sr-only" />
                        <Label
                          htmlFor={denom.label}
                          className={`group flex flex-col overflow-hidden bg-white rounded-2xl cursor-pointer transition-all h-full ${isSelected
                              ? "border-2 border-[#00BCD4] shadow-[0_0_15px_rgba(0,188,212,0.4)]"
                              : "border border-gray-200 hover:border-[#00BCD4] hover:shadow-[0_0_10px_rgba(0,188,212,0.2)]"
                            }`}
                        >
                          {hasIcon ? (
                            <>
                              <div className="px-3 py-4 flex-1 flex flex-col items-center justify-center">
                                <div className="text-gray-900 font-bold text-base md:text-lg text-center mb-2">
                                  {denom.label}
                                </div>
                                <div className="w-16 h-16 relative bg-transparent">
                                  <Image
                                    src={product.denom_icon_url}
                                    alt={denom.label}
                                    fill
                                    className="object-contain"
                                    sizes="64px"
                                  />
                                </div>
                              </div>
                              <div className={`p-3 text-right transition-colors ${isSelected ? "bg-[#e5e7eb]" : "bg-[#f3f4f6] group-hover:bg-[#e5e7eb]"}`}>
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
                              <div className="px-3 py-3 flex-1 flex items-center justify-center text-center">
                                <div className="text-black font-extrabold text-base md:text-xl leading-tight w-full max-w-[120px]">
                                  {denom.label}
                                </div>
                              </div>
                              <div className={`px-3 pt-4 pb-3 text-right flex flex-col justify-end min-h-[56px] transition-colors ${isSelected ? "bg-[#e5e7eb]" : "bg-[#f3f4f6] group-hover:bg-[#e5e7eb]"}`}>
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
                  })}
                </div>
              </RadioGroup>
            </div>

            {/* Step 3: Enter Details */}
            <div className="glassmorphism p-6 rounded-lg shadow-md border bg-white border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${selectedDenomination ? "bg-[#00BCD4] text-white" : "bg-gray-200 text-brand-light-gray"
                    }`}
                >
                  {isTopupProduct ? "3" : "2"}
                </div>
                <h2 className="text-xl font-semibold text-brand-charcoal">Enter Details</h2>
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
                    className="bg-white border-gray-200 text-brand-charcoal placeholder:text-gray-400 focus:ring-[#00BCD4] focus:border-[#00BCD4]"
                  />
                  <p className="text-xs mt-1 text-brand-light-gray">
                    Make sure your email address is correct, we will use it to deliver your voucher code.
                  </p>
                </div>

              </div>
            </div>

            {/* Step 4: Select Payment */}
            <div className="glassmorphism p-6 bg-white rounded-lg shadow-md border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${selectedDenomination && email && (!isTopupProduct || userId)
                      ? "bg-[#00BCD4] text-white"
                      : "bg-gray-200 text-brand-light-gray"
                    }`}
                >
                  {isTopupProduct ? "4" : "3"}
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
                disabled={!selectedDenomination || !selectedPayment || !email || (isTopupProduct && !userId)}
                className="w-full mt-6 bg-[#00BCD4] hover:bg-[#00BCD4]/90 text-white py-3 text-lg font-semibold"
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Payment Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
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
                  <Image
                    src={selectedPaymentMethod.qr_url}
                    alt="Payment QR Code"
                    width={192}
                    height={192}
                    className="object-contain"
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
