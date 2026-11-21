"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { loginAdminWithPassword } from "@/app/actions/admin-auth"
import { getAdminMfaStageAction, trustAdminDeviceAction } from "@/app/actions/admin-utils"
import { createClient } from "@/lib/supabase/client"
import { BrandLoader } from "@/components/brand-loader"

type MfaStage = "enroll" | "verify"

/** Second login step: set up (first time) or enter the authenticator-app code. */
function AdminMfaStep({ stage, onDone }: { stage: MfaStage; onDone: () => void }) {
  const supabase = createClient()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  // React runs effects twice in development; two parallel enrolls collide in Supabase.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      const { data: factors, error } = await supabase.auth.mfa.listFactors()
      if (error) return toast.error(error.message)
      if (stage === "verify") {
        const totp = factors?.totp?.[0]
        if (totp) setFactorId(totp.id)
        return
      }
      // A half-finished earlier setup blocks a new one; unverified factors are safe to drop.
      for (const f of factors?.all || []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      // Friendly names must be unique per user in Supabase.
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Byiora Admin ${crypto.randomUUID().slice(0, 8)}` })
      if (enrollError || !data) return toast.error(enrollError?.message || "Could not start 2FA setup")
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    })()
  }, [stage, supabase])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || !/^\d{6}$/.test(code)) return toast.error("Enter the 6-digit code from your authenticator app.")
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) {
      setCode("")
      return toast.error("That code didn't work. Check your phone's time and try the newest code.")
    }
    if (trustDevice) await trustAdminDeviceAction().catch(() => {})
    onDone()
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <form onSubmit={verify}>
      <CardContent className="space-y-4 pt-4">
        {stage === "enroll" ? (
          <>
            <p className="text-sm text-[#4B5563]">
              Scan this QR code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.
            </p>
            {qrCode ? (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="Two-factor setup QR code" width={180} height={180} className="rounded-lg border border-[#E5E7EB] bg-white p-2" />
                {secret && <p className="text-xs text-[#4B5563] break-all text-center">Can't scan? Enter this key: <span className="font-mono">{secret}</span></p>}
              </div>
            ) : (
              <p className="text-sm text-center text-[#4B5563]">Preparing setup…</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#4B5563]">Enter the 6-digit code from your authenticator app.</p>
        )}
        <div className="space-y-2">
          <Label htmlFor="mfa-code" className="text-[#1F2937] font-semibold text-base">Authentication code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="bg-[#F9FAFB] border-[#E5E7EB] text-gray-900 text-center tracking-[0.4em] text-lg"
            disabled={busy || !factorId}
            autoFocus
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#4B5563] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="h-4 w-4 accent-[#7E3AF2]"
          />
          Trust this device for 7 days (don&apos;t use on shared computers)
        </label>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button type="submit" className="w-full bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-medium py-2.5 rounded-xl" disabled={busy || !factorId || code.length !== 6}>
          {busy ? "Verifying…" : stage === "enroll" ? "Turn on 2FA and continue" : "Verify and continue"}
        </Button>
        <Button type="button" variant="ghost" className="w-full text-[#4B5563]" onClick={signOut}>
          Use a different account
        </Button>
      </CardFooter>
    </form>
  )
}

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState("")
  const [mfaStage, setMfaStage] = useState<MfaStage | null>(null)
  // Show the logo loader (not the form) until we know whether a session exists.
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()

  // Already signed in (trusted device or bounced from the dashboard): go straight in, or resume at 2FA.
  useEffect(() => {
    getAdminMfaStageAction()
      .then(({ stage }) => {
        if (stage === "done") return router.replace("/admin/dashboard")
        if (stage !== "none") setMfaStage(stage)
        setCheckingSession(false)
      })
      .catch(() => setCheckingSession(false))
  }, [router])

  // Full navigation so the server reads the upgraded (2FA) session cookie.
  const goToDashboard = () => {
    toast.success("Login successful!")
    window.location.href = "/admin/dashboard"
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captchaToken) {
      toast.error("Complete captcha verification first.")
      return
    }
    setIsLoading(true)
    try {
      const result = await loginAdminWithPassword(email, password, captchaToken)
      if (result.error) {
        toast.error(result.error || "Invalid credentials")
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      if (result.mfa === "done") return goToDashboard()
      setMfaStage(result.mfa === "enroll" ? "enroll" : "verify")
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Login failed. Please try again.")
      setIsLoading(false)
    }
  }

  if (checkingSession) return <BrandLoader label="Checking your session" />

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-4 py-8" style={{ colorScheme: "light" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="https://www.byiora.com.np/logo-final.png"
              alt="Byiora"
              width={160}
              height={56}
              style={{ objectFit: 'contain', width: 'auto', height: 56 }}
              priority
              unoptimized={true}
            />
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">Admin Portal</h1>
          <p className="text-sm text-[#4B5563] mt-1">Sign in to access your admin dashboard</p>
        </div>

        <Card className="border border-[#E5E7EB] shadow-xl bg-white rounded-2xl overflow-hidden">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-center text-2xl font-bold text-[#1F2937]">Welcome Back</CardTitle>
            <CardDescription className="text-center text-[#4B5563]">
              {mfaStage === "enroll" ? "Set up two-factor authentication" : mfaStage === "verify" ? "Two-factor authentication" : "Enter your credentials to continue"}
            </CardDescription>
          </CardHeader>
          {mfaStage ? (
            <AdminMfaStep stage={mfaStage} onDone={goToDashboard} />
          ) : (
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1F2937] font-semibold text-base">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-[#F9FAFB] border-[#E5E7EB] text-gray-900 placeholder:text-gray-400 focus:border-[#7E3AF2] focus:ring-[#7E3AF2]"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#1F2937] font-semibold text-base">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-[#F9FAFB] border-[#E5E7EB] text-gray-900 placeholder:text-gray-400 focus:border-[#7E3AF2] focus:ring-[#7E3AF2]"
                  disabled={isLoading}
                />
              </div>
              <TurnstileWidget onToken={setCaptchaToken} />
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-[#7E3AF2] hover:bg-[#6C2BD9] text-white font-medium py-2.5 rounded-xl shadow-md transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </CardFooter>
          </form>
          )}
        </Card>
      </div>
    </div>
  )
}
