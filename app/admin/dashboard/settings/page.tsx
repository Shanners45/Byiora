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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Save, User, Lock, QrCode, CreditCard, Upload, Plus, Pencil, Trash2, X, Check, ArrowUp, ArrowDown } from "lucide-react"
import Image from "next/image"
import { getAdminSessionAction, type AdminSession } from "@/app/actions/admin-utils"
import { createPaymentMethodAction, deletePaymentMethodAction, getPaymentMethodsAction, updatePaymentMethodAction, toggleExclusiveAction, type PaymentMethodRow } from "@/app/actions/payment-methods"
import { getPaymentCredentialsAction, savePaymentCredentialsAction } from "@/app/actions/payment-credentials"

interface PaymentMethod {
  id: string
  name: string
  logo_url: string | null
  qr_url: string | null
  instructions: string | null
  is_enabled: boolean
  sort_order: number
  category: "static" | "nepalpay" | "fonepay" | "khalti"
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [adminUser, setAdminUser] = useState<AdminSession | null>(null)
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
    qr_url: "",
    instructions: "Scan the QR code with your app. In remarks, please enter your name.",
    logo_url: "",
  } as any)

  // Automated Gateways Credentials state
  const [gatewayCreds, setGatewayCreds] = useState<Record<string, { username: string, isPasswordSet: boolean, merchantCode?: string | null }>>({})
  const [nepalpayUser, setNepalpayUser] = useState("")
  const [nepalpayPass, setNepalpayPass] = useState("")
  const [fonepayUser, setFonepayUser] = useState("")
  const [fonepayPass, setFonepayPass] = useState("")
  const [khaltiUser, setKhaltiUser] = useState("")
  const [khaltiPass, setKhaltiPass] = useState("")
  const [isSavingGateways, setIsSavingGateways] = useState(false)

  useEffect(() => {
    const fetchAdminUser = async () => {
      const session = await getAdminSessionAction()
      if (session.success) {
        setAdminUser(session.data)
        setName(session.data.name)
      }
      
      loadPaymentMethods()
      loadGatewayCreds()
    }

    fetchAdminUser()
  }, [])

  const loadGatewayCreds = async () => {
    try {
      const result = await getPaymentCredentialsAction()
      if (result.success && result.data) {
        setGatewayCreds(result.data)
        if (result.data.nepalpay) setNepalpayUser(result.data.nepalpay.username)
        if (result.data.fonepay) setFonepayUser(result.data.fonepay.username)
        if (result.data.khalti) setKhaltiUser(result.data.khalti.username)
      }
    } catch (error) {
      console.error("Error loading gateway creds:", error)
    }
  }

  const handleSaveGateway = async (provider: string, user: string, pass: string) => {
    if (!user) return toast.error(`Username is required for ${provider}`)
    
    setIsSavingGateways(true)
    try {
      const result = await savePaymentCredentialsAction(provider, user, pass || undefined)
      if (result.success) {
        toast.success(`${provider} credentials saved and verified!`)
        loadGatewayCreds()
        
        // Save the verified merchant code in state
        setGatewayCreds(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            username: user,
            isPasswordSet: true,
            merchantCode: result.merchantCode
          }
        }))

        if (provider === "nepalpay") setNepalpayPass("")
        if (provider === "fonepay") setFonepayPass("")
        if (provider === "khalti") setKhaltiPass("")
      } else {
        toast.error(result.error || "Failed to save credentials")
      }
    } catch (err) {
      toast.error("An error occurred")
    } finally {
      setIsSavingGateways(false)
    }
  }

  const loadPaymentMethods = async () => {
    setIsLoadingPayments(true)
    try {
      const result = await getPaymentMethodsAction()
      if (result.error) {
        toast.error(result.error)
      } else {
        const methods = (result.data || []) as PaymentMethod[]
        const hasNepalPay = methods.some(m => m.name.toLowerCase().includes("nepalpay"))
        const hasFonepay = methods.some(m => m.name.toLowerCase().includes("fonepay"))
        const hasKhalti = methods.some(m => m.name.toLowerCase().includes("khalti"))
        
        let shouldReload = false
        if (!hasNepalPay) {
          await createPaymentMethodAction({ name: "NepalPay", is_enabled: false, logo_url: null, qr_url: null, instructions: "Pay securely via NepalPay App.", sort_order: 98, category: "nepalpay" })
          shouldReload = true
        }
        if (!hasFonepay) {
          await createPaymentMethodAction({ name: "Fonepay", is_enabled: false, logo_url: null, qr_url: null, instructions: "Pay securely via Fonepay App.", sort_order: 99, category: "fonepay" })
          shouldReload = true
        }
        if (!hasKhalti) {
          await createPaymentMethodAction({ name: "Khalti", is_enabled: false, logo_url: null, qr_url: null, instructions: "Pay securely via Khalti App.", sort_order: 100, category: "khalti" })
          shouldReload = true
        }

        if (shouldReload) {
          const freshResult = await getPaymentMethodsAction()
          setPaymentMethods((freshResult.data || []) as PaymentMethod[])
        } else {
          setPaymentMethods(methods)
        }
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
    // If it's a dynamic method (nepalpay/fonepay) and we are ENABLING it, we need to disable others of the same category
    const isDynamic = method.category === "nepalpay" || method.category === "fonepay"
    
    if (isDynamic && !method.is_enabled) {
      // Toggle exclusive (enables this, disables others of same category)
      const result = await toggleExclusiveAction(method.id, method.category, true)
      if (result.error) return toast.error("Failed to update payment method")
      
      // Update local state: enable this one, disable all others in same category
      setPaymentMethods((prev) =>
        prev.map((m) => {
          if (m.id === method.id) return { ...m, is_enabled: true }
          if (m.category === method.category) return { ...m, is_enabled: false }
          return m
        })
      )
      toast.success(`${method.name} enabled (other ${method.category} methods disabled)`)
    } else {
      // Standard toggle
      const result = await updatePaymentMethodAction(method.id, { is_enabled: !method.is_enabled })
      if (result.error) return toast.error("Failed to update payment method")

      setPaymentMethods((prev) =>
        prev.map((m) => (m.id === method.id ? { ...m, is_enabled: !m.is_enabled } : m))
      )
      toast.success(`${method.name} ${!method.is_enabled ? "enabled" : "disabled"}`)
    }
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

    const result = await updatePaymentMethodAction(editingId, {
      name: editForm.name,
      logo_url: editForm.logo_url ?? null,
      qr_url: editForm.qr_url ?? null,
      instructions: editForm.instructions ?? null,
      category: editForm.category,
    })
    if (result.error) return toast.error("Failed to save changes")

    setPaymentMethods((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, ...editForm } : m))
    )
    setEditingId(null)
    setEditForm({})
    toast.success("Payment method updated!")
  }

  const moveMethod = async (index: number, direction: "up" | "down") => {
    const newMethods = [...paymentMethods]
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newMethods.length) return

    // Swap elements in array
    const temp = newMethods[index]
    newMethods[index] = newMethods[swapIndex]
    newMethods[swapIndex] = temp

    // Re-assign sort_orders based on new index
    const updated = newMethods.map((m, i) => ({ ...m, sort_order: i + 1 }))
    setPaymentMethods(updated)

    // Save
    Promise.all(updated.map(m => updatePaymentMethodAction(m.id, { sort_order: m.sort_order })))
  }

  const handleDelete = async (method: PaymentMethod) => {
    if (!confirm(`Delete "${method.name}"? This cannot be undone.`)) return
    const result = await deletePaymentMethodAction(method.id)
    if (result.error) return toast.error("Failed to delete payment method")

    setPaymentMethods((prev) => prev.filter((m) => m.id !== method.id))
    toast.success(`${method.name} deleted`)
  }

  const handleAddNew = async () => {
    if (!newMethod.name.trim()) {
      toast.error("Please enter a payment method name")
      return
    }

    // For automated gateways username + password are required at create time.
    if (newMethod.category === "nepalpay" || newMethod.category === "fonepay") {
      const u = newMethod.category === "nepalpay" ? nepalpayUser : fonepayUser
      const p = newMethod.category === "nepalpay" ? nepalpayPass : fonepayPass
      if (!u || !p) {
        toast.error("Username and password are required for automated gateways.")
        return
      }
    }

    const result = await createPaymentMethodAction({
      name: newMethod.name.trim(),
      logo_url: newMethod.logo_url || null,
      qr_url: newMethod.qr_url || null,
      instructions: newMethod.instructions || null,
      category: newMethod.category || "static",
      is_enabled: true,
      sort_order: 0, // Gets placed at the start
    })
    if (result.error) return toast.error("Failed to add payment method")

    setPaymentMethods((prev) => {
      const updated = [result.data as unknown as PaymentMethod, ...prev]
      updated.forEach((m, i) => { m.sort_order = i + 1 })
      Promise.all(updated.map(m => updatePaymentMethodAction(m.id, { sort_order: m.sort_order })))
      return updated
    })

    // For automated gateways we save credentials unconditionally — the
    // up-front guard at the top of handleAddNew already enforces that
    // username + password are provided.
    if (newMethod.category === "nepalpay") {
      await handleSaveGateway("nepalpay", nepalpayUser, nepalpayPass)
    } else if (newMethod.category === "fonepay") {
      await handleSaveGateway("fonepay", fonepayUser, fonepayPass)
    }

    setNewMethod({
      name: "",
      logo_url: "",
      qr_url: "",
      instructions: "Scan the QR code with your app. In remarks, please enter your name.",
      category: "static"
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
        upsert: false,
      })

      if (uploadError) {
        console.error("QR Upload Error:", uploadError)
        toast.error(`Failed to upload QR code: ${uploadError.message}`)
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
                              <Label className="text-[#1F2937]">Name {(editForm.category !== "static") && "(Auto-set)"}</Label>
                              <div className="flex gap-2">
                                <Select
                                  value={editForm.category || "static"}
                                  onValueChange={(val) => {
                                    setEditForm((f) => ({ ...f, category: val as any, name: val !== "static" ? (val === "nepalpay" ? "NepalPay" : val === "fonepay" ? "Fonepay" : "Khalti") : f.name }))
                                  }}
                                >
                                  <SelectTrigger className="w-32 border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="static">Static</SelectItem>
                                    <SelectItem value="nepalpay">NepalPay</SelectItem>
                                    <SelectItem value="fonepay">Fonepay</SelectItem>
                                    <SelectItem value="khalti">Khalti</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(editForm.category || "static") === "static" && (
                                  <Input
                                    value={editForm.name || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                    className="flex-1 border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                                    placeholder="e.g. eSewa"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[#1F2937]">Logo URL (optional)</Label>
                              <div className="flex gap-2 items-center">
                                <Input
                                  value={editForm.logo_url || ""}
                                  onChange={(e) => setEditForm((f) => ({ ...f, logo_url: e.target.value }))}
                                  className="flex-1 border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-400"
                                  placeholder="https://example.com/logo.png"
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`logo-upload-edit-${method.id}`}
                                  className="hidden"
                                  onChange={(e) =>
                                    handleQRUpload(e, method.id, (url) =>
                                      setEditForm((f) => ({ ...f, logo_url: url }))
                                    )
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUploadingQR === method.id}
                                  onClick={() => document.getElementById(`logo-upload-edit-${method.id}`)?.click()}
                                  className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 whitespace-nowrap"
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Upload
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          {(editForm.category || "static") === "static" ? (
                            <>
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
                                  <img
                                    src={editForm.qr_url}
                                    alt="QR"
                                    className="object-contain w-full h-full max-w-[96px] max-h-[96px]"
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
                          </>
                          ) : (

                          /* AUTOMATED GATEWAY CREDENTIALS */
                          <div className="mt-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                                <Lock className="h-4 w-4 text-green-600" />
                                Automated Gateway Credentials ({(editForm.category || "static") === "nepalpay" ? "NepalPay" : (editForm.category === "fonepay" ? "Fonepay" : "Khalti")})
                              </h4>
                              {((editForm.category || "static") === "nepalpay" ? gatewayCreds.nepalpay?.isPasswordSet : ((editForm.category === "fonepay" ? gatewayCreds.fonepay?.isPasswordSet : gatewayCreds.khalti?.isPasswordSet))) && (
                                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium flex items-center">
                                  <Check className="w-3 h-3 mr-1" />
                                  Logged In 
                                  {(editForm.category || "static") === "nepalpay" && gatewayCreds.nepalpay?.merchantCode && ` (Merchant: ${gatewayCreds.nepalpay.merchantCode})`}
                                  {(editForm.category || "static") === "fonepay" && gatewayCreds.fonepay?.merchantCode && ` (Merchant: ${gatewayCreds.fonepay.merchantCode})`}
                                  {(editForm.category || "static") === "khalti" && gatewayCreds.khalti?.merchantCode && ` (Verified)`}
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">{(editForm.category || "static") === "khalti" ? "Secret Key (Username)" : "Username (Merchant Code)"}</Label>
                                <Input 
                                  value={(editForm.category || "static") === "nepalpay" ? nepalpayUser : ((editForm.category === "fonepay" ? fonepayUser : khaltiUser))}
                                  onChange={(e) => {
                                    if ((editForm.category || "static") === "nepalpay") setNepalpayUser(e.target.value)
                                    else if (editForm.category === "fonepay") setFonepayUser(e.target.value)
                                    else setKhaltiUser(e.target.value)
                                  }}
                                  placeholder={(editForm.category || "static") === "khalti" ? "Secret key (e.g. 5e7779be...)" : "Username"}
                                  className="bg-white border-slate-300 h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">
                                  {(editForm.category || "static") === "khalti" ? "Public Key (Password)" : "Password"} {((editForm.category || "static") === "nepalpay" ? gatewayCreds.nepalpay?.isPasswordSet : ((editForm.category === "fonepay" ? gatewayCreds.fonepay?.isPasswordSet : gatewayCreds.khalti?.isPasswordSet))) && <span className="text-green-600">(Saved)</span>}
                                </Label>
                                <Input 
                                  type="password"
                                  value={(editForm.category || "static") === "nepalpay" ? nepalpayPass : ((editForm.category === "fonepay" ? fonepayPass : khaltiPass))}
                                  onChange={(e) => {
                                    if ((editForm.category || "static") === "nepalpay") setNepalpayPass(e.target.value)
                                    else if (editForm.category === "fonepay") setFonepayPass(e.target.value)
                                    else setKhaltiPass(e.target.value)
                                  }}
                                  placeholder="Enter to update"
                                  className="bg-white border-slate-300 h-9 text-sm"
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                const isNepal = (editForm.category || "static") === "nepalpay"
                                const isFonepay = editForm.category === "fonepay"
                                const provider = isNepal ? "nepalpay" : (isFonepay ? "fonepay" : "khalti")
                                const u = isNepal ? nepalpayUser : (isFonepay ? fonepayUser : khaltiUser)
                                const p = isNepal ? nepalpayPass : (isFonepay ? fonepayPass : khaltiPass)
                                await handleSaveGateway(provider, u, p)
                              }}
                              disabled={isSavingGateways}
                              className="mt-3 bg-green-600 hover:bg-green-700 text-white w-full"
                            >
                              {isSavingGateways ? "Saving..." : (((editForm.category || "static") === "nepalpay" ? gatewayCreds.nepalpay?.isPasswordSet : ((editForm.category === "fonepay" ? gatewayCreds.fonepay?.isPasswordSet : gatewayCreds.khalti?.isPasswordSet))) ? "Update Credentials" : "Save Credentials Securely")}
                            </Button>
                          </div>
                          )}
                        </div>
                      ) : (
                        /* —— VIEW MODE —— */
                        <div className="flex items-center gap-4">
                          {/* QR thumbnail or logo or placeholder */}
                          <div className="w-14 h-14 border border-gray-200 rounded overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
                            {method.logo_url ? (
                              <img
                                src={method.logo_url}
                                alt={method.name}
                                className="object-contain w-full h-full p-1"
                              />
                            ) : method.qr_url ? (
                              <img
                                src={method.qr_url}
                                alt={method.name}
                                className="object-contain w-full h-full max-w-[56px] max-h-[56px]"
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
                            
                            <div className="flex flex-col border-l border-r border-gray-200 px-2 gap-1 ml-2">
                              <button 
                                onClick={() => moveMethod(paymentMethods.findIndex(m => m.id === method.id), "up")}
                                disabled={paymentMethods.findIndex(m => m.id === method.id) === 0}
                                className="text-gray-400 hover:text-[#7E3AF2] disabled:opacity-30 transition-colors"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => moveMethod(paymentMethods.findIndex(m => m.id === method.id), "down")}
                                disabled={paymentMethods.findIndex(m => m.id === method.id) === paymentMethods.length - 1}
                                className="text-gray-400 hover:text-[#7E3AF2] disabled:opacity-30 transition-colors"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
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
                        <Label className="text-[#1F2937]">
                          {(newMethod.category || "static") === "static" ? "Method Type & Name" : "Method Type"}
                        </Label>
                        <div className="flex gap-2">
                          <Select
                            value={newMethod.category || "static"}
                            onValueChange={(val) => setNewMethod((n: any) => ({ ...n, category: val, name: val !== "static" ? (val === "nepalpay" ? "NepalPay" : val === "fonepay" ? "Fonepay" : "Khalti") : n.name }))}
                          >
                            <SelectTrigger className="w-32 border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="static">Static</SelectItem>
                              <SelectItem value="nepalpay">NepalPay</SelectItem>
                              <SelectItem value="fonepay">Fonepay</SelectItem>
                              <SelectItem value="khalti">Khalti</SelectItem>
                            </SelectContent>
                          </Select>
                          {(newMethod.category || "static") === "static" && (
                            <Input
                              value={newMethod.name}
                              onChange={(e) => setNewMethod((n: any) => ({ ...n, name: e.target.value }))}
                              placeholder="e.g. eSewa"
                              className="flex-1 border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                            />
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[#1F2937]">Logo URL (optional)</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            value={newMethod.logo_url}
                            onChange={(e) => setNewMethod((n: any) => ({ ...n, logo_url: e.target.value }))}
                            placeholder="https://..."
                            className="flex-1 border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            id="logo-upload-new"
                            className="hidden"
                            onChange={(e) =>
                              handleQRUpload(e, "new", (url) => setNewMethod((n: any) => ({ ...n, logo_url: url })))
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isUploadingQR === "new"}
                            onClick={() => document.getElementById("logo-upload-new")?.click()}
                            className="border-[#7E3AF2] text-[#7E3AF2] hover:bg-[#7E3AF2]/10 whitespace-nowrap"
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>
                    {(newMethod.category || "static") === "static" ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[#1F2937]">Instructions</Label>
                          <Textarea
                            value={newMethod.instructions}
                            onChange={(e) => setNewMethod((n: any) => ({ ...n, instructions: e.target.value }))}
                            className="border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[#1F2937]">QR Code URL</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              value={newMethod.qr_url}
                              onChange={(e) => setNewMethod((n: any) => ({ ...n, qr_url: e.target.value }))}
                              placeholder="Paste URL or upload"
                              className="flex-1 border-2 border-[#7E3AF2]/30 focus:border-[#7E3AF2] placeholder:text-gray-400"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              id="qr-upload-new"
                              className="hidden"
                              onChange={(e) =>
                                handleQRUpload(e, "new", (url) => setNewMethod((n: any) => ({ ...n, qr_url: url })))
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
                      </>
                    ) : (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                        <p className="text-sm text-blue-800 font-medium">
                          🔗 Automated Gateway: {newMethod.category === "nepalpay" ? "NepalPay" : (newMethod.category === "fonepay" ? "Fonepay" : "Khalti")}
                        </p>
                        <p className="text-xs text-blue-600">
                          {newMethod.category === "khalti" 
                            ? "Khalti integrates via redirect. Please enter your API keys below."
                            : "QR codes are generated dynamically. Please enter your merchant credentials below to authenticate with the bank."}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-blue-900">{newMethod.category === "khalti" ? "Secret Key (Username)" : "Username (Merchant Code)"}</Label>
                            <Input 
                              value={newMethod.category === "nepalpay" ? nepalpayUser : (newMethod.category === "fonepay" ? fonepayUser : khaltiUser)}
                              onChange={(e) => {
                                if (newMethod.category === "nepalpay") setNepalpayUser(e.target.value)
                                else if (newMethod.category === "fonepay") setFonepayUser(e.target.value)
                                else setKhaltiUser(e.target.value)
                              }}
                              className="bg-white border-blue-200 h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-blue-900">{newMethod.category === "khalti" ? "Public Key (Password)" : "Password"}</Label>
                            <Input 
                              type="password"
                              value={newMethod.category === "nepalpay" ? nepalpayPass : (newMethod.category === "fonepay" ? fonepayPass : khaltiPass)}
                              onChange={(e) => {
                                if (newMethod.category === "nepalpay") setNepalpayPass(e.target.value)
                                else if (newMethod.category === "fonepay") setFonepayPass(e.target.value)
                                else setKhaltiPass(e.target.value)
                              }}
                              className="bg-white border-blue-200 h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
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
