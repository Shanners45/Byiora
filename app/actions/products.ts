"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Verifies the current user is an admin
 */
async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!adminUser) return false
  return true
}

/**
 * Creates a new product (admin only)
 * Uses Service Role to bypass RLS
 */
export async function createProductAction(productData: {
  id: string
  name: string
  slug: string
  category: "topup" | "digital-goods"
  logo: string
  description: string
  is_active: boolean
  denominations: Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean }>
  denom_icon_url: string | null
  ribbon_text: string | null
  faqs: Array<{ question: string; answer: string }>
}) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const { data, error } = await serviceSupabase
      .from("products")
      .insert([productData])
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
    category?: "topup" | "digital-goods"
    logo?: string
    description?: string
    is_active?: boolean
    denominations?: Array<{ price: string; label: string; icon_url?: string; bestseller?: boolean }>
    denom_icon_url?: string | null
    ribbon_text?: string | null
    faqs?: Array<{ question: string; answer: string }>
  }
) {
  if (!(await verifyAdmin())) {
    return { error: "Unauthorized: Admin access required" }
  }

  try {
    const serviceSupabase = createServiceRoleClient()

    const updateData = {
      ...productData,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await serviceSupabase
      .from("products")
      .update(updateData)
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
