"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { sanitizeHtml } from "@/lib/sanitize"

import { verifyAdmin } from "./admin-utils"

function sanitizeProductData<T extends Record<string, any>>(data: T): T {
  const result: any = { ...data }
  if (result.name) result.name = sanitizeHtml(result.name)
  if (result.description) result.description = sanitizeHtml(result.description)
  if (result.ribbon_text) result.ribbon_text = sanitizeHtml(result.ribbon_text)
  if (result.uid_instructions) result.uid_instructions = sanitizeHtml(result.uid_instructions)
  
  if (result.denominations) {
    result.denominations = result.denominations.map((d: any) => ({
      ...d,
      label: d.label ? sanitizeHtml(d.label) : ""
    }))
  }
  
  if (result.denomination_categories) {
    result.denomination_categories = result.denomination_categories.map((c: any) => ({
      ...c,
      name: c.name ? sanitizeHtml(c.name) : "",
      description: c.description ? sanitizeHtml(c.description) : undefined
    }))
  }

  if (result.faqs) {
    result.faqs = result.faqs.map((f: any) => ({
      ...f,
      question: f.question ? sanitizeHtml(f.question) : "",
      answer: f.answer ? sanitizeHtml(f.answer) : ""
    }))
  }
  
  if (result.checkout_fields) {
    result.checkout_fields = result.checkout_fields.map((f: any) => ({
      ...f,
      label: f.label ? sanitizeHtml(f.label) : ""
    }))
  }

  return result as T
}

/**
 * Creates a new product (admin only)
 * Uses Service Role to bypass RLS
 */
export async function createProductAction(productData: {
  id: string
  name: string
  slug: string
  category: "topup" | "digital-goods" | "games" | "direct-login"
  logo: string
  description: string
  is_active: boolean
  denominations: Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean; in_stock?: boolean; categoryId?: string }>
  denomination_categories?: Array<{ id: string; name: string; icon_url?: string; description?: string }>
  denom_icon_url: string | null
  ribbon_text: string | null
  faqs: Array<{ question: string; answer: string }>
  checkout_fields?: Array<{ key: string; label: string; type: string; required: boolean }>
  uid_instructions?: string | null
  uid_guide_image?: string | null
  servers?: Array<{ id: string; name: string }>
}) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const sanitizedData = sanitizeProductData(productData)

    const { data, error } = await serviceSupabase
      .from("products")
      .insert([sanitizedData as any])
      .select()
      .single()

    if (error) {
      console.error("Error creating product:", error)
      return { error: `Failed to create product: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/products")
    revalidatePath("/")
    return { success: true, data }
  } catch (error: any) {
    console.error("Error in createProductAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Updates an existing product (admin only)
 * Uses Service Role to bypass RLS
 */
export async function updateProductAction(
  id: string,
  productData: {
    name?: string
    slug?: string
    category?: "topup" | "digital-goods" | "games" | "direct-login"
    logo?: string
    description?: string
    is_active?: boolean
    denominations?: Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean; in_stock?: boolean; categoryId?: string }>
    denomination_categories?: Array<{ id: string; name: string; icon_url?: string; description?: string }>
    denom_icon_url?: string | null
    ribbon_text?: string | null
    faqs?: Array<{ question: string; answer: string }>
    checkout_fields?: Array<{ key: string; label: string; type: string; required: boolean }>
    uid_instructions?: string | null
    uid_guide_image?: string | null
    servers?: Array<{ id: string; name: string }>
  }
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()
    const sanitizedData = sanitizeProductData(productData)

    const updateData = {
      ...sanitizedData,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await serviceSupabase
      .from("products")
      .update(updateData as any)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating product:", error)
      return { error: `Failed to update product: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/products")
    revalidatePath("/admin/dashboard/products/[id]")
    revalidatePath("/")
    return { success: true, data }
  } catch (error: any) {
    console.error("Error in updateProductAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Gets a product by ID (admin only)
 * Uses Service Role to bypass RLS
 */
export async function getProductByIdAction(id: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching product:", error)
      return { error: `Failed to fetch product: ${error.message}` }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error("Error in getProductByIdAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Deletes a product (admin only)
 * Uses Service Role to bypass RLS
 */
export async function deleteProductAction(id: string) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("products")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting product:", error)
      return { error: `Failed to delete product: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/products")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Error in deleteProductAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}

/**
 * Updates product status (admin only)
 * Uses Service Role to bypass RLS
 */
export async function updateProductStatusAction(id: string, isActive: boolean) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { error } = await serviceSupabase
      .from("products")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating product status:", error)
      return { error: `Failed to update product status: ${error.message}` }
    }

    revalidatePath("/admin/dashboard/products")
    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Error in updateProductStatusAction:", error)
    return { error: error.message || "An unexpected error occurred" }
  }
}
