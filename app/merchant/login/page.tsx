"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { TurnstileWidget, currentTurnstileToken } from "@/components/turnstile-widget"
import { createClient } from "@/lib/supabase/client"
import {
  getMerchantStateAction,
  loginMerchantAction,
  changeMerchantPasswordAction,
  sendMerchantEmailCodeAction,
  verifyMerchantEmailCodeAction,
  logoutMerchantAction,
  requestMerchantPasswordResetAction,
  resetMerchantPasswordAction,
} from "@/app/actions/merchant"

type Step = "credentials" | "mfa" | "password" | "email" | "forgot" | "reset"

const inputCls = "bg-[#F9FAFB] border-[#E5E7EB] text-gray-900 placeholder:text-gray-400 focus:border-[#7E3AF2] focus:ring-[#7E3AF2] rounded-xl h-11 text-sm"
const primaryCls = "w-full bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm"

const STEP_COPY: Record<Step, [string, string]> = {
  credentials: ["Merchant Sign In", "Enter your credentials to continue"],
  mfa: ["Two-Factor Authentication", "Enter the 6-digit code from your authenticator app"],
  password: ["Choose a New Password", "Create a secure password for your account"],
  email: ["Confirm Your Email", "We sent a 6-digit code to your inbox"],
  forgot: ["Reset Your Password", "We'll email you a 6-digit code"],
  reset: ["Choose a New Password", "Enter the code from your email and a new password"],
}

function CodeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Input
      id="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={`${inputCls} text-center tracking-[0.4em] text-lg`}
      disabled={disabled}
      autoFocus
    />
  )
}

