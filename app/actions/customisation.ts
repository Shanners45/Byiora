"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import DOMPurify from "isomorphic-dompurify"

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: adminUser } = await supabase.from('admin_users').select('id').eq('id', user.id).single()
  if (!adminUser) return false
  return true
}

export async function addBannerAction(title: string, linkUrl: string, imageUrl: string, sortOrder: number) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const sanitizedTitle = DOMPurify.sanitize(title || "")
  // Sanitize links to prevent malicious javascript URIs
  const sanitizedLink = linkUrl ? DOMPurify.sanitize(linkUrl) : ""
  
  const { data, error } = await supabase.from("banners").insert([{
    title: sanitizedTitle,
    image_url: imageUrl, 
    link_url: sanitizedLink,
    is_active: true,
    sort_order: sortOrder
  }]).select().single()

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function updateBannerAction(id: string, title: string, linkUrl: string, imageUrl: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const sanitizedTitle = DOMPurify.sanitize(title || "")
  const sanitizedLink = linkUrl ? DOMPurify.sanitize(linkUrl) : ""

  const { error } = await supabase.from("banners").update({
    title: sanitizedTitle,
    image_url: imageUrl,
    link_url: sanitizedLink
  }).eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function addCategoryAction(title: string, sortOrder: number) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const sanitizedTitle = DOMPurify.sanitize(title || "")

  const { data, error } = await supabase.from("homepage_categories").insert([{
    title: sanitizedTitle,
    sort_order: sortOrder,
    product_ids: []
  }]).select().single()

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function updateCategoryTitleAction(id: string, title: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const sanitizedTitle = DOMPurify.sanitize(title || "")

  const { error } = await supabase.from("homepage_categories").update({
    title: sanitizedTitle
  }).eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getBannersAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.from("banners").select("*").order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { success: true, data }
}

export async function deleteBannerAction(id: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from("banners").delete().eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function toggleBannerStatusAction(id: string, currentStatus: boolean) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from("banners").update({ is_active: !currentStatus }).eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function reorderBannersAction(banner1Id: string, banner1Order: number, banner2Id: string, banner2Order: number) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const [{ error: error1 }, { error: error2 }] = await Promise.all([
    supabase.from("banners").update({ sort_order: banner1Order }).eq("id", banner1Id),
    supabase.from("banners").update({ sort_order: banner2Order }).eq("id", banner2Id)
  ])

  if (error1 || error2) return { error: (error1 || error2)?.message || "Failed to reorder" }
  return { success: true }
}

export async function getCategoriesAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const [{ data: categories, error: catError }, { data: products, error: prodError }] = await Promise.all([
    supabase.from("homepage_categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("products").select("id, name, logo").eq("is_active", true)
  ])

  if (catError) return { error: catError.message }
  return { success: true, categories, products }
}

export async function deleteCategoryAction(id: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from("homepage_categories").delete().eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function toggleCategoryStatusAction(id: string, currentStatus: boolean) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from("homepage_categories").update({ is_active: !currentStatus }).eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateCategoryProductsAction(id: string, productIds: string[]) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const { error } = await supabase.from("homepage_categories").update({ product_ids: productIds }).eq("id", id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function reorderCategoriesAction(cat1Id: string, cat1Order: number, cat2Id: string, cat2Order: number) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const supabase = createServiceRoleClient()

  const [{ error: error1 }, { error: error2 }] = await Promise.all([
    supabase.from("homepage_categories").update({ sort_order: cat1Order }).eq("id", cat1Id),
    supabase.from("homepage_categories").update({ sort_order: cat2Order }).eq("id", cat2Id)
  ])

  if (error1 || error2) return { error: (error1 || error2)?.message || "Failed to reorder" }
  return { success: true }
}
