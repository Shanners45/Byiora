"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { encryptInventoryCode, decryptInventoryCode, generateCodeHash } from "./inventory-encryption"
import { verifyAdmin, getAdminSessionAction } from "./admin-utils"
import { revalidatePath } from "next/cache"
import { fillPendingFromStock } from "@/lib/merchant/trade"
import { decryptInventoryCode as decryptForPreview } from "@/lib/crypto/inventory"
import { denomKey, findDenomination, type Denomination } from "@/lib/denominations"

/** A product's pack, by permanent id (or by title when that title is unique in the product). */
async function loadPack(productId: string, key: string): Promise<Denomination | undefined> {
  const { data } = await (createServiceRoleClient().from("products") as any).select("denominations").eq("id", productId).maybeSingle()
  return findDenomination<Denomination>(data?.denominations, key)
}

const CODES_PAGE_SIZE = 20

/**
 * Fetches products that can have inventory (digital-goods, games)
 */
export async function getInventoryProductsAction() {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, logo, category, denominations, denomination_categories, checkout_fields, uid_instructions")
    .in("category", ["digital-goods", "games"])
    .order("created_at", { ascending: false })

  if (error) return { error: error.message }

  // Exclude direct-login and topup products, as well as any products requiring credentials or user ID input
  const eligibleProducts = (data || []).filter((product: any) => {
    if (product.category === "topup" || product.category === "direct-login") return false
    if (Array.isArray(product.checkout_fields) && product.checkout_fields.length > 0) return false
    if (product.uid_instructions) return false
    return true
  })

  return { success: true, products: eligibleProducts }
}

/**
 * Gets stock breakdown for a specific product
 */
export async function getProductStockAction(productId: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const supabase = createServiceRoleClient()
  
  const { data, error } = await supabase
    .from("gift_card_inventory")
    .select("denomination_id, denomination_label, status, merchant_id")
    .eq("product_id", productId)

  if (error) return { error: error.message }

  // Aggregate stats
  const stats: Record<string, { available: number; delivered: number }> = {}
  
  data.forEach((item: any) => {
    const key = item.denomination_id || item.denomination_label
    if (!stats[key]) {
      stats[key] = { available: 0, delivered: 0 }
    }
    // A merchant's private codes can't be sold on the storefront, so they don't count as available here.
    if (item.status === "AVAILABLE" && !item.merchant_id) stats[key].available++
    if (item.status === "DELIVERED") stats[key].delivered++
  })

  return { success: true, stats }
}

/**
 * Bulk adds multiple codes for a denomination
 */
export async function addInventoryCodesAction(productId: string, denominationKey: string, codesRaw: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const pack = await loadPack(productId, denominationKey)
  if (!pack) return { error: "That pack no longer exists. Refresh the page and pick it again." }
  
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
          denomination_label: pack.label,
          denomination_id: pack.id || null,
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

  // Merchant orders that were waiting for this amount get their codes now.
  const merchantOrdersFilled = successCodes.length ? await fillPendingFromStock(productId, denomKey(pack)).catch(() => 0) : 0

  revalidatePath("/admin/dashboard/inventory")
  return { 
    success: true, 
    merchantOrdersFilled,
    added: successCodes.length, 
    failed: failedCodes.length, 
    failedDetails: failedCodes 
  }
}

/**
 * One page (20) of codes for a denomination with masked previews, newest first.
 * status: "AVAILABLE" | "DELIVERED" | "all". Totals per status come back for the filter tabs.
 */
