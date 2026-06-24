"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Upload, Trash2, Pencil, HelpCircle, Plus, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine } from "lucide-react"
import { type Product } from "@/lib/product-categories"
import { createClient } from "@/lib/supabase/client"
import { getProductByIdAction, updateProductAction } from "@/app/actions/products"
import { toast } from "sonner"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RichTextEditor } from "@/components/rich-text-editor"

export default function ProductEditPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [showServers, setShowServers] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showCheckoutFields, setShowCheckoutFields] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [category, setCategory] = useState<"topup" | "digital-goods" | "games" | "direct-login">("digital-goods")
  const [logo, setLogo] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [ribbonText, setRibbonText] = useState("")
  const [denominations, setDenominations] = useState<Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean; in_stock?: boolean; categoryId?: string }>>([])
  const [denomIconUrl, setDenomIconUrl] = useState("")
  const [uidInstructions, setUidInstructions] = useState("")
  const [uidGuideImage, setUidGuideImage] = useState("")
  const [isUploadingGuide, setIsUploadingGuide] = useState(false)
  const [servers, setServers] = useState<Array<{ id: string; name: string }>>([])
  const [newServerName, setNewServerName] = useState("")

  // New Denomination Form state
  const [newDenomPrice, setNewDenomPrice] = useState("")
  const [newDenomLabel, setNewDenomLabel] = useState("")
  const [newDenomBestseller, setNewDenomBestseller] = useState(false)
  const [newDenomInStock, setNewDenomInStock] = useState(true)
  const [newDenomCategoryId, setNewDenomCategoryId] = useState<string>("")
  const [editingDenomIndex, setEditingDenomIndex] = useState<number | null>(null)

  // Denomination Categories state
  const [denominationCategories, setDenominationCategories] = useState<Array<{ id: string; name: string; icon_url?: string; description?: string }>>([])
  const [newDenomCatName, setNewDenomCatName] = useState("")
  const [newDenomCatIconUrl, setNewDenomCatIconUrl] = useState("")
  const [newDenomCatDesc, setNewDenomCatDesc] = useState("")
  const [editingDenomCatIndex, setEditingDenomCatIndex] = useState<number | null>(null)
  const [isUploadingCatIcon, setIsUploadingCatIcon] = useState(false)

  // Checkout Fields state (for direct-login category)
  const [checkoutFields, setCheckoutFields] = useState<Array<{ key: string; label: string; type: "text" | "email" | "password"; required: boolean }>>([])
  const [newFieldLabel, setNewFieldLabel] = useState("")
  const [newFieldType, setNewFieldType] = useState<"text" | "email" | "password">("text")
  const [newFieldRequired, setNewFieldRequired] = useState(true)
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null)

  // FAQ state
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [newFaqQuestion, setNewFaqQuestion] = useState("")
  const [newFaqAnswer, setNewFaqAnswer] = useState("")
  const [editingFaqIndex, setEditingFaqIndex] = useState<number | null>(null)

  const handlePriceChange = (val: string, setter: (val: string) => void) => {
    const numericVal = val.replace(/\D/g, "");
    if (!numericVal) {
      setter("");
      return;
    }
    setter(Number(numericVal).toLocaleString('en-US'));
  }

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const result = await getProductByIdAction(productId)

        if (result.error || !result.data) {
          toast.error(result.error || "Product not found")
          router.push("/admin/dashboard/products")
          return
        }

        const productData = result.data as any

        setProduct(productData)
        setName(productData.name || "")
        setSlug(productData.slug || "")
        setSlugManuallyEdited(!!productData.slug)
        setCategory(productData.category || "digital-goods")
        setLogo(productData.logo || "")
        setDescription(productData.description || "")
        setIsActive(productData.is_active !== false)
        setRibbonText(productData.ribbon_text || "")
        if (productData.denom_icon_url) setDenomIconUrl(productData.denom_icon_url)

        if (productData.denominations && Array.isArray(productData.denominations)) {
          setDenominations(productData.denominations)
        }



        if (productData.faqs && Array.isArray(productData.faqs)) {
          setFaqs(productData.faqs)
        }

        if (productData.checkout_fields && Array.isArray(productData.checkout_fields)) {
          setCheckoutFields(productData.checkout_fields)
        }

        if (productData.uid_instructions) {
          setUidInstructions(productData.uid_instructions)
        } else if (productData.category === "topup") {
          setUidInstructions("To find your User ID, click on your avatar, you can find your User ID under your Nickname.")
        }
        
        if (productData.uid_guide_image) {
          setUidGuideImage(productData.uid_guide_image)
        }

        if (productData.servers && Array.isArray(productData.servers)) {
          setServers(productData.servers)
          if (productData.servers.length > 0) setShowServers(true)
        }

        if (productData.denomination_categories && Array.isArray(productData.denomination_categories)) {
          setDenominationCategories(productData.denomination_categories)
          if (productData.denomination_categories.length > 0) setShowCategories(true)
        }

        if (productData.checkout_fields && Array.isArray(productData.checkout_fields)) {
          setCheckoutFields(productData.checkout_fields)
          if (productData.checkout_fields.length > 0) setShowCheckoutFields(true)
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Error loading product:", error)
        toast.error("Failed to load product")
        router.push("/admin/dashboard/products")
      }
    }

    fetchProduct()
  }, [productId, router])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB")
      return
    }

    setIsUploading(true)

    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${productId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        toast.error(`Failed to upload image: ${uploadError.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        setLogo(urlData.publicUrl)
        toast.success("Image uploaded successfully")
      } else {
        toast.error("Failed to get image URL")
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      toast.error("Failed to upload image")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDenomIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB")
      return
    }

    setIsUploadingIcon(true)

    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `denom-icon-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false })

      if (uploadError) {
        toast.error(`Failed to upload: ${uploadError.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath)
      if (urlData?.publicUrl) {
        setDenomIconUrl(urlData.publicUrl)
        toast.success("Icon uploaded successfully")
      }
    } catch { toast.error("Failed to upload icon") } finally { setIsUploadingIcon(false) }
  }

  const handleCatIconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB")
      return
    }

    setIsUploadingCatIcon(true)

    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `cat-icon-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false })

      if (uploadError) {
        toast.error(`Failed to upload: ${uploadError.message}`)
        return
      }

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath)
      if (urlData?.publicUrl) {
        setNewDenomCatIconUrl(urlData.publicUrl)
        toast.success("Category Icon uploaded successfully")
      }
    } catch { toast.error("Failed to upload category icon") } finally { setIsUploadingCatIcon(false) }
  }

  const handleGuideImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image size must be less than 2MB"); return }
    setIsUploadingGuide(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `uid-guide-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file, { cacheControl: "3600", upsert: false })
      if (uploadError) { toast.error(`Failed to upload: ${uploadError.message}`); return }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName)
      if (urlData?.publicUrl) { setUidGuideImage(urlData.publicUrl); toast.success("Guide image uploaded!") }
    } catch { toast.error("Failed to upload guide image") } finally { setIsUploadingGuide(false) }
  }

  const generateSlug = (nameValue: string) => {
    return nameValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!slugManuallyEdited) {
      setSlug(generateSlug(newName))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value)
    setSlugManuallyEdited(true)
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      if (denominationCategories.length > 1) {
        const hasUncategorized = denominations.some(d => !d.categoryId || d.categoryId === "none");
        if (hasUncategorized) {
          toast.error("All denominations must have a Category when multiple categories exist");
          setIsSaving(false);
          return;
        }
      }

      const denominationsWithIcon = denominations.map(d => ({
        ...d,
        icon_url: (!showCategories && denomIconUrl) ? denomIconUrl : d.icon_url,
      }))

      const result = await updateProductAction(productId, {
        name,
        category,
        logo,
        description,
        is_active: isActive,
        denominations: denominationsWithIcon,
        denomination_categories: showCategories ? denominationCategories : [],
        faqs,
        slug: slug.trim() || generateSlug(name.trim()),
        denom_icon_url: showCategories ? null : (denomIconUrl || null),
        ribbon_text: ribbonText.trim() || null,
        checkout_fields: ((category === "direct-login" || category === "topup") && showCheckoutFields) ? checkoutFields : [],
        uid_instructions: category === "topup" ? uidInstructions : null,
        uid_guide_image: category === "topup" ? uidGuideImage : null,
        servers: (category === "topup" && showServers) ? servers : [],
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Product updated successfully")
      router.push("/admin/dashboard/products")
    } catch (error: any) {
      console.error("Error updating product:", error)
      toast.error(error?.message || "Failed to update product")
    } finally {
      setIsSaving(false)
    }
  }

  const addDenomination = () => {
    if (!newDenomPrice || !newDenomLabel) {
      toast.error("Please fill in all denomination fields")
      return
    }

    if (denominationCategories.length > 1 && (!newDenomCategoryId || newDenomCategoryId === "none")) {
      toast.error("Please select a Category Name for the denomination")
      return
    }

    if (editingDenomIndex !== null) {
      const updated = [...denominations]
      updated[editingDenomIndex] = { price: newDenomPrice, label: newDenomLabel, bestseller: newDenomInStock ? newDenomBestseller : false, in_stock: newDenomInStock, categoryId: newDenomCategoryId === "none" ? undefined : newDenomCategoryId || undefined }
      setDenominations(updated)
      setEditingDenomIndex(null)
    } else {
      setDenominations([...denominations, { price: newDenomPrice, label: newDenomLabel, bestseller: newDenomInStock ? newDenomBestseller : false, in_stock: newDenomInStock, categoryId: newDenomCategoryId === "none" ? undefined : newDenomCategoryId || undefined }])
    }

    setNewDenomPrice("")
    setNewDenomLabel("")
    setNewDenomBestseller(false)
    setNewDenomInStock(true)
    setNewDenomCategoryId("")
  }

  const removeDenomination = (index: number) => {
    setDenominations(denominations.filter((_, i) => i !== index))
  }

  const editDenomination = (index: number) => {
    const denom = denominations[index]
    setNewDenomPrice(denom.price)
    setNewDenomLabel(denom.label)
    setNewDenomBestseller(denom.bestseller || false)
    setNewDenomInStock(denom.in_stock !== false)
    setNewDenomCategoryId(denom.categoryId || "")
    setEditingDenomIndex(index)
  }

  const addDenomCategory = () => {
    if (!newDenomCatName) {
      toast.error("Please provide a category name")
      return
    }

    if (editingDenomCatIndex !== null) {
      const updated = [...denominationCategories]
      updated[editingDenomCatIndex] = { ...updated[editingDenomCatIndex], name: newDenomCatName, icon_url: newDenomCatIconUrl, description: newDenomCatDesc }
      setDenominationCategories(updated)
      setEditingDenomCatIndex(null)
    } else {
      setDenominationCategories([...denominationCategories, { id: crypto.randomUUID(), name: newDenomCatName, icon_url: newDenomCatIconUrl, description: newDenomCatDesc }])
    }

    setNewDenomCatName("")
    setNewDenomCatIconUrl("")
    setNewDenomCatDesc("")
  }

  const editDenomCategory = (index: number) => {
    const cat = denominationCategories[index]
    setNewDenomCatName(cat.name)
    setNewDenomCatIconUrl(cat.icon_url || "")
    setNewDenomCatDesc(cat.description || "")
    setEditingDenomCatIndex(index)
  }

  const removeDenomCategory = (index: number) => {
    setDenominationCategories(denominationCategories.filter((_, i) => i !== index))
  }

  const moveDenomCategory = (index: number, direction: "up" | "down" | "top" | "bottom") => {
    const updated = [...denominationCategories]
    if (direction === "up" && index > 0) {
      const temp = updated[index]
      updated[index] = updated[index - 1]
      updated[index - 1] = temp
    } else if (direction === "down" && index < updated.length - 1) {
      const temp = updated[index]
      updated[index] = updated[index + 1]
      updated[index + 1] = temp
    } else if (direction === "top" && index > 0) {
      const [moved] = updated.splice(index, 1)
      updated.unshift(moved)
    } else if (direction === "bottom" && index < updated.length - 1) {
      const [moved] = updated.splice(index, 1)
      updated.push(moved)
    }
    setDenominationCategories(updated)
  }

  const addFaq = () => {
    if (!newFaqQuestion || !newFaqAnswer) {
      toast.error("Please fill in both question and answer")
      return
    }

    if (editingFaqIndex !== null) {
      const updated = [...faqs]
      updated[editingFaqIndex] = { question: newFaqQuestion, answer: newFaqAnswer }
      setFaqs(updated)
      setEditingFaqIndex(null)
    } else {
      setFaqs([
        ...faqs,
        {
          question: newFaqQuestion,
          answer: newFaqAnswer,
        },
      ])
    }

    setNewFaqQuestion("")
    setNewFaqAnswer("")
  }

  const editFaq = (index: number) => {
    const faq = faqs[index]
    setNewFaqQuestion(faq.question)
    setNewFaqAnswer(faq.answer)
    setEditingFaqIndex(index)
  }

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#F59E0B] border-gray-200 mx-auto mb-4"></div>
          <p className="text-[#4B5563]">Loading product...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/dashboard/products")}
            className="text-[#4B5563] hover:text-[#1F2937]"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Edit Product</h1>
            <p className="text-[#4B5563]">Update product details and settings</p>
          </div>
        </div>
        <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Product Details */}
          <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
            <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
              <CardTitle className="text-[#1F2937]">Product Details</CardTitle>
              <CardDescription className="text-[#92400E]">Basic information about the product</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#1F2937]">Product Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={handleNameChange}
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-[#1F2937]">URL Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={handleSlugChange}
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                    placeholder="auto-generated-slug"
                  />
                  <p className="text-xs text-[#4B5563]">URL: byiora.com.np/{category}/{slug || generateSlug(name)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-[#1F2937]">Category</Label>
                  <Select value={category} onValueChange={(value: "topup" | "digital-goods" | "games" | "direct-login") => setCategory(value)}>
                    <SelectTrigger className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital-goods">Digital Goods</SelectItem>
                      <SelectItem value="topup">Top-up</SelectItem>
                      <SelectItem value="games">Games</SelectItem>
                      <SelectItem value="direct-login">Direct Login</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between md:pt-6">
                  <div className="space-y-0.5">
                    <Label htmlFor="active" className="text-[#1F2937]">Product Status</Label>
                    <p className="text-sm text-[#4B5563]">{isActive ? "Product is visible" : "Product is hidden"}</p>
                  </div>
                  <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[#1F2937]">Description</Label>
                <RichTextEditor
                  id="description"
                  value={description}
                  onChange={setDescription}
                  placeholder="Enter product description"
                  className="border-[#F59E0B]/30 focus-within:border-[#F59E0B] focus-within:ring-[#F59E0B]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ribbon" className="text-[#1F2937]">Ribbon Text <span className="text-gray-400 font-normal">(Optional)</span></Label>
                  <Input id="ribbon" value={ribbonText} onChange={(e) => setRibbonText(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder='e.g. Hot, New, Discount, 10% Off' maxLength={20} />
                  <p className="text-xs text-[#4B5563]">Displayed as a badge on the product card (max 20 chars).</p>
                </div>
                {category === "topup" && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-servers" className="text-[#1F2937]">Product Servers</Label>
                      <p className="text-xs text-[#4B5563]">Enable to add servers for this product</p>
                    </div>
                    <Switch id="show-servers" checked={showServers} onCheckedChange={setShowServers} />
                  </div>
                )}

                {(category === "topup" || category === "digital-goods") && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-categories" className="text-[#1F2937]">Denomination Categories</Label>
                      <p className="text-xs text-[#4B5563]">Enable to group denominations</p>
                    </div>
                    <Switch id="show-categories" checked={showCategories} onCheckedChange={setShowCategories} />
                  </div>
                )}

                {(category === "direct-login" || category === "topup") && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="show-checkout" className="text-[#1F2937]">Checkout Fields</Label>
                      <p className="text-xs text-[#4B5563]">Enable to add custom checkout fields</p>
                    </div>
                    <Switch id="show-checkout" checked={showCheckoutFields} onCheckedChange={setShowCheckoutFields} />
                  </div>
                )}

                {!showCategories && (
                  <div className="space-y-2">
                    <Label className="text-[#1F2937]">Denomination Icon <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <div className="flex items-center gap-3">
                      {denomIconUrl && (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#F59E0B]/40 flex-shrink-0 bg-white flex items-center justify-center">
                          <Image src={denomIconUrl} alt="Denom icon" fill sizes="56px" style={{ objectFit: 'contain' }} />
                        </div>
                      )}
                      <div className="flex-1 space-y-1.5">
                        <Input value={denomIconUrl} onChange={(e) => setDenomIconUrl(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="Paste icon URL or upload" />
                        <input type="file" accept="image/*" id="denom-icon-upload-edit" onChange={handleDenomIconUpload} className="hidden" />
                        <Button type="button" variant="outline" disabled={isUploadingIcon} onClick={() => document.getElementById('denom-icon-upload-edit')?.click()} className="w-full border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 text-sm h-8">
                          {isUploadingIcon ? <><div className="animate-spin h-3 w-3 border-2 border-[#F59E0B] border-t-transparent rounded-full mr-2" />Uploading...</> : <><Upload className="h-3 w-3 mr-2 text-[#F59E0B]" />Upload Icon</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checkout Fields — for direct-login and topup categories */}
          {((category === "direct-login" || category === "topup") && showCheckoutFields) && (
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <CardTitle className="text-[#1F2937]">Checkout Fields</CardTitle>
                <CardDescription className="text-[#92400E]">Configure the input fields customers fill out (max 3)</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {checkoutFields.length > 0 && (
                    <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#F9FAFB]">
                          <TableRow>
                            <TableHead className="text-[#4B5563]">Label</TableHead>
                            <TableHead className="text-[#4B5563]">Type</TableHead>
                            <TableHead className="text-[#4B5563]">Required</TableHead>
                            <TableHead className="w-[100px] text-right text-[#4B5563]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checkoutFields.map((field, index) => (
                            <TableRow key={index} className="border-t border-[#E5E7EB]">
                              <TableCell className="text-[#1F2937] font-medium">{field.label}</TableCell>
                              <TableCell className="text-[#4B5563] capitalize">{field.type}</TableCell>
                              <TableCell className="text-[#4B5563]">{field.required ? "Yes" : "No"}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => { setNewFieldLabel(field.label); setNewFieldType(field.type as any); setNewFieldRequired(field.required); setEditingFieldIndex(index) }} className="h-8 w-8 p-0 text-[#F59E0B] hover:bg-[#FEF7E0] mr-1"><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setCheckoutFields(checkoutFields.filter((_, i) => i !== index))} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {(checkoutFields.length < 3 || editingFieldIndex !== null) && (
                    <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border-2 border-dashed border-[#E5E7EB]">
                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs text-[#6B7280]">Field Label</Label>
                          <Input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Email Address" className="h-9 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" />
                        </div>
                        <div className="w-[120px] space-y-2">
                          <Label className="text-xs text-[#6B7280]">Type</Label>
                          <Select value={newFieldType} onValueChange={(v: "text" | "email" | "password") => setNewFieldType(v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="password">Password</SelectItem></SelectContent></Select>
                        </div>
                        <div className="flex flex-col justify-center space-y-2 pb-2">
                          <Label htmlFor="edit-field-req" className="text-xs text-[#6B7280]">Required?</Label>
                          <Switch id="edit-field-req" checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white h-9 px-4" onClick={() => { if (!newFieldLabel.trim()) { toast.error("Label is required"); return }; const key = newFieldLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""); const newField = { key, label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired }; if (editingFieldIndex !== null) { const updated = [...checkoutFields]; updated[editingFieldIndex] = newField; setCheckoutFields(updated); setEditingFieldIndex(null) } else { setCheckoutFields([...checkoutFields, newField]) }; setNewFieldLabel(""); setNewFieldType("text"); setNewFieldRequired(true) }}>{editingFieldIndex !== null ? <><Pencil className="h-4 w-4 mr-2" />Update Field</> : <><Plus className="h-4 w-4 mr-2" />Add Field</>}</Button>
                        {editingFieldIndex !== null && <Button variant="outline" size="sm" className="h-9" onClick={() => { setEditingFieldIndex(null); setNewFieldLabel(""); setNewFieldType("text"); setNewFieldRequired(true) }}>Cancel</Button>}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User ID Help — only for topup category */}
          {category === "topup" && (
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-[#F59E0B]" />
                  <CardTitle className="text-[#1F2937]">User ID Help</CardTitle>
                </div>
                <CardDescription className="text-[#92400E]">Instructions for users</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="uid_instructions" className="text-[#1F2937]">Instructions</Label>
                    <Textarea id="uid_instructions" value={uidInstructions} onChange={(e) => setUidInstructions(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500 min-h-[120px]" placeholder="Enter instructions for users..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#1F2937]">Guide Image</Label>
                    <div className="flex flex-col items-center gap-3">
                      {uidGuideImage ? (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[#F59E0B]/30 bg-white">
                          <Image src={uidGuideImage} alt="UID Guide" fill className="object-contain" unoptimized />
                          <button onClick={() => setUidGuideImage("")} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded-lg border-2 border-dashed border-[#F59E0B]/20 flex flex-col items-center justify-center bg-white/50">
                          <HelpCircle className="h-8 w-8 text-[#F59E0B]/20 mb-1" />
                          <p className="text-[10px] text-[#92400E]/60">No image</p>
                        </div>
                      )}
                      <div className="w-full">
                        <input type="file" accept="image/*" id="guide-image-upload-edit" onChange={handleGuideImageUpload} className="hidden" />
                        <Button type="button" variant="outline" size="sm" disabled={isUploadingGuide} onClick={() => document.getElementById('guide-image-upload-edit')?.click()} className="w-full border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 h-9">
                          {isUploadingGuide ? "Uploading..." : <><Upload className="h-3 w-3 mr-2" />Upload Guide Image</>}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Servers — only for topup category */}
          {category === "topup" && showServers && (
            <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
              <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-[#F59E0B]" />
                  <CardTitle className="text-[#1F2937]">Product Servers</CardTitle>
                </div>
                <CardDescription className="text-[#92400E]">Add available servers for this product</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex gap-2">
                  <Input 
                    value={newServerName} 
                    onChange={(e) => setNewServerName(e.target.value)} 
                    placeholder="e.g. Asia, Europe, America" 
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newServerName.trim()) {
                          setServers([...servers, { id: crypto.randomUUID(), name: newServerName.trim() }]);
                          setNewServerName("");
                        }
                      }
                    }}
                  />
                  <Button 
                    type="button"
                    onClick={() => {
                      if (newServerName.trim()) {
                        setServers([...servers, { id: crypto.randomUUID(), name: newServerName.trim() }]);
                        setNewServerName("");
                      }
                    }}
                    className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white"
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {servers.map((server) => (
                    <Badge key={server.id} variant="secondary" className="bg-white border-[#F59E0B]/30 text-[#1F2937] py-1 pl-3 pr-1 flex items-center gap-1">
                      {server.name}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setServers(servers.filter(s => s.id !== server.id))}
                        className="h-5 w-5 p-0 hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {servers.length === 0 && (
                    <p className="text-xs text-[#92400E]/60 italic">No servers added yet. Product will show only User ID input.</p>
                  )}
                </div>
              </CardContent>
              </Card>
          )}
        </div>

        {/* Product Image */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md h-fit">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Product Image</CardTitle>
            <CardDescription className="text-[#92400E]">Update product logo</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border border-[#F59E0B]/30 mb-4">
                <Image src={logo || "/placeholder.svg?height=128&width=128"} alt={name} fill className="object-contain" />
              </div>
              <div className="space-y-2 w-full">
                <Label htmlFor="logo" className="text-[#1F2937]">Logo URL</Label>
                <Input id="logo" value={logo} onChange={(e) => setLogo(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="https://example.com/logo.png" />
              </div>
              <div className="w-full mt-4">
                <Label htmlFor="image-upload" className="text-[#1F2937] mb-2 block">Or Upload New Image</Label>
                <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button className="w-full bg-white border-2 border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0]" onClick={() => document.getElementById("image-upload")?.click()} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload New Image"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Denomination Categories */}
        {(category === "topup" || category === "digital-goods") && showCategories && (
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-3">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Denomination Categories</CardTitle>
            <CardDescription className="text-[#92400E]">Group denominations into specific categories</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {denominationCategories.length > 0 && (
              <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-hidden">
                <Table>
                  <TableHeader className="bg-white">
                    <TableRow>
                      <TableHead className="text-[#1F2937] font-medium w-16">Icon</TableHead>
                      <TableHead className="text-[#1F2937] font-medium">Name</TableHead>
                      <TableHead className="text-[#1F2937] font-medium">Description</TableHead>
                      <TableHead className="text-[#1F2937] font-medium w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {denominationCategories.map((cat, index) => (
                      <TableRow key={index} className="border-t border-[#F59E0B]/10 hover:bg-[#FEF7E0]/50">
                        <TableCell>
                          {cat.icon_url ? (
                            <div className="w-8 h-8 relative rounded overflow-hidden">
                              <Image src={cat.icon_url} alt={cat.name} fill className="object-cover" />
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-[#1F2937]">{cat.name}</TableCell>
                        <TableCell className="text-[#4B5563] text-sm">{cat.description || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => moveDenomCategory(index, "top")} disabled={index === 0} className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move to Top"><ArrowUpToLine className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => moveDenomCategory(index, "up")} disabled={index === 0} className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move Up"><ArrowUp className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => moveDenomCategory(index, "down")} disabled={index === denominationCategories.length - 1} className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move Down"><ArrowDown className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => moveDenomCategory(index, "bottom")} disabled={index === denominationCategories.length - 1} className="h-8 w-8 p-0 text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move to Bottom"><ArrowDownToLine className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => editDenomCategory(index)} className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => removeDenomCategory(index)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="bg-white p-4 rounded-md border-2 border-[#F59E0B]/20">
              <h3 className="text-[#1F2937] font-medium mb-4">{editingDenomCatIndex !== null ? "Edit Category" : "Add New Category"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat-name" className="text-[#1F2937]">Category Name</Label>
                    <Input id="cat-name" value={newDenomCatName} onChange={(e) => setNewDenomCatName(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="e.g. Weekly Pass" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat-desc" className="text-[#1F2937]">Description (Optional)</Label>
                    <Input id="cat-desc" value={newDenomCatDesc} onChange={(e) => setNewDenomCatDesc(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="Brief description" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1F2937]">Category Icon (Optional)</Label>
                  <div className="flex gap-4 items-start">
                    <div className="w-16 h-16 relative rounded overflow-hidden border-2 border-[#F59E0B]/30 bg-gray-50 flex-shrink-0 flex items-center justify-center">
                      {newDenomCatIconUrl ? (
                        <Image src={newDenomCatIconUrl} alt="Icon preview" fill className="object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">No icon</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input value={newDenomCatIconUrl} onChange={(e) => setNewDenomCatIconUrl(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500 h-8" placeholder="URL or upload ->" />
                      <input id="cat-icon-upload" type="file" accept="image/*" onChange={handleCatIconUpload} className="hidden" />
                      <Button type="button" size="sm" className="w-full bg-white border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0] h-8" onClick={() => document.getElementById("cat-icon-upload")?.click()} disabled={isUploadingCatIcon}>
                        <Upload className="h-3 w-3 mr-2" />
                        {isUploadingCatIcon ? "Uploading..." : "Upload Icon"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={addDenomCategory}>
                  {editingDenomCatIndex !== null ? <><Pencil className="h-4 w-4 mr-2" />Update Category</> : <><Plus className="h-4 w-4 mr-2" />Add Category</>}
                </Button>
                {editingDenomCatIndex !== null && <Button variant="outline" onClick={() => { setEditingDenomCatIndex(null); setNewDenomCatName(""); setNewDenomCatIconUrl(""); setNewDenomCatDesc("") }}>Cancel</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Denominations */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-3">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">Product Denominations</CardTitle>
          <CardDescription className="text-[#92400E]">Add available denominations and prices</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {denominations.length > 0 && (
            <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
              <Table>
                <TableHeader className="bg-[#F9FAFB]">
                  <TableRow>
                    <TableHead className="text-[#4B5563]">Price</TableHead>
                    <TableHead className="text-[#4B5563]">Label</TableHead>
                    {showCategories && <TableHead className="text-[#4B5563]">Category</TableHead>}
                    <TableHead className="text-[#4B5563]">Best Seller</TableHead>
                    <TableHead className="text-[#4B5563]">Stock</TableHead>
                    <TableHead className="w-[100px] text-right text-[#4B5563]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denominations.map((denom, index) => (
                    <TableRow key={index} className="border-t border-[#E5E7EB]">
                      <TableCell className="text-[#1F2937] font-medium">Rs. {denom.price}</TableCell>
                      <TableCell className="text-[#4B5563]">{denom.label}</TableCell>
                      <TableCell className="text-[#4B5563] text-sm">
                        {denom.categoryId ? denominationCategories.find(c => c.id === denom.categoryId)?.name || "Unknown" : "—"}
                      </TableCell>
                      <TableCell className="text-[#4B5563]">{denom.bestseller ? <Badge className="bg-pink-500 border-none text-white">Best Seller</Badge> : "—"}</TableCell>
                      <TableCell className="text-[#4B5563]">{denom.in_stock !== false ? <Badge className="bg-green-500 border-none text-white">In Stock</Badge> : <Badge className="bg-gray-400 border-none text-white">Out of Stock</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => editDenomination(index)} className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => removeDenomination(index)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="bg-white p-4 rounded-md border-2 border-[#F59E0B]/20">
            <h3 className="text-[#1F2937] font-medium mb-4">{editingDenomIndex !== null ? "Edit Denomination" : "Add New Denomination"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-[#1F2937]">Price (Rs.)</Label>
                <Input id="price" value={newDenomPrice} onChange={(e) => handlePriceChange(e.target.value, setNewDenomPrice)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="e.g. 2,333" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label" className="text-[#1F2937]">Label</Label>
                <Input id="label" value={newDenomLabel} onChange={(e) => setNewDenomLabel(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="e.g. 100 Diamonds" />
              </div>
              {showCategories && (
                <div className="space-y-2">
                  <Label className="text-[#1F2937]">Category</Label>
                  <Select value={newDenomCategoryId} onValueChange={setNewDenomCategoryId}>
                    <SelectTrigger className="bg-white border-2 border-[#F59E0B]/30 focus:ring-[#F59E0B]">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {denominationCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 flex flex-col justify-center">
                <Label htmlFor="bestseller" className="text-[#1F2937] mb-2">Best Seller?</Label>
                <div>
                  <Switch
                    id="bestseller"
                    checked={newDenomBestseller}
                    disabled={!newDenomInStock}
                    onCheckedChange={setNewDenomBestseller}
                  />
                  {!newDenomInStock && (
                    <p className="text-[10px] text-red-400 mt-1">Must be in stock</p>
                  )}
                </div>
              </div>
              <div className="space-y-2 flex flex-col justify-center">
                <Label htmlFor="in-stock" className="text-[#1F2937] mb-2">In Stock?</Label>
                <div>
                  <Switch id="in-stock" checked={newDenomInStock} onCheckedChange={(checked) => {
                    setNewDenomInStock(checked)
                    // Auto-clear bestseller when marking out of stock
                    if (!checked) setNewDenomBestseller(false)
                  }} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={addDenomination}>
                {editingDenomIndex !== null ? <><Pencil className="h-4 w-4 mr-2" />Update Denomination</> : <><Plus className="h-4 w-4 mr-2" />Add Denomination</>}
              </Button>
              {editingDenomIndex !== null && <Button variant="outline" onClick={() => { setEditingDenomIndex(null); setNewDenomPrice(""); setNewDenomLabel(""); setNewDenomBestseller(false); setNewDenomInStock(true); setNewDenomCategoryId("") }}>Cancel</Button>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-3">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">Product FAQs</CardTitle>
          <CardDescription className="text-[#92400E]">Common questions and answers</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {faqs.length > 0 && (
            <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-hidden">
              <Table>
                <TableHeader className="bg-white">
                  <TableRow>
                    <TableHead className="text-[#1F2937] font-medium w-1/3">Question</TableHead>
                    <TableHead className="text-[#1F2937] font-medium">Answer</TableHead>
                    <TableHead className="text-[#1F2937] font-medium w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faqs.map((faq, index) => (
                    <TableRow key={index} className="border-t border-[#F59E0B]/10 hover:bg-[#FEF7E0]/50">
                      <TableCell className="font-medium text-[#1F2937] break-words">{faq.question}</TableCell>
                      <TableCell className="text-[#4B5563] break-words">{faq.answer}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => editFaq(index)} className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => removeFaq(index)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="bg-white p-4 rounded-md border-2 border-[#F59E0B]/20">
            <h3 className="text-[#1F2937] font-medium mb-4">{editingFaqIndex !== null ? "Edit FAQ" : "Add New FAQ"}</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faq-question" className="text-[#1F2937]">Question</Label>
                <Input id="faq-question" value={newFaqQuestion} onChange={(e) => setNewFaqQuestion(e.target.value)} className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500" placeholder="e.g. How long?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faq-answer" className="text-[#1F2937]">Answer</Label>
                <RichTextEditor
                  id="faq-answer"
                  value={newFaqAnswer}
                  onChange={setNewFaqAnswer}
                  placeholder="e.g. You can redeem it on the official website..."
                  className="border-[#F59E0B]/30 focus-within:border-[#F59E0B] focus-within:ring-[#F59E0B]"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={addFaq}>{editingFaqIndex !== null ? "Update FAQ" : "Add FAQ"}</Button>
              {editingFaqIndex !== null && <Button variant="outline" onClick={() => { setEditingFaqIndex(null); setNewFaqQuestion(""); setNewFaqAnswer("") }}>Cancel</Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
)
}
