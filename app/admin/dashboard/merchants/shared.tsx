"use client"

// Panels shared by the merchants list and the merchant detail page.

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { UserPlus, ExternalLink, CheckCircle2, Ban, PauseCircle, KeyRound, FileText, Download, Search } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Pager, usePaged } from "@/components/merchant/pager"
import { downloadStatementPdf, recentMonths, viewerTimeZone } from "@/components/merchant/statement-pdf"
import { useAdminSession } from "@/lib/admin-session-context"
import { KYC_DOC_TYPES } from "@/lib/merchant/kyc"
import {
  listMerchantsAction,
  inviteMerchantAction,
  resendMerchantInviteAction,
  setMerchantStatusAction,
  getMerchantKycAction,
  reviewKycAction,
  getMerchantTopupsAction,
  listMerchantLedgerAdminAction,
  listMerchantOrdersAdminAction,
  fulfilMerchantOrderAction,
  getMerchantStatementAdminAction,
  getMerchantInventoryAction,
  addMerchantInventoryCodesAction,
  setMerchantGlobalInventoryAction,
  setMerchantManualDeliveryAction,
  listMerchantAuditAction,
  type MerchantInventoryView,
  type AuditRow,
  listPendingTopupsAction,
  reviewTopupAction,
  adjustMerchantWalletAction,
  updateMerchantTermsAction,
  refundMerchantOrderAction,
  type MerchantListRow,
  type KycSubmissionView,
  type AdminTopup,
  type AdminLedgerRow,
  type AdminOrderRow,
} from "@/app/actions/merchant-admin"

