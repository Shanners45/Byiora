"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Upload, Trash2, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Image from "next/image"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createProductAction } from "@/app/actions/products"

export default function AddProductPage() {
  const supabase = createClient()
  const router = useRouter()

  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)

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
  const [newDenomBestseller, setNewDenomBestseller] = useState(false)
  const [editingDenomIndex, setEditingDenomIndex] = useState<number | null>(null)

  // FAQ state
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [newFaqQuestion, setNewFaqQuestion] = useState("")
  const [newFaqAnswer, setNewFaqAnswer] = useState("")

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
      const fileName = `product-${Date.now()}.${fileExt}`
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
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image size must be less than 2MB"); return }
    setIsUploadingIcon(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `denom-icon-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, file, { cacheControl: "3600", upsert: false })
      if (uploadError) { toast.error(`Failed to upload: ${uploadError.message}`); return }
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName)
      if (urlData?.publicUrl) { setDenomIconUrl(urlData.publicUrl); toast.success("Denomination icon uploaded!") }
    } catch { toast.error("Failed to upload icon") } finally { setIsUploadingIcon(false) }
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
    if (!name.trim()) {
      toast.error("Product name is required")
      return
    }

    setIsSaving(true)

    try {
      // Inject the shared denom icon into every denomination before saving
      const denominationsWithIcon = denominations.map(d => ({
        ...d,
        icon_url: denomIconUrl || undefined,
      }))

      // Use Server Action with Service Role to bypass RLS
      const result = await createProductAction({
        id: crypto.randomUUID(),
        name: name.trim(),
        slug: slug.trim() || generateSlug(name.trim()),
        category,
        logo,
        description: description.trim(),
        is_active: isActive,
        denominations: denominationsWithIcon,
        denom_icon_url: denomIconUrl || null,
        ribbon_text: ribbonText.trim() || null,
        faqs,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Product created successfully")
      router.push("/admin/dashboard/products")
    } catch (error) {
      console.error("Error creating product:", error)
      toast.error("Failed to create product")
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
      updated[editingDenomIndex] = { 
        price: newDenomPrice, 
        label: newDenomLabel,
        bestseller: newDenomBestseller
      }
      setDenominations(updated)
      setEditingDenomIndex(null)
    } else {
      setDenominations([...denominations, { price: newDenomPrice, label: newDenomLabel, bestseller: newDenomBestseller }])
    }

    setNewDenomPrice("")
    setNewDenomLabel("")
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
            <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Add New Product</h1>
            <p className="text-[#4B5563]">Create a new product for your store</p>
          </div>
        </div>
        <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Creating..." : "Create Product"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Details */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-2">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Product Details</CardTitle>
            <CardDescription className="text-[#92400E]">Basic information about the product</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#1F2937]">
                Product Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={handleNameChange}
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                placeholder="Enter product name"
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
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                placeholder="auto-generated-from-product-name"
              />
              <p className="text-xs text-[#4B5563]">
                URL: byiora.store/{category}/{slug || generateSlug(name) || 'product-slug'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-[#1F2937]">
                Category *
              </Label>
              <Select value={category} onValueChange={(value: "topup" | "digital-goods") => setCategory(value)}>
                <SelectTrigger className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital-goods">Digital Goods</SelectItem>
                  <SelectItem value="topup">Top-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#1F2937]">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] min-h-[120px] placeholder:text-gray-500"
                placeholder="Enter product description"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active" className="text-[#1F2937]">
                  Product Status
                </Label>
                <p className="text-sm text-[#4B5563]">
                  {isActive ? "Product will be visible on the homepage" : "Product will be hidden from the homepage"}
                </p>
              </div>
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ribbon" className="text-[#1F2937]">
                Ribbon Text <span className="text-gray-400 font-normal">(Optional)</span>
              </Label>
              <Input
                id="ribbon"
                value={ribbonText}
                onChange={(e) => setRibbonText(e.target.value)}
                className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                placeholder='e.g. Hot, New, Discount, 10% Off'
                maxLength={20}
              />
              <p className="text-xs text-[#4B5563]">Short label displayed as a badge on the product card homepage (max 20 chars).</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1F2937]">
                Denomination Icon <span className="text-gray-400 font-normal">(Optional — applies to all denominations)</span>
              </Label>
              <div className="flex items-center gap-3">
                {denomIconUrl && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-[#F59E0B]/40 flex-shrink-0 bg-white flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={denomIconUrl} alt="Denom icon" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={denomIconUrl}
                    onChange={(e) => setDenomIconUrl(e.target.value)}
                    className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                    placeholder="Paste icon URL or upload"
                  />
                  <input type="file" accept="image/*" id="denom-icon-upload" onChange={handleDenomIconUpload} className="hidden" />
                  <Button
                    type="button" variant="outline" disabled={isUploadingIcon}
                    onClick={() => document.getElementById('denom-icon-upload')?.click()}
                    className="w-full border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 text-sm h-8"
                  >
                    {isUploadingIcon
                      ? <><div className="animate-spin h-3 w-3 border-2 border-[#F59E0B] border-t-transparent rounded-full mr-2" />Uploading...</>
                      : <><Upload className="h-3 w-3 mr-2 text-[#F59E0B]" />Upload Icon</>}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Image */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Product Image</CardTitle>
            <CardDescription className="text-[#92400E]">Upload product logo</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border border-[#F59E0B]/30 mb-4">
                <Image
                  src={logo || "/placeholder.svg?height=128&width=128"}
                  alt={name || "Product"}
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
                  className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="w-full mt-4">
                <Label htmlFor="image-upload" className="text-[#1F2937] mb-2 block">
                  Or Upload New Image
                </Label>
                <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button
                  className="w-full bg-white border-2 border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#FEF7E0]"
                  onClick={() => document.getElementById("image-upload")?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Denominations */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-3">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">Product Denominations</CardTitle>
            <CardDescription className="text-[#92400E]">Add available denominations and prices</CardDescription>
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
                            {denom.bestseller ? <Badge className="bg-pink-500 hover:bg-pink-600 border-none text-white">Best Seller</Badge> : <span className="text-gray-400">—</span>}
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
              <div className="bg-white p-4 rounded-md border-2 border-[#F59E0B]/20">
                <h3 className="text-[#1F2937] font-medium mb-4">Add New Denomination</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-[#1F2937]">
                      Price (Rs.)
                    </Label>
                    <Input
                      id="price"
                      value={newDenomPrice}
                      onChange={(e) => setNewDenomPrice(e.target.value)}
                      className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                      placeholder="e.g. 2,333"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="label" className="text-[#1F2937]">
                      Label
                    </Label>
                    <Input
                      id="label"
                      value={newDenomLabel}
                      onChange={(e) => setNewDenomLabel(e.target.value)}
                      className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                      placeholder="e.g. 100 Diamonds"
                    />
                  </div>
                  <div className="space-y-2 flex flex-col justify-center">
                    <Label htmlFor="bestseller" className="text-[#1F2937] mb-2">
                      Best Seller?
                    </Label>
                    <div>
                      <Switch
                        id="bestseller"
                        checked={newDenomBestseller}
                        onCheckedChange={setNewDenomBestseller}
                      />
                    </div>
                  </div>
                </div>
                <Button className="mt-4 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={addDenomination}>
                  Add Denomination
                </Button>
              </div>

              {/* (Denomination Icon is managed in Product Details above) */}
            </div>
          </CardContent>
        </Card>

        {/* FAQs */}
        <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md lg:col-span-3">
          <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
            <CardTitle className="text-[#1F2937]">FAQs</CardTitle>
            <CardDescription className="text-[#92400E]">Add frequently asked questions for this product</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Current FAQs */}
              <div className="rounded-md border-2 border-[#F59E0B]/20 overflow-hidden">
                <Table>
                  <TableHeader className="bg-white">
                    <TableRow>
                      <TableHead className="text-[#1F2937] font-medium w-1/3">Question</TableHead>
                      <TableHead className="text-[#1F2937] font-medium">Answer</TableHead>
                      <TableHead className="text-[#1F2937] font-medium w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faqs.map((faq, index) => (
                      <TableRow key={index} className="hover:bg-[#FEF7E0]/50">
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
              <div className="bg-white p-4 rounded-md border-2 border-[#F59E0B]/20">
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
                      className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
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
                      className="bg-white border-2 border-[#F59E0B]/30 focus:border-[#F59E0B] placeholder:text-gray-500"
                      placeholder="e.g. You can redeem it on the official website..."
                    />
                  </div>
                </div>
                <Button className="mt-4 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={addFaq}>
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
