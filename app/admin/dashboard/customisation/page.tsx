"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Upload, Trash2, ImageIcon, Plus, ChevronUp, ChevronDown, Check, X, Layers, Package } from "lucide-react"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Banner {
  id: string
  title: string
  image_url: string
  link_url: string
  is_active: boolean
  sort_order: number
}

interface Category {
  id: string
  title: string
  is_active: boolean
  sort_order: number
  product_ids: string[]
}

interface ProductInfo {
  id: string
  name: string
  logo: string
}

export default function CustomisationPage() {
  const [activeTab, setActiveTab] = useState("banners")

  // ====================== BANNERS STATE ======================
  const [banners, setBanners] = useState<Banner[]>([])
  const [isLoadingBanners, setIsLoadingBanners] = useState(true)
  const [isUploadingBanner, setIsUploadingBanner] = useState<string | null>(null)
  const [showAddBannerForm, setShowAddBannerForm] = useState(false)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [editBannerForm, setEditBannerForm] = useState<Partial<Banner>>({})
  const [newBanner, setNewBanner] = useState({ title: "", image_url: "", link_url: "" })
  const [isReordering, setIsReordering] = useState(false)

  // ====================== CATEGORIES STATE ======================
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [newCategoryTitle, setNewCategoryTitle] = useState("")
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryTitle, setEditCategoryTitle] = useState("")

  useEffect(() => {
    loadBanners()
    loadCategoriesAndProducts()
  }, [])

  // ====================== BANNERS LOGIC ======================
  const loadBanners = async () => {
    setIsLoadingBanners(true)
    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true })
      if (error) toast.error("Failed to load banners")
      else if (data) setBanners(data)
    } finally {
      setIsLoadingBanners(false)
    }
  }

  const handleBannerImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bannerId: string | "new",
    onSuccess: (url: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingBanner(bannerId)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const filePath = `banners/banner-${bannerId}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, file, { cacheControl: "3600", upsert: true })
      if (uploadError) throw new Error()
      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath)
      onSuccess(data.publicUrl)
      toast.success("Image uploaded!")
    } catch {
      toast.error("Failed to upload image")
    } finally {
      setIsUploadingBanner(null)
    }
  }

  const handleAddBanner = async () => {
    if (!newBanner.image_url) return toast.error("Please provide an image URL")
    try {
      const { data, error } = await supabase
        .from("banners")
        .insert([{
          title: newBanner.title,
          image_url: newBanner.image_url,
          link_url: newBanner.link_url,
          is_active: true,
          sort_order: banners.length + 1
        }])
        .select()
        .single()
      if (error) throw error
      setBanners(prev => [...prev, data as Banner])
      setNewBanner({ title: "", image_url: "", link_url: "" })
      setShowAddBannerForm(false)
      toast.success("Banner added")
    } catch (err: any) {
      toast.error(err.message || "Failed to add banner")
    }
  }

  const handleSaveBannerEdit = async () => {
    if (!editingBannerId) return
    try {
      const { error } = await supabase
        .from("banners")
        .update({
          title: editBannerForm.title || "",
          link_url: editBannerForm.link_url || "",
          image_url: editBannerForm.image_url || ""
        })
        .eq("id", editingBannerId)
      if (error) throw error
      setBanners(prev => prev.map(b => b.id === editingBannerId ? { ...b, ...editBannerForm } : b))
      setEditingBannerId(null)
      toast.success("Banner updated")
    } catch (err: any) {
      toast.error(err.message || "Failed to update banner")
    }
  }

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("Delete banner?")) return
    try {
      const { error } = await supabase.from("banners").delete().eq("id", id)
      if (error) throw error
      setBanners(prev => prev.filter(b => b.id !== id))
    } catch (err: any) {
      toast.error(err.message || "Failed to delete banner")
    }
  }

  const handleToggleBannerActive = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from("banners")
        .update({ is_active: !banner.is_active })
        .eq("id", banner.id)
      if (error) throw error
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !banner.is_active } : b))
    } catch (err: any) {
      toast.error(err.message || "Failed to update banner")
    }
  }

  const handleMoveBanner = async (index: number, direction: 'up' | 'down') => {
    if (isReordering || (direction === 'up' && index === 0) || (direction === 'down' && index === banners.length - 1)) return

    setIsReordering(true)
    const newBanners = [...banners]
    const swapIndex = direction === 'up' ? index - 1 : index + 1

    const currentOrder = newBanners[index].sort_order
    newBanners[index].sort_order = newBanners[swapIndex].sort_order
    newBanners[swapIndex].sort_order = currentOrder

    const temp = newBanners[index]
    newBanners[index] = newBanners[swapIndex]
    newBanners[swapIndex] = temp

    setBanners(newBanners)

    try {
      await Promise.all([
        supabase.from("banners").update({ sort_order: newBanners[index].sort_order }).eq("id", newBanners[index].id),
        supabase.from("banners").update({ sort_order: newBanners[swapIndex].sort_order }).eq("id", newBanners[swapIndex].id)
      ])
      toast.success("Order updated")
    } catch (err: any) {
      toast.error("Failed to reorder banners")
      loadBanners() // revert on error
    } finally {
      setIsReordering(false)
    }
  }

  // ====================== CATEGORIES LOGIC ======================
  const loadCategoriesAndProducts = async () => {
    setIsLoadingCategories(true)
    try {
      const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] = await Promise.all([
        supabase.from("homepage_categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("products").select("id, name, logo").eq("is_active", true)
      ])
      if (catErr) toast.error("Failed to load categories")
      else if (cats) setCategories(cats)
      if (prodErr) toast.error("Failed to load products")
      else if (prods) setProducts(prods)
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim()) return toast.error("Category title is required")
    try {
      const { data, error } = await supabase
        .from("homepage_categories")
        .insert([{ title: newCategoryTitle.trim(), sort_order: categories.length + 1, product_ids: [], is_active: true }])
        .select()
        .single()
      if (error) throw error
      setCategories(prev => [...prev, data as Category])
      setNewCategoryTitle("")
      setShowAddCategoryForm(false)
      toast.success("Category added")
    } catch (err: any) {
      toast.error(err.message || "Failed to add category")
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this homepage category? Products will not be deleted.")) return
    try {
      const { error } = await supabase.from("homepage_categories").delete().eq("id", id)
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category")
    }
  }

  const handleSaveCategoryEdit = async () => {
    if (!editingCategoryId || !editCategoryTitle.trim()) return
    try {
      const { error } = await supabase
        .from("homepage_categories")
        .update({ title: editCategoryTitle.trim() })
        .eq("id", editingCategoryId)
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === editingCategoryId ? { ...c, title: editCategoryTitle } : c))
      setEditingCategoryId(null)
      toast.success("Category renamed")
    } catch (err: any) {
      toast.error(err.message || "Failed to rename category")
    }
  }

  const handleToggleCategoryActive = async (cat: Category) => {
    try {
      const { error } = await supabase
        .from("homepage_categories")
        .update({ is_active: !cat.is_active })
        .eq("id", cat.id)
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !cat.is_active } : c))
    } catch (err: any) {
      toast.error(err.message || "Failed to update category")
    }
  }

  const handleToggleProductInCategory = async (cat: Category, productId: string) => {
    let newProductIds = [...(cat.product_ids || [])]
    if (newProductIds.includes(productId)) {
      newProductIds = newProductIds.filter(id => id !== productId)
    } else {
      newProductIds.push(productId)
    }
    try {
      const { error } = await supabase
        .from("homepage_categories")
        .update({ product_ids: newProductIds })
        .eq("id", cat.id)
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, product_ids: newProductIds } : c))
    } catch (err: any) {
      toast.error(err.message || "Failed to update category")
    }
  }

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    if (isReordering || (direction === 'up' && index === 0) || (direction === 'down' && index === categories.length - 1)) return

    setIsReordering(true)
    const newCats = [...categories]
    const swapIndex = direction === 'up' ? index - 1 : index + 1

    const currentOrder = newCats[index].sort_order
    newCats[index].sort_order = newCats[swapIndex].sort_order
    newCats[swapIndex].sort_order = currentOrder

    const temp = newCats[index]
    newCats[index] = newCats[swapIndex]
    newCats[swapIndex] = temp

    setCategories(newCats)

    try {
      await Promise.all([
        supabase.from("homepage_categories").update({ sort_order: newCats[index].sort_order }).eq("id", newCats[index].id),
        supabase.from("homepage_categories").update({ sort_order: newCats[swapIndex].sort_order }).eq("id", newCats[swapIndex].id)
      ])
      toast.success("Category order updated")
    } catch (err: any) {
      toast.error("Failed to reorder categories")
      loadCategoriesAndProducts() // revert on error
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Store Customisation</h1>
        <p className="text-[#4B5563]">Manage homepage banners and product categories display.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-12 bg-[#FEF7E0] border border-[#F59E0B]/20 p-1">
          <TabsTrigger value="banners" className="text-[#1F2937] data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white h-full">
            <ImageIcon className="h-4 w-4 mr-2" /> Banners
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-[#1F2937] data-[state=active]:bg-[#F59E0B] data-[state=active]:text-white h-full">
            <Layers className="h-4 w-4 mr-2" /> Categories
          </TabsTrigger>
        </TabsList>

        {/* BANNERS TAB */}
        <TabsContent value="banners" className="space-y-6 mt-6">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-semibold text-[#1F2937]">Banners</h2>
              <p className="text-xs text-[#F59E0B] mt-1 italic font-medium">Recommended size: 1280 × 420 px (or any 3:1 aspect ratio)</p>
            </div>
            <Button onClick={() => setShowAddBannerForm(true)} className="bg-[#7E3AF2] hover:bg-[#7E3AF2]/90 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Banner
            </Button>
          </div>

          {showAddBannerForm && (
            <Card className="border-2 border-[#7E3AF2]/30 bg-white shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#1F2937] flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" /> New Banner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#1F2937]">Title</Label>
                    <Input value={newBanner.title} onChange={e => setNewBanner(n => ({ ...n, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#1F2937]">Link URL</Label>
                    <Input value={newBanner.link_url} onChange={e => setNewBanner(n => ({ ...n, link_url: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1F2937]">Image URL *</Label>
                  <div className="flex gap-3">
                    <Input value={newBanner.image_url} onChange={e => setNewBanner(n => ({ ...n, image_url: e.target.value }))} />
                    <input type="file" id="new-banner" className="hidden" onChange={e => handleBannerImageUpload(e, "new", url => setNewBanner(n => ({ ...n, image_url: url })))} />
                    <Button variant="outline" onClick={() => document.getElementById("new-banner")?.click()}>
                      {isUploadingBanner === "new" ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleAddBanner} className="bg-[#7E3AF2]">Save</Button>
                  <Button variant="outline" onClick={() => setShowAddBannerForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {banners.map((banner, index) => (
              <Card key={banner.id} className="bg-white border-[#F59E0B]/20 p-4">
                {editingBannerId === banner.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input value={editBannerForm.title || ""} onChange={e => setEditBannerForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" />
                      <Input value={editBannerForm.link_url || ""} onChange={e => setEditBannerForm(f => ({ ...f, link_url: e.target.value }))} placeholder="URL" />
                      <div className="md:col-span-2 flex gap-3">
                        <Input value={editBannerForm.image_url || ""} onChange={e => setEditBannerForm(f => ({ ...f, image_url: e.target.value }))} />
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleSaveBannerEdit}>Save</Button>
                        <Button variant="ghost" onClick={() => setEditingBannerId(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center border border-gray-200 rounded overflow-hidden">
                      <button
                        onClick={() => handleMoveBanner(index, 'up')}
                        disabled={isReordering || index === 0}
                        className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveBanner(index, 'down')}
                        disabled={isReordering || index === banners.length - 1}
                        className="p-1 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent border-t border-gray-200"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="w-24 h-14 bg-gray-100 rounded border flex items-center justify-center overflow-hidden">
                      {banner.image_url ? <img src={banner.image_url} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="text-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{banner.title || "Untitled"}</p>
                      <p className="text-xs text-gray-500">{banner.link_url || "No link"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={banner.is_active} onCheckedChange={() => handleToggleBannerActive(banner)} />
                      <Button variant="ghost" size="sm" onClick={() => { setEditingBannerId(banner.id); setEditBannerForm({ ...banner }) }}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteBanner(banner.id)}>Delete</Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-6 mt-6">
          <div className="flex justify-between items-end">
            <h2 className="text-xl font-semibold text-[#1F2937]">Homepage Categories</h2>
            <Button onClick={() => setShowAddCategoryForm(true)} className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white">
              <Plus className="h-4 w-4 mr-2" /> Add Category
            </Button>
          </div>

          {showAddCategoryForm && (
            <Card className="border-2 border-[#F59E0B]/30 bg-white shadow-md">
              <CardContent className="pt-6 flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Category Title</Label>
                  <Input value={newCategoryTitle} onChange={e => setNewCategoryTitle(e.target.value)} placeholder="e.g. Best Sellers"
                    className="placeholder:text-gray-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleAddCategory} className="bg-[#F59E0B]">Save</Button>
                  <Button variant="outline" onClick={() => setShowAddCategoryForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6">
            {categories.map((cat, index) => (
              <Card key={cat.id} className="border-[#F59E0B]/20 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-[#FEF7E0] py-3 px-4 border-b border-[#F59E0B]/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center bg-white border border-[#F59E0B]/30 rounded overflow-hidden shadow-sm">
                      <button
                        onClick={() => handleMoveCategory(index, 'up')}
                        disabled={isReordering || index === 0}
                        className="p-1 hover:bg-[#F59E0B]/10 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-4 w-4 text-[#F59E0B]" />
                      </button>
                      <button
                        onClick={() => handleMoveCategory(index, 'down')}
                        disabled={isReordering || index === categories.length - 1}
                        className="p-1 hover:bg-[#F59E0B]/10 disabled:opacity-30 disabled:hover:bg-transparent border-t border-[#F59E0B]/20"
                      >
                        <ChevronDown className="h-4 w-4 text-[#F59E0B]" />
                      </button>
                    </div>
                    {editingCategoryId === cat.id ? (
                      <div className="flex items-center gap-2 ml-2">
                        <Input value={editCategoryTitle} onChange={e => setEditCategoryTitle(e.target.value)} className="h-8 max-w-[200px]" autoFocus />
                        <Button size="sm" onClick={handleSaveCategoryEdit} className="h-8 px-2 bg-green-600 text-white">Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)} className="h-8 px-2">Cancel</Button>
                      </div>
                    ) : (
                      <CardTitle className="text-[#1F2937] text-lg ml-2 flex items-center gap-2">
                        {cat.title}
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-700" onClick={() => { setEditingCategoryId(cat.id); setEditCategoryTitle(cat.title); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </Button>
                      </CardTitle>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={cat.is_active} onCheckedChange={() => handleToggleCategoryActive(cat)} />
                    <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500 mb-3">Select products to show in this category on the homepage:</p>
                  <div className="max-h-60 overflow-y-auto border rounded-md p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-gray-50">
                    {products.map(prod => {
                      const isSelected = (cat.product_ids || []).includes(prod.id)
                      return (
                        <div
                          key={prod.id}
                          className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${isSelected ? "bg-[#7E3AF2]/10 border-[#7E3AF2]" : "bg-white border-gray-200 hover:bg-gray-100"}`}
                          onClick={() => handleToggleProductInCategory(cat, prod.id)}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? "bg-[#7E3AF2] border-[#7E3AF2] text-white" : "border-gray-300"}`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="w-8 h-8 rounded border overflow-hidden flex-shrink-0 bg-white">
                            <img src={prod.logo} alt="" className="w-full h-full object-contain p-1" />
                          </div>
                          <span className="text-sm font-medium truncate flex-1">{prod.name}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-[#F59E0B] mt-2 italic font-medium">Selected: {(cat.product_ids || []).filter(id => products.some(p => p.id === id)).length} products</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
