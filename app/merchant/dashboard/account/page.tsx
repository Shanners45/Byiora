"use client"

import { useEffect, useState } from "react"
import { Building2, ShieldCheck, CheckCircle2, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMerchantState } from "@/lib/merchant/context"
import { getMyKycAction, type MyKyc } from "@/app/actions/merchant"
import { VerificationPanel } from "@/components/merchant/verification-panel"
import { SecurityPanel } from "@/components/merchant/security-panel"
import { amberCard, fmtDateTime, InfoBox, PageHeader } from "@/components/merchant/ui"

const TABS = ["business", "security"] as const
type Tab = (typeof TABS)[number]
const tabCls = "data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#92400E] hover:text-[#B45309] font-bold flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap shrink-0"
const KYC: Record<string, [string, string]> = {
  not_submitted: ["Not verified", "bg-slate-100 text-slate-700 border-slate-300"],
  submitted: ["Under review", "bg-purple-100 text-purple-900 border-purple-300"],
  more_info: ["Changes needed", "bg-amber-100 text-amber-900 border-amber-300"],
  rejected: ["Not approved", "bg-red-100 text-red-800 border-red-300"],
  approved: ["Verified", "bg-emerald-100 text-emerald-900 border-emerald-300"],
}

export default function MerchantAccount() {
  const { state, tick } = useMerchantState()
  const m = state.merchant
  const [tab, setTab] = useState<Tab>("business")
  const [kyc, setKyc] = useState<MyKyc | undefined>(undefined)

  // ?tab=security from links elsewhere in the portal (older ?tab=verification lands here too).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab
    if (TABS.includes(t)) setTab(t)
  }, [])
  useEffect(() => { getMyKycAction().then(setKyc) }, [tick])
  const change = (t: string) => {
    setTab(t as Tab)
    window.history.replaceState(null, "", `?tab=${t}`)
  }

  const verified = m.kycStatus === "approved"
  const needsForm = !verified && m.kycStatus !== "submitted"
  const [kycLabel, kycCls] = KYC[m.kycStatus]

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Account" subtitle="Your business, verification and sign-in security." />
      <Tabs value={tab} onValueChange={change} className="space-y-5">
        <div className="w-full overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-auto bg-[#FEF7E0]/70 border-2 border-[#F59E0B]/30 p-1 rounded-xl shadow-xs gap-1">
            <TabsTrigger value="business" className={tabCls}><Building2 className="h-4 w-4" />Business &amp; verification</TabsTrigger>
            <TabsTrigger value="security" className={tabCls}><ShieldCheck className="h-4 w-4" />Security</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="business" className="space-y-5 sm:space-y-6">
          <Card className={`${amberCard} overflow-hidden`}>
            <CardHeader className="px-4 sm:px-6 py-4 border-b border-[#F59E0B]/20 flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-[#1F2937] text-lg font-bold">{m.businessName}</CardTitle>
                <CardDescription className="text-[#92400E]">To change these details, email support@byiora.com.np</CardDescription>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${kycCls}`}>
                {verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : m.kycStatus === "submitted" ? <Clock className="h-3.5 w-3.5" /> : null}
                {kycLabel}
              </span>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoBox label="Registered name">{kyc?.legalName || m.businessName}</InfoBox>
              <InfoBox label="PAN / VAT">{kyc?.panNumber ? <span className="font-mono">{kyc.panNumber}</span> : "—"}</InfoBox>
              <InfoBox label="Business address">{kyc?.address || "—"}</InfoBox>
              <InfoBox label="Contact person">{m.contactName}</InfoBox>
              <InfoBox label="Email">{m.email}</InfoBox>
              <InfoBox label="Phone">{m.phone || "—"}</InfoBox>
              <InfoBox label="Merchant since">{new Date(m.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</InfoBox>
              <InfoBox label="Account status">{m.status === "active" ? "Active" : "Suspended"}</InfoBox>
              <InfoBox label="Verification">{verified ? "Verified" : m.kycStatus === "submitted" && kyc ? `Submitted ${fmtDateTime(kyc.createdAt)}` : kycLabel}</InfoBox>
            </CardContent>
          </Card>

          {m.kycStatus === "submitted" && (
            <p className="text-sm text-purple-900 rounded-xl border-2 border-purple-200 bg-purple-50 p-3.5">Your documents are under review. We&apos;ll email you when your account is unlocked, usually within 1–2 business days.</p>
          )}
          {needsForm && <VerificationPanel />}
        </TabsContent>
        <TabsContent value="security"><SecurityPanel /></TabsContent>
      </Tabs>
    </div>
  )
}
