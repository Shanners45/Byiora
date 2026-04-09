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
import { ArrowLeft, Save, Upload, Trash2, Pencil } from "lucide-react"
import { type Product } from "@/lib/product-categories"
import { supabase } from "@/lib/supabase"
import { getProductByIdAction, updateProductAction } from "@/app/actions/products"
import { toast } from "sonner"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function ProductEditPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [category, setCategory] = useState<"topup" | "digital-goods">("digital-goods")
  const [logo, setLogo] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [ribbonText, setRibbonText] = useState("")
  const [denominations, setDenominations] = useState<Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean }>>([])
  const [denomIconUrl, setDenomIconUrl] = useState("")
  
  // New Denomination Form state
  const [newDenomPrice, setNewDenomPrice] = useState("")
  const [newDenomLabel, setNewDenomLabel] = useState("")
  const [newDenomIconUrl, setNewDenomIconUrl] = useState("")
  const [newDenomBestseller, setNewDenomBestseller] = useState(false)
  const [editingDenomIndex, setEditingDenomIndex] = useState<number | null>(null)

  // FAQ state
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [newFaqQuestion, setNewFaqQuestion] = useState("")
  const [newFaqAnswer, setNewFaqAnswer] = useState("")

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const result = await getProductByIdAction(productId)

        if (result.error || !result.data) {
          toast.error(result.error || "Product not found")
          router.push("/admin/dashboard/products")
          return
        }

        const productData = result.data

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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB")
      return
    }

    setIsUploading(true)

    try {
      // Create unique filename
      const fileExt = file.name.split(".").pop()
      const fileName = `${productId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      console.log("Uploading file:", fileName)

      // Upload to Supabase Storage
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

      console.log("Upload successful:", uploadData)

      // Get public URL
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath)

      console.log("Public URL:", urlData)

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
    } catch (error) {
      toast.error("Failed to upload icon")
    } finally {
      setIsUploadingIcon(false)
    }
  }

  // Auto-generate slug from name
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
      // Inject the shared denom icon into every denomination before saving
      const denominationsWithIcon = denominations.map(d => ({
        ...d,
        icon_url: denomIconUrl || undefined,
      }))

      // Use Server Action to update product
      const result = await updateProductAction(productId, {
        name,
        category,
        logo,
        description,
        is_active: isActive,
        denominations: denominationsWithIcon,
        faqs,
        slug: slug.trim() || generateSlug(name.trim()),
        denom_icon_url: denomIconUrl || null,
        ribbon_text: ribbonText.trim() || null,
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

    if (editingDenomIndex !== null) {
      const updated = [...denominations]
      updated[editingDenomIndex] = { price: newDenomPrice, label: newDenomLabel, bestseller: newDenomBestseller }
      setDenominations(updated)
      setEditingDenomIndex(null)
    } else {
      setDenominations([...denominations, { price: newDenomPrice, label: newDenomLabel, bestseller: newDenomBestseller }])
    }

    setNewDenomPrice("")
    setNewDenomLabel("")
    setNewDenomIconUrl("")
    setNewDenomBestseller(false)
  }

  const removeDenomination = (index: number) => {
    setDenominations(denominations.filter((_, i) => i !== index))
  }

  const editDenomination = (index: number) => {
    const denom = denominations[index]
    setNewDenomPrice(denom.price)
    setNewDenomLabel(denom.label)
    setNewDenomBestseller(denom.bestseller || false)
    setEditingDenomIndex(index)
  }

  const addFaq = () => {
    if (!newFaqQuestion || !newFaqAnswer) {
      toast.error("Please fill in both question and answer")
      return
    }

    setFaqs([
      ...faqs,
      {
        question: newFaqQuestion,
        answer: newFaqAnswer,
      },
    ])

    setNewFaqQuestion("")
    setNewFaqAnswer("")
  }

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
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
        <Button className="bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Details */}
        <Card className="border-none shadow-md lg:col-span-2">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-[#1F2937]">Product Details</CardTitle>
            <CardDescription className="text-[#4B5563]">Basic information about the product</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Row 1: Product Name and URL Slug side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#1F2937]">
                  Product Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={handleNameChange}
                  className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-[#1F2937]">
                  URL Slug
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={handleSlugChange}
                  className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2]"
                  placeholder="auto-generated-from-product-name"
                />
                <p className="text-xs text-[#4B5563]">
                  URL: byiora.store/{category}/{slug || generateSlug(name) || 'product-slug'}
                </p>
              </div>
            </div>

            {/* Row 2: Category and Product Status side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-[#1F2937]">
                  Category
                </Label>
                <Select value={category} onValueChange={(value: "topup" | "digital-goods") => setCategory(value)}>
                  <SelectTrigger className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital-goods">Digital Goods</SelectItem>
                    <SelectItem value="topup">Top-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between md:pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="active" className="text-[#1F2937]">
                    Product Status
                  </Label>
                  <p className="text-sm text-[#4B5563]">
                    {isActive ? "Product is visible on the homepage" : "Product is hidden from the homepage"}
                  </p>
                </div>
                <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#1F2937]">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-[#F9FAFB] border-[#E5E7EB] min-h-[120px]"
              />
            </div>

            {/* Row 3: Ribbon Text and Denomination Icon side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ribbon" className="text-[#1F2937]">
                  Ribbon Text <span className="text-[#4B5563] font-normal">(Optional)</span>
                </Label>
                <Input
                  id="ribbon"
                  value={ribbonText}
                  onChange={(e) => setRibbonText(e.target.value)}
                  className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2] placeholder:text-gray-400"
                  placeholder='e.g. Hot, New, Discount, 10% Off'
                  maxLength={20}
                />
                <p className="text-xs text-[#4B5563]">Short label shown as a badge on the product card (max 20 chars).</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[#1F2937]">
                  Denomination Icon <span className="text-[#4B5563] font-normal">(Optional)</span>
                </Label>
                <div className="flex items-center gap-3">
                  {denomIconUrl && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#E5E7EB] flex-shrink-0 bg-white flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={denomIconUrl} alt="Denom icon" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={denomIconUrl}
                      onChange={(e) => setDenomIconUrl(e.target.value)}
                      className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2] placeholder:text-gray-400"
                      placeholder="Paste icon URL or upload"
                    />
                    <input type="file" accept="image/*" id="denom-icon-upload-edit" onChange={handleDenomIconUpload} className="hidden" />
                    <Button
                      type="button" variant="outline" disabled={isUploadingIcon}
                      onClick={() => document.getElementById('denom-icon-upload-edit')?.click()}
                      className="w-full border-[#E5E7EB] hover:bg-gray-50 text-sm h-8 text-[#4B5563]"
                    >
                      {isUploadingIcon
                        ? <><div className="animate-spin h-3 w-3 border-2 border-[#7E3AF2] border-t-transparent rounded-full mr-2" />Uploading...</>
                        : <><Upload className="h-3 w-3 mr-2" />Upload Icon</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Image */}
        <Card className="border-none shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-[#1F2937]">Product Image</CardTitle>
            <CardDescription className="text-[#4B5563]">Upload or update product logo</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border border-[#E5E7EB] mb-4">
                <Image
                  src={logo || "/placeholder.svg?height=128&width=128"}
                  alt={name}
                  fill
                  className="object-contain"
                />
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="logo" className="text-[#1F2937]">
                  Logo URL
                </Label>
                <Input
                  id="logo"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="bg-[#F9FAFB] border-2 border-[#E5E7EB] focus:border-[#7E3AF2]"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="w-full mt-4">
                <Label htmlFor="image-upload" className="text-[#1F2937] mb-2 block">
                  Or Upload New Image
                </Label>
                <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button
                  className="w-full bg-white border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]"
                  onClick={() => document.getElementById("image-upload")?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload New Image"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Denominations */}
        <Card className="border-none shadow-md lg:col-span-3">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-[#1F2937]">Product Denominations</CardTitle>
            <CardDescription className="text-[#4B5563]">Manage available denominations and prices</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Current denominations */}
              {denominations.length > 0 && (
                <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#F9FAFB]">
                      <TableRow>
                        <TableHead className="text-[#4B5563]">Price</TableHead>
                        <TableHead className="text-[#4B5563]">Label</TableHead>
                        <TableHead className="text-[#4B5563]">Best Seller</TableHead>
                        <TableHead className="w-[100px] text-right text-[#4B5563]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {denominations.map((denom, index) => (
                        <TableRow key={index} className="border-t border-[#E5E7EB]">
                          <TableCell className="text-[#1F2937] font-medium">Rs. {denom.price}</TableCell>
                          <TableCell className="text-[#4B5563]">{denom.label}</TableCell>
                          <TableCell className="text-[#4B5563]">
                            {denom.bestseller ? <Badge className="bg-pink-500 hover:bg-pink-600 border-none text-white">Best Seller</Badge> : <span className="text-gray-400">No</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => editDenomination(index)}
                                className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDenomination(index)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Add new denomination */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[#1F2937]">Add New Denomination</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                  <div className="space-y-2 col-span-1">
                    <Label className="text-[#4B5563]">Price (Rs) *</Label>
                    <Input
                      placeholder="e.g. 2,333"
                      value={newDenomPrice}
                      onChange={(e) => setNewDenomPrice(e.target.value)}
                      className="border-[#E5E7EB] bg-white text-[#1F2937] placeholder:text-gray-400 focus-visible:ring-[#7E3AF2]"
                    />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label className="text-[#4B5563]">Label *</Label>
                    <Input
                      placeholder="e.g. 500 UC"
                      value={newDenomLabel}
                      onChange={(e) => setNewDenomLabel(e.target.value)}
                      className="bg-white border-2 border-[#E5E7EB] focus:border-[#7E3AF2] placeholder:text-gray-500"
                    />
                  </div>
                  <div className="space-y-2 col-span-1 flex flex-col justify-center h-full pb-2">
                    <Label className="text-[#4B5563] mb-2">Best Seller?</Label>
                    <div>
                      <Switch
                        checked={newDenomBestseller}
                        onCheckedChange={setNewDenomBestseller}
                      />
                    </div>
                  </div>
                </div>
                <Button className="mt-4 bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white" onClick={addDenomination}>
                  Add Denomination
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQs */}
        <Card className="border-none shadow-md lg:col-span-3">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-[#1F2937]">FAQs</CardTitle>
            <CardDescription className="text-[#4B5563]">Manage frequently asked questions for this product</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Current FAQs */}
              <div className="rounded-md border border-[#E5E7EB] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#F9FAFB]">
                    <TableRow>
                      <TableHead className="text-[#1F2937] font-medium w-1/3">Question</TableHead>
                      <TableHead className="text-[#1F2937] font-medium">Answer</TableHead>
                      <TableHead className="text-[#1F2937] font-medium w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faqs.map((faq, index) => (
                      <TableRow key={index} className="hover:bg-[#F9FAFB]">
                        <TableCell className="font-medium text-[#1F2937] break-words">{faq.question}</TableCell>
                        <TableCell className="text-[#4B5563] break-words">{faq.answer}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#EF4444] hover:text-[#EF4444]/80 hover:bg-red-50"
                            onClick={() => removeFaq(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {faqs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-[#4B5563]">
                          No FAQs added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Add new FAQ */}
              <div className="bg-[#F3F4F6] p-4 rounded-md border border-[#E5E7EB]">
                <h3 className="text-[#1F2937] font-medium mb-4">Add New FAQ</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question" className="text-[#1F2937]">
                      Question
                    </Label>
                    <Input
                      id="question"
                      value={newFaqQuestion}
                      onChange={(e) => setNewFaqQuestion(e.target.value)}
                      className="bg-white border-2 border-[#E5E7EB] focus:border-[#7E3AF2] placeholder:text-gray-500"
                      placeholder="e.g. How to redeem the code?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="answer" className="text-[#1F2937]">
                      Answer
                    </Label>
                    <Textarea
                      id="answer"
                      value={newFaqAnswer}
                      onChange={(e) => setNewFaqAnswer(e.target.value)}
                      className="bg-white border-2 border-[#E5E7EB] focus:border-[#7E3AF2] placeholder:text-gray-500"
                      placeholder="e.g. You can redeem it on the official website..."
                    />
                  </div>
                </div>
                <Button className="mt-4 bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white" onClick={addFaq}>
                  Add FAQ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
