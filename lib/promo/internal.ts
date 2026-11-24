import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Server-only promo internals.
 *
 * IMPORTANT: This module must NOT have the "use server" directive. Everything
 * here runs with the service-role key and is only ever called from trusted
 * server code (checkout). Marking these functions as Server Actions would
 * expose them as unauthenticated public RPC endpoints.
 *
 * Redemption itself lives in the database (supabase/migrations/20261202_promo_redemption_lifecycle.sql):
 * inserting an order that carries promo_code reserves a use in the same transaction, with the code
 * locked and its limits checked; order status changes consume or release that use; a pg_cron sweeper
 * frees expired holds. The app only quotes the discount and never reserves, releases or counts by hand.
 */

/** Uses that still count against a limit: reserved (awaiting payment) or consumed (paid). */
export async function countLiveUses(
  supabase: any,
  promoId: string,
  match: { column: "user_id" | "user_email" | "device_id"; value: string },
): Promise<number> {
  const query = supabase
    .from("promo_code_usage")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", promoId)
    .neq("status", "released")
  // Emails are stored lowercased, so an exact match (not ilike, where _ and % are wildcards) is correct.
  const value = match.column === "user_email" ? match.value.trim().toLowerCase() : match.value
  const { count } = await query.eq(match.column, value)
  return count ?? 0
}

/** Maps the database's redemption errors (raised while inserting the order) to customer text. */
export function promoRedemptionError(message: string | undefined): string | null {
  if (!message) return null
  if (message.includes("PROMO_LIMIT_REACHED")) return "This promo code was just used up. Remove it to continue at the regular price."
  if (message.includes("PROMO_ALREADY_USED")) return "You've already used this promo code."
  if (message.includes("PROMO_UNAVAILABLE")) return "This promo code is no longer available. Remove it to continue at the regular price."
  return null
}

/**
 * Checks a promo code against this order and prices it. Side-effect free: the use is reserved by the
 * database when the order row is inserted (and the insert fails if the code ran out meanwhile).
 * Called internally from addTransactionAction only — never expose as an action.
 */
export async function quotePromoCode({
  code,
  productId,
  productCategory,
  denominationLabel,
  email,
  userId,
  deviceId,
  verifiedPrice,
}: {
  code: string
  productId: string
  productCategory: string
  denominationLabel: string
  email: string
  userId?: string | null
  deviceId?: string | null
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

    // Global limit (usage_count is kept exact by the database from live uses)
    if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
      return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "This promo code has reached its usage limit." }
    }

    // Per-customer limit by account, email and device (the database re-checks all three atomically)
    if (promo.per_user_limit && promo.per_user_limit > 0) {
      const identities = [
        userId ? { column: "user_id" as const, value: userId } : null,
        { column: "user_email" as const, value: cleanEmail },
        deviceId ? { column: "device_id" as const, value: deviceId } : null,
      ].filter((m): m is NonNullable<typeof m> => m !== null)
      for (const match of identities) {
        if ((await countLiveUses(supabase, promo.id, match)) >= promo.per_user_limit) {
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

    return {
      success: true,
      discountAmount,
      finalPrice,
      originalPrice: verifiedPrice,
    }
  } catch (err: any) {
    console.error("[Promo] Quote error:", err.message)
    return { success: false, discountAmount: 0, finalPrice: verifiedPrice, originalPrice: verifiedPrice, error: "Failed to check promo." }
  }
}
