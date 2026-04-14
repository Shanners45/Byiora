"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, User, Lock } from "lucide-react"


export default function SettingsPage() {
  const router = useRouter()
  const { user, logout, updateProfile, isLoggedIn } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [isUpdating, setIsUpdating] = useState(false)

  const [transactions, setTransactions] = useState([]) // Mock transaction state

  // Redirect if not logged in
  if (!isLoggedIn) {
    router.push("/")
    return null
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)

    try {
      const success = await updateProfile(name)
      if (success) {
        toast.success("Profile updated successfully")
      } else {
        toast.error("Failed to update profile")
      }
    } catch (error) {
      console.error("Update profile error:", error)
      toast.error("Failed to update profile")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }

    setIsUpdating(true)

    // Simulate API call
    setTimeout(() => {
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setIsUpdating(false)
    }, 1000)
  }


  return (
    <div className="min-h-screen bg-brand-purple">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={() => router.push("/")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-white ml-4">Account Settings</h1>
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="w-full">
            <div className="bg-brand-purple rounded-t-lg p-2">
              <TabsList className="grid w-full grid-cols-2 bg-[#E0D4FD]/30 rounded-lg h-auto">
                <TabsTrigger
                  value="profile"
                  className="text-lg py-3 rounded-md data-[state=active]:bg-[#E0D4FD] data-[state=active]:text-[#111827] text-white"
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="security"
                  className="text-lg py-3 rounded-md data-[state=active]:bg-[#E0D4FD] data-[state=active]:text-[#111827] text-white"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="profile" className="mt-0">
              <Card className="bg-white border-none shadow-lg rounded-b-lg rounded-t-none">
                <CardHeader>
                  <CardTitle className="text-[#1F2937]">Profile Information</CardTitle>
                  <CardDescription className="text-[#4B5563]">Update your account profile information</CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdateProfile}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-[#1F2937]">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[#1F2937]">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email"
                        disabled
                        className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                      />
                      <p className="text-xs text-[#4B5563]">Email address cannot be changed</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="bg-[#FCD34D] hover:bg-[#FCD34D]/90 text-[#111827]"
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Updating..." : "Update Profile"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0 space-y-6">
              <Card className="bg-white border-none shadow-lg rounded-b-lg rounded-t-none">
                <CardHeader>
                  <CardTitle className="text-[#1F2937]">Change Password</CardTitle>
                  <CardDescription className="text-[#4B5563]">Update your account password</CardDescription>
                </CardHeader>
                <form onSubmit={handleChangePassword}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-[#1F2937]">
                        Current Password
                      </Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-[#1F2937]">
                        New Password
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-[#1F2937]">
                        Confirm New Password
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-400"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="bg-[#FCD34D] hover:bg-[#FCD34D]/90 text-[#111827]"
                      disabled={isUpdating}
                    >
                      {isUpdating ? "Updating..." : "Change Password"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>


            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  )
}
