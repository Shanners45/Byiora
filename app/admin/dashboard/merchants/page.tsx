"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Store, RefreshCw, ClipboardList, Wallet, Package, TrendingUp, ChevronRight, Search, QrCode, FileText, Headset, Hourglass, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminSession } from "@/lib/admin-session-context"
import { createClient } from "@/lib/supabase/client"
import { useRealtimePings } from "@/lib/realtime/use-pings"
import { RevenueReport } from "@/components/merchant/revenue-report"
import {
  listMerchantsAction,
  listPendingTopupsAction,
  listPendingMerchantOrdersAction,
  type AdminOrderRow,
  getTopupSettingsAction,
  updateTopupSettingsAction,
  getMerchantCatalogAdminAction,
  setMerchantCatalogAction,
  getMerchantRevenueReportAction,
  type MerchantListRow,
  type AdminTopup,
  type CatalogProductRow,
} from "@/app/actions/merchant-admin"
import type { TopupSettings } from "@/lib/merchant/reports"
import { listSupportBySellerAction } from "@/app/actions/merchant-support"
import { SupportTab } from "./support-tab"
import { NotificationsTab } from "./notifications-tab"
import { amberCard, FillOrderButton, InviteDialog, inputCls, KYC_STYLE, npr, pill, STATUS_STYLE, tabCls, TopupCard, formatAmountInput } from "./shared"
import { Pager, usePaged } from "@/components/merchant/pager"

