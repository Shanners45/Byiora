import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { alertStaff } from "@/lib/merchant/alerts"

/**
 * Call right after codes are taken from the shared inventory (storefront sale, merchant order, merchant
 * backorder fill). If that product pack has no AVAILABLE shared codes left, staff get a Discord alert so
 * it can be restocked. Only the shared pool counts: merchants' own uploaded codes are separate stock.
 *
 * merchantOrderId: for merchant orders, only alert if this order actually used shared-pool codes
 * (a merchant can be served from their own codes while the shared pool was already empty).
 */
export async function alertIfSoldOut(opts: {
  productId: string
  label: string
  /** The pack's permanent id; counts that pack only (a title can repeat across categories). */
  denominationId?: string | null
  productName?: string
  soldVia: string
  merchantOrderId?: string
}): Promise<void> {
  try {
    const db = createServiceRoleClient() as any

    if (opts.merchantOrderId) {
      const { count: fromShared } = await db
        .from("gift_card_inventory")
        .select("id", { count: "exact", head: true })
        .eq("transaction_id", `MO-${opts.merchantOrderId}`)
        .is("merchant_id", null)
      if (!fromShared) return
    }

    let left = db
      .from("gift_card_inventory")
      .select("id", { count: "exact", head: true })
      .eq("product_id", opts.productId)
      .eq("status", "AVAILABLE")
      .is("merchant_id", null)
    left = opts.denominationId ? left.eq("denomination_id", opts.denominationId) : left.eq("denomination_label", opts.label)
    const { count, error } = await left
    if (error || count === null || count > 0) return

    let name = opts.productName
    if (!name) {
      const { data } = await db.from("products").select("name").eq("id", opts.productId).maybeSingle()
      name = data?.name || opts.productId
    }

    await alertStaff(
      "🚨 Out of stock: the last code was just sold",
      [
        { name: "Product", value: String(name), inline: true },
        { name: "Pack", value: opts.label, inline: true },
        { name: "Codes left", value: "0", inline: true },
        { name: "Last code went to", value: opts.soldVia, inline: false },
        { name: "Restock", value: "Admin → Inventory → Add codes", inline: false },
      ],
      0xdc2626,
      // At most one alert per pack per hour, in case two orders take the last codes at the same moment.
      `sold-out:${opts.productId}:${opts.denominationId || opts.label}`,
    )
  } catch (e: any) {
    console.error("[stock alert] failed:", e?.message)
  }
}
