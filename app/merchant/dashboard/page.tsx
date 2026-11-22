"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Area } from "recharts"
import { ArrowDownRight, ArrowUpRight, CheckCircle2, AlertTriangle, ShieldCheck, KeyRound, Wallet, FileCheck, Gauge } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMerchantState } from "@/lib/merchant/context"
import { getMerchantOverviewAction, type MerchantOverview } from "@/app/actions/merchant-trade"
import { amberCard, fmtDateTime, npr, PageHeader, Spinner, StatCard } from "@/components/merchant/ui"

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span>{now ? "First month with sales" : "No sales yet this month"}</span>
  const pct = Math.round(((now - before) / before) * 100)
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}% vs last month
    </span>
  )
}

function HealthRow({ icon: Icon, label, value, ok, href }: { icon: any; label: string; value: string; ok: boolean; href?: string }) {
  const row = (
    <div className={`flex items-center gap-3 rounded-lg border border-[#F59E0B]/20 bg-white p-3 ${href ? "hover:border-[#7E3AF2]/40 transition" : ""}`}>
      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${ok ? "bg-emerald-50" : "bg-amber-50"}`}>
        <Icon className={`h-4 w-4 ${ok ? "text-emerald-600" : "text-amber-600"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#6B7280]">{label}</p>
        <p className="text-sm font-bold text-[#1F2937] truncate">{value}</p>
      </div>
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
    </div>
  )
  return href ? <Link href={href} className="block">{row}</Link> : row
}

function LimitBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100))
  return (
    <div className="rounded-lg border border-[#F59E0B]/20 bg-white p-3">
      <div className="flex justify-between text-xs"><span className="text-[#6B7280]">{label}</span><span className="font-semibold text-[#1F2937]">{npr(used)} of {npr(limit)}</span></div>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#7E3AF2]"}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function MerchantOverviewPage() {
  const { state, tick } = useMerchantState()
  const [data, setData] = useState<MerchantOverview | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    getMerchantOverviewAction(Intl.DateTimeFormat().resolvedOptions().timeZone).then(setData)
  }, [tick])

  if (!data) return <Spinner label="Loading overview..." />
  const m = state.merchant
  const lowBalance = state.canUse && (data.lowBalanceThresholdPaisa ? data.availablePaisa < data.lowBalanceThresholdPaisa : data.daysLeft != null && data.daysLeft < 3)
  const chart = data.monthly.map((x) => ({ label: x.label, sales: x.spendPaisa / 100, orders: x.orders }))
  const kycLabel = { not_submitted: "Not submitted", submitted: "Under review", more_info: "Changes needed", rejected: "Not approved", approved: "Verified" }[m.kycStatus]
  const l = data.limits

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title={`Welcome back, ${m.contactName.split(" ")[0]}`} subtitle="Your sales, wallet and account at a glance.">
        {state.canUse && (
          <Button asChild size="sm" className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm">
            <Link href="/merchant/dashboard/catalog">Buy codes</Link>
          </Button>
        )}
      </PageHeader>

      {lowBalance && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <p className="text-sm"><span className="font-bold">Low wallet balance.</span> {npr(data.availablePaisa)} available{data.daysLeft != null ? `, about ${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"} at your recent spending` : ""}. Top up so orders and API calls don&apos;t fail.</p>
          <Button asChild size="sm" className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shrink-0"><Link href="/merchant/dashboard/wallet">Top up</Link></Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard label="Available to Spend" value={npr(data.availablePaisa)} hint={data.creditLimitPaisa ? `Balance ${npr(data.balancePaisa)} + credit ${npr(data.creditLimitPaisa)}` : data.pendingTopups ? `${data.pendingTopups} top-up${data.pendingTopups > 1 ? "s" : ""} pending` : "Wallet balance"} valueCls="text-[#7E3AF2]" />
        <StatCard label="Sales This Month" value={npr(data.month.spendPaisa)} hint={<Change now={data.month.spendPaisa} before={data.prevMonthSpendPaisa} />} />
        <StatCard label="Orders This Month" value={data.month.orders.toLocaleString()} hint={`${data.month.cards.toLocaleString()} codes delivered`} />
        <StatCard label="Balance Runway" value={data.daysLeft == null ? "—" : `${data.daysLeft.toLocaleString()} day${data.daysLeft === 1 ? "" : "s"}`} hint={data.avgDailySpendPaisa ? `At ${npr(data.avgDailySpendPaisa)} a day (last 14 days)` : "Not enough sales yet"} valueCls={data.daysLeft != null && data.daysLeft < 3 ? "text-red-600" : "text-[#1F2937]"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        <Card className={`${amberCard} xl:col-span-2 overflow-hidden`}>
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-[#1F2937] text-lg font-bold">Monthly sales</CardTitle>
              <CardDescription className="text-[#92400E]">Since you joined, up to the last 6 months</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="h-8 border-[#F59E0B]/40 text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold"><Link href="/merchant/dashboard/revenue">Full report</Link></Button>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="h-[260px] w-full bg-white rounded-lg border border-[#F59E0B]/20 p-2">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="merchantSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7E3AF2" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#7E3AF2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} tickMargin={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} width={70} tickFormatter={(v) => (v >= 1000 ? `Rs. ${v / 1000}k` : `Rs. ${v}`)} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#0EA5E9", fontSize: 12 }} width={30} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", backgroundColor: "#ffffff" }}
                      cursor={{ fill: "#7E3AF2", fillOpacity: 0.05 }}
                      formatter={(value, name) => {
                        const n = Number(value ?? 0)
                        return name === "orders" ? [`${n} ${n === 1 ? "order" : "orders"}`, "Orders"] : [`Rs. ${n.toLocaleString("en-IN")}`, "Sales"]
                      }}
                      labelStyle={{ fontWeight: "bold", color: "#1F2937" }}
                    />
                    <Bar yAxisId="orders" dataKey="orders" fill="#0EA5E9" fillOpacity={0.25} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Area type="monotoneX" dataKey="sales" stroke="#7E3AF2" strokeWidth={2.5} fill="url(#merchantSales)" dot={chart.length < 3} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                ["Lifetime sales", npr(data.lifetime.spendPaisa)],
                ["Lifetime orders", data.lifetime.orders.toLocaleString()],
                ["Average order", npr(data.avgOrderPaisa)],
                ["Via API", `${data.apiShare}% of orders`],
              ].map(([k, v]) => (
                <div key={k} className="bg-white/90 rounded-lg p-2.5 border border-[#F59E0B]/20">
                  <span className="text-[11px] text-[#92400E] font-medium block">{k}</span>
                  <span className="text-sm font-bold text-[#111827]">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={`${amberCard} overflow-hidden`}>
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] text-lg font-bold">Account health</CardTitle>
            <CardDescription className="text-[#92400E]">What keeps your account trusted and running</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 space-y-2">
            <HealthRow icon={FileCheck} label="Business verification" value={kycLabel} ok={m.kycStatus === "approved"} href={m.kycStatus === "approved" ? undefined : "/merchant/dashboard/account"} />
            <HealthRow icon={ShieldCheck} label="Two-factor sign-in" value={state.mfaEnabled ? "On" : "Off, recommended"} ok={state.mfaEnabled} href={state.mfaEnabled ? undefined : "/merchant/dashboard/account?tab=security"} />
            <HealthRow icon={KeyRound} label="Active API keys" value={data.activeKeys ? `${data.activeKeys} active` : "None yet"} ok={data.activeKeys > 0} href="/merchant/dashboard/api-keys" />
            <HealthRow icon={Wallet} label="Account status" value={m.status === "active" ? "Active" : "Suspended"} ok={m.status === "active"} />
            {(l.perOrderPaisa || l.dailyPaisa || l.monthlyPaisa) && (
              <div className="pt-2 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] uppercase tracking-wider"><Gauge className="h-3.5 w-3.5" />Spending limits</p>
                {l.dailyPaisa ? <LimitBar label="Last 24 hours" used={l.dailyUsedPaisa} limit={l.dailyPaisa} /> : null}
                {l.monthlyPaisa ? <LimitBar label="Last 30 days" used={l.monthlyUsedPaisa} limit={l.monthlyPaisa} /> : null}
                {l.perOrderPaisa ? <p className="text-xs text-[#6B7280]">Max {npr(l.perOrderPaisa)} per order</p> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
        <Card className={`${amberCard} overflow-hidden`}>
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] text-lg font-bold">Top products</CardTitle>
            <CardDescription className="text-[#92400E]">Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 space-y-2">
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-[#4B5563] text-center py-8">No sales in the last 30 days.</p>
            ) : (
              data.topProducts.map((p, i) => {
                const share = Math.round((p.spendPaisa / data.topProducts[0].spendPaisa) * 100)
                return (
                  <div key={p.name} className="rounded-lg border border-[#F59E0B]/20 bg-white p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-[#1F2937] truncate">{i + 1}. {p.name}</span>
                      <span className="font-bold text-[#1F2937] shrink-0">{npr(p.spendPaisa)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-[#7E3AF2]" style={{ width: `${share}%` }} /></div>
                    <p className="text-xs text-[#6B7280] mt-1">{p.cards} codes</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className={`${amberCard} xl:col-span-2 overflow-hidden`}>
          <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-[#1F2937] text-lg font-bold">Recent orders</CardTitle>
              <CardDescription className="text-[#92400E]">Your latest purchases</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="h-8 border-[#F59E0B]/40 text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold"><Link href="/merchant/dashboard/orders">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-[#4B5563] text-center py-8">No orders yet.{state.canUse ? " Buy your first codes from the catalog." : ""}</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-[#F59E0B]/20 bg-white">
                {data.recentOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1F2937] truncate">{o.product} · {o.denomination}</p>
                      <p className="text-xs text-[#6B7280]">{fmtDateTime(o.createdAt)} · {o.quantity} code{o.quantity > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#1F2937]">{npr(o.totalPaisa)}</p>
                      <p className={`text-xs font-semibold ${o.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{o.status === "completed" ? "Completed" : "Refunded"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