function TopupSettingsCard({ refreshKey }: { refreshKey: number }) {
  const [s, setS] = useState<TopupSettings | null>(null)
  const [limits, setLimits] = useState({ min: "", max: "" })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getTopupSettingsAction().then((r) => {
      if (!r) return
      setS(r)
      setLimits({
        min: formatAmountInput(String(r.fonepay_topup_min_rupees), false),
        max: formatAmountInput(String(r.fonepay_topup_max_rupees), false),
      })
    })
  }, [refreshKey])

  const save = async (patch: Partial<TopupSettings>) => {
    setBusy(true)
    const res = await updateTopupSettingsAction(patch)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setS((cur) => (cur ? { ...cur, ...patch } : cur))
    toast.success("Saved. Merchants see the change immediately.")
  }

  const handleSaveLimits = () => {
    const minVal = Number(limits.min.replace(/,/g, ""))
    const maxVal = Number(limits.max.replace(/,/g, ""))
    if (minVal <= 0 || maxVal <= 0) return toast.error("Enter valid limit amounts.")
    if (minVal > maxVal) return toast.error("Min cannot exceed Max.")
    save({ fonepay_topup_min_rupees: minVal, fonepay_topup_max_rupees: maxVal })
  }

  if (!s) return null
  return (
    <Card className={`${amberCard} overflow-hidden`}>
      <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
        <CardTitle className="text-[#1F2937] text-lg font-bold">Wallet top-up methods</CardTitle>
        <CardDescription className="text-[#92400E]">Choose how merchants can add money to their wallets</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#F59E0B]/20 bg-white p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><QrCode className="h-5 w-5 text-[#7E3AF2]" /></div>
              <div>
                <p className="text-sm font-bold text-[#1F2937]">Fonepay QR</p>
                <p className="text-xs text-[#4B5563]">Instant and automatic. Uses the same Fonepay account and bank verification as customer checkout.</p>
              </div>
            </div>
            <Switch checked={s.fonepay_topup_enabled} disabled={busy} onCheckedChange={(on) => save({ fonepay_topup_enabled: on })} aria-label="Fonepay wallet top-up" />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7280]">Min (Rs.)</span>
              <Input
                type="text"
                inputMode="numeric"
                value={limits.min}
                onChange={(e) => setLimits({ ...limits, min: formatAmountInput(e.target.value, false) })}
                className={`${inputCls} h-9`}
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7280]">Max per QR (Rs.)</span>
              <Input
                type="text"
                inputMode="numeric"
                value={limits.max}
                onChange={(e) => setLimits({ ...limits, max: formatAmountInput(e.target.value, false) })}
                className={`${inputCls} h-9`}
              />
            </label>
            <Button size="sm" variant="outline" disabled={busy} className="h-9 bg-white" onClick={handleSaveLimits}>Save</Button>
          </div>
        </div>
        <div className="rounded-xl border border-[#F59E0B]/20 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-[#B45309]" /></div>
              <div>
                <p className="text-sm font-bold text-[#1F2937]">Manual wallet top-up</p>
                <p className="text-xs text-[#4B5563]">Merchant pays you directly and submits the reference and receipt. You approve it in the Top-ups tab.</p>
              </div>
            </div>
            <Switch checked={s.manual_topup_enabled} disabled={busy} onCheckedChange={(on) => save({ manual_topup_enabled: on })} aria-label="Manual wallet top-up" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GlobalCatalog({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<CatalogProductRow[] | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await getMerchantCatalogAdminAction()
    if (!res.success) return toast.error(res.error)
    setRows(res.data)
  }, [])
  useEffect(() => { load() }, [load, refreshKey])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows || []).filter((r) => (!needle || r.name.toLowerCase().includes(needle)) && (filter === "all" || (filter === "on") === r.enabled))
  }, [rows, q, filter])
  const paged = usePaged(shown)

  const set = async (ids: string[], enabled: boolean) => {
    if (!ids.length) return
    setBusy(true)
    const res = await setMerchantCatalogAction(ids, enabled)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setRows((cur) => (cur || []).map((r) => (ids.includes(r.id) ? { ...r, enabled } : r)))
    setSelected(new Set())
    toast.success(`${ids.length} product${ids.length === 1 ? "" : "s"} ${enabled ? "shown to" : "hidden from"} merchants`)
  }

  if (!rows) return <p className="text-center text-sm text-[#4B5563] py-10">Loading products...</p>
  const on = rows.filter((r) => r.enabled).length

  return (
    <Card className={`${amberCard} overflow-hidden`}>
      <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
        <CardTitle className="text-[#1F2937] text-lg font-bold">Products for merchants ({on} of {rows.length} on)</CardTitle>
        <CardDescription className="text-[#92400E]">Off = no merchant can see or buy it, whatever their own settings. New products start off. Fine-tune per merchant in their Products &amp; pricing tab. Game top-ups (player ID) are coming soon for merchants and can't be turned on yet; merchants see them as &quot;Coming soon&quot;.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 pl-9 bg-white`} aria-label="Search products" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`h-10 border px-3 text-sm bg-white ${inputCls}`} aria-label="Filter">
            <option value="all">All</option>
            <option value="on">Shown to merchants</option>
            <option value="off">Hidden from merchants</option>
          </select>
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
            <span className="text-sm font-bold text-purple-900">{selected.size} selected</span>
            <Button size="sm" disabled={busy} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => set([...selected], true)}>Show to merchants</Button>
            <Button size="sm" disabled={busy} variant="outline" className="h-8 bg-white border-red-300 text-red-700" onClick={() => set([...selected], false)}>Hide from merchants</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
        <div className="rounded-lg border border-[#F59E0B]/20 bg-white divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 bg-[#FEF7E0]/60 text-[11px] font-bold uppercase tracking-wider text-[#1F2937]">
            <input type="checkbox" aria-label="Select all shown" checked={shown.length > 0 && shown.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} className="h-4 w-4 accent-[#7E3AF2]" />
            <span className="flex-1">Product ({shown.length})</span>
            <span>Merchants can see</span>
          </div>
          {paged.pageItems.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })} className="h-4 w-4 accent-[#7E3AF2]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.logo ? <img src={r.logo} alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain bg-[#F9FAFB] border border-gray-100" loading="lazy" /> : <div className="h-8 w-8 rounded-md bg-purple-50" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1F2937] truncate">{r.name}</p>
                <p className="text-[11px] text-[#6B7280] capitalize">{r.category.replace(/-/g, " ")} · {r.denominations} amounts</p>
              </div>
              <Switch checked={r.enabled} disabled={busy} onCheckedChange={(v) => set([r.id], v)} aria-label={`Show ${r.name} to merchants`} />
            </div>
          ))}
        </div>
        <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />
      </CardContent>
    </Card>
  )
}

