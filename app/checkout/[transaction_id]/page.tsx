"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, RefreshCw, Smartphone, Clock, ShieldCheck, Phone, ArrowLeft, Download } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { getOrGenerateQRAction, verifyPaymentAction, verifyPaymentByPhoneAction, expireTransactionAction, cancelTransactionAction } from "@/app/actions/checkout"
import { toast } from "sonner"
import Image from "next/image"

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

  // Phone verification state
  const [showPhoneVerify, setShowPhoneVerify] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false)

  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

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
      if (res.success) {
        setQrData(res)
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
        if (res.status === "Completed") {
          setIsCompleted(true)
        } else if (res.status === "Expired" || res.status === "Payment Failed") {
          setIsExpired(true)
          setQrData(res)
        } else {
          setError(res.error || "Failed to load QR code")
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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

  // Auto-redirect on completion — replaces the old "Payment Confirmed!" full-page UI.
  // The /transactions page will fire a toast based on the ?paid=success query param.
  useEffect(() => {
    if (!isCompleted) return
    localStorage.removeItem(`qr_${transaction_id}`)
    if (qrData?.isGuest) {
      router.push("/?paid=success")
    } else {
      router.push("/transactions?paid=success")
    }
  }, [isCompleted, qrData, router, transaction_id])

  // Auto-redirect registered users on expiry
  useEffect(() => {
    let isMounted = true;
    
    const handleExpiry = async () => {
      if (isExpired && qrData) {
        // Explicitly fail the transaction and wait for it to complete
        await expireTransactionAction(transaction_id).catch(() => {})

        if (!qrData.isGuest && isMounted) {
          toast.info("Session expired. Redirecting to your transactions...")
          router.push("/transactions")
        }
      }
    }
    
    handleExpiry()
    
    return () => { isMounted = false }
  }, [isExpired, qrData, router, transaction_id])

  // Background Polling - Flat 5s for 5 minutes (DYNAMIC: NepalPay/Fonepay)
  useEffect(() => {
    if (!qrData || isCompleted || isExpired || error || qrData.isStatic) return

    const pollDelay = 5000 // 5 seconds
    let isRequesting = false

    const poll = async () => {
      if (isRequesting || isCompleted) return
      isRequesting = true

      try {
        const provider = qrData.paymentCategory || "nepalpay"
        const res = await verifyPaymentAction(transaction_id, qrData.validationTraceId, provider)

        if (res.success && res.completed) {
          setIsCompleted(true)
        }
      } catch (e) {
        console.error("Poll error", e)
      } finally {
        isRequesting = false
        if (!isCompleted) {
          pollInterval.current = setTimeout(poll, pollDelay)
        }
      }
    }

    pollInterval.current = setTimeout(poll, pollDelay)

    return () => {
      if (pollInterval.current) clearTimeout(pollInterval.current)
    }
  }, [qrData, isCompleted, isExpired, error, transaction_id, router])

  // Static-QR polling — checks DB status every 5s for up to 5 minutes
  // (admin manually flips status from Processing -> Completed/Failed).
  useEffect(() => {
    if (!qrData?.isStatic || isCompleted || isExpired || error) return

    let elapsed = 0
    const max = 5 * 60 * 1000 // 5 minutes
    const interval = setInterval(async () => {
      elapsed += 5000
      try {
        const res = await fetch(`/api/transaction-status?id=${transaction_id}`, { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (data.status === "Completed" || data.status === "Payment Done") {
            setIsCompleted(true)
            clearInterval(interval)
            return
          }
          if (data.status === "Failed" || data.status === "Payment Failed") {
            setIsExpired(true)
            clearInterval(interval)
            return
          }
        }
      } catch (e) {
        // Swallow transient network errors; keep polling until elapsed >= max.
      }
      if (elapsed >= max) clearInterval(interval)
    }, 5000)

    return () => clearInterval(interval)
  }, [qrData, isCompleted, isExpired, error, transaction_id])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handlePhoneVerification = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter the phone number used for payment")
      return
    }

    setIsPhoneVerifying(true)
    try {
      const res = await verifyPaymentByPhoneAction(transaction_id, phoneNumber)
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
      } else {
        toast.error("Payment not verified yet. We will keep checking automatically.")
      }
    } catch (e) {
      toast.error("Error verifying payment")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCancelOrder = async () => {
    if (confirm("Are you sure you want to cancel this order?")) {
      setIsCancelling(true)
      try {
        const res = await cancelTransactionAction(transaction_id)
        if (res.success) {
          localStorage.removeItem(`qr_${transaction_id}`)
          if (qrData && !qrData.isGuest) {
            router.push("/transactions")
          } else {
            router.push("/")
          }
        } else {
          toast.error(res.error || "Failed to cancel order")
          setIsCancelling(false)
        }
      } catch (e) {
        toast.error("An error occurred")
        setIsCancelling(false)
      }
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

  // ========== EXPIRED STATE (Guest users only — registered users are auto-redirected) ==========
  if (isExpired && !loading && (qrData?.isGuest || !qrData)) {
    return (
      <div className="container mx-auto max-w-lg py-12 px-4">
        <Card className="shadow-2xl border-2 border-amber-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b pb-4">
            <div className="flex justify-between items-center w-full">
              <CardTitle className="text-xl flex items-center gap-2 text-amber-900">
                <Clock className="h-5 w-5 text-amber-600" />
                QR Code Expired
              </CardTitle>
              <div className="relative h-8 w-28">
                <Image src="/logo-final.png" alt="Byiora" fill className="object-contain object-right" />
              </div>
            </div>
            <CardDescription className="text-amber-700 mt-1">
              Order ID: <span className="font-mono text-sm font-bold text-amber-900 bg-white border border-amber-200 px-2 py-0.5 rounded ml-1 shadow-sm">{transaction_id}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {!showPhoneVerify ? (
              <>
                <div className="text-center space-y-3">
                  <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Payment Session Expired</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    The QR code for this transaction has expired. Expired QR codes cannot be reused for security reasons.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => setShowPhoneVerify(true)}
                    className="w-full h-12 bg-[#7E3AF2] hover:bg-[#6c2bd9] text-white font-semibold"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Payment success but order failed?
                  </Button>

                  <Button
                    onClick={() => router.push("/")}
                    variant="outline"
                    className="w-full h-12 font-semibold"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Store
                  </Button>
                </div>

                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  Expired QR tokens cannot be reused. If you need to purchase again, please start a new order from the store.
                </p>
              </>
            ) : (
              <>
                {/* Phone Verification Form */}
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-gray-900">Verify Your Payment</h3>
                    <p className="text-gray-600 text-sm">
                      Enter the phone number you used to pay. We'll check the bank's transaction records to confirm your payment.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-700 font-medium">
                      🔒 This verification is processed entirely on our secure servers. Your phone number is only used for matching against bank records.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Phone Number Used for Payment</label>
                    <Input
                      type="tel"
                      placeholder="e.g. 9841234567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="h-12 text-lg"
                      maxLength={15}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowPhoneVerify(false)}
                      variant="outline"
                      className="flex-1 h-11"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handlePhoneVerification}
                      disabled={isPhoneVerifying || !phoneNumber.trim()}
                      className="flex-1 h-11 bg-[#7E3AF2] hover:bg-[#6c2bd9] text-white font-semibold"
                    >
                      {isPhoneVerifying ? (
                        <span className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Verifying...
                        </span>
                      ) : "Verify Payment"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========== MAIN CHECKOUT STATE ==========
  return (
    <div className="min-h-screen bg-white">
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
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#7E3AF2] border-t-transparent mb-4"></div>
              <p className="text-gray-500 text-lg">Generating secure QR code...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center py-16">
              <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Checkout Error</h3>
              <p className="text-gray-600 text-lg mb-8">{error}</p>
              <Button onClick={() => router.push("/")} variant="outline" size="lg">
                Return to Store
              </Button>
            </div>
          ) : qrData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              {/* LEFT COLUMN: QR CODE */}
              <div className="flex flex-col items-center justify-center w-full">
                <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-200 relative w-full max-w-[320px] flex flex-col justify-center items-center">
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
                    <Button
                      onClick={handleCancelOrder}
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
                  </div>
                )}
              </div>
            </div>
          ) : null}
      </div>
    </div>
  )
}
