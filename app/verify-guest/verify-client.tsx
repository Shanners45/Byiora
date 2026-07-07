"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Phone, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"
import { verifyPaymentByPhoneAction } from "@/app/actions/checkout"
import { useRouter } from "next/navigation"
import { TurnstileWidget } from "@/components/turnstile-widget"

export function VerifyGuestPaymentClient({
  transactionId,
  productName,
  price,
  status
}: {
  transactionId: string
  productName: string
  price: string
  status: string
}) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()

  const handleVerify = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number")
      return
    }
    if (!captchaToken) {
      toast.error("Please complete the security check")
      return
    }

    setIsVerifying(true)
    try {
      const res = await verifyPaymentByPhoneAction(transactionId, phoneNumber, captchaToken)
      if (res.success) {
        setIsSuccess(true)
        toast.success("Payment verified successfully! Your order is being fulfilled.")
      } else {
        toast.error(res.error || "Verification failed")
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed")
    } finally {
      setIsVerifying(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center pt-16 pb-24">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-green-200">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Verification Complete</h1>
        <p className="text-gray-600 text-lg mb-8 max-w-md text-center leading-relaxed">
          Your payment has been successfully verified! You will receive an email shortly with your order details.
        </p>
        <Button 
          onClick={() => router.push("/")}
          className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-1"
        >
          Return to Store
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start w-full">
      {/* LEFT COLUMN: Order Details */}
      <div className="w-full md:w-5/12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white relative overflow-hidden">
           <div className="absolute -top-4 -right-4 p-4 opacity-10">
             <ShieldCheck className="w-40 h-40" />
           </div>
           <div className="relative z-10">
             <h2 className="text-3xl font-bold mb-2 text-white tracking-tight">Payment Verification</h2>
             <p className="text-gray-300 text-sm leading-relaxed">
               Please verify your payment to fulfill this order.
             </p>
           </div>
        </div>
        
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Summary</h3>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 text-sm">Product</span>
                <span className="font-semibold text-gray-900 text-right">{productName}</span>
              </div>
              <div className="w-full h-px bg-gray-200 my-4"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Total Amount</span>
                <span className="font-bold text-xl text-[#6B3FA0]">NPR {price}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Actions */}
      <div className="w-full md:w-7/12">
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
                  onChange={(e) => setPhoneNumber(e.target.value)}
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
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1 h-14 rounded-xl font-semibold border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Return to Store
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isVerifying || !phoneNumber.trim() || !captchaToken}
                className="flex-[2] h-14 bg-[#6B3FA0] hover:bg-[#5A338A] text-white font-semibold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
              >
                {isVerifying ? (
                  <span className="flex items-center">
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </span>
                ) : "Verify Securely"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
