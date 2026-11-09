import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Server-only promo internals.
 *
 * IMPORTANT: This module must NOT have the "use server" directive. Everything
 * here runs with the service-role key and is only ever called from trusted
 * server code (checkout, webhooks, cron). Marking these functions as Server
 * Actions would expose them as unauthenticated public RPC endpoints, letting
 * anyone release/reclaim promo usage and bypass per-user limits.
 */

/**
 * Releases a promo code reservation when an order fails, is cancelled, or expires.
 */
export async function releasePromoCodeOnFailure(transactionId: string): Promise<boolean> {
  if (!transactionId) return false
  try {
    const supabase = createServiceRoleClient() as any

    const { data: usage, error: usageErr } = await supabase
      .from("promo_code_usage")
      .select("id, promo_code_id, code")
      .eq("transaction_id", transactionId)
      .maybeSingle()

    if (usageErr || !usage) {
      return false
    }

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
 * Re-applies a promo code usage if a previously failed transaction is recovered.
 */
export async function reclaimPromoCodeOnRecovery(transactionId: string): Promise<boolean> {
  if (!transactionId) return false
  try {
    const supabase = createServiceRoleClient() as any

    const { data: txn } = await supabase
      .from("transactions")
      .select("transaction_id, promo_code, discount_amount, original_price, price, user_email, user_id, product_id, guest_user_data")
      .eq("transaction_id", transactionId)
      .single()

    if (!txn || !txn.promo_code) return false

    const { data: existingUsage } = await supabase
      .from("promo_code_usage")
      .select("id")
      .eq("transaction_id", transactionId)
      .maybeSingle()

    if (existingUsage) return false // Already recorded

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
 * Counts only valid/active promo code usages, releasing any that point to a
 * failed or cancelled transaction.
 */
export async function getEffectiveUsageCount(
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
      releasePromoCodeOnFailure(usage.transaction_id).catch(() => {})
      continue
    }
    if (terminalFailedStatuses.includes(matchedTxn.status)) {
      releasePromoCodeOnFailure(usage.transaction_id).catch(() => {})
      continue
    }
    validCount++
  }

  return validCount
}

/**
 * Atomically validates and applies a promo code during order creation.
 * Called internally from addTransactionAction only — never expose as an action.
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
    const isFullDiscountServer = promo.discount_type === "percentage" ? parseFloat(promo.discount_value) >= 100 : parseFloat(promo.discount_value) >= verifiedPrice
    if (isFullDiscountServer && !userId) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "100% discount codes require signing in to a registered account." }
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
          : "usage_count.gte.0"
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
