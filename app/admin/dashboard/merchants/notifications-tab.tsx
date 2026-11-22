"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Send, Trash2, Megaphone, Bell, Search, Mail, ChevronDown, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { listMerchantsAction, type MerchantListRow } from "@/app/actions/merchant-admin"
import { deleteNotificationAction, listSentNotificationsAction, sendMerchantNotificationAction, type SentNotificationRow } from "@/app/actions/merchant-notifications"
import { Pager } from "@/components/merchant/pager"
import { amberCard, fmtDate, pill } from "./shared"

/** "All merchants" or one merchant picked from a clean searchable dropdown. */
function RecipientPicker({
  merchants,
  mode,
  setMode,
  value,
  onChange,
}: {
  merchants: MerchantListRow[]
  mode: "all" | "one"
  setMode: (m: "all" | "one") => void
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setSearch("")
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!search.trim()) return merchants
    const q = search.trim().toLowerCase()
    return merchants.filter(
      (m) =>
        m.business_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    )
  }, [merchants, search])

  const selected = useMemo(
    () => merchants.find((m) => m.id === value),
    [merchants, value]
  )

  const seg = (on: boolean) =>
    `flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
      on ? "bg-[#7E3AF2] text-white shadow-sm" : "text-[#4B5563] hover:text-[#1F2937] hover:bg-white/60"
    }`

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1 rounded-xl bg-gray-100 border border-gray-200 p-1">
        <button
          type="button"
          className={seg(mode === "all")}
          onClick={() => {
            setMode("all")
            onChange(null)
          }}
        >
          All merchants ({merchants.length})
        </button>
        <button
          type="button"
          className={seg(mode === "one")}
          onClick={() => setMode("one")}
        >
          One merchant
        </button>
      </div>

      {mode === "one" && (
        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex items-center justify-between w-full h-10 px-3 text-left rounded-xl border border-gray-200 bg-white text-sm text-[#1F2937] hover:border-gray-300 focus:border-[#7E3AF2] focus:ring-2 focus:ring-[#7E3AF2]/20 outline-none transition-all shadow-none"
          >
            {selected ? (
              <span className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-[#1F2937] truncate">{selected.business_name}</span>
                <span className="text-[#6B7280] text-xs truncate">({selected.email})</span>
              </span>
            ) : (
              <span className="text-gray-400">Select a merchant...</span>
            )}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {selected && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      onChange(null)
                    }
                  }}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Clear merchant selection"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {open && (
            <div
              className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false)
              }}
            >
              {/* Search bar inside dropdown under "Select a merchant" */}
              <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search merchant name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-[#7E3AF2] focus:ring-1 focus:ring-[#7E3AF2] text-[#1F2937] placeholder:text-gray-400 transition-colors"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* List of merchants */}
              <div className="max-h-60 overflow-y-auto p-1 divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <div className="p-3 text-xs text-[#6B7280] text-center">
                    {search ? `No merchants matching "${search}"` : "No merchants available"}
                  </div>
                ) : (
                  filtered.map((m) => {
                    const isSelected = m.id === value
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChange(m.id)
                          setOpen(false)
                        }}
                        className={`relative flex items-center w-full py-2 pl-9 pr-3 text-left rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-purple-50 text-[#7E3AF2]"
                            : "hover:bg-gray-50 text-[#1F2937]"
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center text-[#7E3AF2]">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs sm:text-sm text-[#1F2937] truncate">
                            {m.business_name}
                          </span>
                          <span className="text-[11px] sm:text-xs text-[#6B7280] truncate font-normal">
                            {m.email}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Notifications to merchants, shown as a tab on the Merchants page (that page already checks the admin role). */
export function NotificationsTab() {
  const [merchants, setMerchants] = useState<MerchantListRow[]>([])
  const [mode, setMode] = useState<"all" | "one">("all")
  const [to, setTo] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", body: "", email: false })
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SentNotificationRow | null>(null)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [sent, setSent] = useState<{ rows: SentNotificationRow[]; total: number } | null>(null)

  const loadSent = useCallback(async () => {
    const r = await listSentNotificationsAction(page, search)
    if (r.success) setSent(r)
  }, [page, search])
  useEffect(() => { loadSent() }, [loadSent])
  useEffect(() => { const t = setTimeout(() => { setSearch(q); setPage(1) }, 350); return () => clearTimeout(t) }, [q])
  useEffect(() => {
    listMerchantsAction().then((r) => r.success && setMerchants(r.data.filter((m) => m.status !== "banned")))
    // Opened as ?to=<merchant id>: that merchant is pre-selected.
    const id = new URLSearchParams(window.location.search).get("to")
    if (id) { setMode("one"); setTo(id) }
  }, [])

  const whoLabel = useMemo(() => {
    if (mode === "one") {
      const m = merchants.find((item) => item.id === to)
      return m ? `${m.business_name} (${m.email})` : "Selected merchant"
    }
    return `All merchants (${merchants.length})`
  }, [mode, to, merchants])

  const handleSendConfirm = async () => {
    if (mode === "one" && !to) return toast.error("Pick a merchant first.")
    setBusy(true)
    const r = await sendMerchantNotificationAction({
      merchantId: mode === "one" ? to : null,
      title: form.title,
      body: form.body,
      email: form.email,
    })
    setBusy(false)
    if (!r.success) return toast.error(r.error)
    toast.success(`Sent to ${r.recipients} merchant${r.recipients === 1 ? "" : "s"}`)
    setForm({ ...form, title: "", body: "" })
    setConfirmOpen(false)
    setPage(1)
    loadSent()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const r = await deleteNotificationAction(deleteTarget.id)
    if (!r.success) return toast.error(r.error)
    toast.success("Notification deleted")
    setDeleteTarget(null)
    loadSent()
  }

  // "One merchant" never falls back to everyone: nothing sends until a merchant is picked.
  const canSend = form.title.trim().length >= 3 && form.body.trim().length >= 3 && (mode === "one" ? !!to : merchants.length > 0)

  return (
    <div className="space-y-5 sm:space-y-6">
      <p className="text-xs sm:text-sm text-[#4B5563]">Shows under the bell in their portal instantly. Banned merchants are skipped.</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Compose Form */}
        <Card className={`${amberCard} lg:col-span-5`}>
          <CardHeader className="px-5 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937] text-base font-bold flex items-center gap-2">
              <Send className="h-4 w-4 text-[#7E3AF2]" />
              New notification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1F2937]">Recipient</Label>
              <RecipientPicker merchants={merchants} mode={mode} setMode={setMode} value={to} onChange={setTo} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-title" className="text-xs font-semibold text-[#1F2937]">Notification Title</Label>
              <Input
                id="notif-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Title, e.g. Maintenance on Sunday"
                className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#1F2937] placeholder:text-gray-400 focus:border-[#7E3AF2] focus-visible:border-[#7E3AF2] focus-visible:ring-2 focus-visible:ring-[#7E3AF2]/20 focus-visible:ring-offset-0 transition-all"
                aria-label="Title"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="notif-body" className="text-xs font-semibold text-[#1F2937]">Message</Label>
                <span className="text-[11px] text-[#6B7280]">{form.body.length}/2000</span>
              </div>
              <Textarea
                id="notif-body"
                value={form.body}
                maxLength={2000}
                rows={5}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the full message details..."
                className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-[#1F2937] placeholder:text-gray-400 focus:border-[#7E3AF2] focus-visible:border-[#7E3AF2] focus-visible:ring-2 focus-visible:ring-[#7E3AF2]/20 focus-visible:ring-offset-0 transition-all resize-y"
                aria-label="Message"
              />
            </div>

            <div className="pt-2 border-t border-[#F59E0B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[#4B5563] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#7E3AF2]"
                />
                Also email it
              </label>
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={busy || !canSend}
                className="bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold h-10 px-4 rounded-xl shadow-sm transition-all"
              >
                <Send className="h-4 w-4 mr-2" />
                {mode === "one" ? "Send to merchant" : "Send to all"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sent History */}
        <Card className={`${amberCard} lg:col-span-7 overflow-hidden`}>
          <CardHeader className="px-5 py-4 border-b border-[#F59E0B]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-[#1F2937] text-base font-bold flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#B45309]" />
              Sent ({sent?.total ?? 0})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sent messages"
                className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-xs sm:text-sm text-[#1F2937] placeholder:text-gray-400 focus:border-[#7E3AF2] focus-visible:border-[#7E3AF2] focus-visible:ring-2 focus-visible:ring-[#7E3AF2]/20 focus-visible:ring-offset-0 transition-all shadow-none"
                aria-label="Search sent messages"
              />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {!sent ? (
              <p className="text-sm text-[#4B5563] text-center py-10">Loading...</p>
            ) : sent.rows.length === 0 ? (
              <p className="text-sm text-[#4B5563] text-center py-10">{search ? "No messages match." : "Nothing sent yet."}</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden shadow-xs">
                  {sent.rows.map((n) => (
                    <div key={n.id} className="p-3.5 flex items-start gap-3 hover:bg-gray-50/60 transition-colors">
                      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${n.to ? "bg-purple-100 text-[#7E3AF2]" : "bg-amber-100 text-amber-700"}`}>
                        {n.to ? <Bell className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-semibold text-sm text-[#1F2937] truncate">{n.title}</p>
                          {pill(n.to ? [n.to, "bg-purple-50 text-purple-900 border-purple-200"] : ["All merchants", "bg-amber-50 text-amber-900 border-amber-300"])}
                          {n.emailed && pill(["Emailed", "bg-gray-50 text-gray-700 border-gray-200"])}
                        </div>
                        <p className="text-xs text-[#4B5563] mt-1 line-clamp-2 whitespace-pre-line break-words" title={n.body}>{n.body}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-1">{fmtDate(n.createdAt)}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(n)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0 transition-colors"
                        aria-label={`Delete ${n.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Pager page={page} total={sent.total} onPage={setPage} pageSize={10} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Confirmation Alert Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!o && !busy) setConfirmOpen(false) }}>
        <AlertDialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1F2937]">Send Notification?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-[#4B5563]">
              Send &quot;{form.title.trim()}&quot; to {whoLabel}{form.email ? " and email it" : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1 text-xs">
            <div className="rounded-xl border border-[#F59E0B]/20 bg-[#FEF7E0]/50 p-3 space-y-1.5">
              <div>
                <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block">Recipient</span>
                <span className="font-semibold text-[#1F2937] text-xs">{whoLabel}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider block">Message Preview</span>
                <p className="text-[#4B5563] whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{form.body}</p>
              </div>
            </div>
            {form.email && (
              <div className="flex items-center gap-1.5 text-xs text-purple-800 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200">
                <Mail className="h-3.5 w-3.5 text-[#7E3AF2] shrink-0" />
                <span>An email will also be sent to the merchant&apos;s registered address.</span>
              </div>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold h-9"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={busy}
              onClick={handleSendConfirm}
              className="rounded-xl bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold text-xs sm:text-sm h-9 shadow-sm"
            >
              {busy ? "Sending…" : "Send notification"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1F2937]">Delete Notification?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-[#4B5563]">
              Delete &quot;{deleteTarget?.title}&quot;? It will disappear from merchants&apos; portals.{deleteTarget?.emailed ? " Emails already sent cannot be recalled." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold h-9"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteConfirm}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm h-9 shadow-sm"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
