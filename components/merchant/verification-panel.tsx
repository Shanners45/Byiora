"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Clock, Upload, FileText, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useMerchantState } from "@/lib/merchant/context"
import { KYC_DOC_TYPES, KYC_MAX_BYTES, KYC_MIME, REQUIRED_KYC_DOCS, type KycDocType } from "@/lib/merchant/kyc"
import { createKycUploadAction, getMyKycAction, submitKycAction, type MyKyc } from "@/app/actions/merchant"
import { amberCard, InfoBox, inputCls, primaryBtn, Spinner } from "@/components/merchant/ui"

const BUSINESS_TYPES = {
  sole_proprietorship: "Sole proprietorship",
  partnership: "Partnership firm",
  private_limited: "Private limited company",
  public_limited: "Public limited company",
  other: "Other",
} as const

type Uploaded = { path: string; name: string }
const labelCls = "text-[#1F2937] font-semibold text-sm"

function KycForm({ previous, onSubmitted }: { previous: MyKyc; onSubmitted: () => void }) {
  const [form, setForm] = useState({
    legalName: previous?.legalName || "",
    businessType: previous?.businessType || "",
    panNumber: previous?.panNumber || "",
    registrationNumber: previous?.registrationNumber || "",
    address: previous?.address || "",
    website: previous?.website || "",
  })
  const [files, setFiles] = useState<Partial<Record<KycDocType, Uploaded>>>({})
  const [uploading, setUploading] = useState<KycDocType | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  const upload = async (type: KycDocType, file: File | undefined) => {
    if (!file) return
    if (!(file.type in KYC_MIME)) return toast.error("Upload a PDF, JPG or PNG.")
    if (file.size > KYC_MAX_BYTES) return toast.error("Each file must be 5 MB or smaller.")
    setUploading(type)
    try {
      const slot = await createKycUploadAction(type, file.type, file.size)
      if (!slot.success) return void toast.error(slot.error)
      const { error } = await createClient({ merchant: true }).storage.from("merchant-kyc").uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
      if (error) return void toast.error("Upload failed. Please try again.")
      setFiles((f) => ({ ...f, [type]: { path: slot.path, name: file.name } }))
    } finally {
      setUploading(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const missing = REQUIRED_KYC_DOCS.find((t) => !files[t])
    if (missing) return toast.error(`Upload: ${KYC_DOC_TYPES[missing]}`)
    setBusy(true)
    const res = await submitKycAction({ ...form, documents: Object.entries(files).map(([type, f]) => ({ type, path: f!.path })) })
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Submitted. We'll email you once it's reviewed.")
    onSubmitted()
  }

  return (
    <form onSubmit={submit} className="space-y-5 sm:space-y-6">
      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937] text-lg font-bold">1. Business information</CardTitle>
          <CardDescription className="text-[#92400E]">Enter details exactly as they appear on your registration documents</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="k-legal" className={labelCls}>Registered business name *</Label><Input id="k-legal" value={form.legalName} onChange={set("legalName")} required maxLength={160} className={inputCls} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="k-type" className={labelCls}>Business type *</Label>
            <select id="k-type" value={form.businessType} onChange={set("businessType")} required className={`flex w-full border px-3 text-sm ${inputCls}`}>
              <option value="" disabled>Choose…</option>
              {Object.entries(BUSINESS_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="k-pan" className={labelCls}>PAN / VAT number *</Label><Input id="k-pan" inputMode="numeric" value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} required placeholder="9 digits" className={inputCls} /></div>
          <div className="space-y-1.5"><Label htmlFor="k-reg" className={labelCls}>Registration number</Label><Input id="k-reg" value={form.registrationNumber} onChange={set("registrationNumber")} maxLength={60} className={inputCls} /></div>
          <div className="space-y-1.5"><Label htmlFor="k-web" className={labelCls}>Website</Label><Input id="k-web" type="url" value={form.website} onChange={set("website")} maxLength={200} placeholder="https://" className={inputCls} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="k-addr" className={labelCls}>Business address *</Label><Input id="k-addr" value={form.address} onChange={set("address")} required maxLength={300} placeholder="Street address, city" className={inputCls} /></div>
        </CardContent>
      </Card>

      <Card className={`${amberCard} overflow-hidden`}>
        <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937] text-lg font-bold">2. Documents</CardTitle>
          <CardDescription className="text-[#92400E]">PDF, JPG or PNG, up to 5 MB each.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          {(Object.keys(KYC_DOC_TYPES) as KycDocType[]).map((type) => (
            <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/20 bg-white p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${files[type] ? "bg-emerald-50" : "bg-purple-50"}`}>
                  {files[type] ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-[#7E3AF2]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1F2937]">{KYC_DOC_TYPES[type]}{REQUIRED_KYC_DOCS.includes(type) ? " *" : " (optional)"}</p>
                  <p className="text-xs text-[#6B7280] truncate">{files[type] ? files[type]!.name : "Not uploaded"}</p>
                </div>
              </div>
              <label className={`inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border text-xs font-semibold cursor-pointer shrink-0 bg-white border-purple-300 text-purple-900 ${uploading ? "opacity-50 pointer-events-none" : "hover:bg-purple-50"}`}>
                <Upload className="h-3.5 w-3.5" />
                {uploading === type ? "Uploading…" : files[type] ? "Replace" : "Upload"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(e) => { upload(type, e.target.files?.[0]); e.target.value = "" }} />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={busy || !!uploading} className={`w-full sm:w-auto h-11 px-6 rounded-xl ${primaryBtn}`}>{busy ? "Submitting…" : "Submit for verification"}</Button>
    </form>
  )
}

export function VerificationPanel() {
  const { state, refresh } = useMerchantState()
  const [kyc, setKyc] = useState<MyKyc | undefined>(undefined)

  const load = () => getMyKycAction().then(setKyc)
  useEffect(() => { load() }, [])

  if (kyc === undefined) return <Spinner label="Loading verification..." />

  const status = state.merchant.kycStatus

  if (status === "approved" || status === "submitted") {
    const approved = status === "approved"
    return (
      <div className="space-y-5 sm:space-y-6">
        <Card className={`${amberCard} overflow-hidden`}>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${approved ? "bg-emerald-100" : "bg-purple-100"}`}>
                {approved ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Clock className="h-6 w-6 text-[#7E3AF2]" />}
              </div>
              <div>
                <p className="text-lg font-bold text-[#1F2937]">{approved ? "Your business is verified" : "Under review"}</p>
                <p className="text-sm text-[#4B5563]">{approved ? "Thanks. Nothing else to do here." : "We'll email you as soon as it's reviewed, usually within 1–2 business days."}</p>
              </div>
            </div>
            {kyc && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#F59E0B]/20">
                <InfoBox label="Business name">{kyc.legalName}</InfoBox>
                <InfoBox label="PAN / VAT"><span className="font-mono">{kyc.panNumber}</span></InfoBox>
                <InfoBox label="Submitted">{new Date(kyc.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</InfoBox>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {kyc?.adminNote && (status === "more_info" || status === "rejected") && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">{status === "more_info" ? "What we need from you" : "Why it wasn't approved"}</p>
            <p className="whitespace-pre-line mt-1">{kyc.adminNote}</p>
            <p className="mt-2 text-xs">Please upload your documents again with this submission.</p>
          </div>
        </div>
      )}
      <KycForm previous={kyc} onSubmitted={() => { refresh(); load() }} />
    </div>
  )
}