export async function getDenominationCodesAction(productId: string, denominationKey: string, page = 1, status: "all" | "AVAILABLE" | "DELIVERED" = "all") {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }
  const pack = await loadPack(productId, denominationKey)
  // Codes are tied to the pack id; a pack without one (none since ids were added) matches by title.
  const forPack = (q: any) => (pack?.id ? q.eq("denomination_id", pack.id) : q.eq("denomination_label", pack?.label ?? denominationKey))

  const supabase = createServiceRoleClient()
  const from = (Math.max(1, Math.floor(page)) - 1) * CODES_PAGE_SIZE
  let query = supabase
    .from("gift_card_inventory")
    .select("id, status, created_at, encrypted_code, added_by, transaction_id, merchant_id", { count: "exact" })
    .eq("product_id", productId)
  query = forPack(query)
  if (status !== "all") query = query.eq("status", status)
  const counted = (s: "AVAILABLE" | "DELIVERED") => forPack(supabase.from("gift_card_inventory").select("id", { count: "exact", head: true }).eq("product_id", productId)).eq("status", s)
  const [{ data, error, count }, { count: available }, { count: delivered }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + CODES_PAGE_SIZE - 1),
    counted("AVAILABLE"),
    counted("DELIVERED"),
  ])

  if (error) return { error: error.message }

  // Which merchant got a code (orders are tagged MO-<order id>), or owns it as their private stock.
  const orderIds = [...new Set((data || []).map((r: any) => String(r.transaction_id || "")).filter((t) => t.startsWith("MO-")).map((t) => t.slice(3)))]
  const { data: mOrders } = orderIds.length ? await (supabase.from("merchant_orders") as any).select("id, merchant_id").in("id", orderIds) : { data: [] }
  const merchantOfOrder = new Map<string, string>((mOrders || []).map((o: any) => [o.id, o.merchant_id]))
  const merchantIds = [...new Set([...(data || []).map((r: any) => r.merchant_id).filter(Boolean), ...merchantOfOrder.values()])]
  const { data: ms } = merchantIds.length ? await (supabase.from("merchants") as any).select("id, business_name").in("id", merchantIds) : { data: [] }
  const nameOf = new Map<string, string>((ms || []).map((m: any) => [m.id, m.business_name]))
  const merchantFor = (item: any): { name: string; kind: "delivered" | "reserved" } | null => {
    const t = String(item.transaction_id || "")
    if (item.status === "DELIVERED" && t.startsWith("MO-")) {
      const id = merchantOfOrder.get(t.slice(3))
      return { name: (id && nameOf.get(id)) || "Merchant", kind: "delivered" }
    }
    if (item.merchant_id && item.status === "AVAILABLE") return { name: nameOf.get(item.merchant_id) || "Merchant", kind: "reserved" }
    return null
  }

  // Masked previews for this page only. Uses the plain decryptor: the rate-limited one (50 a minute,
  // kept for full reveals) turned every preview after the 50th into dots.
  const codesWithMask = (data || []).map((item: any) => {
      let masked = "••••-••••"
      const raw = decryptForPreview(item.encrypted_code)?.trim()
      if (raw) masked = raw.length <= 8 ? raw.slice(0, 2) + "••••" + raw.slice(-2) : raw.slice(0, 4) + "-••••-••••-" + raw.slice(-4)

      return {
        id: item.id,
        status: item.status,
        createdAt: item.created_at,
        addedBy: item.added_by,
        maskedCode: masked,
        merchant: merchantFor(item),
      }
    })

  return { success: true, codes: codesWithMask, total: count || 0, pageSize: CODES_PAGE_SIZE, counts: { AVAILABLE: available || 0, DELIVERED: delivered || 0 } }
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
export async function deleteInventoryCodeByValueAction(productId: string, denominationKey: string, rawCode: string) {
  if (!(await verifyAdmin())) return { error: "Unauthorized" }

  const trimmed = rawCode.trim()
  if (!trimmed) return { error: "Please provide a valid code" }

  const adminSession = await getAdminSessionAction()
  const adminUserId = adminSession.success ? adminSession.data?.id : "unknown-admin"

  const codeHash = generateCodeHash(trimmed)
  const supabase = createServiceRoleClient()
  const pack = await loadPack(productId, denominationKey)
  if (!pack) return { error: "That pack no longer exists. Refresh the page and pick it again." }

  // Find the matching AVAILABLE code
  const { data, error: findErr } = await (supabase
    .from("gift_card_inventory") as any)
    .select("id, status")
    .eq("product_id", productId)
    .eq(pack.id ? "denomination_id" : "denomination_label", pack.id || pack.label)
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

  console.log(`[AUDIT] Admin ${adminUserId} burned/deleted matching inventory code ID ${item.id} for product ${productId} (${pack.label})`)

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

