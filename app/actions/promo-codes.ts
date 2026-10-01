"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { headers } from "next/headers"
import { rateLimit } from "@/lib/rate-limit"
import { customAlphabet } from "nanoid"
import { promoValidationInputSchema, createPromoCodeSchema } from "@/lib/validations/promo-code"

// Cryptographically secure code generator — no ambiguous characters (0/O, 1/I/L)
const generateRandomCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 8)

// ── Types ────────────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string
  code: string
  description: string | null
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount: number | null
  min_order_amount: number
  usage_limit: number | null
  usage_count: number
  per_user_limit: number
  starts_at: string
  expires_at: string | null
  applicable_products: string[] | null
  applicable_categories: string[] | null
  excluded_products: string[] | null
  first_order_only: boolean
  registered_only: boolean
  new_user_only: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PromoUsageRecord {
  id: string
  promo_code_id: string
  code: string
  user_email: string
  user_id: string | null
  transaction_id: string
  product_id: string | null
  original_price: number
  discount_amount: number
  final_price: number
  ip_address: string | null
  device_id: string | null
  used_at: string
}

export interface PromoValidationResult {
  valid: boolean
  code?: string
  discountType?: "percentage" | "fixed"
  discountValue?: number
  discountAmount?: number
  finalPrice?: number
  originalPrice?: number
  message: string
  promoDescription?: string
}

// ── Industry Standard: Promo Reservation & Release ──────────────────────────

/**
 * Industry Standard: Releases a promo code reservation when an order fails, is cancelled, or expires.
 * 1. Checks if a promo_code_usage record exists for this transaction_id.
 * 2. Decrements promo_codes.usage_count safely (never below 0).
 * 3. Deletes the promo_code_usage record so the user and code limits are restored.
 */
