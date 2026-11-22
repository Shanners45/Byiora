"use client"

import { useEffect, useMemo, useState } from "react"
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Area } from "recharts"
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RevenueReport as Report } from "@/lib/merchant/reports"
import { amberCard, inputCls, npr, StatCard } from "@/components/merchant/ui"
import { Pager, usePaged } from "@/components/merchant/pager"

type Bucket = "day" | "week" | "month"
// Dates are YYYY-MM-DD in the viewer's own calendar; the server groups in the same time zone.
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const today = () => ymd(new Date())
const shift = (s: string, days = 0, months = 0) => {
  const [y, m, d] = s.split("-").map(Number)
  return ymd(new Date(y, m - 1 + months, d + days))
}
const firstOfMonth = (s: string) => `${s.slice(0, 8)}01`
const localMidnightIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d).toISOString()
}

const PRESETS: Record<string, { label: string; range: () => [string, string] }> = {
  last_12_months: { label: "Last 12 months", range: () => [firstOfMonth(shift(today(), 0, -11)), today()] },
  this_month: { label: "This month", range: () => [firstOfMonth(today()), today()] },
  last_month: { label: "Last month", range: () => [firstOfMonth(shift(firstOfMonth(today()), 0, -1)), shift(firstOfMonth(today()), -1)] },
  last_7: { label: "Last 7 days", range: () => [shift(today(), -6), today()] },
  last_30: { label: "Last 30 days", range: () => [shift(today(), -29), today()] },
  last_90: { label: "Last 90 days", range: () => [shift(today(), -89), today()] },
  this_year: { label: "This year", range: () => [`${today().slice(0, 4)}-01-01`, today()] },
  all_time: { label: "Since joining", range: () => [shift(today(), 0, -24), today()] },
  custom: { label: "Custom range", range: () => [shift(today(), -29), today()] },
}
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
const suggestBucket = (from: string, to: string): Bucket => (days(from, to) <= 31 ? "day" : days(from, to) <= 120 ? "week" : "month")

