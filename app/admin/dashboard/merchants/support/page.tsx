"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Search, Send, CheckCircle2, ExternalLink, Headset } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAdminSession } from "@/lib/admin-session-context"
import { createClient } from "@/lib/supabase/client"
import { useRealtimePings } from "@/lib/realtime/use-pings"
import { getTicketAdminAction, listSupportBySellerAction, replyTicketAdminAction, updateTicketAdminAction, type SellerTickets } from "@/app/actions/merchant-support"
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS, type TicketMessage, type TicketRow } from "@/lib/merchant/support"
import { Pager } from "@/components/merchant/pager"
import { amberCard, fmtDate, inputCls, pill } from "../shared"

type Filter = "active" | "open" | "awaiting_merchant" | "resolved" | "closed" | "all"
const FILTERS: [Filter, string][] = [["active", "Needs attention"], ["open", "Open"], ["awaiting_merchant", "Waiting for merchant"], ["resolved", "Resolved"], ["closed", "Closed"], ["all", "All"]]

function TicketDialog({ id, onClose, refreshKey, onChanged }: { id: string | null; onClose: () => void; refreshKey: number; onChanged: () => void }) {
  const [data, setData] = useState<{ ticket: TicketRow & { email: string }; messages: TicketMessage[] } | null>(null)
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { if (id) getTicketAdminAction(id).then(setData) }, [id])
  useEffect(() => { setData(null); setReply(""); load() }, [load])
  useEffect(() => { if (id) load() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null

  const send = async (next: "awaiting_merchant" | "resolved") => {
    setBusy(true)
    const res = await replyTicketAdminAction(id, reply, next)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(next === "resolved" ? "Replied and resolved. The merchant was emailed." : "Reply sent. The merchant was emailed.")
    setReply("")
    load()
    onChanged()
  }
  const update = async (patch: { status?: string; priority?: string }) => {
    const res = await updateTicketAdminAction(id, patch)
    if (!res.success) return toast.error(res.error)
    load()
    onChanged()
  }
  const t = data?.ticket

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-3xl rounded-2xl bg-white p-0 shadow-xl border-2 border-[#F59E0B]/30 max-h-[92vh] flex flex-col overflow-hidden">
        {!t ? <p className="p-10 text-center text-sm text-[#4B5563]">Loading ticket...</p> : (
          <>
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-100 space-y-2">
              <DialogTitle className="text-lg font-bold text-[#1F2937] pr-6">#{t.number} · {t.subject}</DialogTitle>
              <DialogDescription className="sr-only">#{t.number} · {t.subject} details</DialogDescription>
              <div className="space-y-2 text-xs text-[#4B5563]">
                <p>
                  <span className="font-semibold text-[#1F2937]">{t.businessName}</span> · <span className="text-[#4B5563]">{t.email}</span> · <span className="text-[#4B5563]">{TICKET_CATEGORIES[t.category]}</span>
                  {t.orderRef ? <> · Order <span className="font-mono text-[#4B5563]">{t.orderRef}</span></> : null} · <span className="text-[#6B7280]">Opened {fmtDate(t.createdAt)}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={t.status} onChange={(e) => update({ status: e.target.value })} className="h-8 rounded-xl border-2 border-[#F59E0B]/30 bg-white px-2.5 text-xs font-semibold text-[#1F2937] focus:border-[#F59E0B] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" aria-label="Status">
                      {Object.entries(TICKET_STATUS).map(([v, [l]]) => <option key={v} value={v}>{l === "Waiting for you" ? "Waiting for merchant" : l}</option>)}
                    </select>
                    <select value={t.priority} onChange={(e) => update({ priority: e.target.value })} className="h-8 rounded-xl border-2 border-[#F59E0B]/30 bg-white px-2.5 text-xs font-semibold text-[#1F2937] focus:border-[#F59E0B] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20 transition-all" aria-label="Priority">
                      {Object.entries(TICKET_PRIORITY).map(([v, [l]]) => <option key={v} value={v}>{l} priority</option>)}
                    </select>
                    {t.merchantId && <Link href={`/admin/dashboard/merchants/${t.merchantId}?tab=orders`} className="inline-flex items-center gap-1 font-semibold text-[#7E3AF2] hover:underline"><ExternalLink className="h-3.5 w-3.5" />Merchant&apos;s orders</Link>}
                  </div>
                </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#F9FAFB]">
              {data.messages.map((m) => (
                <div key={m.id} className={`flex ${m.authorType === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.authorType === "admin" ? "bg-[#7E3AF2] text-white rounded-br-md" : "bg-white border border-[#F59E0B]/30 text-[#1F2937] rounded-bl-md"}`}>
                    <p className={`text-[11px] font-semibold mb-1 ${m.authorType === "admin" ? "text-white/80" : "text-[#92400E]"}`}>{m.authorType === "admin" ? "Byiora" : t.businessName} · {fmtDate(m.createdAt)}</p>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 space-y-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Reply to the merchant (they're emailed and see it in their portal)"
                className="w-full rounded-xl border-2 border-[#F59E0B]/30 bg-white p-3 text-sm text-[#1F2937] placeholder:text-gray-400 focus:border-[#F59E0B] focus-visible:border-[#F59E0B] focus-visible:ring-2 focus-visible:ring-[#F59E0B]/20 focus-visible:ring-offset-0 transition-all"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={busy || !reply.trim()} onClick={() => send("resolved")} className="h-9 bg-white border-2 border-[#F59E0B]/30 hover:bg-[#FEF7E0]/50 text-[#1F2937] rounded-xl"><CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />Reply and resolve</Button>
                <Button disabled={busy || !reply.trim()} onClick={() => send("awaiting_merchant")} className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold rounded-xl shadow-sm"><Send className="h-4 w-4 mr-1.5" />{busy ? "Sending…" : "Send reply"}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SellerCard({ s, onOpen }: { s: SellerTickets; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? s.tickets : s.tickets.slice(0, 5)
  return (
    <div className={`${amberCard} overflow-hidden`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-[#F59E0B]/20">
        <div className="min-w-0">
          <p className="font-bold text-[#1F2937] truncate">{s.businessName}</p>
          <p className="text-xs text-[#6B7280] truncate">{s.email} · {s.tickets.length} ticket{s.tickets.length === 1 ? "" : "s"}{s.open ? ` · ${s.open} open` : ""}</p>
        </div>
        <Link href={`/admin/dashboard/merchants/${s.merchantId}`} className="text-xs font-semibold text-[#7E3AF2] hover:underline shrink-0">Open merchant</Link>
      </div>
      <div className="divide-y divide-gray-100 bg-white">
        {shown.map((t) => (
          <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="w-full text-left flex flex-col md:flex-row md:items-center justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-[#FEF7E0]/50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1F2937] truncate">#{t.number} · {t.subject}</p>
              <p className="text-xs text-[#6B7280]">{TICKET_CATEGORIES[t.category]}{t.orderRef ? ` · Order ${t.orderRef.slice(0, 13)}` : ""} · {t.lastMessageBy === "merchant" ? "Merchant replied" : "You replied"} {fmtDate(t.lastMessageAt)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.priority !== "normal" && pill(TICKET_PRIORITY[t.priority])}
              {pill(t.status === "awaiting_merchant" ? ["Waiting for merchant", TICKET_STATUS.awaiting_merchant[1]] : TICKET_STATUS[t.status])}
            </div>
          </button>
        ))}
        {s.tickets.length > 5 && (
          <button type="button" onClick={() => setAll(!all)} className="w-full py-2 text-xs font-semibold text-[#7E3AF2] hover:bg-[#F5F0FB]">{all ? "Show fewer" : `Show all ${s.tickets.length}`}</button>
        )}
      </div>
    </div>
  )
}

export default function MerchantSupportAdmin() {
  const admin = useAdminSession()
  const [filter, setFilter] = useState<Filter>("active")
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [data, setData] = useState<{ sellers: SellerTickets[]; totalSellers: number; counts: Record<string, number> } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => { const t = setTimeout(() => { setSearch(q); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(() => listSupportBySellerAction(page, filter, search).then((d) => d && setData(d)), [page, filter, search])
  useEffect(() => { load() }, [load])
  useRealtimePings(createClient(), "admin:merchants", () => { load(); setTick((t) => t + 1) })

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ticket")
    if (id) setViewing(id)
  }, [])

  if (admin && admin.role !== "admin") {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-6"><h1 className="text-2xl font-bold text-red-700">Access Denied</h1></div>
  }
  if (!data) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
        <p className="text-[#4B5563]">Loading support...</p>
      </div>
    )
  }
  const c = data.counts
  const countFor = (f: Filter) => (f === "active" ? (c.open || 0) + (c.awaiting_merchant || 0) : f === "all" ? Object.values(c).reduce((a, b) => a + b, 0) : c[f] || 0)

  return (
    <div className="space-y-5 sm:space-y-6">
      <Link href="/admin/dashboard/merchants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7E3AF2] hover:underline"><ArrowLeft className="h-4 w-4" />All merchants</Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937]">Merchant Support</h1>
        <p className="text-xs sm:text-sm text-[#4B5563] mt-0.5">Problems raised by sellers about orders, refunds, wallets, limits and the API, grouped by seller. Updates live.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[["Open", c.open || 0, "text-[#7E3AF2]"], ["Waiting for merchant", c.awaiting_merchant || 0, "text-amber-600"], ["Resolved", c.resolved || 0, "text-emerald-600"], ["Closed", c.closed || 0, "text-[#1F2937]"]].map(([l, v, cls]) => (
          <div key={l as string} className={`${amberCard} p-3 sm:p-5`}>
            <p className="text-[10px] sm:text-xs font-bold text-[#92400E] uppercase tracking-wider">{l}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${cls}`}>{v as number}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="w-full lg:w-auto overflow-x-auto [scrollbar-width:none]">
          <div className="inline-flex bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl gap-1">
            {FILTERS.map(([f, l]) => (
              <button key={f} type="button" onClick={() => { setFilter(f); setPage(1) }} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${filter === f ? "bg-[#F59E0B] text-white shadow-sm" : "text-[#92400E] hover:text-[#B45309]"}`}>
                {l} ({countFor(f)})
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Seller, subject, #number or order"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-[#F59E0B]/30 bg-white text-sm text-[#1F2937] placeholder:text-gray-400 focus:border-[#F59E0B] focus-visible:border-[#F59E0B] focus-visible:ring-2 focus-visible:ring-[#F59E0B]/20 focus-visible:ring-offset-0 transition-all"
            aria-label="Search tickets"
          />
        </div>
      </div>

      {data.sellers.length === 0 ? (
        <div className={`${amberCard} text-center py-14`}>
          <Headset className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#1F2937]">{search ? "No tickets match." : "No tickets here."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.sellers.map((s) => <SellerCard key={s.merchantId} s={s} onOpen={setViewing} />)}
          <Pager page={page} total={data.totalSellers} onPage={setPage} />
        </div>
      )}

      <TicketDialog id={viewing} onClose={() => setViewing(null)} refreshKey={tick} onChanged={load} />
    </div>
  )
}
