"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // 1. Use Server Action for login to enforce HTTP-only secure cookies
      const { loginWithPassword } = await import("@/app/actions/auth")
      const result = await loginWithPassword(email, password, "/admin/dashboard")

      if (result.error || !result.data?.user) {
        toast.error(result.error || "Invalid credentials")
        setIsLoading(false)
        return
      }

      // 2. Check admin_users table for UID and role using SSR browser client
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("id", result.data.user.id)
        .eq("status", "active")
        .single()

      if (adminError || !adminUser) {
        toast.error("Not an admin user or inactive")
        await supabase.auth.signOut()
        setIsLoading(false)
        return
      }

      toast.success("Login successful!")
      router.replace("/admin/dashboard")
    } catch (error) {
      console.error("Login error:", error)
      toast.error("Login failed. Please try again.")
      setIsLoading(false)
    }
  }

  // Remove isCheckingAuth logic because we let the edge router handle auth detection
  // if they hit /admin/login while logged in, they can stay or be auto-redirected by middleware if we made middleware redirect. 
  // Let's render the login form immediately


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#7E3AF2]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo-final.png"
              alt="Byiora"
              width={160}
              height={56}
              style={{ objectFit: 'contain' }}
              priority
              unoptimized={true}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-center text-2xl font-bold text-[#1F2937]">Welcome Back</CardTitle>
            <CardDescription className="text-center text-[#4B5563]">
              Sign in to access the admin dashboard
            </CardDescription>
          </CardHeader>
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
                  className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
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
                  className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white font-medium py-2"
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
        </Card>
      </div>
    </div>
  )
}