export async function releasePromoCodeOnFailure(transactionId: string): Promise<boolean> {
  if (!transactionId) return false
  try {
    const supabase = createServiceRoleClient() as any

    // 1. Find if a promo was used on this transaction
    const { data: usage, error: usageErr } = await supabase
      .from("promo_code_usage")
      .select("id, promo_code_id, code")
      .eq("transaction_id", transactionId)
      .maybeSingle()

    if (usageErr || !usage) {
      return false
    }

    // 2. Fetch the promo code to safely decrement usage_count
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("id, usage_count")
      .eq("id", usage.promo_code_id)
      .single()

    if (promo) {
      const newCount = Math.max(0, (promo.usage_count || 1) - 1)
      await supabase
        .from("promo_codes")
        .update({
          usage_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", promo.id)
    }

    // 3. Remove the usage record so the user/device is free to use the promo code again
    await supabase
      .from("promo_code_usage")
      .delete()
      .eq("id", usage.id)

    console.log(`[PROMO RELEASE] Successfully released promo code ${usage.code} for failed/cancelled order ${transactionId}`)
    return true
  } catch (err: any) {
    console.error(`[PROMO RELEASE ERROR] Failed to release promo for ${transactionId}:`, err.message)
    return false
  }
}

/**
 * Industry Standard Reclaim: If a previously failed transaction is successfully recovered/verified,
 * re-applies the promo code usage so it cannot be double-spent.
 */
export async function reclaimPromoCodeOnRecovery(transactionId: string): Promise<boolean> {
  if (!transactionId) return false
  try {
    const supabase = createServiceRoleClient() as any

    // Check if the transaction actually had a promo code applied
    const { data: txn } = await supabase
      .from("transactions")
      .select("transaction_id, promo_code, discount_amount, original_price, price, user_email, user_id, product_id, guest_user_data")
      .eq("transaction_id", transactionId)
      .single()

    if (!txn || !txn.promo_code) return false

    // Check if promo_code_usage is already recorded
    const { data: existingUsage } = await supabase
      .from("promo_code_usage")
      .select("id")
      .eq("transaction_id", transactionId)
      .maybeSingle()

    if (existingUsage) return false // Already recorded

    // Fetch the promo code
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("id, usage_count")
      .ilike("code", txn.promo_code)
      .maybeSingle()

    if (promo) {
      await supabase
        .from("promo_codes")
        .update({
          usage_count: (promo.usage_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", promo.id)

      await supabase.from("promo_code_usage").insert({
        promo_code_id: promo.id,
        code: txn.promo_code.toUpperCase(),
        user_email: txn.user_email?.trim().toLowerCase() || "",
        user_id: txn.user_id || null,
        transaction_id: transactionId,
        product_id: txn.product_id || null,
        original_price: txn.original_price || parseFloat(txn.price),
        discount_amount: txn.discount_amount || 0,
        final_price: parseFloat(txn.price) || 0,
        ip_address: txn.guest_user_data?.ip || null,
        device_id: txn.guest_user_data?.deviceId || null,
      })

      console.log(`[PROMO RECLAIM] Reclaimed promo code ${txn.promo_code} for recovered order ${transactionId}`)
      return true
    }
    return false
  } catch (err: any) {
    console.error(`[PROMO RECLAIM ERROR] Failed to reclaim promo for ${transactionId}:`, err.message)
    return false
  }
}

/**
 * Helper to count only valid/active promo code usages for a set of usage records.
 * If any usage record points to a Failed/Cancelled/Refunded transaction, it releases that usage.
 */
async function getEffectiveUsageCount(
  supabase: any,
  usages: Array<{ id: string; transaction_id: string }>
): Promise<number> {
  if (!usages || usages.length === 0) return 0

  const txnIds = usages.map((u) => u.transaction_id).filter(Boolean)
  if (txnIds.length === 0) return usages.length

  const { data: txns } = await supabase
    .from("transactions")
    .select("transaction_id, status")
    .in("transaction_id", txnIds)

  const terminalFailedStatuses = ["Payment Failed", "Cancelled", "Refunded", "Failed"]
  let validCount = 0

  for (const usage of usages) {
    const matchedTxn = txns?.find((t: any) => t.transaction_id === usage.transaction_id)
    if (!matchedTxn) {
      // Transaction row not found or discarded — release usage
      releasePromoCodeOnFailure(usage.transaction_id).catch(() => {})
      continue
    }
    if (terminalFailedStatuses.includes(matchedTxn.status)) {
      // Order failed or was cancelled — release usage!
      releasePromoCodeOnFailure(usage.transaction_id).catch(() => {})
      continue
    }
    // Completed, Paid, or actively pending/processing
    validCount++
  }

  return validCount
}

// ── Promo Code Validation (Product Page — Preview Only) ──────────────────────

/**
 * Validates a promo code without consuming it. Called when user clicks "Apply".
 * Returns discount preview for UI display.
 */
export async function validatePromoCodeAction({
  code,
  productId,
  productCategory,
  denominationLabel,
  email,
  userId,
  deviceId,
}: {
  code: string
  productId: string
  productCategory: string
  denominationLabel: string
  email: string
  userId?: string | null
  deviceId?: string
}): Promise<PromoValidationResult> {
  try {
    const parse = promoValidationInputSchema.safeParse({
      code,
      productId,
      productCategory,
      denominationLabel,
      email,
      userId,
      deviceId,
    })
    if (!parse.success) {
      return { valid: false, message: parse.error.issues[0]?.message || "Invalid or expired promo code." }
    }

    const h = await headers()
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

    // SECURITY: Rate limit promo validations (5 per minute per IP)
    const rl = await rateLimit(`promo-validate:${ip}`, { windowMs: 60_000, max: 5 })
    if (!rl.ok) {
      return { valid: false, message: "Please wait before trying another code." }
    }

    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode || cleanCode.length < 2 || cleanCode.length > 30) {
      return { valid: false, message: "Invalid or expired promo code." }
    }

    const cleanEmail = email.trim().toLowerCase()
    const supabase = createServiceRoleClient() as any

    // SECURITY: Track failed promo attempts for brute-force detection
    const trackFailedAttempt = async () => {
      try {
        const { Redis } = await import("@upstash/redis")
        const redisUrl = process.env.UPSTASH_REDIS_REST_URL
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
        if (redisUrl && redisToken) {
          const redis = new Redis({ url: redisUrl, token: redisToken })
          const key = `byiora:promo-fails:${ip}`
          const count = await redis.incr(key)
          if (count === 1) await redis.expire(key, 600) // 10-min window
          if (count >= 20) {
            // Auto-ban IP for 24 hours
            const { banEntity } = await import("@/lib/security/blacklist")
            await banEntity({
              type: "ip",
              value: ip,
              reason: "Automated Ban: Excessive promo code brute-force attempts",
              bannedBy: "System (Anti-Spam)",
              durationHours: 24,
            })
          }
        }
      } catch (_) {}
    }

    // ── CHECK 1: Code exists (case-insensitive) ──
    const { data: promo, error: promoErr } = await supabase
      .from("promo_codes")
      .select("*")
      .ilike("code", cleanCode)
      .single()

    if (promoErr || !promo) {
      trackFailedAttempt().catch(() => {})
      return { valid: false, message: "Invalid or expired promo code." }
    }

    // ── CHECK 2: is_active ──
    if (!promo.is_active) {
      trackFailedAttempt().catch(() => {})
      return { valid: false, message: "Invalid or expired promo code." }
    }

    // ── CHECK 3: starts_at ──
    if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
      trackFailedAttempt().catch(() => {})
      return { valid: false, message: "Invalid or expired promo code." }
    }

    // ── CHECK 4: expires_at ──
    if (promo.expires_at && new Date(promo.expires_at) <= new Date()) {
      trackFailedAttempt().catch(() => {})
      return { valid: false, message: "Invalid or expired promo code." }
    }

    // ── CHECK 5: Global usage limit ──
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
      return { valid: false, message: "This promo code has reached its usage limit." }
    }

    // ── CHECK 6: Per-user usage (by email) ──
    if (promo.per_user_limit && promo.per_user_limit > 0) {
      const { data: emailUsages } = await supabase
        .from("promo_code_usage")
        .select("id, transaction_id")
        .eq("promo_code_id", promo.id)
        .ilike("user_email", cleanEmail)

      const activeEmailUsageCount = await getEffectiveUsageCount(supabase, emailUsages || [])
      if (activeEmailUsageCount >= promo.per_user_limit) {
        return { valid: false, message: "You've already used this promo code." }
      }
    }

    // ── CHECK 7: Per-user usage (by device — prevents email cycling) ──
    if (deviceId && promo.per_user_limit && promo.per_user_limit > 0) {
      const { data: deviceUsages } = await supabase
        .from("promo_code_usage")
        .select("id, transaction_id")
        .eq("promo_code_id", promo.id)
        .eq("device_id", deviceId)

      const activeDeviceUsageCount = await getEffectiveUsageCount(supabase, deviceUsages || [])
      if (activeDeviceUsageCount >= promo.per_user_limit) {
        return { valid: false, message: "You've already used this promo code." }
      }
    }

    // ── CHECK 8: Look up the actual product price from DB ──
    let actualPrice = 0
    const { data: productData } = await supabase
      .from("products")
      .select("denominations")
      .eq("id", productId)
      .single()

    let denominations = productData?.denominations
    if (!denominations) {
      const { data: slugProduct } = await supabase
        .from("products")
        .select("denominations")
        .eq("slug", productId)
        .single()
      denominations = slugProduct?.denominations
    }

    if (denominations && Array.isArray(denominations)) {
      const cleanLabel = denominationLabel.trim().toLowerCase()
      const matched = denominations.find(
        (d: any) =>
          (d.label && d.label.trim().toLowerCase() === cleanLabel) ||
          (d.id && String(d.id).trim().toLowerCase() === cleanLabel)
      )
      if (matched?.price !== undefined) {
        actualPrice = parseFloat(String(matched.price).replace(/,/g, "").trim())
      }
    }

    if (!actualPrice || actualPrice <= 0) {
      return { valid: false, message: "Could not verify product price." }
    }

    // ── CHECK 9: min_order_amount ──
    if (promo.min_order_amount && actualPrice < parseFloat(promo.min_order_amount)) {
      return {
        valid: false,
        message: `Minimum order of Rs. ${parseFloat(promo.min_order_amount).toLocaleString()} required for this code.`,
      }
    }

    // ── CHECK 10: applicable_products ──
    if (promo.applicable_products && promo.applicable_products.length > 0) {
      if (!promo.applicable_products.includes(productId)) {
        return { valid: false, message: "This code is not valid for this product." }
      }
    }

    // ── CHECK 11: excluded_products ──
    if (promo.excluded_products && promo.excluded_products.length > 0) {
      if (promo.excluded_products.includes(productId)) {
        return { valid: false, message: "This code is not valid for this product." }
      }
    }

    // ── CHECK 12: applicable_categories ──
    if (promo.applicable_categories && promo.applicable_categories.length > 0) {
      if (!promo.applicable_categories.includes(productCategory)) {
        return { valid: false, message: "This code is not valid for this category." }
      }
    }

    // ── CHECK 13: first_order_only (industry standard: checks email and user_id) ──
    if (promo.first_order_only) {
      let query = supabase
        .from("transactions")
        .select("transaction_id", { count: "exact", head: true })
        .in("status", ["Completed", "Paid"])

      if (userId) {
        query = query.or(`user_email.ilike.${cleanEmail},user_id.eq.${userId}`)
      } else {
        query = query.ilike("user_email", cleanEmail)
      }

      const { count: prevOrders } = await query

      if (prevOrders !== null && prevOrders > 0) {
        return { valid: false, message: "This code is only for first-time buyers." }
      }
    }

    // ── CHECK 14: new_user_only (registered in last 7 days) ──
    if (promo.new_user_only) {
      if (!userId) {
        return { valid: false, message: "Please sign in to use this code." }
      }
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: userRecord } = await supabase
        .from("users")
        .select("created_at")
        .eq("id", userId)
        .single()

      if (!userRecord || new Date(userRecord.created_at) < new Date(sevenDaysAgo)) {
        return { valid: false, message: "This code is only for new users." }
      }
    }

    // ── CHECK 15: registered_only ──
    if (promo.registered_only && !userId) {
      return { valid: false, message: "Please sign in to use this promo code." }
    }

    // ── Calculate discount ──
    let discountAmount = 0
    if (promo.discount_type === "percentage") {
      discountAmount = actualPrice * (parseFloat(promo.discount_value) / 100)
      if (promo.max_discount) {
        discountAmount = Math.min(discountAmount, parseFloat(promo.max_discount))
      }
    } else {
      discountAmount = Math.min(parseFloat(promo.discount_value), actualPrice)
    }

    discountAmount = Math.round(discountAmount * 100) / 100 // Round to 2 decimals
    const finalPrice = Math.max(actualPrice - discountAmount, 0)

    // Build a user-friendly description
    let promoDescription = ""
    if (promo.discount_type === "percentage") {
      promoDescription = `${parseFloat(promo.discount_value)}% off`
      if (promo.max_discount) promoDescription += ` (up to Rs. ${parseFloat(promo.max_discount).toLocaleString()})`
    } else {
      promoDescription = `Rs. ${parseFloat(promo.discount_value).toLocaleString()} off`
    }

    return {
      valid: true,
      code: promo.code.toUpperCase(),
      discountType: promo.discount_type,
      discountValue: parseFloat(promo.discount_value),
      discountAmount,
      finalPrice,
      originalPrice: actualPrice,
      message: `${promo.code.toUpperCase()} Applied!`,
      promoDescription,
    }
  } catch (err: any) {
    console.error("[Promo] Validation error:", err.message)
    return { valid: false, message: "Something went wrong. Please try again." }
  }
}

// ── Server-Side Promo Application (called from addTransactionAction) ─────────

/**
 * Atomically validates and applies a promo code during order creation.
 * Returns the calculated discount, or null if the promo is invalid.
 *
 * This is NOT a public action — it's called internally from addTransactionAction.
 */
export async function applyPromoCodeServerSide({
  code,
  productId,
  productCategory,
  denominationLabel,
  email,
  userId,
  deviceId,
  ip,
  transactionId,
  verifiedPrice,
}: {
  code: string
  productId: string
  productCategory: string
  denominationLabel: string
  email: string
  userId?: string | null
  deviceId?: string | null
  ip: string
  transactionId: string
  verifiedPrice: number
}): Promise<{
  success: boolean
  discountAmount: number
  finalPrice: number
  originalPrice: number
  error?: string
}> {
  try {
    const cleanCode = code.trim().toUpperCase()
    const cleanEmail = email.trim().toLowerCase()
    const supabase = createServiceRoleClient() as any

    // Re-validate everything server-side (never trust client preview)
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("*")
      .ilike("code", cleanCode)
      .single()

    if (!promo || !promo.is_active) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Invalid promo code." }
    }

    const now = new Date()
    if (promo.starts_at && new Date(promo.starts_at) > now) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Promo code not yet active." }
    }
    if (promo.expires_at && new Date(promo.expires_at) <= now) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Promo code expired." }
    }

    // Per-user check (by email & device)
    if (promo.per_user_limit && promo.per_user_limit > 0) {
      const { data: usages } = await supabase
        .from("promo_code_usage")
        .select("id, transaction_id")
        .eq("promo_code_id", promo.id)
        .ilike("user_email", cleanEmail)

      const activeCount = await getEffectiveUsageCount(supabase, usages || [])
      if (activeCount >= promo.per_user_limit) {
        return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "You've already used this promo code." }
      }

      if (deviceId) {
        const { data: deviceUsages } = await supabase
          .from("promo_code_usage")
          .select("id, transaction_id")
          .eq("promo_code_id", promo.id)
          .eq("device_id", deviceId)

        const activeDeviceCount = await getEffectiveUsageCount(supabase, deviceUsages || [])
        if (activeDeviceCount >= promo.per_user_limit) {
          return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "You've already used this promo code." }
        }
      }
    }

    // Product/category checks
    if (promo.applicable_products?.length > 0 && !promo.applicable_products.includes(productId)) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Not valid for this product." }
    }
    if (promo.excluded_products?.length > 0 && promo.excluded_products.includes(productId)) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Not valid for this product." }
    }
    if (promo.applicable_categories?.length > 0 && !promo.applicable_categories.includes(productCategory)) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Not valid for this category." }
    }

    if (promo.registered_only && !userId) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Sign in required." }
    }
    if (promo.first_order_only) {
      let query = supabase
        .from("transactions")
        .select("transaction_id", { count: "exact", head: true })
        .in("status", ["Completed", "Paid"])

      if (userId) {
        query = query.or(`user_email.ilike.${cleanEmail},user_id.eq.${userId}`)
      } else {
        query = query.ilike("user_email", cleanEmail)
      }

      const { count: prevOrders } = await query
      if (prevOrders !== null && prevOrders > 0) {
        return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "First order only." }
      }
    }

    // Min order check
    if (promo.min_order_amount && verifiedPrice < parseFloat(promo.min_order_amount)) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Minimum not met." }
    }

    // Calculate discount
    let discountAmount = 0
    if (promo.discount_type === "percentage") {
      discountAmount = verifiedPrice * (parseFloat(promo.discount_value) / 100)
      if (promo.max_discount) discountAmount = Math.min(discountAmount, parseFloat(promo.max_discount))
    } else {
      discountAmount = Math.min(parseFloat(promo.discount_value), verifiedPrice)
    }
    discountAmount = Math.round(discountAmount * 100) / 100
    const finalPrice = Math.max(verifiedPrice - discountAmount, 0)

    // ── ATOMIC: Increment usage_count with guard ──
    const { data: updated, error: updateErr } = await supabase
      .from("promo_codes")
      .update({
        usage_count: promo.usage_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", promo.id)
      .eq("is_active", true)
      .or(
        promo.usage_limit !== null
          ? `usage_count.lt.${promo.usage_limit}`
          : "usage_count.gte.0" // Always true for unlimited codes
      )
      .select("id")

    if (updateErr || !updated || updated.length === 0) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Code no longer available." }
    }

    // ── Insert usage audit record ──
    await supabase.from("promo_code_usage").insert({
      promo_code_id: promo.id,
      code: promo.code.toUpperCase(),
      user_email: cleanEmail,
      user_id: userId || null,
      transaction_id: transactionId,
      product_id: productId,
      original_price: verifiedPrice,
      discount_amount: discountAmount,
      final_price: finalPrice,
      ip_address: ip,
      device_id: deviceId || null,
    })

    return {
      success: true,
      discountAmount,
      finalPrice,
      originalPrice: verifiedPrice,
    }
  } catch (err: any) {
    console.error("[Promo] Server-side application error:", err.message)
    return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Failed to apply promo." }
  }
}