export const STATUS_STYLE: Record<string, [string, string]> = {
  active: ["Active", "bg-emerald-100 text-emerald-900 border-emerald-300"],
  suspended: ["Suspended", "bg-amber-100 text-amber-900 border-amber-300"],
  banned: ["Banned", "bg-red-100 text-red-800 border-red-300"],
}
export const KYC_STYLE: Record<string, [string, string]> = {
  not_submitted: ["Not submitted", "bg-slate-100 text-slate-700 border-slate-300"],
  submitted: ["Awaiting review", "bg-purple-100 text-purple-900 border-purple-300"],
  pending: ["Awaiting review", "bg-purple-100 text-purple-900 border-purple-300"],
  more_info: ["More info requested", "bg-amber-100 text-amber-900 border-amber-300"],
  rejected: ["Rejected", "bg-red-100 text-red-800 border-red-300"],
  approved: ["Verified", "bg-emerald-100 text-emerald-900 border-emerald-300"],
}
export const pill = ([text, cls]: [string, string]) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${cls}`}>{text}</span>
export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never")

export const inputCls = "bg-white border-2 border-[#F59E0B]/30 text-[#1F2937] placeholder:text-gray-400 focus:border-[#F59E0B] focus-visible:border-[#F59E0B] focus-visible:ring-2 focus-visible:ring-[#F59E0B]/20 focus-visible:ring-offset-0 rounded-xl transition-all"
export const tabCls = "data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#92400E] hover:text-[#B45309] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap shrink-0"
export const amberCard = "bg-[#FEF7E0] border-2 border-[#F59E0B]/30 shadow-md rounded-xl"

/** Small labelled value box, same as the customer details dialog. */
export function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/90 rounded-lg p-3 border border-[#F59E0B]/20 shadow-xs min-w-0">
      <span className="text-[11px] text-[#92400E] font-medium block">{label}</span>
      <span className="text-sm font-bold text-[#111827] break-words">{children}</span>
    </div>
  )
}

export function InviteDialog({ onInvited }: { onInvited: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ businessName: "", contactName: "", email: "", phone: "" })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await inviteMerchantAction(form)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    if (res.emailSent) toast.success(`Invite sent to ${form.email}`)
    else toast.warning("Merchant created, but the invite email failed. Use 'Send new password' to retry.")
    setForm({ businessName: "", contactName: "", email: "", phone: "" })
    setOpen(false)
    onInvited()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 px-3.5 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold shadow-sm text-xs sm:text-sm">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite merchant
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-w-lg rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold text-[#1F2937]">Invite a merchant</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-[#4B5563]">They get an email with a temporary password. Nothing unlocks until you approve their KYC.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label htmlFor="m-business" className="text-[#1F2937] font-semibold text-sm">Business name *</Label><Input id="m-business" placeholder="e.g. Acme Digital Goods" value={form.businessName} onChange={set("businessName")} required maxLength={120} className={`${inputCls} h-10`} /></div>
          <div className="space-y-1.5"><Label htmlFor="m-contact" className="text-[#1F2937] font-semibold text-sm">Contact person *</Label><Input id="m-contact" placeholder="e.g. John Doe" value={form.contactName} onChange={set("contactName")} required maxLength={80} className={`${inputCls} h-10`} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label htmlFor="m-email" className="text-[#1F2937] font-semibold text-sm">Email *</Label><Input id="m-email" type="email" placeholder="merchant@example.com" value={form.email} onChange={set("email")} required maxLength={120} className={`${inputCls} h-10`} /></div>
            <div className="space-y-1.5"><Label htmlFor="m-phone" className="text-[#1F2937] font-semibold text-sm">Phone</Label><Input id="m-phone" type="tel" placeholder="+977 98XXXXXXXX" value={form.phone} onChange={set("phone")} maxLength={20} className={`${inputCls} h-10`} /></div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold rounded-xl shadow-md">{busy ? "Sending invite…" : "Send invite"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function KycTab({ merchant, onChanged, refreshKey = 0 }: { merchant: MerchantListRow; onChanged: () => void; refreshKey?: number }) {
  const [subs, setSubs] = useState<KycSubmissionView[] | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await getMerchantKycAction(merchant.id)
    if (!res.success) return toast.error(res.error)
    setSubs(res.data)
  }, [merchant.id])
  useEffect(() => { load() }, [load, refreshKey])

  const decide = async (decision: "approved" | "rejected" | "more_info") => {
    if (!subs?.[0]) return
    setBusy(true)
    const res = await reviewKycAction(subs[0].id, decision, note)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(decision === "approved" ? "KYC approved. The merchant has been emailed." : "Decision sent to the merchant.")
    setNote("")
    load()
    onChanged()
  }

  if (!subs) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-3"></div>
        <p className="text-sm text-[#4B5563]">Loading KYC...</p>
      </div>
    )
  }
  if (!subs.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[#F59E0B]/30 bg-[#FEF7E0]/40 py-10 text-center">
        <FileText className="h-8 w-8 text-[#F59E0B] mx-auto mb-2" />
        <p className="text-sm font-semibold text-[#1F2937]">No documents submitted yet</p>
        <p className="text-xs text-[#4B5563] mt-1">The merchant submits KYC from their portal after first sign-in.</p>
      </div>
    )
  }
  const [latest, ...older] = subs

  return (
    <div className="space-y-5">
      <div className={`${amberCard} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#1F2937]">Submission v{latest.version}</p>
            <p className="text-xs text-[#4B5563]">Submitted {fmtDate(latest.created_at)}</p>
          </div>
          {pill(KYC_STYLE[latest.status])}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoBox label="Registered business name">{latest.legal_name}</InfoBox>
          <InfoBox label="Business type"><span className="capitalize">{latest.business_type.replace(/_/g, " ")}</span></InfoBox>
          <InfoBox label="PAN / VAT number"><span className="font-mono">{latest.pan_number}</span></InfoBox>
          <InfoBox label="Registration number">{latest.registration_number || "—"}</InfoBox>
          <InfoBox label="Business address">{latest.address}</InfoBox>
          <InfoBox label="Website">{latest.website || "—"}</InfoBox>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-bold text-[#1F2937]">Documents</h4>
          <span className="text-[11px] text-[#6B7280]">Links expire after 60 seconds. Reopen to refresh.</span>
        </div>
        <div className="space-y-2">
          {latest.documents.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-purple-50 flex items-center justify-center"><FileText className="h-4 w-4 text-[#7E3AF2]" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1F2937] truncate">{KYC_DOC_TYPES[d.type as keyof typeof KYC_DOC_TYPES] || d.type}</p>
                  <p className="text-xs text-[#6B7280]">{d.mime.split("/")[1].toUpperCase()} · {(d.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-purple-300 text-purple-900 text-xs font-semibold hover:bg-purple-50 shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {latest.admin_note && (
        <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-3 text-sm text-[#4B5563]">
          <span className="font-semibold text-[#1F2937]">Note sent to merchant:</span> {latest.admin_note}
        </div>
      )}

      {latest.status === "pending" && (
        <div className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-4 space-y-3">
          <h4 className="text-sm font-bold text-[#1F2937]">Your decision</h4>
          <div className="space-y-1.5">
            <Label htmlFor="kyc-note" className="text-xs font-semibold text-[#4B5563]">Note to merchant (required to reject or ask for more info)</Label>
            <Textarea id="kyc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={inputCls} placeholder="e.g. The PAN certificate is blurry, please upload a clearer scan." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide("approved")} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"><CheckCircle2 className="h-4 w-4 mr-1.5" />Approve</Button>
            <Button size="sm" disabled={busy} variant="outline" onClick={() => decide("more_info")} className="h-9 bg-white border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold">Ask for more info</Button>
            <Button size="sm" disabled={busy} variant="outline" onClick={() => decide("rejected")} className="h-9 bg-white border-red-300 text-red-700 hover:bg-red-50 font-semibold">Reject</Button>
          </div>
        </div>
      )}

      {older.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-[#4B5563]">
          <summary className="cursor-pointer font-semibold text-[#1F2937]">Earlier submissions ({older.length})</summary>
          <ul className="mt-3 space-y-2">
            {older.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#1F2937]">v{s.version}</span>
                <span className="text-xs">{fmtDate(s.created_at)}</span>
                {pill(KYC_STYLE[s.status])}
                {s.admin_note && <span className="w-full text-xs">{s.admin_note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function AccountTab({ merchant, onChanged }: { merchant: MerchantListRow; onChanged: () => void }) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const setStatus = async (status: "active" | "suspended" | "banned") => {
    setBusy(true)
    const res = await setMerchantStatusAction(merchant.id, status, reason)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success({ active: "Merchant reactivated", suspended: "Merchant suspended", banned: "Merchant banned" }[status])
    setReason("")
    onChanged()
  }
  const resend = async () => {
    setBusy(true)
    const res = await resendMerchantInviteAction(merchant.id)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(`New temporary password sent to ${merchant.email}`)
    onChanged()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-bold text-[#1F2937] mb-3">Onboarding</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoBox label="Invited">{fmtDate(merchant.created_at)}</InfoBox>
          <InfoBox label="Onboarded">{merchant.email_verified_at ? fmtDate(merchant.email_verified_at) : merchant.must_change_password ? "Hasn't signed in yet" : "Setting up"}</InfoBox>
          <InfoBox label="Last sign-in">{fmtDate(merchant.last_login_at)}</InfoBox>
          <InfoBox label="Verification">{KYC_STYLE[merchant.kyc_status][0]}</InfoBox>
        </div>
      </div>
      {merchant.status !== "banned" && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1F2937]">Sign-in help</p>
            <p className="text-xs text-[#4B5563] mt-0.5">Emails a new temporary password. They must change it on next sign-in.</p>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={resend} className="h-9 bg-white border-purple-300 text-purple-900 hover:bg-purple-50 font-semibold shrink-0">
            <KeyRound className="h-4 w-4 mr-1.5 text-purple-700" />Send new password
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Account status</p>
          <p className="text-xs text-[#4B5563] mt-0.5">
            Suspended merchants can sign in and look around but can't order. Banned merchants can't sign in at all. The merchant is emailed either way.
          </p>
        </div>
        {merchant.status_reason && (
          <p className="text-sm text-[#4B5563] rounded-lg bg-[#F9FAFB] border border-gray-200 p-2.5"><span className="font-semibold text-[#1F2937]">Current reason:</span> {merchant.status_reason}</p>
        )}
        {merchant.status !== "active" ? (
          <Button size="sm" disabled={busy} onClick={() => setStatus("active")} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />{merchant.status === "banned" ? "Unban merchant" : "Reactivate merchant"}
          </Button>
        ) : null}
        {merchant.status !== "banned" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="status-reason" className="text-xs font-semibold text-[#4B5563]">Reason (required to suspend or ban)</Label>
              <Textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} className={inputCls} />
            </div>
            <div className="flex flex-wrap gap-2">
              {merchant.status === "active" && (
                <Button size="sm" disabled={busy} variant="outline" onClick={() => setStatus("suspended")} className="h-9 bg-white border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold">
                  <PauseCircle className="h-4 w-4 mr-1.5" />Suspend
                </Button>
              )}
              <Button size="sm" disabled={busy} variant="outline" onClick={() => setStatus("banned")} className="h-9 bg-white border-red-300 text-red-700 hover:bg-red-50 font-semibold">
                <Ban className="h-4 w-4 mr-1.5" />Ban merchant
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const npr = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: paisa % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
export const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", esewa: "eSewa", khalti: "Khalti", fonepay: "Fonepay", other: "Other" }
export const TOPUP_STATUS: Record<string, [string, string]> = {
  awaiting_payment: ["Waiting for payment", "bg-sky-100 text-sky-900 border-sky-300"],
  approved: ["Credited", "bg-emerald-100 text-emerald-900 border-emerald-300"],
  rejected: ["Rejected", "bg-red-100 text-red-800 border-red-300"],
  expired: ["QR expired", "bg-gray-100 text-gray-700 border-gray-300"],
}
export const KIND: Record<string, string> = { topup: "Top-up", order: "Order", refund: "Refund", adjustment: "Adjustment" }

/** Formats numeric input value with commas, e.g. "5000" -> "5,000", "4960.5" -> "4,960.5" */
export function formatAmountInput(val: string, allowDecimals = true): string {
  if (!val) return ""
  let cleaned = val.replace(/[^\d.]/g, "")
  if (!allowDecimals) {
    cleaned = cleaned.replace(/\./g, "")
  }
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  const intPart = parts[0] ? Number(parts[0]).toLocaleString("en-US") : "0"
  if (allowDecimals && parts.length > 1) {
    return `${intPart}.${parts[1].slice(0, 2)}`
  }
  return intPart
}

/** One top-up request with approve / reject. Used in the queue and the merchant dialog. */
export function TopupCard({ t, onChanged, showMerchant }: { t: AdminTopup; onChanged: () => void; showMerchant?: boolean }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState(false)

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(true)
    const res = await reviewTopupAction(t.id, decision, note)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(decision === "approved" ? `${npr(t.amountPaisa)} credited` : "Top-up rejected")
    setApproveConfirm(false)
    onChanged()
  }
  return (
    <div className="rounded-xl border border-[#F59E0B]/20 bg-white p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          {showMerchant && <p className="text-xs font-bold text-[#92400E] uppercase tracking-wider">{t.businessName}</p>}
          <p className="text-lg font-bold text-[#1F2937]">{npr(t.amountPaisa)} <span className="text-sm font-medium text-[#6B7280]">via {t.provider === "fonepay" ? "Fonepay QR (automatic)" : `${METHOD[t.method] || t.method} (manual)`}</span></p>
          <p className="text-xs text-[#4B5563]">Reference <span className="font-mono font-semibold">{t.reference}</span>{t.bankTxnId ? <> · Bank <span className="font-mono">{t.bankTxnId}</span></> : null} · {fmtDate(t.createdAt)}</p>
          {t.adminNote && <p className="text-xs text-[#4B5563] mt-1">Note: {t.adminNote}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {t.proofUrl && (
            <a href={t.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-purple-300 text-purple-900 text-xs font-semibold hover:bg-purple-50">
              <ExternalLink className="h-3.5 w-3.5" />Receipt
            </a>
          )}
          {t.status !== "pending" && pill(TOPUP_STATUS[t.status] || [t.status, "bg-gray-100 text-gray-700 border-gray-300"])}
        </div>
      </div>
      {t.status === "pending" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to reject)" maxLength={500} className={`${inputCls} h-9 flex-1`} />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => setApproveConfirm(true)} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"><CheckCircle2 className="h-4 w-4 mr-1.5" />Approve</Button>
            <Button size="sm" disabled={busy} variant="outline" onClick={() => decide("rejected")} className="h-9 bg-white border-red-300 text-red-700 hover:bg-red-50 font-semibold">Reject</Button>
          </div>
        </div>
      )}

      {/* Topup Approve Confirmation Dialog */}
      <AlertDialog open={approveConfirm} onOpenChange={(open) => { if (!open && !busy) setApproveConfirm(false) }}>
        <AlertDialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1F2937]">Credit Top-up to Wallet?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-[#4B5563]">
              Credit {npr(t.amountPaisa)} to {t.businessName || "this merchant"}&apos;s wallet? Only approve after confirming the money has reached your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={busy}
              onClick={() => setApproveConfirm(false)}
              className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold h-9"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={busy}
              onClick={() => decide("approved")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm h-9 shadow-sm"
            >
              {busy ? "Crediting…" : "Yes, approve & credit"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Server-paged list loader: refetches on page change and on realtime pings. */
function useServerPage<T>(fetchPage: (page: number) => Promise<{ rows: T[]; total: number } | null>, deps: unknown[]) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ rows: T[]; total: number } | null>(null)
  const load = useCallback(async () => {
    const r = await fetchPage(page)
    if (r) setData(r)
  }, [page, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  return { page, setPage, data, load }
}

const money = (v: number | null) => (v == null ? "" : formatAmountInput(String(v / 100), false))

export function WalletTab({ merchant, onChanged, refreshKey = 0 }: { merchant: MerchantListRow; onChanged: () => void; refreshKey?: number }) {
  const [adj, setAdj] = useState({ amount: "", note: "" })
  const [adjustTarget, setAdjustTarget] = useState<{ sign: 1 | -1; amount: number; note: string } | null>(null)
  const [adjustCode, setAdjustCode] = useState("")
  useEffect(() => { if (!adjustTarget) setAdjustCode("") }, [adjustTarget])
  const [terms, setTerms] = useState({
    discount: String(merchant.discount_percent),
    rate: String(merchant.api_rate_limit_per_min),
    credit: money(merchant.credit_limit_paisa) || "0",
    perOrder: money(merchant.limit_per_order_paisa),
    daily: money(merchant.limit_daily_paisa),
    monthly: money(merchant.limit_monthly_paisa),
  })
  const [busy, setBusy] = useState(false)
  const [month, setMonth] = useState(recentMonths(merchant.created_at)[0]?.value || "")

  const topups = useServerPage<AdminTopup>(async (p) => {
    const r = await getMerchantTopupsAction(merchant.id, p)
    return r.success ? { rows: r.topups, total: r.total } : null
  }, [merchant.id, refreshKey])
  const ledger = useServerPage<AdminLedgerRow>(async (p) => {
    const r = await listMerchantLedgerAdminAction(merchant.id, p)
    return r.success ? r : null
  }, [merchant.id, refreshKey])
  const changed = () => { topups.load(); ledger.load(); onChanged() }

  const handleCreditClick = () => {
    const raw = adj.amount.replace(/,/g, "").trim()
    const amount = Number(raw)
    if (!(amount > 0)) return toast.error("Enter an amount.")
    setAdjustTarget({ sign: 1, amount, note: adj.note.trim() })
  }

  const handleDebitClick = () => {
    const raw = adj.amount.replace(/,/g, "").trim()
    const amount = Number(raw)
    if (!(amount > 0)) return toast.error("Enter an amount.")
    setAdjustTarget({ sign: -1, amount, note: adj.note.trim() })
  }

  const confirmAdjust = async () => {
    if (!adjustTarget) return
    setBusy(true)
    const res = await adjustMerchantWalletAction(merchant.id, adjustTarget.sign * adjustTarget.amount, adjustTarget.note, adjustCode)
    setBusy(false)
    if (!res.success) {
      setAdjustCode("")
      return toast.error(res.error)
    }
    toast.success(`Wallet is now ${npr(res.balancePaisa || 0)}`)
    setAdj({ amount: "", note: "" })
    setAdjustTarget(null)
    changed()
  }

  const saveTerms = async () => {
    setBusy(true)
    const n = (v: string) => {
      const clean = v.replace(/,/g, "").trim()
      return clean === "" ? null : Number(clean)
    }
    const res = await updateMerchantTermsAction(merchant.id, {
      discountPercent: Number(terms.discount),
      rateLimitPerMin: Number(terms.rate),
      creditLimitRupees: Number(terms.credit.replace(/,/g, "") || 0),
      perOrderRupees: n(terms.perOrder),
      dailyRupees: n(terms.daily),
      monthlyRupees: n(terms.monthly),
    })
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Saved. The merchant sees the new terms now.")
    onChanged()
  }
  const statement = async () => {
    setBusy(true)
    const st = await getMerchantStatementAdminAction(merchant.id, month, viewerTimeZone())
    setBusy(false)
    if (!st) return toast.error("Couldn't build that statement.")
    await downloadStatementPdf(st)
  }

  const pending = (topups.data?.rows || []).filter((t) => t.status === "pending")
  const field = (k: keyof typeof terms, label: string, hint: string, isAmount = false) => (
    <label className="space-y-1">
      <span className="text-[11px] font-semibold text-[#6B7280]">{label}</span>
      <Input
        type="text"
        inputMode={isAmount ? "numeric" : "decimal"}
        value={terms[k]}
        onChange={(e) => {
          const val = isAmount ? formatAmountInput(e.target.value, false) : e.target.value
          setTerms({ ...terms, [k]: val })
        }}
        placeholder={hint}
        className={`${inputCls} h-9`}
      />
    </label>
  )

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-[#1F2937]">Top-ups waiting for you ({pending.length})</h4>
          {pending.map((t) => <TopupCard key={t.id} t={t} onChanged={changed} />)}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Terms and limits</p>
          <p className="text-xs text-[#4B5563] mt-0.5">Credit lets the balance go below zero by up to this amount. Spend limits use rolling 24-hour and 30-day windows; leave empty for no limit.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {field("discount", "Default discount %", "0")}
          {field("rate", "API requests / minute", "60")}
          {field("credit", "Credit limit (Rs.)", "0", true)}
          {field("perOrder", "Max per order (Rs.)", "No limit", true)}
          {field("daily", "Max per 24 hours (Rs.)", "No limit", true)}
          {field("monthly", "Max per 30 days (Rs.)", "No limit", true)}
        </div>
        <Button size="sm" disabled={busy} onClick={saveTerms} className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold">Save terms</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-[#1F2937]">Manual adjustment</p>
            <p className="text-xs text-[#4B5563] mt-0.5">For money received outside a top-up request, or corrections.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Amount (NPR)"
              value={adj.amount}
              onChange={(e) => setAdj({ ...adj, amount: formatAmountInput(e.target.value, true) })}
              className={`${inputCls} h-9`}
              aria-label="Amount"
            />
            <Input placeholder="Reason (required)" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} maxLength={300} className={`${inputCls} h-9`} aria-label="Reason" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="button" disabled={busy} onClick={handleCreditClick} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">Credit</Button>
            <Button size="sm" type="button" disabled={busy} variant="outline" onClick={handleDebitClick} className="h-9 bg-white border-red-300 text-red-700 hover:bg-red-50 font-semibold">Debit</Button>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-[#1F2937]">Monthly statement</p>
            <p className="text-xs text-[#4B5563] mt-0.5">PDF with opening and closing balance and every wallet transaction.</p>
          </div>
          <div className="flex gap-2">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`h-9 flex-1 border px-3 text-sm bg-white ${inputCls}`} aria-label="Statement month">
              {recentMonths(merchant.created_at).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={busy || !month} onClick={statement} className="h-9 bg-white"><Download className="h-4 w-4 mr-1.5" />PDF</Button>
          </div>
        </div>
      </div>

      {/* Wallet Adjustment Confirmation Alert Dialog */}
      <AlertDialog open={!!adjustTarget} onOpenChange={(open) => { if (!open && !busy) setAdjustTarget(null) }}>
        <AlertDialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1F2937]">
              {adjustTarget?.sign === 1 ? "Credit Merchant Wallet?" : "Debit Merchant Wallet?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-[#4B5563]">
              {adjustTarget?.sign === 1
                ? `Add ${npr(Math.round((adjustTarget?.amount || 0) * 100))} to ${merchant.business_name || "this merchant"}'s wallet?`
                : `Deduct ${npr(Math.round((adjustTarget?.amount || 0) * 100))} from ${merchant.business_name || "this merchant"}'s wallet?`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-[#F59E0B]/20 bg-[#FEF7E0]/50 p-3 space-y-2 text-xs my-1">
            <div className="flex justify-between items-center">
              <span className="text-[#92400E] font-semibold">Adjustment:</span>
              <span className={`font-bold text-sm ${adjustTarget?.sign === 1 ? "text-emerald-700" : "text-red-700"}`}>
                {adjustTarget?.sign === 1 ? "+" : "-"}{npr(Math.round((adjustTarget?.amount || 0) * 100))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#92400E] font-semibold">Current Balance:</span>
              <span className="font-semibold text-[#1F2937]">{npr(merchant.wallet_balance_paisa)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#92400E] font-semibold">New Balance:</span>
              <span className="font-bold text-[#1F2937]">
                {npr(merchant.wallet_balance_paisa + (adjustTarget?.sign || 1) * Math.round((adjustTarget?.amount || 0) * 100))}
              </span>
            </div>
            {adjustTarget?.note && (
              <div className="pt-1.5 border-t border-[#F59E0B]/20">
                <span className="text-[#92400E] font-semibold block text-[11px]">Reason:</span>
                <p className="text-[#4B5563] text-xs break-words">{adjustTarget.note}</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-code" className="text-xs font-semibold text-[#1F2937]">Authenticator code</Label>
            <Input
              id="adjust-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={adjustCode}
              onChange={(e) => setAdjustCode(e.target.value.replace(/D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && adjustCode.length === 6 && !busy) confirmAdjust() }}
              className={`${inputCls} h-11 bg-white text-center tracking-[0.4em] text-lg`}
              disabled={busy}
              autoFocus
            />
            <p className="text-[11px] text-[#6B7280]">Enter the 6-digit code from your admin authenticator app. Needed every time money is moved.</p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={busy}
              onClick={() => setAdjustTarget(null)}
              className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold h-10"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={busy || adjustCode.length !== 6}
              onClick={confirmAdjust}
              className={`rounded-xl text-white font-semibold text-xs sm:text-sm h-10 shadow-sm ${
                adjustTarget?.sign === 1
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {busy ? "Processing…" : adjustTarget?.sign === 1 ? "Confirm Credit" : "Confirm Debit"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-[#1F2937]">Top-up history</h4>
        {!topups.data ? <p className="text-sm text-[#4B5563]">Loading...</p> : topups.data.rows.length === 0 ? (
          <p className="text-sm text-[#4B5563] rounded-lg border border-gray-200 bg-white p-4 text-center">No top-ups yet.</p>
        ) : (
          <>
            {topups.data.rows.map((t) => <TopupCard key={t.id} t={t} onChanged={changed} />)}
            <Pager page={topups.page} total={topups.data.total} onPage={topups.setPage} />
          </>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-[#1F2937]">Statement</h4>
        {!ledger.data ? <p className="text-sm text-[#4B5563]">Loading...</p> : ledger.data.rows.length === 0 ? (
          <p className="text-sm text-[#4B5563] rounded-lg border border-gray-200 bg-white p-4 text-center">No wallet activity yet.</p>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {ledger.data.rows.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1F2937]">{KIND[l.kind] || l.kind}{l.note ? <span className="font-normal text-[#6B7280]"> · {l.note}</span> : null}</p>
                    <p className="text-xs text-[#6B7280]">{fmtDate(l.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold ${l.amountPaisa > 0 ? "text-emerald-600" : "text-[#1F2937]"}`}>{l.amountPaisa > 0 ? "+" : "−"}{npr(Math.abs(l.amountPaisa))}</p>
                    <p className="text-xs text-[#6B7280]">Bal {npr(l.balanceAfterPaisa)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Pager page={ledger.page} total={ledger.data.total} onPage={ledger.setPage} />
          </>
        )}
      </div>
    </div>
  )
}

export function OrdersTab({ merchant, onChanged, refreshKey = 0 }: { merchant: MerchantListRow; onChanged: () => void; refreshKey?: number }) {
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [includeTest, setIncludeTest] = useState(false)
  const [refundTarget, setRefundTarget] = useState<AdminOrderRow | null>(null)
  const [refundNote, setRefundNote] = useState("")
  const [refunding, setRefunding] = useState(false)

  const orders = useServerPage<AdminOrderRow>(async (p) => {
    const r = await listMerchantOrdersAdminAction(merchant.id, p, search, includeTest)
    return r.success ? r : null
  }, [merchant.id, refreshKey, search, includeTest])
  useEffect(() => { const t = setTimeout(() => { setSearch(q); orders.setPage(1) }, 350); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmRefund = async () => {
    if (!refundTarget) return
    const trimmed = refundNote.trim()
    if (trimmed.length < 3) {
      toast.error("Please enter a reason with at least 3 characters.")
      return
    }
    setRefunding(true)
    const res = await refundMerchantOrderAction(refundTarget.id, trimmed)
    setRefunding(false)
    if (!res.success) return toast.error(res.error || "Failed to refund order")
    toast.success("Order refunded to wallet")
    setRefundTarget(null)
    setRefundNote("")
    orders.load()
    onChanged()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search product, customer email or name, reference" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} h-10 pl-9 bg-white`} aria-label="Search orders" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-[#4B5563] font-medium cursor-pointer select-none">
          <input type="checkbox" checked={includeTest} onChange={(e) => { setIncludeTest(e.target.checked); orders.setPage(1) }} className="h-4 w-4 accent-[#7E3AF2]" />
          Include test orders
        </label>
      </div>
      {!orders.data ? <p className="text-sm text-[#4B5563] text-center py-8">Loading orders...</p> : orders.data.rows.length === 0 ? (
        <p className="text-sm text-[#4B5563] rounded-lg border border-gray-200 bg-white p-6 text-center">{search ? "No orders match." : "No orders yet."}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <Table className="min-w-[860px]">
              <TableHeader className="bg-[#FEF7E0]/40">
                <TableRow>{["Date", "Product", "Customer", "Total", "Status", ""].map((h) => <TableHead key={h} className="text-[#1F2937] font-bold text-xs uppercase tracking-wider">{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {orders.data.rows.map((o) => (
                  <TableRow key={o.id} className="border-b border-gray-100">
                    <TableCell className="text-xs text-[#4B5563] py-3">{fmtDate(o.createdAt)}<div className="text-[11px] uppercase font-semibold">{o.source}{o.isTest ? " · test" : ""}</div></TableCell>
                    <TableCell className="py-3"><div className="text-sm font-semibold text-[#1F2937]">{o.product}</div><div className="text-xs text-[#6B7280]">{o.denomination} × {o.quantity}{o.clientRef && o.source === "api" ? ` · merchant ref ${o.clientRef}` : ""}</div></TableCell>
                    <TableCell className="py-3">
                      {o.customer ? (
                        <><div className="text-sm text-[#1F2937]">{o.customer.name || "—"}</div><div className="text-xs text-[#6B7280]">{o.customer.email}{o.customer.phone ? ` · ${o.customer.phone}` : ""}</div></>
                      ) : <span className="text-xs text-[#9CA3AF]">Dashboard order</span>}
                    </TableCell>
                    <TableCell className="text-sm font-bold py-3">{npr(o.totalPaisa)}</TableCell>
                    <TableCell className="py-3">{o.status === "completed" ? pill(["Completed", "bg-emerald-100 text-emerald-900 border-emerald-300"]) : o.status === "pending" ? pill(["Waiting for codes", "bg-blue-100 text-blue-900 border-blue-300"]) : <span title={o.refundNote || ""}>{pill(["Refunded", "bg-amber-100 text-amber-900 border-amber-300"])}</span>}</TableCell>
                    <TableCell className="text-right py-3">
                      {o.status === "pending" && <FillOrderButton order={o} onDone={() => { orders.load(); onChanged() }} />}
                      {o.status !== "refunded" && !o.isTest && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRefundTarget(o)
                            setRefundNote("")
                          }}
                          className="h-8 px-2.5 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50 font-semibold"
                        >
                          Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={orders.page} total={orders.data.total} onPage={orders.setPage} />
        </>
      )}

      <AlertDialog open={!!refundTarget} onOpenChange={(open) => { if (!open && !refunding) setRefundTarget(null) }}>
        <AlertDialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1F2937]">Refund Order</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-[#4B5563]">
              {refundTarget?.status === "pending"
                ? `Cancel this order and refund ${refundTarget ? npr(refundTarget.totalPaisa) : ""} to the merchant's wallet?`
                : `Refund ${refundTarget ? npr(refundTarget.totalPaisa) : ""} to the merchant's wallet?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {refundTarget && (
            <div className="rounded-xl border border-[#F59E0B]/20 bg-[#FEF7E0]/40 p-3 text-xs text-[#1F2937] space-y-1">
              <div className="font-semibold">{refundTarget.product}</div>
              <div className="text-[#6B7280]">
                {refundTarget.denomination} × {refundTarget.quantity} · Total: <span className="font-bold text-[#1F2937]">{npr(refundTarget.totalPaisa)}</span>
              </div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleConfirmRefund()
            }}
            className="space-y-4 pt-1"
          >
            <div className="space-y-1.5">
              <Label htmlFor="merchant-refund-reason" className="text-xs font-semibold text-[#1F2937]">
                Refund reason *
              </Label>
              <Input
                id="merchant-refund-reason"
                placeholder={refundTarget?.status === "pending" ? 'e.g. "out of stock"' : 'e.g. "code did not work"'}
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                maxLength={300}
                required
                className={`${inputCls} h-10`}
                autoFocus
              />
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel
                type="button"
                disabled={refunding}
                onClick={() => setRefundTarget(null)}
                className="rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs sm:text-sm font-semibold h-9"
              >
                Cancel
              </AlertDialogCancel>
              <Button
                type="submit"
                disabled={refunding || refundNote.trim().length < 3}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm h-9 shadow-sm"
              >
                {refunding ? "Refunding…" : "Confirm & Refund"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Fill a pending order: type the codes in, or take them from stock. Cancelling is the Refund button. */
export function FillOrderButton({ order, onDone }: { order: AdminOrderRow; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [codes, setCodes] = useState("")
  const [busy, setBusy] = useState(false)
  const count = codes.split(/\r?\n/).filter((c) => c.trim()).length
  const run = async (fromStock: boolean) => {
    setBusy(true)
    const res = await fulfilMerchantOrderAction(order.id, fromStock ? null : codes)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Order filled. The merchant now has the codes.")
    setOpen(false)
    setCodes("")
    onDone()
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 px-2.5 mr-2 text-xs bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold">Fill order</Button>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-w-md rounded-2xl bg-white p-4 sm:p-6 shadow-xl border-2 border-[#F59E0B]/30">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#1F2937]">Fill order</DialogTitle>
          <DialogDescription className="text-xs text-[#4B5563]">{order.product} · {order.denomination} × {order.quantity} · already paid {npr(order.totalPaisa)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-[#1F2937]">Codes, one per line ({count}/{order.quantity})</Label>
          <Textarea value={codes} onChange={(e) => setCodes(e.target.value)} rows={Math.min(8, Math.max(3, order.quantity))} className={`${inputCls} font-mono text-sm`} placeholder="XXXX-XXXX-XXXX" />
          <p className="text-xs text-[#6B7280]">Codes are encrypted and delivered to the merchant straight away, with an order.completed webhook.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button disabled={busy || count !== order.quantity} onClick={() => run(false)} className="flex-1 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold">Deliver these codes</Button>
          <Button disabled={busy} variant="outline" onClick={() => run(true)} className="flex-1 border-[#F59E0B] text-[#92400E] bg-[#FEF7E0] font-semibold">Use codes from stock</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function InventoryTab({ merchant, refreshKey = 0, onChanged }: { merchant: MerchantListRow; refreshKey?: number; onChanged: () => void }) {
  const [inv, setInv] = useState<MerchantInventoryView | null>(null)
  const [form, setForm] = useState({ productId: "", label: "", codes: "" })
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await getMerchantInventoryAction(merchant.id)
    if (!r.success) return toast.error(r.error)
    setInv(r.data)
  }, [merchant.id])
  useEffect(() => { load() }, [load, refreshKey])
  const paged = usePaged(inv?.rows || [])

  if (!inv) return <p className="text-sm text-[#4B5563] text-center py-8">Loading inventory...</p>
  const labels = inv.products.find((p) => p.id === form.productId)?.labels || []
  const count = form.codes.split(/\r?\n/).map((c) => c.trim()).filter(Boolean).length

  const add = async () => {
    setBusy(true)
    const r = await addMerchantInventoryCodesAction(merchant.id, form.productId, form.label, form.codes)
    setBusy(false)
    if (!r.success) return toast.error(r.error)
    toast.success(`Added ${r.added} code${r.added === 1 ? "" : "s"}${r.duplicates ? `, ${r.duplicates} duplicates skipped` : ""}${r.failed ? `, ${r.failed} failed` : ""}${r.filled ? `. ${r.filled} waiting order${r.filled === 1 ? "" : "s"} filled` : ""}`)
    setForm({ ...form, codes: "" })
    load()
  }
  const toggleManual = async (on: boolean) => {
    const r = await setMerchantManualDeliveryAction(merchant.id, on)
    if (!r.success) return toast.error(r.error)
    toast.success(on ? "Out-of-stock API orders will wait for manual delivery" : "Out-of-stock API orders will be refused")
    load()
    onChanged()
  }
  const toggleGlobal = async (on: boolean) => {
    const r = await setMerchantGlobalInventoryAction(merchant.id, on)
    if (!r.success) return toast.error(r.error)
    toast.success(on ? "Merchant can also buy from shared stock" : "Merchant now buys only from their own stock")
    load()
    onChanged()
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Use shared Byiora stock</p>
          <p className="text-xs text-[#4B5563] mt-0.5">Orders always use this merchant&apos;s own codes first. When on, they fall back to the shared stock; when off, they can only buy what you load here.</p>
        </div>
        <Switch checked={inv.useGlobal} onCheckedChange={toggleGlobal} aria-label="Use shared stock" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#1F2937]">Manual delivery when out of stock</p>
          <p className="text-xs text-[#4B5563] mt-0.5">On: API orders for an out-of-stock amount are accepted and charged, then wait in Pending orders until you deliver the codes. The catalog shows &quot;Delivery delay&quot;. Off: those orders are refused with OUT_OF_STOCK (not charged) and the catalog shows &quot;Out of stock&quot;.</p>
        </div>
        <Switch checked={inv.manualDelivery} onCheckedChange={toggleManual} aria-label="Manual delivery when out of stock" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-bold text-[#1F2937]">Add codes for this merchant only</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, label: "" })} className={`h-10 border px-3 text-sm bg-white ${inputCls}`} aria-label="Product">
            <option value="">Choose product…</option>
            {inv.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} disabled={!form.productId} className={`h-10 border px-3 text-sm bg-white ${inputCls}`} aria-label="Amount">
            <option value="">Choose amount…</option>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <Textarea value={form.codes} onChange={(e) => setForm({ ...form, codes: e.target.value })} rows={5} placeholder="One code per line" className={`${inputCls} font-mono text-sm`} aria-label="Codes" />
        <Button size="sm" disabled={busy || !form.productId || !form.label || !count} onClick={add} className="h-9 bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-semibold">{busy ? "Adding…" : `Add ${count || ""} code${count === 1 ? "" : "s"}`}</Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-[#1F2937]">Own stock</h4>
        {inv.rows.length === 0 ? (
          <p className="text-sm text-[#4B5563] rounded-lg border border-gray-200 bg-white p-4 text-center">No codes reserved for this merchant yet.</p>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
              {paged.pageItems.map((r) => (
                <div key={`${r.productId}-${r.label}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0"><p className="font-semibold text-[#1F2937] truncate">{r.productName}</p><p className="text-xs text-[#6B7280]">{r.label}</p></div>
                  <div className="text-right shrink-0"><p className={`font-bold ${r.available ? "text-emerald-600" : "text-gray-400"}`}>{r.available} available</p><p className="text-xs text-[#6B7280]">{r.delivered} sold</p></div>
                </div>
              ))}
            </div>
            <Pager page={paged.page} total={paged.total} onPage={paged.setPage} />
          </>
        )}
      </div>
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  "merchant.invited": "Invited", "merchant.password_changed": "Changed password", "merchant.email_verified": "Confirmed email", "merchant.mfa_enabled": "Turned on 2FA", "merchant.mfa_disabled": "Turned off 2FA",
  "kyc.submitted": "Submitted KYC", "kyc.approved": "KYC approved", "kyc.rejected": "KYC rejected", "kyc.more_info": "KYC: more info requested",
  "order.placed": "Order placed", "order.refunded": "Order refunded", "order.fulfilled": "Pending order filled", "delivery.manual_on": "Manual delivery turned on", "notification.sent": "Notification sent", "notification.deleted": "Notification deleted", "delivery.manual_off": "Manual delivery turned off", "merchant.password_reset_requested": "Asked for a password reset", "merchant.password_reset": "Reset password by email", "topup.requested": "Requested manual top-up", "topup.approved": "Top-up approved", "topup.rejected": "Top-up rejected",
  "topup.fonepay_started": "Started Fonepay top-up", "topup.fonepay_paid": "Fonepay top-up paid", "wallet.adjusted": "Wallet adjusted", "merchant.terms_updated": "Terms updated",
  "pricing.updated": "Prices updated", "pricing.catalog_mode": "Catalog mode changed", "api_key.created": "API key created", "api_key.revoked": "API key revoked",
  "webhook.updated": "Webhook settings changed", "inventory.added": "Codes added", "inventory.global_on": "Shared stock on", "inventory.global_off": "Shared stock off",
  "merchant.status.active": "Reactivated", "merchant.status.suspended": "Suspended", "merchant.status.banned": "Banned", "merchant.credentials_reset": "New password sent",
}

export function ActivityTab({ merchant, refreshKey = 0 }: { merchant: MerchantListRow; refreshKey?: number }) {
  const log = useServerPage<AuditRow>(async (p) => {
    const r = await listMerchantAuditAction(merchant.id, p)
    return r.success ? r : null
  }, [merchant.id, refreshKey])
  if (!log.data) return <p className="text-sm text-[#4B5563] text-center py-8">Loading activity...</p>
  if (!log.data.rows.length) return <p className="text-sm text-[#4B5563] rounded-lg border border-gray-200 bg-white p-6 text-center">No activity yet.</p>
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {log.data.rows.map((r) => {
          const details = Object.entries(r.details || {}).filter(([, v]) => v != null && typeof v !== "object").slice(0, 4)
          return (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1F2937]">{ACTION_LABEL[r.action] || r.action}</p>
                {details.length > 0 && <p className="text-xs text-[#6B7280] truncate">{details.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
              </div>
              <div className="text-xs text-[#6B7280] sm:text-right shrink-0">
                <span className="capitalize font-semibold">{r.actorType}</span>{r.ip ? ` · ${r.ip}` : ""}
                <div>{fmtDate(r.createdAt)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <Pager page={log.page} total={log.data.total} onPage={log.setPage} />
    </div>
  )
}
