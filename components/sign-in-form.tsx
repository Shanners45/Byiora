"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { TurnstileWidget } from "@/components/turnstile-widget"
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

interface SignInFormProps {
  onSuccess?: () => void
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [signInCaptchaToken, setSignInCaptchaToken] = useState("")
  const [signUpCaptchaToken, setSignUpCaptchaToken] = useState("")
  const { login, signup, loginWithGoogle } = useAuth()

  const GoogleButton = ({ label }: { label: string }) => (
    <Button
      type="button"
      onClick={() => void loginWithGoogle()}
      className="w-full bg-white text-black border border-gray-300 hover:bg-gray-50"
    >
      <GoogleIcon />
      {label}
    </Button>
  )

  const OrDivider = () => (
    <div className="flex items-center gap-3 -my-1">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs uppercase tracking-wide text-gray-500">or</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!signInCaptchaToken) {
        toast.error("Please complete captcha verification.")
        setIsLoading(false)
        return
      }
      const success = await login(signInEmail, signInPassword, signInCaptchaToken)
      if (success) {
        toast.success("Welcome back! Sign in successful.")
        // Close dialog by resetting form
        setSignInEmail("")
        setSignInPassword("")
        onSuccess?.()
      }
    } catch (error) {
      toast.error("Failed to sign in. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!signUpName.trim()) {
      toast.error("Please enter your full name!")
      return
    }

    if (signUpPassword !== confirmPassword) {
      toast.error("Passwords do not match!")
      return
    }

    if (signUpPassword.length < 6) {
      toast.error("Password must be at least 6 characters long!")
      return
    }

    setIsLoading(true)

    try {
      if (!signUpCaptchaToken) {
        toast.error("Please complete captcha verification.")
        setIsLoading(false)
        return
      }
      const success = await signup(signUpEmail, signUpPassword, signUpName.trim(), signUpCaptchaToken)
      if (success) {
        // Reset form
        setSignUpName("")
        setSignUpEmail("")
        setSignUpPassword("")
        setConfirmPassword("")
        // Show welcome toast
        toast.success("Welcome to Byiora! Your account has been created successfully.")
        onSuccess?.()
      } else {
        toast.error("Failed to create account. Please try again.")
      }
    } catch (error) {
      console.error("Signup error:", error)
      toast.error("An error occurred during signup. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-center text-2xl font-bold text-brand-charcoal">Welcome to Byiora</DialogTitle>
        <DialogDescription className="text-center text-brand-light-gray">
          Sign in to track your purchases and access exclusive offers
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="signin" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
          <TabsTrigger
            value="signin"
            className="text-brand-charcoal data-[state=active]:bg-brand-sky-blue data-[state=active]:text-white"
          >
            Sign In
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="text-brand-charcoal data-[state=active]:bg-brand-sky-blue data-[state=active]:text-white"
            onClick={(e) => {
              e.preventDefault()
              window.location.href = "/en-np/sign-up"
            }}
          >
            Sign Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="email" className="text-brand-charcoal font-semibold text-base">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-brand-charcoal">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
            <TurnstileWidget onToken={setSignInCaptchaToken} />
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white mt-1"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
            <OrDivider />
            <GoogleButton label="Continue with Google" />
          </form>
        </TabsContent>

        <TabsContent value="signup" className="space-y-3">
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="signup-name" className="text-brand-charcoal font-semibold text-base">
                  Full Name
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  placeholder="Full Name"
                  required
                  className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
                />
              </div>
              <div>
                <Label htmlFor="signup-email" className="text-brand-charcoal font-semibold text-base">
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="signup-password" className="text-brand-charcoal">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-brand-charcoal">
                  Confirm
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm"
                  required
                  className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
                />
              </div>
            </div>
            <TurnstileWidget onToken={setSignUpCaptchaToken} />
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white mt-1"
            >
              {isLoading ? "Creating Account..." : "Sign Up"}
            </Button>
            <OrDivider />
            <GoogleButton label="Continue with Google" />
          </form>
        </TabsContent>
      </Tabs>

      <div className="text-center text-sm text-brand-light-gray">
        Sign up to track your purchase history and get exclusive offers!
      </div>
    </div>
  )
}