function MerchantTable({ rows, empty }: { rows: MerchantListRow[]; empty: string }) {
  const router = useRouter()
  const paged = usePaged(rows)
  if (!rows.length) return <p className="text-center text-sm text-[#4B5563] py-12">{empty}</p>
  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-[#F59E0B]/20 bg-white shadow-xs">
      <Table className="min-w-[820px]">
        <TableHeader className="bg-[#FEF7E0]/40 border-b-2 border-[#F59E0B]/20">
          <TableRow>
            {["Business", "Status", "KYC", "Wallet", "Revenue", ""].map((h) => (
              <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.pageItems.map((m) => (
            <TableRow key={m.id} onClick={() => router.push(`/admin/dashboard/merchants/${m.id}`)} className="hover:bg-[#FEF7E0]/50 transition-colors border-b border-gray-100 cursor-pointer">
              <TableCell className="py-3.5">
                <div className="font-semibold text-[#1F2937]">{m.business_name}</div>
                <div className="text-xs text-[#6B7280]">{m.contact_name} · {m.email}</div>
              </TableCell>
              <TableCell className="py-3.5">{pill(STATUS_STYLE[m.status])}</TableCell>
              <TableCell className="py-3.5">{pill(KYC_STYLE[m.kyc_status])}</TableCell>
              <TableCell className="py-3.5">
                <div className="text-sm font-semibold text-[#1F2937]">{npr(m.wallet_balance_paisa)}</div>
                {m.pending_topups > 0 && <div className="text-xs font-semibold text-[#7E3AF2]">{m.pending_topups} top-up pending</div>}
              </TableCell>
              <TableCell className="py-3.5">
                <div className="text-sm font-bold text-[#1F2937]">{npr(m.revenue_paisa)}</div>
                <div className="text-xs text-[#6B7280]">{npr(m.month_revenue_paisa)} this month · {m.orders} orders</div>
              </TableCell>
              <TableCell className="text-right py-3.5">
                <Link href={`/admin/dashboard/merchants/${m.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center h-8 px-3 rounded-lg text-xs border border-[#F59E0B]/40 text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold shadow-sm">
                  Open<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />
    </>
  )
}

function TopupQueue({ topups, onChanged }: { topups: AdminTopup[]; onChanged: () => void }) {
  const paged = usePaged(topups)
  if (!topups.length) return <p className="text-center text-sm text-[#4B5563] py-12">No top-ups waiting.</p>
  return (
    <>
      {paged.pageItems.map((t) => <TopupCard key={t.id} t={t} showMerchant onChanged={onChanged} />)}
      <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />
    </>
  )
}

export default function MerchantsPage() {
  const admin = useAdminSession()
  const [rows, setRows] = useState<MerchantListRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [topups, setTopups] = useState<AdminTopup[]>([])
  const [openTickets, setOpenTickets] = useState(0)
  const [pending, setPending] = useState<(AdminOrderRow & { merchantId: string; businessName: string })[]>([])
  const [q, setQ] = useState("")
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState("all")
  // Deep links: ?tab=support|notifications|…, ?ticket=<id> opens Support, ?to=<merchant> opens Notifications.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const t = p.get("tab") || (p.get("ticket") ? "support" : p.get("to") ? "notifications" : null)
    if (t) setTab(t)
  }, [])

  const load = useCallback(async () => {
    const [res, tq, sup, po] = await Promise.all([listMerchantsAction(), listPendingTopupsAction(), listSupportBySellerAction(1, "open"), listPendingMerchantOrdersAction()])
    if (!res.success) return toast.error(res.error)
    setRows(res.data)
    if (tq.success) setTopups(tq.data)
    if (sup) setOpenTickets(sup.counts.open || 0)
    if (po.success) setPending(po.rows)
  }, [])
  useEffect(() => { load() }, [load])
  useRealtimePings(createClient(), "admin:merchants", () => {
    load()
    setTick((t) => t + 1)
  })

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setTick((t) => t + 1)
    setRefreshing(false)
  }
  const loadAllRevenue = useCallback((from: string, to: string, bucket: "day" | "week" | "month", tz: string) => getMerchantRevenueReportAction(null, from, to, bucket, tz), [])

  if (admin && admin.role !== "admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h1 className="text-2xl font-bold tracking-tight text-red-700">Access Denied</h1>
        <p className="text-red-600 mt-2">Merchant management is restricted to full administrators.</p>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
        <p className="text-[#4B5563]">Loading merchants...</p>
      </div>
    )
  }

  const needle = q.trim().toLowerCase()
  const filtered = needle ? rows.filter((r) => `${r.business_name} ${r.contact_name} ${r.email}`.toLowerCase().includes(needle)) : rows
  const queue = rows.filter((r) => r.kyc_status === "submitted")
  const stats = [
    { label: "Merchant Revenue", value: npr(rows.reduce((s, r) => s + r.revenue_paisa, 0)), cls: "text-[#7E3AF2]", hint: "All time" },
    { label: "This Month", value: npr(rows.reduce((s, r) => s + r.month_revenue_paisa, 0)), cls: "text-[#1F2937]", hint: `${rows.filter((r) => r.month_revenue_paisa > 0).length} merchants ordered` },
    { label: "Merchants", value: rows.length, cls: "text-[#1F2937]", hint: `${rows.filter((r) => r.kyc_status === "approved").length} verified · ${queue.length} awaiting KYC` },
    { label: "Wallet Float", value: npr(rows.reduce((s, r) => s + r.wallet_balance_paisa, 0)), cls: "text-emerald-600", hint: topups.length ? `${topups.length} top-ups to review` : "Prepaid, not yet spent" },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937]">Merchants</h1>
          <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">Sellers, their prices and products, wallets and the revenue they bring in. Updates live.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="border-[#F59E0B] text-[#92400E] bg-[#FEF7E0] hover:bg-[#FEF7E0]/80 font-semibold shadow-xs h-9 px-3.5 text-xs sm:text-sm">
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <InviteDialog onInvited={load} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className={amberCard}>
            <CardContent className="p-3 sm:p-5">
              <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider truncate">{s.label}</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 truncate ${s.cls}`}>{s.value}</p>
              <p className="text-[11px] sm:text-xs text-[#6B7280] mt-1 truncate">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5 sm:space-y-6 w-full min-w-0">
        <div className="w-full overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-auto justify-start bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl shadow-xs gap-1">
            <TabsTrigger value="all" className={tabCls}><Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />All Merchants ({rows.length})</TabsTrigger>
            <TabsTrigger value="queue" className={tabCls}>
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />KYC Queue ({queue.length})
              {queue.length > 0 && <span className="ml-0.5 h-2 w-2 rounded-full bg-red-600" />}
            </TabsTrigger>
            <TabsTrigger value="topups" className={tabCls}>
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Top-ups ({topups.length})
              {topups.length > 0 && <span className="ml-0.5 h-2 w-2 rounded-full bg-red-600" />}
            </TabsTrigger>
            <TabsTrigger value="pending" className={tabCls}>
              <Hourglass className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Pending orders ({pending.length})
              {pending.length > 0 && <span className="ml-0.5 h-2 w-2 rounded-full bg-red-600" />}
            </TabsTrigger>
            <TabsTrigger value="catalog" className={tabCls}><Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Products for Merchants</TabsTrigger>
            <TabsTrigger value="revenue" className={tabCls}><TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Revenue</TabsTrigger>
            <TabsTrigger value="support" className={tabCls}>
              <Headset className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Support
              {openTickets ? <span className="ml-1 rounded-full bg-red-600 text-white text-[11px] font-bold px-1.5 leading-none py-0.5">{openTickets}</span> : null}
            </TabsTrigger>
            <TabsTrigger value="notifications" className={tabCls}><Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Notifications</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-[#1F2937] text-lg font-bold">Merchant Directory</CardTitle>
                <CardDescription className="text-[#92400E]">Click a merchant to manage their prices, products, wallet and orders</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search merchants" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 pl-9 bg-white`} aria-label="Search merchants" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <MerchantTable rows={filtered} empty={rows.length ? "No merchants match." : "No merchants yet. Invite your first seller."} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">KYC Review Queue</CardTitle>
              <CardDescription className="text-[#92400E]">Open a merchant and use the Verification tab to approve or reject</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <MerchantTable rows={queue} empty="Nothing waiting for review." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topups" className="space-y-5 sm:space-y-6">
          <TopupSettingsCard refreshKey={tick} />
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">Manual top-up requests</CardTitle>
              <CardDescription className="text-[#92400E]">Approve only after the money is in your account. Fonepay top-ups are credited automatically and don&apos;t appear here.</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 space-y-3">
              <TopupQueue topups={topups} onChanged={load} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">Orders waiting for codes</CardTitle>
              <CardDescription className="text-[#92400E]">API orders placed while out of stock. The merchant already paid. Fill each one with codes, or open the merchant and refund it from the Orders tab.</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {pending.length === 0 ? <p className="text-sm text-[#4B5563] text-center py-8">Nothing waiting. Every order has its codes.</p> : (
                <PendingList rows={pending} onDone={load} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog"><GlobalCatalog refreshKey={tick} /></TabsContent>
        <TabsContent value="revenue"><RevenueReport load={loadAllRevenue} refreshKey={tick} showDiscount csvName="all-merchants-revenue" /></TabsContent>
        <TabsContent value="support"><SupportTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function PendingList({ rows, onDone }: { rows: (AdminOrderRow & { merchantId: string; businessName: string })[]; onDone: () => void }) {
  const { page, setPage, pageItems: slice } = usePaged(rows)
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <Table className="min-w-[820px]">
          <TableHeader className="bg-[#FEF7E0]/40">
            <TableRow>{["Waiting since", "Merchant", "Product", "Customer", "Paid", ""].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((o) => (
              <TableRow key={o.id} className="border-b border-gray-100">
                <TableCell className="text-xs text-[#4B5563] py-3">{new Date(o.createdAt).toLocaleString()}</TableCell>
                <TableCell className="py-3"><Link href={`/admin/dashboard/merchants/${o.merchantId}`} className="text-sm font-semibold text-[#7E3AF2] hover:underline">{o.businessName}</Link></TableCell>
                <TableCell className="py-3"><div className="text-sm font-semibold text-[#1F2937]">{o.product}</div><div className="text-xs text-[#6B7280]">{o.denomination} × {o.quantity}{o.clientRef ? ` · ref ${o.clientRef}` : ""}</div></TableCell>
                <TableCell className="py-3 text-xs text-[#6B7280]">{o.customer?.email || "—"}</TableCell>
                <TableCell className="py-3 text-sm font-bold">{npr(o.totalPaisa)}</TableCell>
                <TableCell className="py-3 text-right"><FillOrderButton order={o} onDone={onDone} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager page={page} total={rows.length} onPage={setPage} />
    </>
  )
}
