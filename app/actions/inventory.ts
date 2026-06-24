"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { encryptInventoryCode, decryptInventoryCode } from "./inventory-encryption"
import { verifyAdmin, getAdminSessionAction } from "./admin-utils"
import { revalidatePath } from "next/cache"

/**
 * Fetches products that can have inventory (digital-goods, games)
 */
export async function getInventoryProductsAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, logo, category, denominations")
    .in("category", ["digital-goods", "games"])
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }
  return { success: true, products: data }
}

/**
 * Gets stock breakdown for a specific product
 */
export async function getProductStockAction(productId: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  
  const { data, error } = await supabase
    .from("gift_card_inventory")
    .select("denomination_label, status")
    .eq("product_id", productId)

  if (error) return { error: error.message }

  // Aggregate stats
  const stats: Record<string, { available: number; delivered: number }> = {}
  
  data.forEach((item: any) => {
    if (!stats[item.denomination_label]) {
      stats[item.denomination_label] = { available: 0, delivered: 0 }
    }
    if (item.status === "AVAILABLE") stats[item.denomination_label].available++
    if (item.status === "DELIVERED") stats[item.denomination_label].delivered++
  })

  return { success: true, stats }
}

/**
 * Bulk adds multiple codes for a denomination
 */
export async function addInventoryCodesAction(productId: string, denominationLabel: string, codesRaw: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  
  const adminSession = await getAdminSessionAction()
  const adminUserId = adminSession.success ? adminSession.data?.id : "unknown-admin"

  const codes = codesRaw.split("\n").map(c => c.trim()).filter(Boolean)
  if (codes.length === 0) return { error: "No valid codes provided" }

  const supabase = createServiceRoleClient()
  const successCodes = []
  const failedCodes = []

  for (const code of codes) {
    try {
      // 1. Encrypt and Hash
      const { success, encryptedBlob, codeHash, error: encryptErr } = await encryptInventoryCode(code)
      if (!success || !encryptedBlob || !codeHash) {
        failedCodes.push({ code: "MASKED", reason: encryptErr || "Encryption failed" })
        continue
      }

      // 2. Insert
      const { error: insertErr } = await supabase
        .from("gift_card_inventory")
        .insert({
          product_id: productId,
          denomination_label: denominationLabel,
          encrypted_code: encryptedBlob,
          code_hash: codeHash,
          added_by: adminUserId || "unknown-admin"
        } as any)

      if (insertErr) {
        // Handle unique constraint violation
        if (insertErr.code === "23505" || insertErr.message.includes("unique")) {
          failedCodes.push({ code: "MASKED", reason: "Duplicate code" })
        } else {
          failedCodes.push({ code: "MASKED", reason: insertErr.message })
        }
      } else {
        successCodes.push("MASKED")
      }
    } catch (err: any) {
      failedCodes.push({ code: "MASKED", reason: err.message })
    }
  }

  revalidatePath("/admin/dashboard/inventory")
  return { 
    success: true, 
    added: successCodes.length, 
    failed: failedCodes.length, 
    failedDetails: failedCodes 
  }
}

/**
 * Reveals a code (Admin Audit only)
 */
export async function revealAdminCodeAction(inventoryId: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("gift_card_inventory")
    .select("encrypted_code")
    .eq("id", inventoryId)
    .single()

  if (error || !data) return { error: "Code not found" }

  const decryptResult = await decryptInventoryCode((data as any).encrypted_code)
  if (!decryptResult.success) return { error: decryptResult.error }

  // TODO: Log this reveal in an audit table
  console.log(`[AUDIT] Admin revealed code for inventory ID ${inventoryId}`)

  return { success: true, code: decryptResult.decrypted }
}
