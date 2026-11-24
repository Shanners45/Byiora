"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Headset, Plus, Send, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMerchantState } from "@/lib/merchant/context"
import { createTicketAction, getMyTicketAction, listMyTicketsAction, replyMyTicketAction, resolveMyTicketAction } from "@/app/actions/merchant-support"
import { TICKET_CATEGORIES, TICKET_STATUS, type TicketMessage, type TicketRow } from "@/lib/merchant/support"
import { Pager } from "@/components/merchant/pager"
import { amberCard, fmtDateTime, inputCls, PageHeader, primaryBtn, Spinner } from "@/components/merchant/ui"

const pill = ([t, c]: [string, string]) => <span className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${c}`}>{t}</span>
const labelCls = "text-sm font-semibold text-[#1F2937]"

function NewTicketDialog({ open, onOpenChange, initialOrder, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initialOrder: string; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ category: initialOrder ? "order" : "", subject: "", orderRef: initialOrder, body: "" })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setForm({ category: initialOrder ? "order" : "", subject: "", orderRef: initialOrder, body: "" }) }, [open, initialOrder])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await createTicketAction(form)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Ticket opened. We'll reply here and by email.")
    onOpenChange(false)
    onCreated(res.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1F2937]">New support ticket</DialogTitle>
          <DialogDescription className="text-xs text-[#4B5563]">Tell us what went wrong. Include the order ID for order or refund problems so we can find it quickly.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className={labelCls}>What is it about? *</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className={`flex w-full border px-3 text-sm ${inputCls}`}>
              <option value="" disabled>Choose…</option>
              {Object.entries(TICKET_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Subject *</span>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required maxLength={150} placeholder="e.g. Order BYI-… code shows an error" className={inputCls} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Order ID or reference</span>
            <Input value={form.orderRef} onChange={(e) => setForm({ ...form, orderRef: e.target.value })} maxLength={100} placeholder="From your Orders page or API response" className={`${inputCls} font-mono`} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelCls}>Details *</span>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required rows={5} maxLength={5000} placeholder="What happened, when, and what you expected." className={inputCls.replace("h-10", "")} />
          </label>
          <Button type="submit" disabled={busy} className={`w-full h-11 rounded-xl ${primaryBtn}`}>{busy ? "Sending…" : "Open ticket"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TicketDialog({ id, onClose, tick, onChanged }: { id: string | null; onClose: () => void; tick: number; onChanged: () => void }) {
  const [data, setData] = useState<{ ticket: TicketRow; messages: TicketMessage[] } | null>(null)
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { if (id) getMyTicketAction(id).then(setData) }, [id])
  useEffect(() => { setData(null); setReply(""); load() }, [load])
  useEffect(() => { if (id) load() }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null

  const send = async () => {
    setBusy(true)
    const res = await replyMyTicketAction(id, reply)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setReply("")
    load()
    onChanged()
  }
  const resolve = async () => {
    const res = await resolveMyTicketAction(id)
    if (!res.success) return toast.error(res.error)
    toast.success("Marked as resolved")
    load()
    onChanged()
  }
  const t = data?.ticket
  const closed = t?.status === "closed"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-2xl rounded-2xl bg-white p-0 shadow-xl border-2 border-[#F59E0B]/30 max-h-[92vh] flex flex-col overflow-hidden">
        {!t ? <div className="p-10"><Spinner label="Loading ticket..." /></div> : (
          <>
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-100">
              <DialogTitle className="text-lg font-bold text-[#1F2937] pr-6">#{t.number} · {t.subject}</DialogTitle>
              <DialogDescription className="sr-only">Support ticket #{t.number} details</DialogDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563] font-medium mt-1">
                {pill(TICKET_STATUS[t.status])}
                <span className="text-[#4B5563]">{TICKET_CATEGORIES[t.category]}</span>
                {t.orderRef && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="font-mono text-[#4B5563]">Order {t.orderRef}</span>
                  </>
                )}
                <span className="text-gray-300">·</span>
                <span className="text-[#6B7280]">Opened {fmtDateTime(t.createdAt)}</span>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#F9FAFB]">
              {data.messages.map((m) => (
                <div key={m.id} className={`flex ${m.authorType === "merchant" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.authorType === "merchant" ? "bg-[#7E3AF2] text-white rounded-br-md" : "bg-white border border-[#F59E0B]/30 text-[#1F2937] rounded-bl-md"}`}>
                    <p className={`text-[11px] font-semibold mb-1 ${m.authorType === "merchant" ? "text-white/80" : "text-[#92400E]"}`}>{m.authorType === "merchant" ? "You" : "Byiora support"} · {fmtDateTime(m.createdAt)}</p>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 sm:p-5 border-t border-gray-100 space-y-2">
              {closed ? (
                <p className="text-sm text-[#4B5563] text-center">This ticket is closed. Open a new one if you need more help.</p>
              ) : (
                <>
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply…" className={inputCls.replace("h-10", "")} />
                  <div className="flex flex-wrap justify-between gap-2">
                    {t.status !== "resolved" ? <Button variant="outline" onClick={resolve} className="h-9 bg-white"><CheckCircle2 className="h-4 w-4 mr-1.5" />Problem solved</Button> : <span />}
                    <Button disabled={busy || !reply.trim()} onClick={send} className={`h-9 ${primaryBtn}`}><Send className="h-4 w-4 mr-1.5" />{busy ? "Sending…" : "Send reply"}</Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function MerchantSupport() {
  const { tick } = useMerchantState()
  const [data, setData] = useState<{ rows: TicketRow[]; total: number; openCount: number } | null>(null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<"active" | "all">("all")
  const [creating, setCreating] = useState(false)
  const [initialOrder, setInitialOrder] = useState("")
  const [viewing, setViewing] = useState<string | null>(null)

  const load = useCallback(() => listMyTicketsAction(page, filter).then((d) => d && setData(d)), [page, filter])
  useEffect(() => { load() }, [load, tick])
  // ?order=<id> from the Orders page opens a prefilled ticket.
  useEffect(() => {
    const order = new URLSearchParams(window.location.search).get("order")
    if (order) {
      setInitialOrder(order.slice(0, 100))
      setCreating(true)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  if (!data) return <Spinner label="Loading support..." />

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Support" subtitle="Problems with orders, refunds, your wallet, limits or the API. We reply here and by email.">
        <Button size="sm" onClick={() => { setInitialOrder(""); setCreating(true) }} className={`h-9 ${primaryBtn}`}><Plus className="h-4 w-4 mr-1.5" />New ticket</Button>
      </PageHeader>

      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-[#1F2937] text-lg font-bold">Your tickets</CardTitle>
            <CardDescription className="text-[#92400E]">{data.openCount ? `${data.openCount} open` : "Nothing open"}</CardDescription>
          </div>
          <div className="inline-flex rounded-lg border-2 border-[#F59E0B]/30 bg-white p-1 gap-1 self-start">
            {(["all", "active"] as const).map((f) => (
              <button key={f} type="button" onClick={() => { setFilter(f); setPage(1) }} className={`px-3 py-1 rounded-md text-xs font-bold ${filter === f ? "bg-[#F59E0B] text-white" : "text-[#92400E] hover:bg-[#FEF7E0]"}`}>{f === "all" ? "All" : "Open only"}</button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 space-y-2">
          {data.rows.length === 0 ? (
            <div className="text-center py-12">
              <Headset className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1F2937]">No tickets{filter === "active" ? " open" : " yet"}</p>
              <p className="text-xs text-[#4B5563] mt-1">Open one whenever something goes wrong with an order, refund or limit.</p>
            </div>
          ) : (
            <>
              {data.rows.map((t) => (
                <button key={t.id} type="button" onClick={() => setViewing(t.id)} className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#F59E0B]/20 bg-white p-3.5 hover:border-[#7E3AF2]/40 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1F2937] truncate">#{t.number} · {t.subject}</p>
                    <p className="text-xs text-[#6B7280]">{TICKET_CATEGORIES[t.category]}{t.orderRef ? ` · Order ${t.orderRef.slice(0, 12)}` : ""} · Updated {fmtDateTime(t.lastMessageAt)}{t.lastMessageBy === "admin" && t.status === "awaiting_merchant" ? " · New reply" : ""}</p>
                  </div>
                  {pill(TICKET_STATUS[t.status])}
                </button>
              ))}
              <Pager page={page} total={data.total} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <NewTicketDialog open={creating} onOpenChange={setCreating} initialOrder={initialOrder} onCreated={(id) => { load(); setViewing(id) }} />
      <TicketDialog id={viewing} onClose={() => setViewing(null)} tick={tick} onChanged={load} />
    </div>
  )
}