export default function MerchantLogin() {
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [codeSent, setCodeSent] = useState(false)

  const goToDashboard = () => {
    // Full navigation so the server reads the latest session cookie.
    window.location.href = "/merchant/dashboard"
  }
  const goTo = (stage: string) => {
    setCode("")
    if (stage === "ready") return goToDashboard()
    setStep(stage as Step)
  }

  // Resume where a signed-in merchant left off.
  useEffect(() => {
    getMerchantStateAction()
      .then((s) => (s ? goTo(s.stage) : setStep("credentials")))
      .catch(() => setStep("credentials"))
  }, [])

  // Send the email code once when that step opens.
  useEffect(() => {
    if (step !== "email" || codeSent) return
    setCodeSent(true)
    sendMerchantEmailCodeAction().then((r) => (r.success ? toast.success("Code sent. Check your inbox.") : toast.error(r.error)))
  }, [step, codeSent])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch {
      toast.error("Something went wrong. Please try again.")
    }
    setBusy(false)
  }

  const signIn = (e: React.FormEvent) => {
    e.preventDefault()
    const token = currentTurnstileToken(e.currentTarget as HTMLFormElement, captchaToken)
    if (!token) return toast.error("Complete the captcha first.")
    run(async () => {
      const r = await loginMerchantAction(email, password, token)
      if (!r.success) return void toast.error(r.error)
      setPassword("")
      goTo(r.stage)
    })
  }

  const verifyMfa = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const supabase = createClient({ merchant: true })
      const { data } = await supabase.auth.mfa.listFactors()
      const factorId = data?.totp?.[0]?.id
      if (!factorId) return void toast.error("No authenticator found on this account.")
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) {
        setCode("")
        return void toast.error("That code didn't work. Try the newest code.")
      }
      const s = await getMerchantStateAction()
      goTo(s?.stage || "credentials")
    })
  }

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return toast.error("The passwords don't match.")
    run(async () => {
      const r = await changeMerchantPasswordAction(newPassword)
      if (!r.success) return void toast.error(r.error)
      toast.success("Password updated.")
      setNewPassword("")
      setConfirmPassword("")
      const s = await getMerchantStateAction()
      goTo(s?.stage || "credentials")
    })
  }

  const verifyEmail = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const r = await verifyMerchantEmailCodeAction(code)
      if (!r.success) {
        setCode("")
        return void toast.error(r.error)
      }
      toast.success("Email confirmed.")
      goToDashboard()
    })
  }

  const requestReset = (e: React.FormEvent) => {
    e.preventDefault()
    const token = currentTurnstileToken(e.currentTarget as HTMLFormElement, captchaToken)
    if (!token) return toast.error("Complete the captcha first.")
    run(async () => {
      const r = await requestMerchantPasswordResetAction(email, token)
      if (!r.success) return void toast.error(r.error)
      toast.success(r.message)
      setCode("")
      setStep("reset")
    })
  }

  const doReset = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return toast.error("The passwords don't match.")
    run(async () => {
      const r = await resetMerchantPasswordAction(email, code, newPassword)
      if (!r.success) return void toast.error(r.error)
      toast.success("Password changed. Sign in with your new password.")
      setCode("")
      setNewPassword("")
      setConfirmPassword("")
      setCaptchaToken("")
      setStep("credentials")
    })
  }

  const resendCode = () =>
    run(async () => {
      const r = await sendMerchantEmailCodeAction()
      r.success ? toast.success("New code sent.") : toast.error(r.error)
    })

  const signOut = () =>
    run(async () => {
      await logoutMerchantAction()
      window.location.reload()
    })

  if (!step) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200"></div>
      </div>
    )
  }

  const codeReady = /^\d{6}$/.test(code)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-4 py-8" style={{ colorScheme: "light" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Image src="https://www.byiora.com.np/logo-final.png" alt="Byiora" width={160} height={56} style={{ objectFit: "contain", width: "auto", height: 56 }} priority unoptimized />
          </div>
        </div>

        <Card className="border border-[#E5E7EB] shadow-xl bg-white rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-center text-2xl font-bold text-[#1F2937]">{STEP_COPY[step][0]}</CardTitle>
            <CardDescription className="text-center text-[#4B5563]">{STEP_COPY[step][1]}</CardDescription>
          </CardHeader>

          {step === "credentials" && (
            <form onSubmit={signIn}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#1F2937] font-semibold text-sm">Email Address</Label>
                  <Input id="email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} disabled={busy} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#1F2937] font-semibold text-sm">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} disabled={busy} />
                </div>
                <TurnstileWidget onToken={setCaptchaToken} />
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className={primaryCls} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
                <button type="button" onClick={() => { setCaptchaToken(""); setStep("forgot") }} className="text-xs font-semibold text-[#7E3AF2] hover:underline" disabled={busy}>Forgot your password?</button>
              </CardFooter>
            </form>
          )}

          {step === "mfa" && (
            <form onSubmit={verifyMfa}>
              <CardContent className="space-y-2 pt-4">
                <Label htmlFor="code" className="text-[#1F2937] font-semibold text-sm">Authentication code</Label>
                <CodeInput value={code} onChange={setCode} disabled={busy} />
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className={primaryCls} disabled={busy || !codeReady}>{busy ? "Verifying…" : "Verify and continue"}</Button>
                <Button type="button" variant="ghost" className="w-full text-[#4B5563] hover:text-[#1F2937] hover:bg-gray-100 rounded-xl" onClick={signOut} disabled={busy}>Use a different account</Button>
              </CardFooter>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={savePassword}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-[#1F2937] font-semibold text-sm">New password</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" placeholder="Enter at least 10 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10} maxLength={72} className={inputCls} disabled={busy} autoFocus />
                  <p className="text-xs text-[#6B7280]">At least 10 characters, with letters and numbers.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-[#1F2937] font-semibold text-sm">Confirm new password</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputCls} disabled={busy} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className={primaryCls} disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
                <Button type="button" variant="ghost" className="w-full text-[#4B5563] hover:text-[#1F2937] hover:bg-gray-100 rounded-xl" onClick={signOut} disabled={busy}>Sign out</Button>
              </CardFooter>
            </form>
          )}

          {step === "forgot" && (
            <form onSubmit={requestReset}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-[#1F2937] font-semibold text-sm">Email Address</Label>
                  <Input id="reset-email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} disabled={busy} autoFocus />
                </div>
                <TurnstileWidget onToken={setCaptchaToken} />
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className={primaryCls} disabled={busy}>{busy ? "Sending…" : "Email me a code"}</Button>
                <Button type="button" variant="ghost" className="w-full text-[#4B5563] hover:text-[#1F2937] hover:bg-gray-100 rounded-xl" onClick={() => { setCaptchaToken(""); setStep("credentials") }} disabled={busy}>Back to sign in</Button>
              </CardFooter>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={doReset}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-[#1F2937] font-semibold text-sm">Code sent to {email}</Label>
                  <CodeInput value={code} onChange={setCode} disabled={busy} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-new" className="text-[#1F2937] font-semibold text-sm">New password</Label>
                  <Input id="reset-new" type="password" autoComplete="new-password" placeholder="Enter at least 10 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10} maxLength={72} className={inputCls} disabled={busy} />
                  <p className="text-xs text-[#6B7280]">At least 10 characters, with letters and numbers. You'll be signed out everywhere else.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm" className="text-[#1F2937] font-semibold text-sm">Confirm new password</Label>
                  <Input id="reset-confirm" type="password" autoComplete="new-password" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputCls} disabled={busy} />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className={primaryCls} disabled={busy || !codeReady}>{busy ? "Saving…" : "Set new password"}</Button>
                <Button type="button" variant="ghost" className="w-full text-[#4B5563] hover:text-[#1F2937] hover:bg-gray-100 rounded-xl" onClick={() => { setCaptchaToken(""); setStep("forgot") }} disabled={busy}>Didn't get a code? Send again</Button>
              </CardFooter>
            </form>
          )}

          {step === "email" && (
            <form onSubmit={verifyEmail}>
              <CardContent className="space-y-2 pt-4">
                <Label htmlFor="code" className="text-[#1F2937] font-semibold">Verification code</Label>
                <CodeInput value={code} onChange={setCode} disabled={busy} />
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className={primaryCls} disabled={busy || !codeReady}>{busy ? "Checking…" : "Confirm email"}</Button>
                <Button type="button" variant="ghost" className="w-full text-[#4B5563]" onClick={resendCode} disabled={busy}>Send a new code</Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
