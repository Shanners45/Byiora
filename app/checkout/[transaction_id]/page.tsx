"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { AlertCircle, RefreshCw, Smartphone, Clock, ShieldCheck, Phone, ArrowLeft, Download, ShieldAlert } from "lucide-react"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { QRCodeSVG } from "qrcode.react"
import { getOrGenerateQRAction, verifyPaymentAction, verifyPaymentByPhoneAction, expireTransactionAction, cancelTransactionAction } from "@/app/actions/checkout"
import { toast } from "sonner"
import Image from "next/image"
import CheckoutOverlay from "@/components/checkout-overlay"
import { createClient } from "@/lib/supabase/client"

import { use } from "react"

export default function CheckoutPage({ params }: { params: Promise<{ transaction_id: string }> }) {
  const router = useRouter()
  const { transaction_id } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [isNewlyExpired, setIsNewlyExpired] = useState(false)
  const [overlayType, setOverlayType] = useState<"success" | "cancelled" | "failed" | null>(null)

  // Phone verification state
  const [showPhoneVerify, setShowPhoneVerify] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false)
  const [captchaToken, setCaptchaToken] = useState("")
  const [isScanned, setIsScanned] = useState(false)

  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const qrRequested = useRef(false)

  useEffect(() => {
    document.title = "Checkout | Byiora"
  }, [])

  const loadQR = async () => {
    setLoading(true)
    setError(null)
    setIsExpired(false)
    try {
      // Check localStorage first
      const cached = localStorage.getItem(`qr_${transaction_id}`)
      if (cached) {
        const cachedQr = JSON.parse(cached)
        const now = Math.floor(Date.now() / 1000)
        if (cachedQr.expiresAt && now > cachedQr.expiresAt) {
          // It's expired locally. Don't fetch new QR.
          setQrData(cachedQr)
          setIsExpired(true)
          setLoading(false)
          return
        } else if (cachedQr.expiresAt && cachedQr.expiresAt > now) {
          setQrData(cachedQr)
          setTimeLeft(cachedQr.expiresAt - now)
          setLoading(false)
          return
        } else {
          localStorage.removeItem(`qr_${transaction_id}`)
        }
      }

      const res = await getOrGenerateQRAction(transaction_id)
      if (res.price || res.product || res.productName) {
        setQrData(res)
      }
      if (res.success) {
        setTimeLeft(res.expiresIn || 0)

        // Save to localStorage for persistence (covers static & dynamic so users
        // returning to the same /checkout/[transaction_id] URL during the active
        // 5-minute window get the original QR + remaining time restored).
        const expiresAt = Math.floor(Date.now() / 1000) + (res.expiresIn || 5 * 60)
        localStorage.setItem(`qr_${transaction_id}`, JSON.stringify({ ...res, expiresAt }))

        if (res.status === "Completed") {
          setIsCompleted(true)
        }
      } else {
        if (res.status === "Completed" || res.status === "Paid") {
          setIsCompleted(true)
        } else if (res.status === "Cancelled" || res.error?.includes("cancelled")) {
          setIsCancelled(true)
          setOverlayType("cancelled")
        } else if (res.status === "Payment Failed" || res.error?.includes("expired")) {
          setIsExpired(true)
          setQrData(res)
        } else {
          setError(res.error || "Checkout unavailable")
        }
      }
    } catch (err: any) {
      setError("Checkout unavailable")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (qrRequested.current) return
    qrRequested.current = true
    
    loadQR()
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [transaction_id])

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0 && !isCompleted && !error && !qrData?.isStatic) {
      timerInterval.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval.current!)
            setIsExpired(true)
            setIsNewlyExpired(true)
            localStorage.removeItem(`qr_${transaction_id}`)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [timeLeft, isCompleted, error])

  // Show success overlay on completion — will redirect after animation finishes.
  useEffect(() => {
    if (!isCompleted) return
    localStorage.removeItem(`qr_${transaction_id}`)
    setOverlayType("success")
  }, [isCompleted, transaction_id])

  // Handle expiry actions (DB update + email)
  useEffect(() => {
    if (!isExpired || !qrData || isCancelled) return

    if (isNewlyExpired) {
      // Fire-and-forget: don't block on server action (DB update + email)
      expireTransactionAction(transaction_id).catch(() => { })

      if (!qrData.isGuest) {
        setOverlayType("failed")
      }
    }
  }, [isExpired, qrData, transaction_id, isCancelled, isNewlyExpired])

  // Background Polling replaced by Supabase Realtime
  // Real-time status listener via Supabase WebSocket channel (Pure WebSocket - No HTTP Polling)
  useEffect(() => {
    if (isCompleted || isExpired || error || isCancelled) return

    const supabase = createClient()
    const channel = supabase
      .channel(`checkout-${transaction_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `transaction_id=eq.${transaction_id}`
      }, (payload) => {
        const newStatus = payload.new.status
        const remarks = payload.new.failure_remarks
        if (newStatus === 'Completed' || newStatus === 'Paid') {
          setIsCompleted(true)
        } else if (newStatus === 'Processing' || (remarks && remarks.includes("Scanned"))) {
          setIsScanned(true)
        } else if (newStatus === 'Payment Failed') {
          setIsNewlyExpired(true)
          setIsExpired(true)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isCompleted, isExpired, error, transaction_id, isCancelled])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handlePhoneVerification = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, "")
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith("9")) {
      toast.error("Please enter a valid 10-digit phone number starting with 9")
      return
    }

    setIsPhoneVerifying(true)
    try {
      if (!captchaToken) {
        toast.error("Please complete the security check")
        setIsPhoneVerifying(false)
        return
      }
      const res = await verifyPaymentByPhoneAction(transaction_id, cleanPhone, captchaToken)
      if (res.success && (res.verified || res.alreadyCompleted)) {
        setIsCompleted(true)
        toast.success("Payment verified successfully! Your order is being fulfilled.")
        setTimeout(() => {
          if (!qrData?.isGuest) {
            router.push("/transactions")
          }
        }, 3000)
      } else {
        toast.error(res.error || "No matching payment found")
      }
    } catch (e) {
      toast.error("Verification failed. Please try again.")
    } finally {
      setIsPhoneVerifying(false)
    }
  }

  const handleManualVerify = async () => {
    if (!qrData || isCompleted || isExpired || error || qrData.isStatic) return

    setIsVerifying(true)
    try {
      const provider = qrData.paymentCategory || "nepalpay"
      const res = await verifyPaymentAction(transaction_id, qrData.validationTraceId, provider)

      if (res.success && res.completed) {
        setIsCompleted(true)
        toast.success("Payment verified successfully!")
      } else if (res.error) {
        if (res.error.toLowerCase().includes("fetch failed") || res.error.toLowerCase().includes("network")) {
          toast.error("Our payment network is temporarily unresponsive. Please try again shortly.")
        } else {
          toast.error(res.error)
        }
      } else {
        toast.error("Payment not received.")
      }
    } catch (e: any) {
      toast.error(e?.message || "An unexpected error occurred while verifying the payment.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCancelOrder = async () => {
    setIsCancelling(true)
    try {
      const res = await cancelTransactionAction(transaction_id)
      if (res.success) {
        localStorage.removeItem(`qr_${transaction_id}`)
        setIsCancelled(true)
        setOverlayType("cancelled")
      } else {
        toast.error(res.error || "Failed to cancel order")
        setIsCancelling(false)
      }
    } catch (e) {
      toast.error("An error occurred")
      setIsCancelling(false)
    }
  }

  const handleDownloadQR = async () => {
    try {
      if (qrData.isStatic && qrData.staticQrUrl) {
        const response = await fetch(qrData.staticQrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `QR_${transaction_id}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (qrData.qrString) {
        let qrUrl = qrData.qrString;
        if (!qrUrl.startsWith("data:image") && qrUrl.length > 1000) {
          qrUrl = `data:image/png;base64,${qrUrl}`;
        }

        if (qrUrl.startsWith("data:image")) {
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = qrUrl;
          a.download = `QR_${transaction_id}.png`;
          document.body.appendChild(a);
          a.click();
        } else {
          // QRCodeSVG fallback
          const svg = document.querySelector('svg');
          if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new globalThis.Image();
            img.onload = () => {
              canvas.width = svg.clientWidth || 280;
              canvas.height = svg.clientHeight || 280;
              ctx?.drawImage(img, 0, 0);
              const pngFile = canvas.toDataURL("image/png");
              const a = document.createElement("a");
              a.download = `QR_${transaction_id}.png`;
              a.href = pngFile;
              a.click();
            };
            img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
          }
        }
      }
    } catch (e) {
      toast.error("Failed to download QR code");
    }
  }

  // ========== COMPLETED STATE ==========
  // The full-page "Payment Confirmed!" UI was removed in favor of an
  // automatic redirect to /transactions?paid=success (see useEffect above)
  // which displays a toast on arrival.


  // ========== MAIN CHECKOUT STATE ==========
  // Handle overlay redirect
  const handleOverlayComplete = useCallback(() => {
    const returnUrl = typeof window !== "undefined" ? localStorage.getItem("byiora_checkout_return") : null
    if (typeof window !== "undefined") localStorage.removeItem("byiora_checkout_return")

    if (overlayType === "success") {
      if (qrData?.isGuest) {
        router.push("/?paid=success")
      } else {
        router.push("/transactions?paid=success")
      }
    } else if (overlayType === "cancelled") {
      // Guest: homepage | Registered: products page (returnUrl)
      if (qrData?.isGuest) {
        router.push("/")
      } else {
        router.push(returnUrl || "/")
      }
    } else if (overlayType === "failed") {
      // Guest: products page (returnUrl) | Registered: transaction history
      if (qrData?.isGuest) {
        router.push(returnUrl || "/")
      } else {
        router.push("/transactions")
      }
    }
  }, [overlayType, qrData, router])

  return (
    <div className="min-h-screen bg-white">
      {/* Premium Animated Overlays */}
      {overlayType && (
        <CheckoutOverlay
          type={overlayType}
          onComplete={handleOverlayComplete}
          delayMs={overlayType === "success" ? 3000 : 2500}
        />
      )}
      <div className="w-full border-b bg-gray-50/50">
        <div className="container mx-auto px-4 py-4 md:py-6 flex justify-between items-center w-full">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-gray-900">
              <Smartphone className="h-7 w-7 md:h-8 md:w-8 text-[#7E3AF2]" />
              Scan to Pay
            </h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Order ID: <span className="font-mono font-bold text-gray-900 bg-white border border-gray-200 px-2 py-0.5 rounded ml-1 shadow-sm">{transaction_id}</span>
            </p>
          </div>
          <div className="relative h-8 w-24 md:h-10 md:w-32">
            <Image src="/logo-final.png" alt="Byiora" fill className="object-contain object-right" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start animate-pulse">
            {/* LEFT COLUMN SKELETON */}
            <div className="flex flex-col items-center justify-center w-full">
              <div className="bg-gray-100 p-4 rounded-2xl w-full max-w-[320px] aspect-square flex flex-col justify-center items-center border border-gray-200">
                <div className="w-16 h-16 bg-gray-200 rounded-full mb-4"></div>
                <div className="w-40 h-5 bg-gray-200 rounded-md"></div>
              </div>
              {/* Download Button Skeleton */}
              <div className="mt-4 w-full max-w-[320px] h-11 bg-gray-100 rounded-md"></div>
              {/* Timer Skeleton */}
              <div className="mt-6 w-48 h-6 bg-gray-100 rounded-full"></div>
            </div>

            {/* RIGHT COLUMN SKELETON */}
            <div className="flex flex-col w-full">
              <div className="h-10 w-64 bg-gray-100 rounded-md mb-2"></div>
              <div className="h-5 w-40 bg-gray-100 rounded-md mb-8"></div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="h-6 w-48 bg-gray-100 rounded-md mb-6"></div>
                <div className="space-y-4">
                  <div className="h-14 w-full bg-gray-50 rounded-lg"></div>
                  <div className="h-14 w-full bg-gray-50 rounded-lg"></div>
                </div>
              </div>

              <div className="h-6 w-56 bg-gray-100 rounded-md mb-4"></div>
              <div className="flex gap-2">
                <div className="h-12 flex-1 bg-gray-100 rounded-md"></div>
                <div className="h-12 w-28 bg-gray-200 rounded-md"></div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-center py-16 px-4">
            <div className="bg-red-50 p-4 rounded-full mb-6 border border-red-100 shadow-sm">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Checkout Unavailable</h3>
            <p className="text-gray-600 text-lg mb-8 max-w-md leading-relaxed">
              {["This order is no longer active", "Transaction not found", "Transaction is already completed", "Transaction is", "Payment session expired"].some(e => error.includes(e)) 
                ? error 
                : "Checkout unavailable"}
            </p>
            <Button
              onClick={() => {
                const returnUrl = typeof window !== 'undefined' ? localStorage.getItem(`returnUrl_${transaction_id}`) : null
                router.push(returnUrl || "/")
              }}
              className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-1"
            >
              Return to Store
            </Button>
          </div>
        ) : isExpired && (qrData?.isGuest || !qrData) ? (
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start w-full">
            {/* LEFT COLUMN: Order Details */}
            <div className="w-full md:w-5/12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white relative overflow-hidden">
                <div className="absolute -top-4 -right-4 p-4 opacity-10">
                  <AlertCircle className="w-40 h-40" />
                </div>
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-100 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 border border-red-500/30">
                    <Clock className="w-3.5 h-3.5" />
                    Expired
                  </span>
                  <h2 className="text-3xl font-bold mb-2 text-white tracking-tight">Order Expired</h2>
                  <p className="text-gray-300 text-sm">Your payment session has timed out.</p>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Summary</h3>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-600 text-sm">Product</span>
                      <span className="font-semibold text-gray-900 text-right">{qrData?.product || qrData?.productName || "Game Top-up"}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-gray-600 text-sm">Denomination</span>
                      <span className="font-semibold text-gray-900 text-right">{qrData?.denomination || qrData?.amount || "-"}</span>
                    </div>
                    <div className="w-full h-px bg-gray-200 my-4"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Total Amount</span>
                      <span className="font-bold text-xl text-[#6B3FA0]">NPR {qrData?.price || qrData?.amountToPay || "0"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Actions */}
            <div className="w-full md:w-7/12">
              {!showPhoneVerify ? (
                <div className="bg-white rounded-2xl shadow-xl shadow-amber-500/5 border border-amber-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 md:p-8 border-b border-amber-100 flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <AlertCircle className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Payment Session Ended</h2>
                      <p className="text-gray-600 leading-relaxed text-sm">
                        The QR code for this transaction has expired and is no longer valid. For security reasons, please do not attempt to scan the old code.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 space-y-5 bg-white">
                    <Button
                      onClick={() => setShowPhoneVerify(true)}
                      className="w-full h-14 bg-[#6B3FA0] hover:bg-[#5A338A] text-white font-semibold text-base rounded-xl shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-0.5"
                    >
                      <ShieldCheck className="h-5 w-5 mr-2" />
                      I already paid, verify my payment
                    </Button>

                    <Button
                      onClick={() => router.push("/")}
                      variant="outline"
                      className="w-full h-14 font-semibold text-base rounded-xl border-gray-300 hover:bg-gray-50 text-gray-700"
                    >
                      <ArrowLeft className="h-5 w-5 mr-2" />
                      Return to Store
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl shadow-purple-500/5 border border-purple-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#6B3FA0] to-[#8B5CF6] p-6 md:p-8 text-white flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Verify Your Payment</h2>
                      <p className="text-purple-100 text-sm leading-relaxed">
                        Enter the exact phone number you used to make the payment. We will securely check the banking records to fulfill your order.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700">Phone Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                          type="tel"
                          placeholder="e.g. 98XXXXXXXX"
                          value={phoneNumber}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, "")
                            if (val.length > 0 && val[0] !== "9") {
                              val = "" // Force starting with 9
                            }
                            if (val.length <= 10) {
                              setPhoneNumber(val)
                            }
                          }}
                          className="pl-12 h-14 text-lg bg-gray-50 border-gray-300 focus:bg-white focus:border-[#6B3FA0] focus:ring-[#6B3FA0] rounded-xl transition-colors placeholder:text-gray-500 text-gray-900"
                          maxLength={15}
                        />
                      </div>
                    </div>

                    <div className="flex justify-center py-2">
                      <TurnstileWidget onToken={setCaptchaToken} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button
                        onClick={() => { setShowPhoneVerify(false); setCaptchaToken("") }}
                        variant="outline"
                        className="flex-1 h-14 rounded-xl font-semibold border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handlePhoneVerification}
                        disabled={isPhoneVerifying || !phoneNumber.trim() || !captchaToken}
                        className="flex-[2] h-14 bg-[#6B3FA0] hover:bg-[#5A338A] text-white font-semibold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
                      >
                        {isPhoneVerifying ? (
                          <span className="flex items-center">
                            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                            Verifying...
                          </span>
                        ) : "Verify Securely"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : qrData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            {/* LEFT COLUMN: QR CODE */}
            <div className="flex flex-col items-center justify-center w-full">
              <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-200 relative w-full max-w-[320px] flex flex-col justify-center items-center overflow-hidden">
                {isScanned && (
                  <div className="absolute inset-0 bg-white/85 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-2xl p-4 text-center animate-in fade-in duration-300">
                    <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-3 border border-purple-100 shadow-md">
                      <RefreshCw className="h-7 w-7 text-[#7E3AF2] animate-spin" />
                    </div>
                    <Badge className="bg-[#7E3AF2] text-white border-none font-semibold text-xs mb-1.5 px-3 py-1 shadow-sm">
                      QR Code Scanned!
                    </Badge>
                    <p className="text-xs text-gray-600 font-medium max-w-[210px] mt-1 leading-relaxed">
                      Payment detected. Verifying transaction with your bank...
                    </p>
                  </div>
                )}

                {timeLeft === 0 && !qrData.isStatic && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-10 flex flex-col items-center justify-center rounded-xl">
                    <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
                    <p className="font-bold text-lg text-gray-800">QR Code Expired</p>
                    <p className="text-sm text-gray-500 mt-1 mb-3">This session has timed out</p>
                  </div>
                )}

                {qrData.isStatic ? (
                  <div className="relative w-full h-full max-w-[300px]">
                    {qrData.staticQrUrl ? (
                      <Image
                        src={qrData.staticQrUrl}
                        alt="Payment QR"
                        fill
                        className="object-contain rounded-lg p-2"
                        sizes="(max-width: 300px) 100vw, 300px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
                        No QR available
                      </div>
                    )}
                  </div>
                ) : qrData.qrString?.startsWith("data:image") || qrData.qrString?.length > 1000 ? (
                  <div className="w-full flex flex-col items-center justify-center">
                    <div className="w-full text-center mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7E3AF2]/10 text-[#7E3AF2] font-semibold text-xs tracking-wide uppercase">
                        {qrData.paymentMethodName || qrData.paymentCategory || "NepalPay"}
                      </span>
                    </div>
                    <div
                      className="w-full aspect-square rounded-xl shadow-sm border border-gray-100"
                      style={{
                        backgroundImage: `url(${qrData.qrString.startsWith("data:") ? qrData.qrString : `data:image/png;base64,${qrData.qrString}`})`,
                        backgroundPosition: "center 31%",
                        backgroundSize: "175%",
                        backgroundRepeat: "no-repeat"
                      }}
                    />
                  </div>
                ) : (
                  <div className="p-4">
                    <QRCodeSVG
                      value={qrData.qrString || "error"}
                      size={280}
                      level="Q"
                      includeMargin={false}
                    />
                  </div>
                )}
              </div>

              {/* Download QR Button */}
              <div className="mt-4 flex justify-center w-full max-w-[320px]">
                <Button
                  onClick={handleDownloadQR}
                  variant="outline"
                  className="w-full flex items-center justify-center border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: DETAILS & ACTIONS */}
            <div className="flex flex-col justify-center space-y-6 h-full py-4 md:pl-8">
              {qrData.isStatic && qrData.instructions && (
                <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-4 text-blue-800 whitespace-pre-wrap leading-relaxed">
                  {qrData.instructions}
                </div>
              )}

              <div className="w-full bg-gray-50/80 rounded-xl p-6 border border-gray-100 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Product</span>
                  <div className="text-right flex flex-col">
                    <span className="font-semibold text-gray-900 max-w-[200px] truncate" title={qrData.product}>{qrData.product}</span>
                    {qrData.denomination && qrData.denomination !== qrData.product && (
                      <span className="text-xs text-[#7E3AF2] font-semibold tracking-wide mt-0.5">
                        {qrData.denomination}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Amount to Pay</span>
                  <span className="font-bold text-[#7E3AF2] text-xl">Rs. {qrData.amount}</span>
                </div>
                {!qrData.isStatic && (
                  <div className="flex justify-between items-center text-amber-700 pt-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Clock className="h-5 w-5" /> Expires in
                    </span>
                    <span className="font-mono font-bold text-2xl tracking-tight">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-start gap-3 border border-green-100">
                <ShieldCheck className="h-6 w-6 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
                  Payments are securely processed. Don't close this tab until you complete the payment on your mobile app.
                </p>
              </div>

              {qrData.isStatic ? (
                <div className="w-full h-14 flex items-center justify-center bg-[#EADDFF]/40 text-[#381E72] rounded-xl font-bold shadow-inner border border-[#EADDFF]">
                  <RefreshCw className="h-5 w-5 mr-3 animate-spin text-[#7E3AF2]" />
                  Waiting for admin to confirm your payment...
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={handleManualVerify}
                    disabled={isVerifying || isCancelling}
                    className="flex-1 h-14 bg-[#7E3AF2] hover:bg-[#6c2bd9] text-white rounded-xl font-bold shadow-md flex items-center justify-center transition-all text-lg"
                  >
                    {isVerifying ? (
                      <><RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Verifying...</>
                    ) : (
                      "I have paid"
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={isVerifying || isCancelling}
                        variant="outline"
                        className="flex-1 h-14 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all text-lg"
                      >
                        {isCancelling ? (
                          <><RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Cancelling...</>
                        ) : (
                          "Cancel Order"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white border-gray-200 shadow-xl sm:rounded-2xl p-6 sm:max-w-md">
                      <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="text-2xl font-bold text-gray-900">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-500 text-base">
                          This will cancel the current order. You will need to create a new order to checkout.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-6 gap-3 sm:space-x-0">
                        <AlertDialogCancel className="mt-0 h-12 sm:rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 border-none font-semibold transition-colors">No, keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelOrder} className="h-12 sm:rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md">Yes, cancel order</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