function label(bucketKey: string, bucket: Bucket, long = false) {
  const d = new Date(`${bucketKey}T00:00:00Z`)
  if (bucket === "month") return d.toLocaleDateString(undefined, { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" })
  const s = d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
  return bucket === "week" ? `Week of ${s}` : long ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : s
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span>No earlier period to compare</span>
  const pct = Math.round(((now - before) / before) * 100)
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${pct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
      {pct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}% vs previous period
    </span>
  )
}

/** Date-range revenue report. `load` decides whose data (one merchant or all). */
export function RevenueReport({
  load,
  refreshKey = 0,
  revenueLabel = "Revenue",
  csvName = "revenue",
  showDiscount = false,
}: {
  load: (fromIso: string, toIso: string, bucket: Bucket, tz: string) => Promise<Report | null>
  refreshKey?: number
  revenueLabel?: string
  csvName?: string
  /** Admin only: show the discount given vs retail. */
  showDiscount?: boolean
}) {
  const [preset, setPreset] = useState("last_12_months")
  const [[from, to], setRange] = useState(PRESETS.last_12_months.range())
  const [bucket, setBucket] = useState<Bucket>("month")
  const [report, setReport] = useState<Report | null | undefined>(undefined)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // The account's start date (in the viewer's calendar): nothing before it is ever shown.
  const joined = report?.startsAt ? ymd(new Date(report.startsAt)) : null
  const pick = (key: string) => {
    setPreset(key)
    if (key === "custom") return
    let [a, b] = PRESETS[key].range()
    if (joined && a < joined) a = joined
    setRange([a, b])
    setBucket(suggestBucket(a, b))
  }

  const invalid = !from || !to || from > to || days(from, to) > 732
  useEffect(() => {
    if (invalid) return
    let live = true
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    load(localMidnightIso(from), localMidnightIso(shift(to, 1)), bucket, tz).then((r) => live && setReport(r))
    return () => { live = false }
  }, [from, to, bucket, refreshKey, invalid, load])

  const chart = useMemo(() => (report?.series || []).map((p) => ({ name: label(p.bucket, report!.bucket), revenue: p.revenuePaisa / 100, orders: p.orders })), [report])
  const periods = usePaged(useMemo(() => [...(report?.series || [])].reverse(), [report]))
  const products = usePaged(report?.byProduct || [])
  const shownFrom = report ? ymd(new Date(report.from)) : from

  const exportCsv = () => {
    if (!report) return
    const rows = [["Period", `${revenueLabel} (NPR)`, "Orders", "Codes", "Refunded (NPR)"], ...report.series.map((p) => [label(p.bucket, report.bucket, true), String(p.revenuePaisa / 100), String(p.orders), String(p.codes), String(p.refundedPaisa / 100)])]
    rows.push([], ["Product", "Amount", `${revenueLabel} (NPR)`, "Orders", "Codes"], ...report.byProduct.map((p) => [p.productName, p.denomination, String(p.revenuePaisa / 100), String(p.orders), String(p.codes)]))
    const blob = new Blob([rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${csvName}-${shownFrom}-to-${to}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const t = report?.totals
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className={`${amberCard} p-3 sm:p-4 flex flex-col lg:flex-row lg:items-end gap-3`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1">
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider">Period</span>
            <select value={preset} onChange={(e) => pick(e.target.value)} className={`flex w-full border px-3 text-sm ${inputCls}`}>
              {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider">From</span>
            <Input type="date" value={joined && from < joined ? joined : from} min={joined || undefined} max={to} onChange={(e) => { setPreset("custom"); setRange([e.target.value, to]) }} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider">To</span>
            <Input type="date" value={to} min={from} max={today()} onChange={(e) => { setPreset("custom"); setRange([from, e.target.value]) }} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[#92400E] uppercase tracking-wider">Group by</span>
            <select value={bucket} onChange={(e) => setBucket(e.target.value as Bucket)} className={`flex w-full border px-3 text-sm ${inputCls}`}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!report} className="h-10 border-[#F59E0B] text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold shrink-0">
          <Download className="h-4 w-4 mr-1.5" />Export CSV
        </Button>
      </div>
      {invalid && <p className="text-sm text-red-600">Pick a valid range of up to 2 years.</p>}

      {report === undefined ? (
        <div className="text-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto" /></div>
      ) : !report || !t ? (
        <p className="text-sm text-[#4B5563] text-center py-12">Couldn&apos;t load this report.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard label={revenueLabel} value={npr(t.revenuePaisa)} hint={<Delta now={t.revenuePaisa} before={report.previous.revenuePaisa} />} valueCls="text-[#7E3AF2]" />
            <StatCard label="Orders" value={t.orders.toLocaleString()} hint={<Delta now={t.orders} before={report.previous.orders} />} />
            <StatCard label="Codes Delivered" value={t.codes.toLocaleString()} hint={`Avg order ${npr(t.orders ? Math.round(t.revenuePaisa / t.orders) : 0)}`} />
            <StatCard label="Refunded" value={npr(t.refundedPaisa)} hint={showDiscount ? `Discount given ${npr(t.savedPaisa)}` : `${t.refundedPaisa ? "Returned to wallet" : "No refunds"}`} valueCls={t.refundedPaisa ? "text-amber-600" : "text-[#1F2937]"} />
          </div>

          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">{revenueLabel} by {bucket}</CardTitle>
              <CardDescription className="text-[#92400E]">
                {label(shownFrom, "day", true)} to {label(to, "day", true)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="h-[280px] w-full bg-white rounded-lg border border-[#F59E0B]/20 p-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revReport" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7E3AF2" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#7E3AF2" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} tickMargin={8} minTickGap={16} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} width={72} tickFormatter={(v) => (v >= 1000 ? `Rs. ${v / 1000}k` : `Rs. ${v}`)} />
                      <YAxis yAxisId="orders" orientation="right" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#0EA5E9", fontSize: 12 }} width={30} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", backgroundColor: "#ffffff" }}
                        cursor={{ fill: "#7E3AF2", fillOpacity: 0.05 }}
                        formatter={(value, name) => { const n = Number(value ?? 0); return name === "orders" ? [`${n} ${n === 1 ? "order" : "orders"}`, "Orders"] : [`Rs. ${n.toLocaleString("en-IN")}`, revenueLabel] }}
                        labelStyle={{ fontWeight: "bold", color: "#1F2937" }}
                      />
                      <Bar yAxisId="orders" dataKey="orders" fill="#0EA5E9" fillOpacity={0.25} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Area type="monotoneX" dataKey="revenue" stroke="#7E3AF2" strokeWidth={2.5} fill="url(#revReport)" dot={false} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
            <Card className={`${amberCard} overflow-hidden`}>
              <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
                <CardTitle className="text-[#1F2937] text-lg font-bold">{bucket === "month" ? "Month-wise" : bucket === "week" ? "Week-wise" : "Day-wise"} breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <div className="overflow-x-auto rounded-lg border border-[#F59E0B]/20 bg-white">
                  <Table>
                    <TableHeader className="bg-[#FEF7E0]/40">
                      <TableRow>{["Period", revenueLabel, "Orders", "Codes"].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.pageItems.map((p) => (
                        <TableRow key={p.bucket} className="border-b border-gray-100">
                          <TableCell className="text-sm py-2.5">{label(p.bucket, report.bucket, true)}</TableCell>
                          <TableCell className="text-sm font-bold py-2.5">{npr(p.revenuePaisa)}{p.refundedPaisa ? <span className="block text-[11px] font-medium text-amber-600">−{npr(p.refundedPaisa)} refunded</span> : null}</TableCell>
                          <TableCell className="text-sm py-2.5">{p.orders}</TableCell>
                          <TableCell className="text-sm py-2.5">{p.codes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pager page={periods.page} total={periods.total} onPage={periods.setPage} />
              </CardContent>
            </Card>

            <Card className={`${amberCard} overflow-hidden`}>
              <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
                <CardTitle className="text-[#1F2937] text-lg font-bold">By product</CardTitle>
                <CardDescription className="text-[#92400E]">Top amounts in this period</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {report.byProduct.length === 0 ? (
                  <p className="text-sm text-[#4B5563] text-center py-10">No sales in this period.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-[#F59E0B]/20 bg-white">
                      <Table>
                        <TableHeader className="bg-[#FEF7E0]/40">
                          <TableRow>{["Product", revenueLabel, "Codes"].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}</TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.pageItems.map((p) => (
                            <TableRow key={`${p.productId}-${p.denomination}`} className="border-b border-gray-100">
                              <TableCell className="py-2.5"><div className="text-sm font-semibold text-[#1F2937]">{p.productName}</div><div className="text-xs text-[#6B7280]">{p.denomination}</div></TableCell>
                              <TableCell className="text-sm font-bold py-2.5">{npr(p.revenuePaisa)}<span className="block text-[11px] font-medium text-[#6B7280]">{t.revenuePaisa ? Math.round((p.revenuePaisa / t.revenuePaisa) * 100) : 0}% of total</span></TableCell>
                              <TableCell className="text-sm py-2.5">{p.codes}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Pager page={products.page} total={products.total} onPage={products.setPage} />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
