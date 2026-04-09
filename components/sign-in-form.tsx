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

interface SignInFormProps {
  onSuccess?: () => void
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const { login, signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const success = await login(signInEmail, signInPassword)
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
    console.log("Sign up form submitted")

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
      const success = await signup(signUpEmail, signUpPassword, signUpEmail.split("@")[0])
      if (success) {
        // Reset form
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
          >
            Sign Up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="space-y-4">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="signup-email" className="text-brand-charcoal font-semibold text-base">
                Email
              </Label>
              <Input
                id="signup-email"
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
            <div>
              <Label htmlFor="signup-password" className="text-brand-charcoal">
                Password
              </Label>
              <Input
                id="signup-password"
                type="password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-brand-charcoal">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="bg-brand-white border-gray-200 text-brand-charcoal placeholder:text-gray-500 focus:ring-brand-sky-blue focus:border-brand-sky-blue"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-sky-blue hover:bg-brand-sky-blue/90 text-white"
            >
              {isLoading ? "Creating Account..." : "Sign Up"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <div className="text-center text-sm text-brand-light-gray">
        Sign up to track your purchase history and get exclusive offers!
      </div>
    </div>
  )
}
