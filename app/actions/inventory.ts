"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { encryptInventoryCode, decryptInventoryCode, generateCodeHash } from "./inventory-encryption"
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
 * Fetches all codes for a specific denomination with masked previews
 * Sorted newest first so recently added codes appear at the top.
 */
export async function getDenominationCodesAction(productId: string, denominationLabel: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("gift_card_inventory")
    .select("id, status, created_at, encrypted_code, added_by")
    .eq("product_id", productId)
    .eq("denomination_label", denominationLabel)
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }

  // Decrypt in memory to generate safe masked previews
  const codesWithMask = await Promise.all(
    (data || []).map(async (item: any) => {
      let masked = "••••-••••"
      try {
        const decrypted = await decryptInventoryCode(item.encrypted_code)
        if (decrypted.success && decrypted.decrypted) {
          const raw = decrypted.decrypted.trim()
          if (raw.length <= 8) {
            masked = raw.slice(0, 2) + "••••" + raw.slice(-2)
          } else {
            masked = raw.slice(0, 4) + "-••••-••••-" + raw.slice(-4)
          }
        }
      } catch (e) {}

      return {
        id: item.id,
        status: item.status,
        createdAt: item.created_at,
        addedBy: item.added_by,
        maskedCode: masked
      }
    })
  )

  return { success: true, codes: codesWithMask }
}

/**
 * Deletes an inventory code by ID.
 * Security rule: Only AVAILABLE codes can be deleted. Delivered codes are immutable.
 */
export async function deleteInventoryCodeAction(inventoryId: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const adminSession = await getAdminSessionAction()
  const adminUserId = adminSession.success ? adminSession.data?.id : "unknown-admin"

  const supabase = createServiceRoleClient()

  // 1. Verify code exists and is AVAILABLE
  const { data, error: fetchErr } = await (supabase
    .from("gift_card_inventory") as any)
    .select("id, status, product_id, denomination_label")
    .eq("id", inventoryId)
    .single()

  const item = data as any

  if (fetchErr || !item) {
    return { error: "Inventory code not found" }
  }

  if (item.status === "DELIVERED") {
    return { error: "Cannot delete a code that has already been delivered to a customer." }
  }

  // 2. Delete the record
  const { error: deleteErr } = await (supabase
    .from("gift_card_inventory") as any)
    .delete()
    .eq("id", inventoryId)
    .eq("status", "AVAILABLE")

  if (deleteErr) {
    return { error: deleteErr.message }
  }

  console.log(`[AUDIT] Admin ${adminUserId} deleted inventory code ID ${inventoryId} for product ${item.product_id} (${item.denomination_label})`)

  revalidatePath("/admin/dashboard/inventory")
  return { success: true }
}

/**
 * Deletes an inventory code by exact matching value.
 * Used when an admin enters a typo and wants to burn/remove it immediately by pasting the code.
 */
export async function deleteInventoryCodeByValueAction(productId: string, denominationLabel: string, rawCode: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const trimmed = rawCode.trim()
  if (!trimmed) return { error: "Please provide a valid code" }

  const adminSession = await getAdminSessionAction()
  const adminUserId = adminSession.success ? adminSession.data?.id : "unknown-admin"

  const codeHash = generateCodeHash(trimmed)
  const supabase = createServiceRoleClient()

  // Find the matching AVAILABLE code
  const { data, error: findErr } = await (supabase
    .from("gift_card_inventory") as any)
    .select("id, status")
    .eq("product_id", productId)
    .eq("denomination_label", denominationLabel)
    .eq("code_hash", codeHash)
    .eq("status", "AVAILABLE")
    .maybeSingle()

  const item = data as any

  if (findErr) return { error: findErr.message }
  if (!item) {
    return { error: "No matching available code found for this denomination. (It may have already been delivered or does not exist.)" }
  }

  const { error: deleteErr } = await (supabase
    .from("gift_card_inventory") as any)
    .delete()
    .eq("id", item.id)
    .eq("status", "AVAILABLE")

  if (deleteErr) return { error: deleteErr.message }

  console.log(`[AUDIT] Admin ${adminUserId} burned/deleted matching inventory code ID ${item.id} for product ${productId} (${denominationLabel})`)

  revalidatePath("/admin/dashboard/inventory")
  return { success: true }
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

