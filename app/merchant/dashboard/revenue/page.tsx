"use client"

import { getMyRevenueReportAction } from "@/app/actions/merchant-trade"
import { useMerchantState } from "@/lib/merchant/context"
import { RevenueReport } from "@/components/merchant/revenue-report"
import { PageHeader } from "@/components/merchant/ui"

export default function MerchantRevenue() {
  const { tick } = useMerchantState()
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Revenue" subtitle="Your sales through Byiora by day, week or month, for any date range." />
      <RevenueReport load={getMyRevenueReportAction} refreshKey={tick} revenueLabel="Sales" csvName="byiora-sales" />
    </div>
  )
}
