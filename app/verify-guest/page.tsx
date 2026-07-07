import { redirect } from "next/navigation"
import { verifyGuestVerificationToken } from "@/app/actions/checkout-encryption"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldAlert, CreditCard, ShieldCheck } from "lucide-react"
import Image from "next/image"
import { VerifyGuestPaymentClient } from "./verify-client"

export default async function VerifyGuestPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    redirect("/")
  }

  // Decrypt and verify the token
  const result = await verifyGuestVerificationToken(token)

  if (!result.success || !result.transactionId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center pt-24 p-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Link Expired</h1>
        <p className="text-gray-600 text-lg mb-8 max-w-md text-center leading-relaxed">
          {result.error === "Token expired" 
            ? "This verification link has expired because it is older than 24 hours. For your security, please contact support if you need further assistance."
            : "This verification link is invalid or corrupted. Please ensure you clicked the full link from your email."}
        </p>
        <Link href="/">
          <Button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-1">
            Return to Store
          </Button>
        </Link>
      </div>
    )
  }

  // Fetch transaction to ensure it exists and is still in a valid state
  const supabase = createServiceRoleClient()
  const { data: txn, error } = await supabase
    .from("transactions")
    .select("status, product_name, amount, price")
    .eq("transaction_id", result.transactionId)
    .single()

  if (error || !txn) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center pt-24 p-4">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Transaction Not Found</h1>
        <p className="text-gray-600 text-lg mb-8 max-w-md text-center leading-relaxed">We could not find the transaction associated with this link.</p>
        <Link href="/">
          <Button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-1">Return to Store</Button>
        </Link>
      </div>
    )
  }

  if ((txn.status as string) === "Completed" || (txn.status as string) === "Paid") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center pt-24 p-4">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Payment Verified</h1>
        <p className="text-gray-600 text-lg mb-8 max-w-md text-center leading-relaxed">
          This transaction has already been verified and processed. You should have received a confirmation email.
        </p>
        <Link href="/">
          <Button className="bg-[#6B3FA0] hover:bg-[#5A3588] text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg shadow-purple-500/20 transition-all hover:-translate-y-1">
            Return to Store
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full border-b bg-gray-50/50">
        <div className="container mx-auto px-4 py-4 md:py-6 flex justify-between items-center w-full">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-gray-900">
              <ShieldCheck className="h-7 w-7 md:h-8 md:w-8 text-[#7E3AF2]" />
              Verify Payment
            </h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
              Order ID: <span className="font-mono font-bold text-gray-900 bg-white border border-gray-200 px-2 py-0.5 rounded ml-1 shadow-sm">{result.transactionId}</span>
            </p>
          </div>
          <div className="relative h-8 w-24 md:h-10 md:w-32">
            <Image src="/logo-final.png" alt="Byiora" fill className="object-contain object-right" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <VerifyGuestPaymentClient 
          transactionId={result.transactionId}
          productName={txn.product_name}
          price={txn.price}
          status={txn.status}
        />
      </div>
    </div>
  )
}
