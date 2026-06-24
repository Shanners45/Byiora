import { redirect } from "next/navigation"
import { verifyGuestVerificationToken } from "@/app/actions/checkout-encryption"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldAlert, CreditCard } from "lucide-react"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {result.error === "Token expired" 
              ? "This verification link has expired because it is older than 24 hours. For your security, please contact support if you need further assistance."
              : "This verification link is invalid or corrupted. Please ensure you clicked the full link from your email."}
          </p>
          <Link href="/">
            <Button className="w-full bg-[#6B3FA0] hover:bg-[#5A338A] text-white py-6 text-lg font-medium rounded-xl">
              Return to Store
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Fetch transaction to ensure it exists and is still in a valid state
  const supabase = createServiceRoleClient()
  const { data: txn, error } = await supabase
    .from("transactions")
    .select("status, product_name, amount, price, payment_category")
    .eq("transaction_id", result.transactionId)
    .single()

  if (error || !txn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Not Found</h1>
          <p className="text-gray-500 mb-8">We could not find the transaction associated with this link.</p>
          <Link href="/">
            <Button className="w-full bg-[#6B3FA0] hover:bg-[#5A338A] text-white">Return to Store</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (txn.status === "Completed" || txn.status === "Payment Done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Verified</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            This transaction has already been verified and processed. You should have received a confirmation email.
          </p>
          <Link href="/">
            <Button className="w-full bg-[#6B3FA0] hover:bg-[#5A338A] text-white py-6 text-lg font-medium rounded-xl">
              Return to Store
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <VerifyGuestPaymentClient 
        transactionId={result.transactionId}
        productName={txn.product_name}
        price={txn.price}
        status={txn.status}
      />
    </div>
  )
}
