"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
import { Download, Plus, Upload, CheckCircle2, QrCode, FileText, RefreshCw, XCircle, Bell, FileDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useMerchantState } from "@/lib/merchant/context"
import { KYC_MAX_BYTES, KYC_MIME } from "@/lib/merchant/kyc"
import {
  checkFonepayTopupAction,
  createFonepayTopupAction,
  createTopupProofUploadAction,
  getMyStatementAction,
  getWalletAction,
  listMyLedgerAction,
  requestTopupAction,
  setLowBalanceThresholdAction,
  type FonepayTopupView,
  type LedgerRow,
  type WalletView,
} from "@/app/actions/merchant-trade"
import { Pager, usePaged } from "@/components/merchant/pager"
import { downloadStatementPdf, recentMonths, viewerTimeZone } from "@/components/merchant/statement-pdf"
import { amberCard, fmtDateTime, inputCls, LockedNote, npr, PageHeader, primaryBtn, Spinner, StatCard } from "@/components/merchant/ui"

const METHODS = { bank_transfer: "Bank transfer", esewa: "eSewa", khalti: "Khalti", other: "Other" } as const
const KIND: Record<string, [string, string]> = { topup: ["Top-up", "text-emerald-700"], order: ["Order", "text-[#1F2937]"], refund: ["Refund", "text-emerald-700"], adjustment: ["Adjustment", "text-purple-800"] }
const TOPUP_STATUS: Record<string, [string, string]> = {
  awaiting_payment: ["Waiting for payment", "bg-sky-100 text-sky-900 border-sky-300"],
  pending: ["Awaiting approval", "bg-purple-100 text-purple-900 border-purple-300"],
  approved: ["Credited", "bg-emerald-100 text-emerald-900 border-emerald-300"],
  rejected: ["Rejected", "bg-red-100 text-red-800 border-red-300"],
  failed: ["Failed", "bg-red-100 text-red-800 border-red-300"],
}
const tabCls = "data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white text-[#92400E] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm"
const labelCls = "text-[#1F2937] font-semibold text-sm"

