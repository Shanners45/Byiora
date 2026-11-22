"use client"

import type React from "react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { KeyRound, Smartphone, CheckCircle2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useMerchantState } from "@/lib/merchant/context"
import { changeMerchantPasswordAction, recordMerchantMfaChangeAction } from "@/app/actions/merchant"
import { amberCard, inputCls, primaryBtn } from "@/components/merchant/ui"

export function SecurityPanel() {
  const { state, refresh } = useMerchantState()

  // Password state
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busyPassword, setBusyPassword] = useState(false)

  // 2FA state
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [busyMfa, setBusyMfa] = useState(false)
  const starting = useRef(false)

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return toast.error("The new passwords don't match.")
    setBusyPassword(true)
    const res = await changeMerchantPasswordAction(next, current)
    setBusyPassword(false)
    if (!res.success) return toast.error(res.error)
    toast.success("Password changed successfully.")
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  const startSetup = async () => {
    if (starting.current) return
    starting.current = true
    setBusyMfa(true)
    const supabase = createClient({ merchant: true })
    const { data: factors } = await supabase.auth.mfa.listFactors()
    for (const f of factors?.all || []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Byiora Merchant ${crypto.randomUUID().slice(0, 8)}`,
    })
    setBusyMfa(false)
    starting.current = false
    if (error || !data) return toast.error(error?.message || "Could not start 2FA setup.")
    setSetup({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setup) return
    setBusyMfa(true)
    const { error } = await createClient({ merchant: true }).auth.mfa.challengeAndVerify({
      factorId: setup.factorId,
      code,
    })
    if (error) {
      setBusyMfa(false)
      setCode("")
      return toast.error("That code didn't work. Check your phone's time and try the newest code.")
    }
    await recordMerchantMfaChangeAction(true).catch(() => {})
    await refresh()
    setBusyMfa(false)
    setSetup(null)
    setCode("")
    toast.success("Two-factor authentication is now enabled.")
  }

  const turnOff = async () => {
    if (!window.confirm("Turn off two-factor sign-in? Your account will only be protected by your password.")) return
    setBusyMfa(true)
    const supabase = createClient({ merchant: true })
    const { data } = await supabase.auth.mfa.listFactors()
    for (const f of data?.totp || []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (error) {
        setBusyMfa(false)
        return toast.error(error.message)
      }
    }
    await supabase.auth.refreshSession()
    await recordMerchantMfaChangeAction(false).catch(() => {})
    await refresh()
    setBusyMfa(false)
    toast.success("Two-factor authentication is turned off.")
  }

  return (
    <Card className={`${amberCard} overflow-hidden shadow-sm`}>
      <CardContent className="p-4 sm:p-6 lg:p-7">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {/* Password Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#F59E0B]/15">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#7E3AF2] shrink-0">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Password</h3>
                <p className="text-xs text-[#6B7280]">At least 10 characters with letters and numbers</p>
              </div>
            </div>

            <form onSubmit={submitPassword} className="space-y-3.5 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="pw-current" className="text-[#1F2937] font-semibold text-xs">
                  Current password
                </Label>
                <Input
                  id="pw-current"
                  className={inputCls}
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-new" className="text-[#1F2937] font-semibold text-xs">
                  New password
                </Label>
                <Input
                  id="pw-new"
                  className={inputCls}
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 10 characters"
                  required
                  minLength={10}
                  maxLength={72}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-confirm" className="text-[#1F2937] font-semibold text-xs">
                  Confirm new password
                </Label>
                <Input
                  id="pw-confirm"
                  className={inputCls}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={busyPassword} className={`h-10 px-5 rounded-xl ${primaryBtn}`}>
                  {busyPassword ? "Saving…" : "Update password"}
                </Button>
              </div>
            </form>
          </div>

          {/* 2FA Section */}
          <div className="space-y-4 lg:border-l lg:border-[#F59E0B]/20 lg:pl-8 sm:pt-0 pt-6 border-t border-[#F59E0B]/20 lg:border-t-0">
            <div className="flex items-center justify-between pb-2 border-b border-[#F59E0B]/15 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    state.mfaEnabled ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#1F2937] truncate">Two-Factor Authentication (2FA)</h3>
                  <p className="text-xs text-[#6B7280] truncate">Secure wallet withdrawals and ordering access</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${
                  state.mfaEnabled
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-amber-50 text-amber-900 border-amber-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${state.mfaEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {state.mfaEnabled ? "Enabled" : "Not enabled"}
              </span>
            </div>

            {state.mfaEnabled ? (
              <div className="space-y-4 pt-1">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-900 text-sm">Two-factor sign-in is active</p>
                    <p className="text-emerald-800 mt-1">
                      Every sign-in requires a 6-digit code from your authenticator app (Google Authenticator,
                      Microsoft Authenticator, or 1Password).
                    </p>
                  </div>
                </div>
                <div>
                  <Button
                    variant="outline"
                    disabled={busyMfa}
                    onClick={turnOff}
                    className="h-10 bg-white border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 font-semibold text-xs rounded-xl"
                  >
                    {busyMfa ? "Updating…" : "Turn off two-factor sign-in"}
                  </Button>
                </div>
              </div>
            ) : setup ? (
              <form onSubmit={confirmSetup} className="space-y-3.5 pt-1">
                <p className="text-xs text-[#4B5563]">
                  1. Scan this QR code with Google Authenticator, Microsoft Authenticator, or 1Password:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-[#F59E0B]/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setup.qr}
                    alt="2FA QR Code"
                    width={130}
                    height={130}
                    className="rounded-lg border border-gray-100 shrink-0"
                  />
                  <div className="space-y-1.5 text-xs text-[#4B5563] min-w-0 w-full">
                    <p className="font-semibold text-[#1F2937]">Can&apos;t scan?</p>
                    <p className="text-[11px] text-[#6B7280]">Enter this key manually into your authenticator app:</p>
                    <div className="flex items-center gap-1.5 bg-[#FEF7E0] p-1.5 rounded-lg border border-[#F59E0B]/30">
                      <code className="font-mono text-[11px] text-[#1F2937] break-all select-all flex-1">
                        {setup.secret}
                      </code>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-[#92400E] shrink-0 hover:bg-amber-100"
                        onClick={() => {
                          navigator.clipboard.writeText(setup.secret).then(() => toast.success("Secret copied"))
                        }}
                        aria-label="Copy key"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mfa-code" className="text-[#1F2937] font-semibold text-xs">
                    2. Enter the 6-digit code from your app
                  </Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className={`${inputCls} tracking-[0.35em] text-center text-base font-bold`}
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="submit"
                    disabled={busyMfa || code.length !== 6}
                    className={`h-10 px-5 rounded-xl ${primaryBtn}`}
                  >
                    {busyMfa ? "Verifying…" : "Turn on 2FA"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSetup(null)}
                    disabled={busyMfa}
                    className="h-10 rounded-xl text-xs text-[#6B7280]"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="rounded-xl border border-[#F59E0B]/20 bg-white/70 p-3.5 space-y-2">
                  <p className="text-xs font-semibold text-[#1F2937]">Why enable two-factor authentication?</p>
                  <ul className="text-xs text-[#6B7280] space-y-1 list-disc list-inside">
                    <li>Protects against unauthorized wallet deductions and orders</li>
                    <li>Safeguards production API keys and webhook secrets</li>
                    <li>Industry standard security for merchant accounts</li>
                  </ul>
                </div>
                <div>
                  <Button disabled={busyMfa} onClick={startSetup} className={`h-10 px-5 rounded-xl ${primaryBtn}`}>
                    {busyMfa ? "Preparing…" : "Set up two-factor sign-in"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
