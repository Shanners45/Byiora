"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { Header } from "@/components/header"
import Link from "next/link"
import Image from "next/image"
import { Mail, Facebook, Instagram, Youtube, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react"
import { signupWithPassword, verifySignupOtp, resendSignupOtp } from "@/app/actions/auth"

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const OTP_LENGTH = 6
const SIGNUP_STORAGE_KEY = "byiora_signup_otp"

function saveSignupState(email: string) {
  try {
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify({ email, ts: Date.now() }))
  } catch {}
}

function loadSignupState(): { email: string } | null {
  try {
    const raw = localStorage.getItem(SIGNUP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire after 15 minutes
    if (Date.now() - parsed.ts > 15 * 60 * 1000) {
      localStorage.removeItem(SIGNUP_STORAGE_KEY)
      return null
    }
    return { email: parsed.email }
  } catch {
    return null
  }
}

function clearSignupState() {
  try { localStorage.removeItem(SIGNUP_STORAGE_KEY) } catch {}
}

function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return lower.includes("rate limit") || lower.includes("too many") || lower.includes("429") || lower.includes("email rate limit")
}

export default function SignUpPage() {
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup")
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Step tracking for signup OTP flow
  const [signupStep, setSignupStep] = useState<1 | 2>(1)

  // Form fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")

  // OTP fields
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""))
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [resendCooldown, setResendCooldown] = useState(0)

  const { login, loginWithGoogle } = useAuth()

  // Restore signup OTP state from localStorage on mount
  useEffect(() => {
    const saved = loadSignupState()
    if (saved && saved.email) {
      setEmail(saved.email)
      setSignupStep(2)
      setAuthMode("signup")
      setShowEmailForm(true)
    }
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
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

    // Focus last filled or first empty
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    otpRefs.current[focusIndex]?.focus()
  }

  // Step 1: Submit credentials
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!captchaToken) {
        toast.error("Please complete captcha verification.")
        return
      }
      if (!name.trim()) {
        toast.error("Please enter your full name!")
        return
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match!")
        return
      }
      if (password.length < 8) {
        toast.error("Password must be at least 8 characters long!")
        return
      }

      const result = await signupWithPassword(email, password, name.trim(), captchaToken)

      if (result.error) {
        if (isRateLimitError(result.error)) {
          toast.error("You have requested too many codes. Please wait 15 minutes and try again.")
        } else {
          toast.error(result.error)
        }
        return
      }

      // Move to OTP step and persist state
      toast.success("Verification code sent to your email!")
      setSignupStep(2)
      saveSignupState(email.trim())
      setResendCooldown(60)
    } catch (error) {
      console.error("Signup error:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== OTP_LENGTH) {
      toast.error(`Please enter the complete ${OTP_LENGTH}-digit code`)
      return
    }

    setIsLoading(true)
    try {
      const result = await verifySignupOtp(email, code)
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

      clearSignupState()
      toast.success("Welcome to Byiora! Your account has been verified.")
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "/"
      window.location.href = redirect
    } catch (error) {
      console.error("OTP verification error:", error)
      toast.error("Verification failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    try {
      const result = await resendSignupOtp(email)
      if (result.error) {
        if (isRateLimitError(result.error)) {
          toast.error("You have requested too many codes. Please wait 15 minutes and try again.")
        } else {
          toast.error(result.error)
        }
        return
      }
      toast.success("New verification code sent!")
      setResendCooldown(60)
      setOtp(Array(OTP_LENGTH).fill(""))
      otpRefs.current[0]?.focus()
    } catch {
      toast.error("Failed to resend code.")
    }
  }

  // Sign-in flow (unchanged)
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (!captchaToken) {
        toast.error("Please complete captcha verification.")
        return
      }
      const success = await login(email, password, captchaToken)
      if (success) {
        toast.success("Welcome back! Sign in successful.")
        const redirect = new URLSearchParams(window.location.search).get("redirect") || "/"
        window.location.href = redirect
      }
    } catch (error) {
      console.error("Auth error:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setAuthMode((prev) => (prev === "signup" ? "signin" : "signup"))
    setShowEmailForm(false)
    setSignupStep(1)
    setName("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setCaptchaToken("")
    setOtp(Array(OTP_LENGTH).fill(""))
    clearSignupState()
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

          {/* ────── SIGNUP MODE: Step 2 — OTP Verification ────── */}
          {authMode === "signup" && signupStep === 2 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-[#FFD700]" />
                </div>
                <h1 className="text-white text-2xl md:text-3xl font-bold mb-2">Verify Your Email</h1>
                <p className="text-white/60 text-sm">
                  We sent a {OTP_LENGTH}-digit code to<br />
                  <span className="text-[#FFD700] font-medium">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* OTP Input Boxes */}
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

                <Button
                  type="submit"
                  disabled={isLoading || otp.join("").length !== OTP_LENGTH}
                  className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</>
                  ) : (
                    "Verify & Create Account"
                  )}
                </Button>

                <div className="text-center space-y-3">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-sm text-white/60 hover:text-[#FFD700] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive a code? Resend"}
                  </button>
                  <br />
                  <button
                    type="button"
                    onClick={() => { setSignupStep(1); setOtp(Array(OTP_LENGTH).fill("")); }}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to credentials
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ────── Default: Method selector or credential forms ────── */
            <>
              <div className="text-center mb-10">
                <p className="text-white/60 text-sm font-medium mb-2 tracking-wide uppercase">
                  {authMode === "signup" ? "Faster top up, better deals" : "Welcome Back"}
                </p>
                <h1 className="text-white text-3xl md:text-4xl font-bold">
                  {authMode === "signup" ? (
                    <>Join <span className="text-[#FFD700]">Byiora Now.</span></>
                  ) : (
                    <>Sign in to <span className="text-[#FFD700]">Byiora.</span></>
                  )}
                </h1>
              </div>

              <div className="space-y-4">
                {!showEmailForm ? (
                  <>
                    <Button
                      onClick={() => loginWithGoogle()}
                      className="w-full h-14 bg-white hover:bg-gray-100 text-[#1F2937] font-semibold rounded-full flex items-center justify-center transition-all duration-200"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </Button>

                    <Button
                      onClick={() => setShowEmailForm(true)}
                      className="w-full h-14 bg-white hover:bg-gray-100 text-[#1F2937] font-semibold rounded-full flex items-center justify-center transition-all duration-200"
                    >
                      <Mail className="mr-2 h-5 w-5 text-[#4B5563]" />
                      {authMode === "signup" ? "Sign up with Email" : "Sign in with Email"}
                    </Button>
                  </>
                ) : (
                  <form
                    onSubmit={authMode === "signup" ? handleSignup : handleSignIn}
                    className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
                  >
                    {authMode === "signup" && (
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-white/80 ml-1">Full Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your name"
                          required
                          className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/80 ml-1">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-white/80 ml-1">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min. 8 characters)"
                          required
                          className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                        />
                      </div>
                      {authMode === "signup" && (
                        <div className="space-y-2">
                          <Label htmlFor="confirm" className="text-white/80 ml-1">Confirm Password</Label>
                          <Input
                            id="confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm Password"
                            required
                            className="h-12 bg-white/10 border-[#4a2a5f] text-white placeholder:text-white/30 focus:ring-[#FFD700] focus:border-[#FFD700] rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                    {authMode === "signin" && (
                      <div className="text-right">
                        <Link href="/en-np/forgot-password" className="text-[#FFD700]/80 hover:text-[#FFD700] text-sm transition-colors">
                          Forgot password?
                        </Link>
                      </div>
                    )}
                    <div className="py-2">
                      <TurnstileWidget onToken={setCaptchaToken} />
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#311144] font-bold rounded-xl transition-all duration-200"
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{authMode === "signup" ? "Creating Account..." : "Signing In..."}</>
                      ) : (
                        authMode === "signup" ? "Create Account" : "Sign In"
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="w-full text-white/60 hover:text-white text-sm transition-colors"
                    >
                      ← Back to options
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-8 text-center">
                <p className="text-white/60 text-sm mb-6">
                  By {authMode === "signup" ? "signing up" : "signing in"}, you agree to the{" "}
                  <Link href="/terms-and-conditions" className="text-[#FFD700] hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy-policy" className="text-[#FFD700] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <div className="h-px bg-white/10 w-full mb-6" />

                <p className="text-white/80">
                  {authMode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    onClick={toggleMode}
                    className="text-[#FFD700] font-bold hover:underline"
                  >
                    {authMode === "signup" ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Simplified Yellow Footer */}
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