/** Fonepay QR image: the proxy returns either a sticker image (base64) or a raw QR string. */
function FonepayQr({ qr }: { qr: string }) {
  if (qr.startsWith("data:image") || qr.length > 1000) {
    const src = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`
    return <div className="w-full aspect-square rounded-xl border border-gray-100" style={{ backgroundImage: `url(${src})`, backgroundPosition: "center 31%", backgroundSize: "175%", backgroundRepeat: "no-repeat" }} />
  }
  return <QRCodeSVG value={qr} size={240} level="Q" includeMargin={false} />
}

function FonepayTopup({ settings, tick, onCredited }: { settings: WalletView["settings"]; tick: number; onCredited: () => void }) {
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [topup, setTopup] = useState<FonepayTopupView | null>(null)
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState<"paid" | "failed" | null>(null)
  const checking = useRef(false)

  const check = useCallback(async (manual = false) => {
    if (!topup || checking.current) return
    checking.current = true
    if (manual) setIsChecking(true)
    try {
      const res = await checkFonepayTopupAction(topup.reference)
      if ("error" in res) {
        if (manual) toast.error(res.error)
        return
      }
      if (res.status === "approved") {
        setResult("paid")
        toast.success("Payment received. Your wallet is topped up.")
        onCredited()
      } else if (res.status === "failed") {
        setResult("failed")
        onCredited()
      } else if (manual) {
        toast.info(res.status === "error" ? "Couldn't reach the bank. Try again in a moment." : "No payment yet. If you just paid, it will show in a few seconds.")
      }
    } finally {
      checking.current = false
      if (manual) setIsChecking(false)
    }
  }, [topup, onCredited])

  // Countdown with a bank check every 5 seconds; at 0:00 one final check settles it as paid or failed.
  useEffect(() => {
    if (!topup || result) return
    const end = Date.now() + topup.expiresIn * 1000
    let ticks = 0
    // Keeps checking after 0:00 until the server settles it (clocks can differ by a few seconds).
    const id = setInterval(() => {
      setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)))
      if (++ticks % 5 === 0) check()
    }, 1000)
    return () => clearInterval(id)
  }, [topup, result, check])
  useEffect(() => { if (tick && topup && !result) check() }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await createFonepayTopupAction(Number(amount))
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setResult(null)
    setTopup(res.topup)
    setLeft(res.topup.expiresIn)
  }
  const reset = () => { setTopup(null); setResult(null); setAmount("") }

  if (topup && result) {
    const paid = result === "paid"
    return (
      <div className="text-center space-y-3 py-6">
        {paid ? <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" /> : <XCircle className="h-12 w-12 text-red-500 mx-auto" />}
        <p className="text-lg font-bold text-[#1F2937]">{paid ? `${npr(topup.amountPaisa)} added` : "Payment failed"}</p>
        <p className="text-sm text-[#4B5563]">{paid ? `Reference ${topup.reference}` : "No payment was received within 5 minutes. Nothing was charged to your wallet."}</p>
        <Button variant="outline" className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[#1F2937] font-semibold" onClick={reset}>{paid ? "Add more funds" : "Try again"}</Button>
      </div>
    )
  }

  if (topup) {
    const mm = String(Math.floor(left / 60))
    const ss = String(left % 60).padStart(2, "0")
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[#1F2937]">Pay {npr(topup.amountPaisa)}</span>
          <span className={`font-mono font-bold ${left > 60 ? "text-[#7E3AF2]" : "text-red-600"}`}>{left > 0 ? `${mm}:${ss}` : "Checking…"}</span>
        </div>
        <div className="relative mx-auto w-full max-w-[280px] min-h-[260px] flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-3">
          {left === 0 && (
            <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl text-center p-4">
              <RefreshCw className="h-7 w-7 text-[#7E3AF2] animate-spin mb-2" />
              <p className="font-bold text-[#1F2937]">Confirming with the bank…</p>
            </div>
          )}
          <FonepayQr qr={topup.qrString} />
        </div>
        <p className="text-xs text-center text-[#4B5563]">Scan with any mobile banking or wallet app that supports Fonepay.</p>
        {left > 0 && (
          <Button
            type="button"
            disabled={isChecking}
            className="w-full h-11 rounded-xl bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm transition-all"
            onClick={() => check(true)}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Checking payment…" : "I've paid, check now"}
          </Button>
        )}
        <p className="text-[11px] text-center text-[#9CA3AF]">Reference {topup.reference}</p>
      </div>
    )
  }

  return (
    <form onSubmit={start} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fp-amount" className={labelCls}>Amount (NPR) *</Label>
        <Input id="fp-amount" type="number" inputMode="numeric" step={1} min={settings.fonepayMin} max={settings.fonepayMax} value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls} placeholder={`${settings.fonepayMin.toLocaleString("en-IN")} – ${settings.fonepayMax.toLocaleString("en-IN")}`} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[1000, 5000, 10000, 25000, 50000].filter((v) => v >= settings.fonepayMin && v <= settings.fonepayMax).map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-[#F59E0B]/40 bg-[#FEF7E0] px-3 py-1 text-xs font-semibold text-[#92400E] hover:bg-[#FEF7E0]/60">{npr(v * 100)}</button>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={busy} className={`w-full h-11 rounded-xl ${primaryBtn}`}>{busy ? "Creating QR…" : "Generate Fonepay QR"}</Button>
      <p className="text-xs text-[#6B7280] text-center">Credited instantly once the bank confirms. Pay within 5 minutes or the payment fails.</p>
    </form>
  )
}

function ManualTopup({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ amount: "", method: "bank_transfer", reference: "" })
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file?: File) => {
    if (!file) return
    if (!(file.type in KYC_MIME) || file.size > KYC_MAX_BYTES) return toast.error("Upload a PDF, JPG or PNG under 5 MB.")
    setBusy(true)
    const slot = await createTopupProofUploadAction(file.type, file.size)
    if (!slot.success) { setBusy(false); return toast.error(slot.error) }
    const { error } = await createClient({ merchant: true }).storage.from("merchant-kyc").uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
    setBusy(false)
    if (error) return toast.error("Upload failed. Try again.")
    setProof({ path: slot.path, name: file.name })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await requestTopupAction({ amountRupees: Number(form.amount), method: form.method, reference: form.reference, proofPath: proof?.path })
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Request sent. We'll credit your wallet once the payment is confirmed.")
    setForm({ amount: "", method: "bank_transfer", reference: "" })
    setProof(null)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs sm:text-sm text-[#4B5563]">Pay Byiora using the account details from your account manager, then tell us about the payment. We credit your wallet after confirming it, usually within a few hours on business days.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label htmlFor="t-amount" className={labelCls}>Amount paid (NPR) *</Label><Input id="t-amount" type="number" min={100} step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className={inputCls} placeholder="e.g. 50000" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="t-method" className={labelCls}>Paid with *</Label>
          <select id="t-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={`flex w-full border px-3 text-sm ${inputCls}`}>
            {Object.entries(METHODS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="t-ref" className={labelCls}>Transaction ID / reference *</Label><Input id="t-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required maxLength={80} className={inputCls} placeholder="From your bank or wallet receipt" /></div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#FEF7E0]/50 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1F2937]">Payment receipt (recommended)</p>
          <p className="text-xs text-[#6B7280] truncate">{proof ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{proof.name}</span> : "Screenshot or PDF, speeds up approval"}</p>
        </div>
        <label className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-white border-purple-300 text-purple-900 text-xs font-semibold cursor-pointer shrink-0 ${busy ? "opacity-50 pointer-events-none" : "hover:bg-purple-50"}`}>
          <Upload className="h-3.5 w-3.5" />{proof ? "Replace" : "Upload"}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = "" }} />
        </label>
      </div>
      <Button type="submit" disabled={busy} className={`w-full h-11 rounded-xl ${primaryBtn}`}>{busy ? "Please wait…" : "Send top-up request"}</Button>
    </form>
  )
}

