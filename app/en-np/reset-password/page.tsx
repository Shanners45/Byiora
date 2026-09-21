"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Header } from "@/components/header"
import Link from "next/link"
import { KeyRound, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from "lucide-react"
import { validateResetTokenAction, resetPasswordWithTokenAction } from "@/app/actions/password-reset"
import { TurnstileWidget } from "@/components/turnstile-widget"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [isValidating, setIsValidating] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string>("")

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [rateLimitCooldown, setRateLimitCooldown] = useState<number>(0)

  // Validate token on mount
  useEffect(() => {
    let isMounted = true

    async function checkToken() {
      if (!token || token.trim().length < 20) {
        if (isMounted) {
          setTokenError("Missing or invalid password reset token. Please use the complete link sent to your email.")
          setIsValidating(false)
        }
        return
      }

      try {
        const res = await validateResetTokenAction(token)
        if (!isMounted) return

        if (res.valid) {
          setMaskedEmail(res.maskedEmail || "")
          setTokenError(null)
        } else {
          setTokenError(res.error || "This reset link is invalid or has expired.")
        }
      } catch (err: any) {
        if (isMounted) {
          setTokenError("Failed to validate reset link. Please try again.")
        }
      } finally {
        if (isMounted) {
          setIsValidating(false)
        }
      }
    }

    checkToken()

    return () => {
      isMounted = false
    }
  }, [token])

  // Countdown timer for rate limiting
  useEffect(() => {
    if (rateLimitCooldown <= 0) return
    const timer = setInterval(() => {
      setRateLimitCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [rateLimitCooldown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rateLimitCooldown > 0) {
      toast.error(`Rate limited. Please wait ${rateLimitCooldown} seconds before trying again.`)
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    const hasTurnstileKey = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (hasTurnstileKey && !captchaToken) {
      toast.error("Please complete the security verification challenge.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await resetPasswordWithTokenAction({
        token,
        newPassword,
        confirmPassword,
        captchaToken,
      })

      if (res.success) {
        setIsSuccess(true)
        toast.success("Password updated successfully!")
      } else {
        if (res.error?.toLowerCase().includes("too many") || res.error?.toLowerCase().includes("minute")) {
          const match = res.error?.match(/(\d+)\s*minute/)
          const minutes = match ? parseInt(match[1], 10) : 1
          setRateLimitCooldown(Math.max(60, minutes * 60))
        }
        toast.error(res.error || "Failed to update password")
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-[500px] bg-[#3a1a4f] border border-[#4a2a5f] rounded-3xl p-8 md:p-12 shadow-2xl z-10 transition-all duration-300">
      {/* ── 1. Validating State ── */}
      {isValidating ? (
        <div className="text-center py-8 space-y-4">
          <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin mx-auto" />
          <h2 className="text-white text-lg font-bold">Verifying Reset Link...</h2>
          <p className="text-white/60 text-sm">Please wait a moment while we authenticate your link.</p>
        </div>
      ) : isSuccess ? (
        /* ── 2. Success State ── */
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-white text-2xl md:text-3xl font-bold mb-3">Password Updated!</h1>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            Your password has been successfully reset. All previous sessions have been signed out for security.
            You can now sign in with your new password.
          </p>
          <Link href="/en-np/sign-up">
            <Button className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200">
              Sign In Now
            </Button>
          </Link>
        </div>
      ) : tokenError ? (
        /* ── 3. Invalid or Expired Token State ── */
        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-white text-2xl font-bold mb-2">Link Invalid or Expired</h1>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            {tokenError}
          </p>
          <div className="space-y-3">
            <Link href="/en-np/forgot-password">
              <Button className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200">
                Request a New Reset Link
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* ── 4. Main Direct Password Input Holder ── */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-[#FFD700]" />
            </div>
            <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">Set New Password</h1>
            <p className="text-white/60 text-sm">
              Enter your new password below
              {maskedEmail ? (
                <> for <span className="text-[#FFD700] font-semibold">{maskedEmail}</span>.</>
              ) : (
                "."
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-white/80 ml-1 text-sm font-medium">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoFocus
                  className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-white/80 ml-1 text-sm font-medium">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Security Verification (Cloudflare Turnstile) */}
            <div className="py-1">
              <TurnstileWidget onToken={setCaptchaToken} />
            </div>

            {/* Rate Limit Alert */}
            {rateLimitCooldown > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Rate limit in effect: Please wait {rateLimitCooldown}s before resubmitting.</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                newPassword.length < 8 ||
                !confirmPassword ||
                rateLimitCooldown > 0 ||
                (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)
              }
              className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200 disabled:opacity-50 mt-2 shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : rateLimitCooldown > 0 ? (
                `Please wait (${rateLimitCooldown}s)`
              ) : (
                "Save New Password"
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-purple">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 relative overflow-hidden bg-brand-purple">
        {/* Background Decorative Elements */}
        <div className="absolute top-20 left-10 text-[#FFD700] opacity-30 transform -rotate-12 select-none pointer-events-none">
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
            <path d="M2 18C10 2 30 2 38 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute bottom-20 right-10 text-[#FFD700] opacity-30 transform rotate-45 select-none pointer-events-none">
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
            <path d="M5 25C15 5 45 5 55 25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-[500px] bg-[#3a1a4f] border border-[#4a2a5f] rounded-3xl p-8 md:p-12 shadow-2xl z-10 flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-[#FFD700] animate-spin" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
    </div>
  )
}
