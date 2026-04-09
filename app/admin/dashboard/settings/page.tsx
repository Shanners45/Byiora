"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Save, User, Lock, QrCode, CreditCard, Upload, Plus, Pencil, Trash2, X, Check } from "lucide-react"
import Image from "next/image"

interface PaymentMethod {
  id: string
  name: string
  logo_url: string
  qr_url: string
  instructions: string
  is_enabled: boolean
  sort_order: number
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [adminUser, setAdminUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null)
  const [name, setName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PaymentMethod>>({})
  const [isUploadingQR, setIsUploadingQR] = useState<string | null>(null)

  // Add new payment method form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMethod, setNewMethod] = useState({
    name: "",
    logo_url: "",
    qr_url: "",
    instructions: "Scan the QR code with your app. In remarks, please enter your name.",
  })

  useEffect(() => {
    const fetchAdminUser = async () => {
      // 1. Initial load from localStorage for immediate UI display
      const adminUserJson = localStorage.getItem("admin_user")
      const sessionJson = localStorage.getItem("byiora_admin_session")

      if (adminUserJson) {
        try {
          const parsedUser = JSON.parse(adminUserJson)
          setAdminUser(parsedUser)
          setName(parsedUser.name)
        } catch (e) {
          console.error("Failed to parse admin_user", e)
        }
      } else if (sessionJson) {
        try {
          const parsedUser = JSON.parse(sessionJson)
          setAdminUser(parsedUser)
          setName(parsedUser.name)
        } catch (e) {
          console.error("Failed to parse admin session", e)
        }
      }

      // 2. Always fetch fresh data from Supabase to ensure roles/names are up-to-date
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: adminData, error } = await supabase
          .from("admin_users")
          .select("id, name, email, role")
          .eq("id", user.id)
          .single()

        if (adminData && !error) {
          setAdminUser(adminData)
          setName(adminData.name)
          // Sync to localStorage so other components stay updated
          localStorage.setItem("admin_user", JSON.stringify(adminData))
          localStorage.setItem("byiora_admin_session", JSON.stringify(adminData))
        }
      }
      
      loadPaymentMethods()
    }

    fetchAdminUser()
  }, [])

  const loadPaymentMethods = async () => {
    setIsLoadingPayments(true)
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("sort_order", { ascending: true })

      if (error) {
        console.error("Error loading payment methods:", error)
        toast.error("Failed to load payment methods")
      } else {
        setPaymentMethods(data || [])
      }
    } catch (error) {
      console.error("Error loading payment methods:", error)
    } finally {
      setIsLoadingPayments(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminUser) return

    setIsUpdatingProfile(true)
    try {
      const { error } = await supabase.from("admin_users").update({ name }).eq("id", adminUser.id)

      if (error) {
        toast.error("Failed to update profile")
        return
      }

      const updatedUser = { ...adminUser, name }
      setAdminUser(updatedUser)
      localStorage.setItem("byiora_admin_session", JSON.stringify(updatedUser))
      localStorage.setItem("admin_user", JSON.stringify(updatedUser))
      toast.success("Profile updated successfully")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminUser) return

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match")
      return
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long")
      return
    }

    setIsUpdatingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminUser.email,
        password: currentPassword,
      })

      if (signInError) {
        toast.error("Current password is incorrect")
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        toast.error("Failed to update password")
        return
      }

      toast.success("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      toast.error("Failed to update password")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleToggleEnabled = async (method: PaymentMethod) => {
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_enabled: !method.is_enabled })
      .eq("id", method.id)

    if (error) {
      toast.error("Failed to update payment method")
      return
    }

    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === method.id ? { ...m, is_enabled: !m.is_enabled } : m))
    )
    toast.success(`${method.name} ${!method.is_enabled ? "enabled" : "disabled"}`)
  }

  const handleStartEdit = (method: PaymentMethod) => {
    setEditingId(method.id)
    setEditForm({ ...method })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSaveEdit = async () => {
    if (!editingId) return

    const { error } = await supabase
      .from("payment_methods")
      .update({
        name: editForm.name,
        logo_url: editForm.logo_url,
        qr_url: editForm.qr_url,
        instructions: editForm.instructions,
      })
      .eq("id", editingId)

    if (error) {
      toast.error("Failed to save changes")
      return
    }

    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, ...editForm } : m))
    )
    setEditingId(null)
    setEditForm({})
    toast.success("Payment method updated!")
  }

  const handleDelete = async (method: PaymentMethod) => {
    if (!confirm(`Delete "${method.name}"? This cannot be undone.`)) return

    const { error } = await supabase.from("payment_methods").delete().eq("id", method.id)

    if (error) {
      toast.error("Failed to delete payment method")
      return
    }

    setPaymentMethods((prev) => prev.filter((m) => m.id !== method.id))
    toast.success(`${method.name} deleted`)
  }

  const handleAddNew = async () => {
    if (!newMethod.name.trim()) {
      toast.error("Please enter a payment method name")
      return
    }

    const { data, error } = await supabase
      .from("payment_methods")
      .insert([
        {
          name: newMethod.name.trim(),
          logo_url: newMethod.logo_url,
          qr_url: newMethod.qr_url,
          instructions: newMethod.instructions,
          is_enabled: true,
          sort_order: paymentMethods.length + 1,
        },
      ])
      .select()
      .single()

    if (error) {
      toast.error("Failed to add payment method")
      return
    }

    setPaymentMethods((prev) => [...prev, data])
    setNewMethod({
      name: "",
      logo_url: "",
      qr_url: "",
      instructions: "Scan the QR code with your app. In remarks, please enter your name.",
    })
    setShowAddForm(false)
    toast.success("Payment method added!")
  }

  const handleQRUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    methodId: string | "new",
    fieldSetter: (url: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    setIsUploadingQR(methodId)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png"
      const filePath = `payment-qr/${methodId}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      })

      if (uploadError) {
        toast.error("Failed to upload QR code")
        return
      }

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath)
      fieldSetter(urlData.publicUrl)
      toast.success("QR code uploaded!")
    } catch {
      toast.error("Failed to upload QR code")
    } finally {
      setIsUploadingQR(null)
    }
  }

  if (!adminUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
          <p className="text-[#4B5563]">Loading settings...</p>
        </div>
      </div>
    )
  }

  const isSuperAdmin = adminUser.role === "admin"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Settings</h1>
        <p className="text-[#4B5563]">Manage your account settings and system preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className={`grid w-full ${isSuperAdmin ? "grid-cols-3" : "grid-cols-2"} bg-[#F3F4F6] h-12`}>
          <TabsTrigger value="profile" className="data-[state=active]:bg-white text-[#1F2937] font-medium">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-white text-[#1F2937] font-medium">
            <Lock className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="payment" className="data-[state=active]:bg-white text-[#1F2937] font-medium">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
            <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription className="text-[#4B5563]">Update your account profile information</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdateProfile}>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#1F2937]">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#1F2937]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={adminUser.email}
                    disabled
                    className="bg-gray-50 border-2 border-gray-200 opacity-60"
                  />
                  <p className="text-xs text-[#4B5563]">Email address cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-[#1F2937]">Role</Label>
                  <Input
                    id="role"
                    value={
                      adminUser.role === "admin"
                        ? "Administrator"
                        : adminUser.role === "sub_admin"
                          ? "Sub-admin"
                          : "Order Manager"
                    }
                    disabled
                    className="bg-gray-50 border-2 border-gray-200 opacity-60"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"
                  disabled={isUpdatingProfile}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isUpdatingProfile ? "Updating..." : "Update Profile"}
                </Button>
              </CardContent>
            </form>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
            <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937] flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-[#4B5563]">Update your account password</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-[#1F2937]">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-[#1F2937]">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-[#1F2937]">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"
                  disabled={isUpdatingPassword}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isUpdatingPassword ? "Updating..." : "Change Password"}
                </Button>
              </CardContent>
            </form>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        {isSuperAdmin && (
          <TabsContent value="payment" className="space-y-6">
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[#1F2937] flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Methods
                    </CardTitle>
                    <CardDescription className="text-[#4B5563]">
                      Manage payment methods, QR codes and enable/disable them on the storefront
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Method
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {isLoadingPayments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-t-[#7E3AF2] border-gray-200"></div>
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-[#4B5563]">
                    <QrCode className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No payment methods found. Add one to get started.</p>
                  </div>
                ) : (
                  paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="bg-white rounded-lg border border-[#F59E0B]/20 p-4 space-y-3"
                    >
                      {editingId === method.id ? (
                        /* —— EDIT MODE —— */
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[#1F2937]">Editing: {method.name}</h3>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white">
                                <Check className="h-4 w-4 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                <X className="h-4 w-4 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[#1F2937]">Name</Label>
                              <Input
                                value={editForm.name || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                className="border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                                placeholder="e.g. eSewa"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[#1F2937]">Logo URL (optional)</Label>
                              <Input
                                value={editForm.logo_url || ""}
                                onChange={(e) => setEditForm((f) => ({ ...f, logo_url: e.target.value }))}
                                className="border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[#1F2937]">Instructions shown to user</Label>
                            <Textarea
                              value={editForm.instructions || ""}
                              onChange={(e) => setEditForm((f) => ({ ...f, instructions: e.target.value }))}
                              className="border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                              placeholder="e.g. Scan QR code with your app..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[#1F2937]">QR Code</Label>
                            <div className="flex items-center gap-4">
                              {editForm.qr_url && (
                                <div className="w-24 h-24 border border-gray-200 rounded overflow-hidden flex-shrink-0">
                                  <Image
                                    src={editForm.qr_url}
                                    alt="QR"
                                    width={96}
                                    height={96}
                                    className="object-contain w-full h-full"
                                  />
                                </div>
                              )}
                              <div className="flex-1 space-y-2">
                                <Input
                                  value={editForm.qr_url || ""}
                                  onChange={(e) => setEditForm((f) => ({ ...f, qr_url: e.target.value }))}
                                  className="border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                                  placeholder="QR code image URL (or upload below)"
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`qr-upload-edit-${method.id}`}
                                  className="hidden"
                                  onChange={(e) =>
                                    handleQRUpload(e, method.id, (url) =>
                                      setEditForm((f) => ({ ...f, qr_url: url }))
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUploadingQR === method.id}
                                  onClick={() => document.getElementById(`qr-upload-edit-${method.id}`)?.click()}
                                  className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  {isUploadingQR === method.id ? "Uploading..." : "Upload QR"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* —— VIEW MODE —— */
                        <div className="flex items-center gap-4">
                          {/* QR thumbnail or placeholder */}
                          <div className="w-14 h-14 border border-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
                            {method.qr_url ? (
                              <Image
                                src={method.qr_url}
                                alt={method.name}
                                width={56}
                                height={56}
                                className="object-contain w-full h-full"
                              />
                            ) : (
                              <QrCode className="h-6 w-6 text-gray-300" />
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#1F2937]">{method.name}</p>
                            <p className="text-xs text-[#4B5563] truncate">{method.instructions}</p>
                          </div>
                          {/* Controls */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#4B5563]">
                                {method.is_enabled ? "Active" : "Hidden"}
                              </span>
                              <Switch
                                checked={method.is_enabled}
                                onCheckedChange={() => handleToggleEnabled(method)}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(method)}
                              className="text-[#7E3AF2] hover:bg-[#7E3AF2]/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(method)}
                              className="text-[#EF4444] hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Add New Form */}
                {showAddForm && (
                  <div className="bg-white rounded-lg border-2 border-[#7E3AF2]/30 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[#1F2937]">New Payment Method</h3>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[#1F2937]">Name *</Label>
                        <Input
                          value={newMethod.name}
                          onChange={(e) => setNewMethod((n) => ({ ...n, name: e.target.value }))}
                          placeholder="e.g. eSewa"
                          className="border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[#1F2937]">Logo URL (optional)</Label>
                        <Input
                          value={newMethod.logo_url}
                          onChange={(e) => setNewMethod((n) => ({ ...n, logo_url: e.target.value }))}
                          placeholder="https://..."
                          className="border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1F2937]">Instructions</Label>
                      <Textarea
                        value={newMethod.instructions}
                        onChange={(e) => setNewMethod((n) => ({ ...n, instructions: e.target.value }))}
                        className="border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#1F2937]">QR Code URL</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newMethod.qr_url}
                          onChange={(e) => setNewMethod((n) => ({ ...n, qr_url: e.target.value }))}
                          placeholder="Paste URL or upload"
                          className="flex-1 border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          id="qr-upload-new"
                          className="hidden"
                          onChange={(e) =>
                            handleQRUpload(e, "new", (url) => setNewMethod((n) => ({ ...n, qr_url: url })))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingQR === "new"}
                          onClick={() => document.getElementById("qr-upload-new")?.click()}
                          className="border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 whitespace-nowrap"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          {isUploadingQR === "new" ? "Uploading..." : "Upload QR"}
                        </Button>
                      </div>
                    </div>
                    <Button
                      onClick={handleAddNew}
                      className="w-full bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