function WalletSettings({ wallet, onSaved }: { wallet: WalletView; onSaved: () => void }) {
  const [threshold, setThreshold] = useState(wallet.lowBalanceThresholdPaisa ? String(wallet.lowBalanceThresholdPaisa / 100) : "")
  const [month, setMonth] = useState(recentMonths(wallet.joinedAt)[0]?.value || "")
  const [busy, setBusy] = useState(false)
  const l = wallet.limits

  const save = async () => {
    setBusy(true)
    const res = await setLowBalanceThresholdAction(Number(threshold || 0))
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(Number(threshold) ? "Low-balance alert threshold updated successfully." : "Low-balance alert disabled.")
    onSaved()
  }
  const statement = async () => {
    setBusy(true)
    const st = await getMyStatementAction(month, viewerTimeZone())
    setBusy(false)
    if (!st) return toast.error("Couldn't build that statement.")
    await downloadStatementPdf(st)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      <div className={`${amberCard} p-4 space-y-3`}>
        <p className="flex items-center gap-2 text-sm font-bold text-[#1F2937]"><Bell className="h-4 w-4 text-[#92400E]" />Low-balance alert</p>
        <p className="text-xs text-[#4B5563]">Email and webhook when what you can spend drops below this. Leave empty to turn off.</p>
        <div className="flex gap-2">
          <Input type="number" min={0} step={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="e.g. 10000" className={`${inputCls} h-9 bg-white`} aria-label="Alert below (NPR)" />
          <Button size="sm" variant="outline" disabled={busy} onClick={save} className="h-9 bg-white">Save</Button>
        </div>
      </div>
      <div className={`${amberCard} p-4 space-y-3`}>
        <p className="flex items-center gap-2 text-sm font-bold text-[#1F2937]"><FileDown className="h-4 w-4 text-[#92400E]" />Monthly statement</p>
        <p className="text-xs text-[#4B5563]">PDF with opening and closing balance and every transaction, for your accounts.</p>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`h-9 flex-1 border px-3 text-sm bg-white ${inputCls}`} aria-label="Statement month">
            {recentMonths(wallet.joinedAt).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={busy || !month} onClick={statement} className="h-9 bg-white"><Download className="h-4 w-4 mr-1.5" />PDF</Button>
        </div>
      </div>
      <div className={`${amberCard} p-4 space-y-2`}>
        <p className="text-sm font-bold text-[#1F2937]">Your limits</p>
        <div className="text-xs text-[#4B5563] space-y-1">
          <p>Credit limit: <span className="font-semibold text-[#1F2937]">{wallet.creditLimitPaisa ? npr(wallet.creditLimitPaisa) : "None"}</span></p>
          <p>Per order: <span className="font-semibold text-[#1F2937]">{l.perOrderPaisa ? npr(l.perOrderPaisa) : "No limit"}</span></p>
          <p>Per 24 hours: <span className="font-semibold text-[#1F2937]">{l.dailyPaisa ? npr(l.dailyPaisa) : "No limit"}</span></p>
          <p>Per 30 days: <span className="font-semibold text-[#1F2937]">{l.monthlyPaisa ? npr(l.monthlyPaisa) : "No limit"}</span></p>
        </div>
        <p className="text-[11px] text-[#6B7280]">Need different limits? Contact your account manager.</p>
      </div>
    </div>
  )
}

export default function MerchantWallet() {
  const { state, refresh, tick } = useMerchantState()
  const [wallet, setWallet] = useState<WalletView | null>(null)
  const [ledger, setLedger] = useState<{ rows: LedgerRow[]; total: number } | null>(null)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => getWalletAction().then((w) => w && setWallet(w)), [])
  useEffect(() => { load() }, [load, tick])
  useEffect(() => { listMyLedgerAction(ledgerPage).then((r) => r && setLedger(r)) }, [ledgerPage, tick])
  const topups = usePaged(wallet?.topups || [])

  if (!wallet) return <Spinner label="Loading wallet..." />

  const { settings } = wallet
  const anyMethod = settings.fonepay || settings.manual
  const pending = wallet.topups.filter((t) => t.status === "pending")
  const credited = () => { load(); refresh(); listMyLedgerAction(ledgerPage).then((r) => r && setLedger(r)) }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Wallet" subtitle="Prepaid balance. Every order is paid from here instantly.">
        <Button size="sm" disabled={!state.canUse || !anyMethod} onClick={() => setOpen(true)} className={`h-9 ${primaryBtn}`}><Plus className="h-4 w-4 mr-1.5" />Add funds</Button>
      </PageHeader>
      <LockedNote show={!state.canUse} />
      {state.canUse && !anyMethod && <LockedNote show>Wallet top-ups are paused right now. Contact support@byiora.com.np if you need funds added.</LockedNote>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard label="Available to Spend" value={npr(wallet.balancePaisa + wallet.creditLimitPaisa)} hint={wallet.creditLimitPaisa ? `Balance ${npr(wallet.balancePaisa)} + credit ${npr(wallet.creditLimitPaisa)}` : "Wallet balance"} valueCls="text-[#7E3AF2]" />
        <StatCard label="Pending Top-ups" value={pending.length ? npr(pending.reduce((s, t) => s + t.amountPaisa, 0)) : "None"} hint={pending.length ? `${pending.length} waiting for approval` : undefined} />
        <StatCard label="Added (30 days)" value={npr(wallet.in30Paisa)} valueCls="text-emerald-600" />
        <StatCard label="Spent (30 days)" value={npr(wallet.out30Paisa)} />
      </div>

      <WalletSettings wallet={wallet} onSaved={load} />

      <Tabs defaultValue="statement" className="space-y-4">
        <TabsList className="inline-flex bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl gap-1">
          <TabsTrigger value="statement" className={tabCls}>Statement</TabsTrigger>
          <TabsTrigger value="topups" className={tabCls}>Top-ups ({wallet.topups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="statement">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">Statement</CardTitle>
              <CardDescription className="text-[#92400E]">Every credit and debit, newest first</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {!ledger ? <p className="text-center text-sm text-[#4B5563] py-12">Loading…</p> : ledger.rows.length === 0 ? (
                <p className="text-center text-sm text-[#4B5563] py-12">No transactions yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-[#F59E0B]/20 bg-white">
                    <Table className="min-w-[640px]">
                      <TableHeader className="bg-[#FEF7E0]/40 border-b-2 border-[#F59E0B]/20">
                        <TableRow>{["Date", "Type", "Details", "Amount", "Balance"].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.rows.map((l) => (
                          <TableRow key={l.id} className="border-b border-gray-100">
                            <TableCell className="text-xs text-[#4B5563] py-3">{fmtDateTime(l.createdAt)}</TableCell>
                            <TableCell className={`text-sm font-semibold py-3 ${KIND[l.kind]?.[1]}`}>{KIND[l.kind]?.[0] || l.kind}</TableCell>
                            <TableCell className="text-xs text-[#6B7280] py-3 max-w-[220px] truncate">{l.note || (l.reference ? `Ref ${l.reference.slice(0, 13)}` : "—")}</TableCell>
                            <TableCell className={`text-sm font-bold py-3 ${l.amountPaisa > 0 ? "text-emerald-600" : "text-[#1F2937]"}`}>{l.amountPaisa > 0 ? "+" : "−"}{npr(Math.abs(l.amountPaisa))}</TableCell>
                            <TableCell className={`text-sm py-3 ${l.balanceAfterPaisa < 0 ? "text-red-600 font-semibold" : ""}`}>{l.balanceAfterPaisa < 0 ? "−" : ""}{npr(Math.abs(l.balanceAfterPaisa))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Pager page={ledgerPage} total={ledger.total} onPage={setLedgerPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topups">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] text-lg font-bold">Top-ups</CardTitle>
              <CardDescription className="text-[#92400E]">Fonepay payments and manual requests</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 space-y-2">
              {wallet.topups.length === 0 ? (
                <p className="text-center text-sm text-[#4B5563] py-12">No top-ups yet.</p>
              ) : (
                <>
                  {topups.pageItems.map((t) => (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#F59E0B]/20 bg-white p-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1F2937]">{npr(t.amountPaisa)} <span className="font-normal text-[#6B7280]">via {t.provider === "fonepay" ? "Fonepay QR" : `${METHODS[t.method as keyof typeof METHODS] || t.method} (manual)`}</span></p>
                        <p className="text-xs text-[#6B7280]">Ref {t.reference} · {fmtDateTime(t.createdAt)}</p>
                        {t.adminNote && t.provider === "manual" && <p className="text-xs text-[#4B5563] mt-1">Note: {t.adminNote}</p>}
                      </div>
                      <span className={`self-start sm:self-auto inline-flex px-2.5 py-0.5 rounded-full border text-xs font-semibold ${TOPUP_STATUS[t.status]?.[1]}`}>{TOPUP_STATUS[t.status]?.[0] || t.status}</span>
                    </div>
                  ))}
                  <Pager page={topups.page} total={topups.total} onPage={topups.setPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) load() }}>
        <DialogContent className="w-[94vw] max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1F2937]">Add funds</DialogTitle>
            <DialogDescription className="text-xs text-[#4B5563]">Current balance {npr(wallet.balancePaisa)}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue={settings.fonepay ? "fonepay" : "manual"} className="space-y-4">
            {settings.fonepay && settings.manual && (
              <TabsList className="grid grid-cols-2 bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl gap-1 h-auto">
                <TabsTrigger value="fonepay" className={`${tabCls} justify-center`}><QrCode className="h-4 w-4" />Fonepay QR</TabsTrigger>
                <TabsTrigger value="manual" className={`${tabCls} justify-center`}><FileText className="h-4 w-4" />Manual top-up</TabsTrigger>
              </TabsList>
            )}
            {settings.fonepay && <TabsContent value="fonepay"><FonepayTopup settings={settings} tick={tick} onCredited={credited} /></TabsContent>}
            {settings.manual && <TabsContent value="manual"><ManualTopup onDone={() => { setOpen(false); credited() }} /></TabsContent>}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
