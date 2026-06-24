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
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Complete</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Your payment has been successfully verified! You will receive an email shortly with your order details.
        </p>
        <Button 
          onClick={() => router.push("/")}
          className="w-full bg-[#6B3FA0] hover:bg-[#5A338A] text-white py-6 text-lg font-medium rounded-xl"
        >
          Return to Store
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 relative">
      <div className="absolute -top-12 left-1/2 -translate-x-1/2">
        <div className="w-24 h-24 bg-white rounded-full p-2 shadow-lg flex items-center justify-center">
          <div className="w-full h-full bg-[#6B3FA0] rounded-full flex items-center justify-center overflow-hidden">
            <Image src="/logo-final.png" alt="Byiora" width={60} height={60} className="object-contain" />
          </div>
        </div>
      </div>

      <div className="text-center mt-12 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Payment</h1>
        <div className="text-sm text-gray-500 mb-1">
          Order: <span className="font-medium text-gray-700">{productName}</span>
        </div>
        <div className="text-sm text-gray-500">
          Amount: <span className="font-medium text-gray-700">NPR {price}</span>
        </div>
      </div>

      <div className="bg-[#f3e8ff] border border-[#d8b4fe] rounded-lg p-4 mb-6">
        <p className="text-[#6B3FA0] text-sm text-center font-medium">
          We were unable to confirm your payment. If your account was charged, please verify your payment below.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Phone Number Used for Payment</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="tel"
              placeholder="e.g. 98XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="pl-10 h-12 text-lg bg-white border-gray-200 focus:border-[#6B3FA0] focus:ring-[#6B3FA0] focus-visible:ring-[#6B3FA0] focus-visible:border-[#6B3FA0]"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <TurnstileWidget onToken={setCaptchaToken} />
        </div>

        <Button
          onClick={handleVerify}
          disabled={isVerifying || !phoneNumber || !captchaToken}
          className="w-full h-12 bg-[#6B3FA0] hover:bg-[#5a3489] text-white text-lg font-medium rounded-xl shadow-md transition-all flex items-center justify-center"
        >
          {isVerifying ? (
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          Verify Payment
        </Button>
      </div>
    </div>
  )
}