// ── Promo Visibility Check (Product Page) ────────────────────────────────────

/**
 * Checks if the promo code input should be shown to the current user type.
 */
export async function getPromoVisibilityAction(isRegistered: boolean): Promise<{ showPromoInput: boolean }> {
  try {
    const supabase = createServiceRoleClient() as any
    const { data } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", "promo_code_visibility")
      .single()

    if (!data?.value) return { showPromoInput: true } // Default: show

    const config = data.value as { guests_enabled?: boolean; registered_enabled?: boolean }
    if (isRegistered) {
      return { showPromoInput: config.registered_enabled !== false }
    }
    return { showPromoInput: config.guests_enabled !== false }
  } catch (_) {
    return { showPromoInput: true }
  }
}

// ── Admin CRUD Actions ───────────────────────────────────────────────────────

async function requireAdmin() {
  const { getAdminSessionAction } = await import("@/app/actions/admin-utils")
  const session = await getAdminSessionAction()
  if (!session.success || session.data.role !== "admin") {
    throw new Error("Unauthorized")
  }
  return session.data
}

/**
 * Lists all promo codes for the admin dashboard.
 */
export async function getPromoCodesAction(): Promise<{
  success: boolean
  data?: PromoCode[]
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PromoCode[] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Creates a new promo code.
 */
export async function createPromoCodeAction(input: {
  code: string
  description?: string
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount?: number | null
  min_order_amount?: number
  usage_limit?: number | null
  per_user_limit?: number
  starts_at?: string
  expires_at?: string | null
  applicable_products?: string[] | null
  applicable_categories?: string[] | null
  excluded_products?: string[] | null
  first_order_only?: boolean
  registered_only?: boolean
  new_user_only?: boolean
}): Promise<{ success: boolean; data?: PromoCode; error?: string }> {
  try {
    const admin = await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const parse = createPromoCodeSchema.safeParse(input)
    if (!parse.success) {
      return { success: false, error: parse.error.issues[0]?.message || "Invalid promo code input." }
    }

    const cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, "")
    if (!cleanCode || cleanCode.length < 2) {
      return { success: false, error: "Code must be at least 2 characters." }
    }

    if (input.discount_value <= 0) {
      return { success: false, error: "Discount value must be greater than 0." }
    }
    if (input.discount_type === "percentage" && input.discount_value > 100) {
      return { success: false, error: "Percentage discount cannot exceed 100%." }
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("promo_codes")
      .select("id")
      .ilike("code", cleanCode)
      .limit(1)

    if (existing && existing.length > 0) {
      return { success: false, error: `Code "${cleanCode}" already exists.` }
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .insert({
        code: cleanCode,
        description: input.description || null,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount: input.max_discount || null,
        min_order_amount: input.min_order_amount || 0,
        usage_limit: input.usage_limit || null,
        per_user_limit: input.per_user_limit ?? 1,
        starts_at: input.starts_at || new Date().toISOString(),
        expires_at: input.expires_at || null,
        applicable_products: input.applicable_products?.length ? input.applicable_products : null,
        applicable_categories: input.applicable_categories?.length ? input.applicable_categories : null,
        excluded_products: input.excluded_products?.length ? input.excluded_products : null,
        first_order_only: input.first_order_only || false,
        registered_only: input.registered_only || false,
        new_user_only: input.new_user_only || false,
        is_active: true,
        created_by: admin.email,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PromoCode }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Updates an existing promo code.
 */
export async function updatePromoCodeAction(
  id: string,
  input: Partial<{
    description: string | null
    discount_type: "percentage" | "fixed"
    discount_value: number
    max_discount: number | null
    min_order_amount: number
    usage_limit: number | null
    per_user_limit: number
    starts_at: string
    expires_at: string | null
    applicable_products: string[] | null
    applicable_categories: string[] | null
    excluded_products: string[] | null
    first_order_only: boolean
    registered_only: boolean
    new_user_only: boolean
    is_active: boolean
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { error } = await supabase
      .from("promo_codes")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Toggles a promo code active/inactive.
 */
export async function togglePromoCodeAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { data: existing } = await supabase
      .from("promo_codes")
      .select("is_active")
      .eq("id", id)
      .single()

    if (!existing) return { success: false, error: "Promo code not found." }

    const { error } = await supabase
      .from("promo_codes")
      .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Deletes a promo code.
 */
export async function deletePromoCodeAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { error } = await supabase.from("promo_codes").delete().eq("id", id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Gets usage records for a specific promo code.
 */
export async function getPromoCodeUsageAction(promoCodeId: string): Promise<{
  success: boolean
  data?: PromoUsageRecord[]
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { data, error } = await supabase
      .from("promo_code_usage")
      .select("*")
      .eq("promo_code_id", promoCodeId)
      .order("used_at", { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PromoUsageRecord[] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Generates multiple unique single-use promo codes for campaigns.
 */
export async function generateBulkCodesAction(input: {
  prefix: string
  count: number
  discount_type: "percentage" | "fixed"
  discount_value: number
  max_discount?: number | null
  expires_at?: string | null
  applicable_products?: string[] | null
  applicable_categories?: string[] | null
}): Promise<{ success: boolean; codes?: string[]; error?: string }> {
  try {
    const admin = await requireAdmin()
    const supabase = createServiceRoleClient() as any

    if (input.count < 1 || input.count > 100) {
      return { success: false, error: "Count must be between 1 and 100." }
    }

    const prefix = input.prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    const codes: string[] = []
    const records: any[] = []

    for (let i = 0; i < input.count; i++) {
      const code = `${prefix}-${generateRandomCode()}`
      codes.push(code)
      records.push({
        code,
        description: `Bulk generated: ${prefix} campaign`,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount: input.max_discount || null,
        usage_limit: 1,
        per_user_limit: 1,
        expires_at: input.expires_at || null,
        applicable_products: input.applicable_products?.length ? input.applicable_products : null,
        applicable_categories: input.applicable_categories?.length ? input.applicable_categories : null,
        is_active: true,
        created_by: admin.email,
      })
    }

    const { error } = await supabase.from("promo_codes").insert(records)
    if (error) return { success: false, error: error.message }

    return { success: true, codes }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Updates promo code visibility settings (guest/registered toggles).
 */
export async function updatePromoVisibilityAction(config: {
  guests_enabled: boolean
  registered_enabled: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { error } = await supabase
      .from("site_config")
      .upsert({
        key: "promo_code_visibility",
        value: config,
        updated_at: new Date().toISOString(),
        updated_by: admin.email,
      })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Gets promo visibility settings for the admin dashboard.
 */
export async function getPromoVisibilitySettingsAction(): Promise<{
  success: boolean
  data?: { guests_enabled: boolean; registered_enabled: boolean }
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { data } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", "promo_code_visibility")
      .single()

    return {
      success: true,
      data: data?.value || { guests_enabled: true, registered_enabled: true },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Fetches all products for the admin multi-select dropdowns.
 */
export async function getProductsForPromoAction(): Promise<{
  success: boolean
  data?: { id: string; name: string; category: string }[]
  error?: string
}> {
  try {
    await requireAdmin()
    const supabase = createServiceRoleClient() as any

    const { data, error } = await supabase
      .from("products")
      .select("id, name, category")
      .order("name")

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
