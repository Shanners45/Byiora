"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, RefreshCw, Smartphone, Clock, ShieldCheck } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { getOrGenerateQRAction, verifyPaymentAction } from "@/app/actions/checkout"
import { toast } from "sonner"
import Image from "next/image"

export default function CheckoutPage({ params }: { params: { transaction_id: string } }) {
  const router = useRouter()
  const { transaction_id } = params

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrData, setQrData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

  const loadQR = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOrGenerateQRAction(transaction_id)
      if (res.success) {
        setQrData(res)
        setTimeLeft(res.expiresIn)
        if (res.status === "Completed") {
          setIsCompleted(true)
        }
      } else {
        if (res.status === "Completed") {
          setIsCompleted(true)
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

  // Countdown timer (only for dynamic QR)
  useEffect(() => {
    if (timeLeft > 0 && !isCompleted && !error && !qrData?.isStatic) {
      timerInterval.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval.current!)
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

  // Background Polling with Exponential Backoff (only for dynamic QR)
  useEffect(() => {
    if (!qrData || isCompleted || timeLeft === 0 || error || qrData.isStatic) return

    let pollDelay = 5000 // Start at 5s
    const maxDelay = 30000 // Max 30s
    let isRequesting = false

    const poll = async () => {
      if (isRequesting || isCompleted) return
      isRequesting = true
      
      try {
        const provider = qrData.qrString.toLowerCase().includes("fonepay") ? "fonepay" : "nepalpay"
        const res = await verifyPaymentAction(transaction_id, qrData.validationTraceId, provider)
        
        if (res.success && res.completed) {
          setIsCompleted(true)
          toast.success("Payment successful! Your order is being fulfilled.")
          setTimeout(() => {
            router.push("/profile") // Redirect to profile to see order
          }, 3000)
        } else if (res.rateLimited) {
          // Slow down if rate limited
          pollDelay = Math.min(pollDelay * 2, maxDelay)
        } else {
          // Slowly increase delay up to 15s to save DB calls if user is slow
          pollDelay = Math.min(pollDelay + 2000, 15000)
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
  }, [qrData, isCompleted, timeLeft, error, transaction_id, router])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (isCompleted) {
    return (
      <div className="container mx-auto max-w-md py-12 px-4">
        <Card className="text-center shadow-lg border-green-200 bg-green-50">
          <CardContent className="pt-10 pb-10 flex flex-col items-center">
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Payment Confirmed!</h2>
            <p className="text-green-700 mb-6">Your order has been completed successfully.</p>
            <Button onClick={() => router.push("/profile")} className="bg-green-600 hover:bg-green-700 w-full">
              View Order Details
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-md py-12 px-4">
      <Card className="shadow-lg border-2 border-[#7E3AF2]/20">
        <CardHeader className="bg-gradient-to-r from-[#7E3AF2]/10 to-transparent border-b">
          <CardTitle className="text-xl flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[#7E3AF2]" />
            Scan to Pay
          </CardTitle>
          <CardDescription>
            Transaction: <span className="font-mono text-xs font-semibold">{transaction_id}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#7E3AF2] border-t-transparent mb-4"></div>
              <p className="text-gray-500 text-sm">Generating secure QR code...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Checkout Error</h3>
              <p className="text-gray-600 text-sm mb-6">{error}</p>
              <Button onClick={() => router.push("/")} variant="outline">
                Return to Store
              </Button>
            </div>
          ) : qrData ? (
            <div className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl shadow-inner border-2 border-gray-100 mb-6 relative w-full flex justify-center">
                {timeLeft === 0 && !qrData.isStatic && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                    <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
                    <p className="font-semibold text-gray-800">QR Code Expired</p>
                    <Button onClick={loadQR} size="sm" className="mt-3 bg-[#7E3AF2] hover:bg-[#6c2bd9]">
                      <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                    </Button>
                  </div>
                )}
                {qrData.isStatic ? (
                  <div className="relative w-full max-w-[220px] aspect-square">
                    {qrData.staticQrUrl ? (
                      <Image 
                        src={qrData.staticQrUrl} 
                        alt="Payment QR" 
                        fill 
                        className="object-contain rounded-lg"
                        sizes="(max-width: 220px) 100vw, 220px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500">
                        No QR available
                      </div>
                    )}
                  </div>
                ) : (
                  <QRCodeSVG 
                    value={qrData.qrString} 
                    size={220}
                    level="Q"
                    includeMargin={false}
                  />
                )}
              </div>

              {qrData.isStatic && qrData.instructions && (
                <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm text-blue-800 whitespace-pre-wrap">
                  {qrData.instructions}
                </div>
              )}

              <div className="w-full bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-500">Product</span>
                  <span className="font-semibold text-gray-900 truncate max-w-[150px]">{qrData.product}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-500">Amount to Pay</span>
                  <span className="font-bold text-[#7E3AF2] text-lg">Rs. {qrData.amount}</span>
                </div>
                {!qrData.isStatic && (
                  <div className="flex justify-between items-center text-amber-700 pt-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="h-4 w-4" /> Expires in
                    </span>
                    <span className="font-mono font-bold text-lg">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 w-full text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                {qrData.isStatic 
                  ? "Payments are manually verified by an administrator." 
                  : "Payments are securely processed & monitored automatically."}
              </div>
            </div>
          ) : null}
        </CardContent>
        
        {qrData && !error && (
          <CardFooter className="bg-gray-50 border-t flex flex-col pt-4 pb-4">
            <p className="text-xs text-center text-gray-500 w-full mb-3">
              Don't close this tab until you complete the payment on your mobile app.
            </p>
            <Button 
              className="w-full" 
              variant="outline"
              disabled={isVerifying || (!qrData.isStatic && timeLeft === 0)}
              onClick={async () => {
                if (qrData.isStatic) {
                  toast.success("Thank you! Admin will verify your payment shortly.")
                  router.push("/profile")
                  return
                }
                
                setIsVerifying(true)
                try {
                  const provider = qrData.qrString.toLowerCase().includes("fonepay") ? "fonepay" : "nepalpay"
                  const res = await verifyPaymentAction(transaction_id, qrData.validationTraceId, provider)
                  if (res.success && res.completed) {
                    setIsCompleted(true)
                    toast.success("Payment confirmed!")
                  } else {
                    toast.info("Payment not detected yet. Please make sure you have scanned and paid.")
                  }
                } finally {
                  setIsVerifying(false)
                }
              }}
            >
              {isVerifying ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
              ) : (
                qrData.isStatic ? "I have paid" : "I have paid, check status"
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
