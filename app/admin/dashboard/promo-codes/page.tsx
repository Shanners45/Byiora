"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  Ticket, Plus, Trash2, Copy, Eye, Loader2, ChevronDown, ChevronUp, 
  Percent, DollarSign, Search, RefreshCw, Zap, ToggleLeft, X, Users, UserCheck, Sparkles, Pencil
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getPromoCodesAction,
  createPromoCodeAction,
  updatePromoCodeAction,
  togglePromoCodeAction,
  deletePromoCodeAction,
  getPromoCodeUsageAction,
  generateBulkCodesAction,
  getPromoVisibilitySettingsAction,
  updatePromoVisibilityAction,
  getProductsForPromoAction,
  type PromoCode,
  type PromoUsageRecord,
} from "@/app/actions/promo-codes"

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showUsageDialog, setShowUsageDialog] = useState(false)
  const [usageData, setUsageData] = useState<PromoUsageRecord[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [selectedCodeForUsage, setSelectedCodeForUsage] = useState<PromoCode | null>(null)
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [products, setProducts] = useState<{ id: string; name: string; category: string }[]>([])
  const [deletingCode, setDeletingCode] = useState<PromoCode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Visibility settings
  const [guestsEnabled, setGuestsEnabled] = useState(true)
  const [registeredEnabled, setRegisteredEnabled] = useState(true)

  // Create/Edit form state
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_discount: "",
    min_order_amount: "",
    usage_limit: "",
    per_user_limit: "1",
    starts_at: "",
    expires_at: "",
    applicable_products: [] as string[],
    applicable_categories: [] as string[],
    excluded_products: [] as string[],
    first_order_only: false,
    registered_only: false,
    new_user_only: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Bulk generation state
  const [bulkForm, setBulkForm] = useState({
    prefix: "",
    count: "10",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_discount: "",
    expires_at: "",
  })
  const [isBulkGenerating, setIsBulkGenerating] = useState(false)

  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive">("all")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [codesRes, visRes, productsRes] = await Promise.all([
        getPromoCodesAction(),
        getPromoVisibilitySettingsAction(),
        getProductsForPromoAction(),
      ])

      if (codesRes.success && codesRes.data) setCodes(codesRes.data)
      if (visRes.success && visRes.data) {
        setGuestsEnabled(visRes.data.guests_enabled)
        setRegisteredEnabled(visRes.data.registered_enabled)
      }
      if (productsRes.success && productsRes.data) setProducts(productsRes.data)
    } catch (err) {
      toast.error("Failed to load promo codes")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleGuestsVisibility = async (newVal: boolean) => {
    setGuestsEnabled(newVal)
    try {
      const res = await updatePromoVisibilityAction({ guests_enabled: newVal, registered_enabled: registeredEnabled })
      if (res.success) {
        toast.success(newVal ? "Guest promo input enabled" : "Guest promo input disabled")
      } else {
        setGuestsEnabled(!newVal)
        toast.error(res.error || "Failed to update visibility")
      }
    } catch {
      setGuestsEnabled(!newVal)
      toast.error("Failed to update visibility")
    }
  }

  const handleToggleRegisteredVisibility = async (newVal: boolean) => {
    setRegisteredEnabled(newVal)
    try {
      const res = await updatePromoVisibilityAction({ guests_enabled: guestsEnabled, registered_enabled: newVal })
      if (res.success) {
        toast.success(newVal ? "Registered user promo input enabled" : "Registered user promo input disabled")
      } else {
        setRegisteredEnabled(!newVal)
        toast.error(res.error || "Failed to update visibility")
      }
    } catch {
      setRegisteredEnabled(!newVal)
      toast.error("Failed to update visibility")
    }
  }

  const handleToggle = async (id: string) => {
    const res = await togglePromoCodeAction(id)
    if (res.success) {
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c))
      toast.success("Promo code toggled")
    } else {
      toast.error(res.error || "Failed to toggle")
    }
  }

  const confirmDelete = async () => {
    if (!deletingCode) return
    setIsDeleting(true)
    try {
      const res = await deletePromoCodeAction(deletingCode.id)
      if (res.success) {
        setCodes(prev => prev.filter(c => c.id !== deletingCode.id))
        toast.success("Promo code deleted")
        setDeletingCode(null)
      } else {
        toast.error(res.error || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete promo code")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewUsage = async (code: PromoCode) => {
    setSelectedCodeForUsage(code)
    setShowUsageDialog(true)
    setUsageLoading(true)
    const res = await getPromoCodeUsageAction(code.id)
    if (res.success && res.data) {
      setUsageData(res.data)
    }
    setUsageLoading(false)
  }

  const resetForm = () => {
    setForm({
      code: "", description: "", discount_type: "percentage", discount_value: "", max_discount: "",
      min_order_amount: "", usage_limit: "", per_user_limit: "1", starts_at: "", expires_at: "",
      applicable_products: [], applicable_categories: [], excluded_products: [],
      first_order_only: false, registered_only: false, new_user_only: false,
    })
    setEditingCode(null)
  }

  const handleEdit = (code: PromoCode) => {
    setForm({
      code: code.code,
      description: code.description || "",
      discount_type: code.discount_type,
      discount_value: String(code.discount_value),
      max_discount: code.max_discount ? String(code.max_discount) : "",
      min_order_amount: code.min_order_amount ? String(code.min_order_amount) : "",
      usage_limit: code.usage_limit ? String(code.usage_limit) : "",
      per_user_limit: String(code.per_user_limit),
      starts_at: code.starts_at ? code.starts_at.slice(0, 16) : "",
      expires_at: code.expires_at ? code.expires_at.slice(0, 16) : "",
      applicable_products: code.applicable_products || [],
      applicable_categories: code.applicable_categories || [],
      excluded_products: code.excluded_products || [],
      first_order_only: code.first_order_only,
      registered_only: code.registered_only,
      new_user_only: code.new_user_only,
    })
    setEditingCode(code)
    setShowCreateForm(true)
  }

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.discount_value) {
      toast.error("Code and discount value are required")
      return
    }
    setIsSubmitting(true)

    const payload = {
      code: form.code,
      description: form.description || undefined,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : 0,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      per_user_limit: form.per_user_limit ? parseInt(form.per_user_limit) : 1,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      applicable_products: form.applicable_products.length > 0 ? form.applicable_products : null,
      applicable_categories: form.applicable_categories.length > 0 ? form.applicable_categories : null,
      excluded_products: form.excluded_products.length > 0 ? form.excluded_products : null,
      first_order_only: form.first_order_only,
      registered_only: form.registered_only,
      new_user_only: form.new_user_only,
    }

    let res
    if (editingCode) {
      res = await updatePromoCodeAction(editingCode.id, payload)
    } else {
      res = await createPromoCodeAction(payload)
    }

    if (res.success) {
      toast.success(editingCode ? "Promo code updated" : "Promo code created")
      setShowCreateForm(false)
      resetForm()
      loadData()
    } else {
      toast.error(res.error || "Failed to save")
    }
    setIsSubmitting(false)
  }

  const handleBulkGenerate = async () => {
    if (!bulkForm.prefix.trim() || !bulkForm.discount_value || !bulkForm.count) {
      toast.error("Prefix, count, and discount value are required")
      return
    }
    setIsBulkGenerating(true)
    const res = await generateBulkCodesAction({
      prefix: bulkForm.prefix,
      count: parseInt(bulkForm.count),
      discount_type: bulkForm.discount_type,
      discount_value: parseFloat(bulkForm.discount_value),
      max_discount: bulkForm.max_discount ? parseFloat(bulkForm.max_discount) : null,
      expires_at: bulkForm.expires_at ? new Date(bulkForm.expires_at).toISOString() : null,
    })

    if (res.success) {
      toast.success(`Generated ${res.codes?.length} codes`)
      setShowBulkDialog(false)
      setBulkForm({ prefix: "", count: "10", discount_type: "percentage", discount_value: "", max_discount: "", expires_at: "" })
      loadData()
    } else {
      toast.error(res.error || "Failed to generate")
    }
    setIsBulkGenerating(false)
  }

  const filteredCodes = codes.filter(c => {
    const matchesSearch = !searchQuery || c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === "all" ? true : activeTab === "active" ? c.is_active : !c.is_active
    return matchesSearch && matchesTab
  })

  const categoryOptions = [
    { value: "digital-goods", label: "Digital Goods" },
    { value: "games", label: "Games" },
    { value: "direct-login", label: "Direct Login" },
    { value: "topup", label: "Top Up" },
  ]

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1F2937]">Promo Codes</h1>
          <p className="text-xs sm:text-sm text-[#4B5563]">Create and manage discount codes and promotional vouchers</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setShowBulkDialog(true)}
            className="flex-1 sm:flex-none border border-[#F59E0B]/40 text-[#92400E] bg-white hover:bg-[#FEF7E0] font-semibold text-xs sm:text-sm h-9 sm:h-10"
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 text-[#F59E0B]" /> Bulk Generate
          </Button>
          <Button
            onClick={() => { resetForm(); setShowCreateForm(true) }}
            className="flex-1 sm:flex-none bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-semibold text-xs sm:text-sm h-9 sm:h-10 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" /> Create Code
          </Button>
        </div>
      </div>

      {/* Promo Code Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-[#92400E]">Total Codes</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1F2937]">{codes.length}</p>
              </div>
              <Ticket className="h-6 w-6 sm:h-8 sm:h-8 text-[#F59E0B] shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-[#92400E]">Active</p>
                <p className="text-xl sm:text-2xl font-bold text-green-700">{codes.filter(c => c.is_active).length}</p>
              </div>
              <Sparkles className="h-6 w-6 sm:h-8 sm:h-8 text-[#F59E0B] shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-[#92400E]">Redemptions</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1F2937]">{codes.reduce((sum, c) => sum + (c.usage_count || 0), 0)}</p>
              </div>
              <Zap className="h-6 w-6 sm:h-8 sm:h-8 text-[#F59E0B] shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-[#92400E]">Inactive</p>
                <p className="text-xl sm:text-2xl font-bold text-[#4B5563]">{codes.filter(c => !c.is_active).length}</p>
              </div>
              <Users className="h-6 w-6 sm:h-8 sm:h-8 text-[#F59E0B] shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visibility Controls - Auto Live Sync */}
      <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[#F59E0B]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-[#F59E0B]/30 flex items-center justify-center text-[#92400E] shadow-xs">
              <ToggleLeft className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-[#1F2937]">Promo Code Visibility</CardTitle>
              <CardDescription className="text-xs text-[#92400E]">Changes update in real-time across checkout</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 transition-colors shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FEF7E0] border border-[#F59E0B]/30 flex items-center justify-center text-[#92400E] shadow-xs shrink-0">
                  <Users className="w-4 h-4 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="font-semibold text-xs sm:text-sm text-[#1F2937]">Guest Visitors</p>
                  <p className="text-[11px] sm:text-xs text-[#6B7280]">Show input to guest buyers</p>
                </div>
              </div>
              <Switch checked={guestsEnabled} onCheckedChange={handleToggleGuestsVisibility} />
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-white border border-[#F59E0B]/20 hover:border-[#F59E0B]/50 transition-colors shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FEF7E0] border border-[#F59E0B]/30 flex items-center justify-center text-[#92400E] shadow-xs shrink-0">
                  <UserCheck className="w-4 h-4 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="font-semibold text-xs sm:text-sm text-[#1F2937]">Registered Users</p>
                  <p className="text-[11px] sm:text-xs text-[#6B7280]">Show input to signed-in users</p>
                </div>
              </div>
              <Switch checked={registeredEnabled} onCheckedChange={handleToggleRegisteredVisibility} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table & Mobile Cards Container */}
      <Card className="bg-[#FEF7E0] border border-[#F59E0B]/40 shadow-xs">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-sm sm:text-base font-bold text-[#1F2937]">All Promo Codes ({filteredCodes.length})</CardTitle>
          <CardDescription className="text-xs text-[#92400E]">Active and inactive vouchers</CardDescription>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4 sm:mb-6">
            <div className="flex overflow-x-auto gap-1.5 pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === "all"
                    ? "bg-[#F59E0B] text-white shadow-xs"
                    : "bg-white border border-[#F59E0B]/30 text-[#92400E] hover:bg-[#FEF7E0]"
                }`}
              >
                All ({codes.length})
              </button>
              <button
                onClick={() => setActiveTab("active")}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === "active"
                    ? "bg-[#F59E0B] text-white shadow-xs"
                    : "bg-white border border-[#F59E0B]/30 text-[#92400E] hover:bg-[#FEF7E0]"
                }`}
              >
                Active ({codes.filter(c => c.is_active).length})
              </button>
              <button
                onClick={() => setActiveTab("inactive")}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === "inactive"
                    ? "bg-[#F59E0B] text-white shadow-xs"
                    : "bg-white border border-[#F59E0B]/30 text-[#92400E] hover:bg-[#FEF7E0]"
                }`}
              >
                Inactive ({codes.filter(c => !c.is_active).length})
              </button>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search codes..."
                className="pl-9 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] rounded-lg text-xs sm:text-sm placeholder:text-gray-400 h-9 sm:h-10"
              />
            </div>
          </div>

          {/* Content: Mobile Cards + Desktop Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#F59E0B]" />
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#F59E0B]/20 p-8 text-center">
              <Ticket className="w-10 h-10 mx-auto text-[#F59E0B]/40 mb-2" />
              <p className="text-[#92400E] font-medium text-sm">No {activeTab === "all" ? "" : activeTab} promo codes found</p>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (Clean & touch-friendly for phone screens) */}
              <div className="block md:hidden space-y-3">
                {filteredCodes.map((code) => (
                  <div key={code.id} className="bg-white rounded-xl border border-[#F59E0B]/30 p-3.5 shadow-xs space-y-2.5">
                    {/* Top Row: Code + Copy + Status Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#1F2937] text-sm">{code.code}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(code.code); toast.success("Copied!") }}
                          className="text-gray-400 hover:text-[#F59E0B] p-1 transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 font-medium">{code.is_active ? "Active" : "Inactive"}</span>
                        <Switch checked={code.is_active} onCheckedChange={() => handleToggle(code.id)} />
                      </div>
                    </div>

                    {code.description && (
                      <p className="text-xs text-gray-600 truncate">{code.description}</p>
                    )}

                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${code.discount_type === "percentage" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                        {code.discount_type === "percentage" ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                        {code.discount_type === "percentage" ? `${code.discount_value}%` : `Rs. ${code.discount_value}`}
                        {code.max_discount ? ` (max Rs.${code.max_discount})` : ""}
                      </span>

                      {code.registered_only && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] rounded font-medium">Registered</span>}
                      {code.first_order_only && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded font-medium">1st Order</span>}
                      {code.new_user_only && <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] rounded font-medium">New User</span>}
                      {!code.applicable_products && !code.applicable_categories && !code.registered_only && !code.first_order_only && !code.new_user_only && (
                        <span className="px-1.5 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 text-[10px] rounded font-medium">All</span>
                      )}
                    </div>

                    {/* Meta Row: Usage & Validity */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1.5 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400">Usage: </span>
                        <span className="font-semibold text-gray-800">{code.usage_count}</span> / {code.usage_limit || "∞"}
                      </div>
                      <div className="text-right">
                        <span>{formatDate(code.starts_at)} → {formatDate(code.expires_at)}</span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewUsage(code)}
                        className="h-7 px-2.5 text-xs text-[#92400E] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                      >
                        <Eye className="w-3 h-3 mr-1" /> Usage
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(code)}
                        className="h-7 px-2.5 text-xs text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#FEF7E0]"
                      >
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingCode(code)}
                        className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block bg-white rounded-lg border border-[#F59E0B]/20 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#F59E0B]/20 bg-[#FEF7E0]/70">
                        <th className="text-left p-3 font-semibold text-[#92400E]">Code</th>
                        <th className="text-left p-3 font-semibold text-[#92400E]">Discount</th>
                        <th className="text-left p-3 font-semibold text-[#92400E]">Usage</th>
                        <th className="text-left p-3 font-semibold text-[#92400E]">Validity</th>
                        <th className="text-left p-3 font-semibold text-[#92400E]">Targeting</th>
                        <th className="text-left p-3 font-semibold text-[#92400E]">Status</th>
                        <th className="text-right p-3 font-semibold text-[#92400E]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCodes.map((code) => (
                        <tr key={code.id} className="border-b border-[#F59E0B]/10 hover:bg-[#FEF7E0]/50 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-[#1F2937]">{code.code}</span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(code.code); toast.success("Copied!") }}
                                className="text-gray-400 hover:text-[#F59E0B] transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {code.description && (
                              <p className="text-xs text-[#6B7280] mt-0.5 truncate max-w-[200px]">{code.description}</p>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${code.discount_type === "percentage" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                              {code.discount_type === "percentage" ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                              {code.discount_type === "percentage" ? `${code.discount_value}%` : `Rs. ${code.discount_value}`}
                              {code.max_discount ? ` (max Rs.${code.max_discount})` : ""}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1F2937]">{code.usage_count}</span>
                              <span className="text-gray-400">/ {code.usage_limit || "∞"}</span>
                            </div>
                            {code.usage_limit && (
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-[#F59E0B] rounded-full transition-all"
                                  style={{ width: `${Math.min((code.usage_count / code.usage_limit) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs text-[#4B5563]">
                            <div>{formatDate(code.starts_at)}</div>
                            <div>→ {formatDate(code.expires_at)}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {code.registered_only && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] rounded font-medium">Registered</span>}
                              {code.first_order_only && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded font-medium">1st Order</span>}
                              {code.new_user_only && <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] rounded font-medium">New User</span>}
                              {!code.applicable_products && !code.applicable_categories && !code.registered_only && !code.first_order_only && !code.new_user_only && (
                                <span className="px-1.5 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 text-[10px] rounded font-medium">All</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Switch checked={code.is_active} onCheckedChange={() => handleToggle(code.id)} />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleViewUsage(code)} className="p-1.5 rounded hover:bg-[#FEF7E0] text-[#92400E] transition-colors" title="View Usage">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEdit(code)} className="p-1.5 rounded hover:bg-[#FEF7E0] text-[#F59E0B] transition-colors" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeletingCode(code)} className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreateForm} onOpenChange={(open) => { setShowCreateForm(open); if (!open) resetForm() }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[88vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">{editingCode ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">{editingCode ? "Update voucher terms, limits, and restrictions" : "Fill in details to generate a promotional discount voucher"}</p>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            {/* Code */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, "") }))}
                placeholder="e.g. DASHAIN10"
                disabled={!!editingCode}
                className="mt-1 uppercase font-mono bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Description (internal)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Dashain 2026 Sale"
                className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>

            {/* Discount Type + Value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Discount Type *</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm(prev => ({ ...prev, discount_type: v as any }))}>
                  <SelectTrigger className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Discount Value *</Label>
                <Input
                  type="number"
                  value={form.discount_value}
                  onChange={(e) => setForm(prev => ({ ...prev, discount_value: e.target.value }))}
                  placeholder={form.discount_type === "percentage" ? "e.g. 10" : "e.g. 100"}
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Max Discount + Min Order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {form.discount_type === "percentage" && (
                <div>
                  <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Max Discount (Rs.)</Label>
                  <Input
                    type="number"
                    value={form.max_discount}
                    onChange={(e) => setForm(prev => ({ ...prev, max_discount: e.target.value }))}
                    placeholder="Optional cap"
                    className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                  />
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Min Order (Rs.)</Label>
                <Input
                  type="number"
                  value={form.min_order_amount}
                  onChange={(e) => setForm(prev => ({ ...prev, min_order_amount: e.target.value }))}
                  placeholder="0"
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Usage Limit</Label>
                <Input
                  type="number"
                  value={form.usage_limit}
                  onChange={(e) => setForm(prev => ({ ...prev, usage_limit: e.target.value }))}
                  placeholder="Unlimited"
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Per User Limit</Label>
                <Input
                  type="number"
                  value={form.per_user_limit}
                  onChange={(e) => setForm(prev => ({ ...prev, per_user_limit: e.target.value }))}
                  placeholder="1"
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Validity Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Valid From</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm(prev => ({ ...prev, starts_at: e.target.value }))}
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Valid Until</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm(prev => ({ ...prev, expires_at: e.target.value }))}
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Applicable Categories */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Applicable Categories</Label>
              <p className="text-[11px] text-[#6B7280] mb-1.5">Leave empty for all categories</p>
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        applicable_categories: prev.applicable_categories.includes(cat.value)
                          ? prev.applicable_categories.filter(c => c !== cat.value)
                          : [...prev.applicable_categories, cat.value]
                      }))
                    }}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      form.applicable_categories.includes(cat.value)
                        ? "bg-[#F59E0B] text-white border-[#F59E0B]"
                        : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Applicable Products */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Applicable Products</Label>
                {form.applicable_products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, applicable_products: [] }))}
                    className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear all ({form.applicable_products.length})
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#6B7280] mb-1.5">Leave empty to apply to all products</p>
              
              <Select
                value=""
                onValueChange={(v) => {
                  if (v && !form.applicable_products.includes(v)) {
                    setForm(prev => ({ ...prev, applicable_products: [...prev.applicable_products, v] }))
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Add product to promo..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  className="max-h-48 w-[var(--radix-select-trigger-width)] max-w-full overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-xl z-[9999]"
                >
                  {products.filter(p => !form.applicable_products.includes(p.id)).length === 0 ? (
                    <div className="p-3 text-xs text-center text-gray-400">All available products added</div>
                  ) : (
                    products
                      .filter(p => !form.applicable_products.includes(p.id))
                      .map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs py-2 cursor-pointer hover:bg-gray-50">
                          {p.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>

              {form.applicable_products.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-24 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
                  {form.applicable_products.map(pid => {
                    const p = products.find(pr => pr.id === pid)
                    return (
                      <span key={pid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-gray-800 text-xs font-semibold rounded-md border border-gray-200 shadow-xs">
                        <span className="truncate max-w-[180px]">{p?.name || pid}</span>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, applicable_products: prev.applicable_products.filter(x => x !== pid) }))}
                          className="text-gray-400 hover:text-red-500 rounded p-0.5 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Targeting Toggles */}
            <div className="space-y-2.5 border-t border-gray-100 pt-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Targeting Rules</p>
                <p className="text-[11px] text-[#6B7280]">Customer redemption constraints</p>
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-900">First order only</Label>
                  <p className="text-[11px] text-[#6B7280]">Valid for customers with 0 previous completed orders</p>
                </div>
                <Switch checked={form.first_order_only} onCheckedChange={(v) => setForm(prev => ({ ...prev, first_order_only: v }))} />
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-900">Registered users only</Label>
                  <p className="text-[11px] text-[#6B7280]">Requires customers to be signed in</p>
                </div>
                <Switch checked={form.registered_only} onCheckedChange={(v) => setForm(prev => ({ ...prev, registered_only: v }))} />
              </div>
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <Label className="text-xs sm:text-sm font-medium text-gray-900">New users only</Label>
                  <p className="text-[11px] text-[#6B7280]">Account created in the last 7 days</p>
                </div>
                <Switch checked={form.new_user_only} onCheckedChange={(v) => setForm(prev => ({ ...prev, new_user_only: v }))} />
              </div>
            </div>

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-semibold h-10 sm:h-11 text-xs sm:text-sm rounded-lg shadow-sm mt-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingCode ? "Update Code" : "Create Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">Usage History: {selectedCodeForUsage?.code}</DialogTitle>
            <p className="text-xs text-gray-500">All customer redemptions for this promotional voucher</p>
          </DialogHeader>
          {usageLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F59E0B]" /></div>
          ) : usageData.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No usage records yet</p>
          ) : (
            <div className="space-y-2.5 pt-2">
              {usageData.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{u.user_email}</p>
                    <p className="text-xs text-gray-500">{u.transaction_id} • {formatDate(u.used_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 line-through">Rs. {u.original_price}</p>
                    <p className="font-semibold text-emerald-700">-Rs. {u.discount_amount}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader className="pb-3 border-b border-gray-100">
            <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">Bulk Generate Promo Codes</DialogTitle>
            <p className="text-xs text-gray-500">Generate multiple unique single-use vouchers</p>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Prefix *</Label>
                <Input
                  value={bulkForm.prefix}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                  placeholder="e.g. DASHAIN"
                  className="mt-1 uppercase font-mono bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Count *</Label>
                <Input
                  type="number"
                  value={bulkForm.count}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, count: e.target.value }))}
                  placeholder="10"
                  min={1}
                  max={100}
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</Label>
                <Select value={bulkForm.discount_type} onValueChange={(v) => setBulkForm(prev => ({ ...prev, discount_type: v as any }))}>
                  <SelectTrigger className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Value *</Label>
                <Input
                  type="number"
                  value={bulkForm.discount_value}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, discount_value: e.target.value }))}
                  className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] placeholder:text-gray-400 rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Expires</Label>
              <Input
                type="datetime-local"
                value={bulkForm.expires_at}
                onChange={(e) => setBulkForm(prev => ({ ...prev, expires_at: e.target.value }))}
                className="mt-1 bg-white text-gray-900 border border-gray-300 focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] rounded-lg h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <p className="text-[11px] text-gray-500">Each code will be: {bulkForm.prefix || "PREFIX"}-XXXXXXXX (single use, 1 per user)</p>
            <Button onClick={handleBulkGenerate} disabled={isBulkGenerating} className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white font-semibold h-10 sm:h-11 text-xs sm:text-sm rounded-lg shadow-sm mt-2">
              {isBulkGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Generate {bulkForm.count || 0} Codes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Promo Code Alert Dialog (Theme matches Cancel Order dialog) */}
      <AlertDialog open={!!deletingCode} onOpenChange={(open) => { if (!open && !isDeleting) setDeletingCode(null) }}>
        <AlertDialogContent className="bg-white border-gray-200 shadow-xl rounded-2xl p-6 sm:max-w-md w-[calc(100%-2rem)] mx-auto">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-2xl font-bold text-gray-900">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 text-base">
              This will permanently delete promo code{" "}
              {deletingCode && (
                <span className="font-mono font-bold text-gray-900 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded">
                  {deletingCode.code}
                </span>
              )}
              . Any customers attempting to use this code will no longer receive a discount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3 sm:space-x-0">
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setDeletingCode(null)}
              className="mt-0 h-12 sm:rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 border-none font-semibold transition-colors"
            >
              No, keep it
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              className="h-12 sm:rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                "Yes, delete code"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
