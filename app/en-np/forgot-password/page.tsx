"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { TurnstileWidget } from "@/components/turnstile-widget"
import Link from "next/link"
import Image from "next/image"
import { Facebook, Instagram, Youtube, ArrowLeft, KeyRound, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import { requestPasswordReset, verifyRecoveryAndResetPassword } from "@/app/actions/auth"

const OTP_LENGTH = 6
const STORAGE_KEY = "byiora_pw_reset"

function saveResetState(email: string, step: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, step, ts: Date.now() }))
  } catch {}
}

function loadResetState(): { email: string; step: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire after 15 minutes
    if (Date.now() - parsed.ts > 15 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { email: parsed.email, step: parsed.step }
  } catch {
    return null
  }
}

function clearResetState() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes("rate limit") || lower.includes("too many") || lower.includes("429") || lower.includes("email rate limit")
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [isLoading, setIsLoading] = useState(false)

  // Form fields
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")

  // OTP
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""))
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [resendCooldown, setResendCooldown] = useState(0)

  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = loadResetState()
    if (saved && saved.step === 2 && saved.email) {
      setEmail(saved.email)
      setStep(2)
    }
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (pasted.length === 0) return
    const newOtp = Array(OTP_LENGTH).fill("")
    for (let i = 0; i < OTP_LENGTH; i++) {
      newOtp[i] = pasted[i] || ""
    }
    setOtp(newOtp)
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    otpRefs.current[focusIndex]?.focus()
  }

  // Step 1: Request password reset
  // Security: Always transition to step 2 regardless of whether email exists
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("Please enter your email address")
      return
    }
    if (!captchaToken) {
      toast.error("Please complete captcha verification.")
      return
    }

    setIsLoading(true)
    try {
      const result = await requestPasswordReset(email.trim(), captchaToken)

      // Show captcha errors
      if (result.error && result.error.includes("Captcha")) {
        toast.error(result.error)
        return
      }

      // Catch rate limit
      if (result.error && isRateLimitError(result.error)) {
        toast.error("You have requested too many codes. Please wait 15 minutes and try again.")
        return
      }

      // Always transition to OTP screen with neutral message
      toast.success("If an account exists for that email, a reset code has been sent.")
      setStep(2)
      saveResetState(email.trim(), 2)
      setResendCooldown(60)
    } catch (error) {
      console.error("Reset request error:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Verify OTP + set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")

    if (code.length !== OTP_LENGTH) {
      toast.error(`Please enter the complete ${OTP_LENGTH}-digit code`)
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

    setIsLoading(true)
    try {
      const result = await verifyRecoveryAndResetPassword(email, code, newPassword)
      if (result.error) {
        if (isRateLimitError(result.error)) {
          toast.error("You have requested too many codes. Please wait 15 minutes and try again.")
        } else {
          toast.error(result.error)
        }
        setOtp(Array(OTP_LENGTH).fill(""))
        otpRefs.current[0]?.focus()
        return
      }

      clearResetState()
      setStep(3)
      toast.success("Password reset successfully!")
    } catch (error) {
      console.error("Password reset error:", error)
      toast.error("Reset failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Resend — also neutral, never reveals email existence
  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      const result = await requestPasswordReset(email.trim(), captchaToken)
      if (result.error && isRateLimitError(result.error)) {
        toast.error("You have requested too many codes. Please wait 15 minutes and try again.")
        return
      }
      toast.success("If an account exists, a new code has been sent.")
      setResendCooldown(60)
      setOtp(Array(OTP_LENGTH).fill(""))
      otpRefs.current[0]?.focus()
    } catch {
      toast.error("Failed to resend code. Please try again.")
    }
  }

  const goBackToStep1 = () => {
    setStep(1)
    setOtp(Array(OTP_LENGTH).fill(""))
    setNewPassword("")
    setConfirmPassword("")
    clearResetState()
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-purple">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 relative overflow-hidden bg-brand-purple">
        {/* Background Decorative Elements */}
        <div className="absolute top-20 left-10 text-[#FFD700] opacity-30 transform -rotate-12 select-none">
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
            <path d="M2 18C10 2 30 2 38 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="absolute bottom-20 right-10 text-[#FFD700] opacity-30 transform rotate-45 select-none">
          <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
            <path d="M5 25C15 5 45 5 55 25" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="w-full max-w-[500px] bg-[#3a1a4f] border border-[#4a2a5f] rounded-3xl p-8 md:p-12 shadow-2xl z-10 transition-all duration-300">

          {/* ────── STEP 3: Success ────── */}
          {step === 3 ? (
            <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-white text-2xl md:text-3xl font-bold mb-3">Password Reset!</h1>
              <p className="text-white/60 text-sm mb-8">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <Link href="/en-np/sign-up">
                <Button className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200">
                  Sign In Now
                </Button>
              </Link>
            </div>
          ) : step === 2 ? (
            /* ────── STEP 2: OTP + New Password ────── */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-[#FFD700]" />
                </div>
                <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">Reset Your Password</h1>
                <p className="text-white/60 text-sm">
                  If an account exists for <span className="text-[#FFD700] font-medium">{email}</span>,<br />
                  we&apos;ve sent a {OTP_LENGTH}-digit code. Enter it below.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* OTP Inputs */}
                <div>
                  <Label className="text-white/80 ml-1 text-sm mb-2 block">Verification Code</Label>
                  <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                    {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpRefs.current[idx] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[idx] || ""}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-xl font-bold bg-white/10 border-2 border-[#4a2a5f] text-white rounded-xl focus:border-[#FFD700] focus:ring-1 focus:ring-[#FFD700] outline-none transition-colors"
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-white/80 ml-1">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-white/80 ml-1">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || otp.join("").length !== OTP_LENGTH}
                  className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting Password...</>
                  ) : (
                    "Reset Password"
                  )}
                </Button>

                <div className="text-center space-y-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-sm text-white/60 hover:text-[#FFD700] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend"}
                  </button>
                  <br />
                  <button
                    type="button"
                    onClick={goBackToStep1}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3 h-3" /> Change email address
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ────── STEP 1: Enter Email ────── */
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-8 h-8 text-[#FFD700]" />
                </div>
                <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">Forgot Password?</h1>
                <p className="text-white/60 text-sm">
                  Enter your email address and we&apos;ll send you a<br />verification code to reset your password.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/80 ml-1">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoFocus
                    className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                  />
                </div>

                <div className="py-2">
                  <TurnstileWidget onToken={setCaptchaToken} />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending Code...</>
                  ) : (
                    "Send Reset Code"
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    href="/en-np/sign-up"
                    className="text-sm text-white/60 hover:text-[#FFD700] transition-colors flex items-center gap-1 justify-center"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full">
        <div className="bg-brand-soft-yellow py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-brand-charcoal mb-4">Need help?</h3>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-brand-charcoal text-brand-charcoal hover:bg-brand-charcoal hover:text-white"
                  >
                    Contact Us
                  </Button>
                </Link>
              </div>
              <div>
                <h3 className="font-bold text-brand-charcoal mb-4">Country</h3>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🇳🇵</span>
                  <span className="text-brand-charcoal font-medium">Nepal</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-brand-charcoal mb-4">Stay updated with us:</h3>
                <div className="flex space-x-2">
                  <a href="https://www.facebook.com/byiora" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="text-brand-charcoal hover:text-blue-600 hover:bg-blue-50">
                      <Facebook className="h-5 w-5" />
                    </Button>
                  </a>
                  <a href="https://www.instagram.com/byiora" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="text-brand-charcoal hover:text-pink-500 hover:bg-pink-50">
                      <Instagram className="h-5 w-5" />
                    </Button>
                  </a>
                  <a href="https://www.youtube.com/@byiora" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="text-brand-charcoal hover:text-red-600 hover:bg-red-50">
                      <Youtube className="h-5 w-5" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 py-4">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-light-gray">
              <div className="flex flex-wrap gap-4">
                <span>© 2026 Copyright Byiora</span>
                <Link href="/terms-and-conditions" className="hover:text-brand-sky-blue">Terms & Conditions</Link>
                <Link href="/privacy-policy" className="hover:text-brand-sky-blue">Privacy Policy</Link>
                <Link href="/refund-policy" className="hover:text-brand-sky-blue">Refund Policy</Link>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 relative">
                  <Image src="/logo-final.png" alt="Byiora Logo" width={80} height={24} className="object-contain" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
