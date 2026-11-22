"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, TrendingUp, Tags, Wallet, ShoppingBag, FileCheck, Settings2, Boxes, History } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminSession } from "@/lib/admin-session-context"
import { createClient } from "@/lib/supabase/client"
import { useRealtimePings } from "@/lib/realtime/use-pings"
import { RevenueReport } from "@/components/merchant/revenue-report"
import { getMerchantDetailAction, getMerchantRevenueReportAction, type MerchantListRow } from "@/app/actions/merchant-admin"
import { AccountTab, ActivityTab, amberCard, fmtDate, InfoBox, InventoryTab, KYC_STYLE, KycTab, npr, OrdersTab, pill, STATUS_STYLE, tabCls, WalletTab } from "../shared"
import { PricingEditor } from "../pricing-editor"

const TABS = ["revenue", "pricing", "wallet", "orders", "inventory", "kyc", "activity", "account"] as const

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const admin = useAdminSession()
  const [merchant, setMerchant] = useState<(MerchantListRow & { catalog_mode: "all" | "selected"; last_active_at: string | null }) | null | undefined>(undefined)
  const [tab, setTab] = useState<string>("revenue")
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    const res = await getMerchantDetailAction(id)
    if (!res.success) {
      toast.error(res.error)
      return setMerchant(null)
    }
    setMerchant(res.data)
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t && (TABS as readonly string[]).includes(t)) setTab(t)
  }, [])

  // Any merchant event (order, top-up, KYC...) refreshes this page live.
  useRealtimePings(createClient(), "admin:merchants", () => {
    load()
    setTick((t) => t + 1)
  })

  const loadReport = useCallback((from: string, to: string, bucket: "day" | "week" | "month", tz: string) => getMerchantRevenueReportAction(id, from, to, bucket, tz), [id])
  const changed = () => { load(); setTick((t) => t + 1) }
  const switchTab = (t: string) => {
    setTab(t)
    window.history.replaceState(null, "", `?tab=${t}`)
  }

  if (admin && admin.role !== "admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h1 className="text-2xl font-bold tracking-tight text-red-700">Access Denied</h1>
        <p className="text-red-600 mt-2">Merchant management is restricted to full administrators.</p>
      </div>
    )
  }
  if (merchant === undefined) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
        <p className="text-[#4B5563]">Loading merchant...</p>
      </div>
    )
  }
  if (!merchant) {
    return (
      <div className="space-y-4">
        <Link href="/admin/dashboard/merchants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E3AF2]"><ArrowLeft className="h-4 w-4" />All merchants</Link>
        <p className="text-[#4B5563]">Merchant not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link href="/admin/dashboard/merchants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E3AF2] hover:underline"><ArrowLeft className="h-4 w-4" />All merchants</Link>

      <div className={`${amberCard} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#111827]">{merchant.business_name}</h1>
          {pill(STATUS_STYLE[merchant.status])}
          {pill(KYC_STYLE[merchant.kyc_status])}
        </div>
        <p className="text-xs sm:text-sm text-[#4B5563] mt-1.5">
          <span className="font-semibold text-[#111827]">{merchant.contact_name}</span> · {merchant.email}{merchant.phone ? ` · ${merchant.phone}` : ""} · Last active {merchant.last_active_at ? fmtDate(merchant.last_active_at) : "not yet"}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#F59E0B]/20">
          <InfoBox label="Revenue to Byiora"><span className="text-[#7E3AF2]">{npr(merchant.revenue_paisa)}</span></InfoBox>
          <InfoBox label="This month">{npr(merchant.month_revenue_paisa)}</InfoBox>
          <InfoBox label="Orders">{merchant.orders.toLocaleString()}{merchant.last_order_at ? <span className="block text-[11px] font-medium text-[#6B7280]">Last {fmtDate(merchant.last_order_at)}</span> : null}</InfoBox>
          <InfoBox label="Wallet balance">{npr(merchant.wallet_balance_paisa)}{merchant.credit_limit_paisa ? <span className="block text-[11px] font-medium text-[#6B7280]">+ {npr(merchant.credit_limit_paisa)} credit</span> : null}{merchant.pending_topups ? <span className="block text-[11px] font-medium text-[#7E3AF2]">{merchant.pending_topups} top-up pending</span> : null}</InfoBox>
          <InfoBox label="Pricing">{merchant.discount_percent}% default · {merchant.catalog_mode === "all" ? "all products" : "selected products"}<span className="block text-[11px] font-medium text-[#6B7280]">API {merchant.api_rate_limit_per_min}/min</span></InfoBox>
        </div>
      </div>

      <Tabs value={tab} onValueChange={switchTab} className="space-y-5">
        <div className="w-full overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-auto bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl shadow-xs gap-1">
            <TabsTrigger value="revenue" className={tabCls}><TrendingUp className="h-4 w-4" />Revenue</TabsTrigger>
            <TabsTrigger value="pricing" className={tabCls}><Tags className="h-4 w-4" />Products &amp; pricing</TabsTrigger>
            <TabsTrigger value="wallet" className={tabCls}><Wallet className="h-4 w-4" />Wallet &amp; top-ups{merchant.pending_topups ? <span className="ml-0.5 h-2 w-2 rounded-full bg-red-600" /> : null}</TabsTrigger>
            <TabsTrigger value="orders" className={tabCls}><ShoppingBag className="h-4 w-4" />Orders</TabsTrigger>
            <TabsTrigger value="inventory" className={tabCls}><Boxes className="h-4 w-4" />Inventory</TabsTrigger>
            <TabsTrigger value="kyc" className={tabCls}><FileCheck className="h-4 w-4" />Verification{merchant.kyc_status === "submitted" ? <span className="ml-0.5 h-2 w-2 rounded-full bg-red-600" /> : null}</TabsTrigger>
            <TabsTrigger value="activity" className={tabCls}><History className="h-4 w-4" />Activity</TabsTrigger>
            <TabsTrigger value="account" className={tabCls}><Settings2 className="h-4 w-4" />Account</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="revenue"><RevenueReport load={loadReport} refreshKey={tick} showDiscount csvName={`merchant-${merchant.business_name.replace(/\W+/g, "-").toLowerCase()}-revenue`} /></TabsContent>
        <TabsContent value="pricing"><PricingEditor merchantId={merchant.id} refreshKey={tick} /></TabsContent>
        <TabsContent value="wallet"><WalletTab merchant={merchant} onChanged={changed} refreshKey={tick} /></TabsContent>
        <TabsContent value="orders"><OrdersTab merchant={merchant} onChanged={changed} refreshKey={tick} /></TabsContent>
        <TabsContent value="inventory"><InventoryTab merchant={merchant} onChanged={changed} refreshKey={tick} /></TabsContent>
        <TabsContent value="activity"><ActivityTab merchant={merchant} refreshKey={tick} /></TabsContent>
        <TabsContent value="kyc"><KycTab merchant={merchant} onChanged={changed} refreshKey={tick} /></TabsContent>
        <TabsContent value="account"><AccountTab merchant={merchant} onChanged={changed} /></TabsContent>
      </Tabs>
    </div>
  )
}
