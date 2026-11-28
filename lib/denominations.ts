/**
 * A pack (denomination) of a product. `id` is its permanent identity, like a Shopify variant or a
 * Stripe price: stock, orders, SKUs and merchant prices are tied to it. `label` is display text and
 * may repeat inside one product (e.g. "475 VP" in both the Nepal and India categories).
 */
export interface Denomination {
  id?: string
  price: string
  label: string
  icon_url?: string
  bestseller?: boolean
  in_stock?: boolean
  categoryId?: string
}

/** The pack's category name for an order snapshot, without flag emoji ("🇮🇳 India" -> "India"). */
export function denomCategoryName(categories: unknown, d: { categoryId?: string | null } | null | undefined): string | null {
  if (!d?.categoryId || !Array.isArray(categories)) return null
  const name = categories.find((c: any) => c?.id === d.categoryId)?.name
  return String(name || "").replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").trim() || null
}

/** An order's pack as people read it: "475 VP · India", or just "475 VP" when it has no category. */
export function packTitle(t: { amount?: string | null; denomination_category?: string | null }): string {
  const label = String(t.amount ?? "")
  const cat = t.denomination_category
  // "50 Diamonds" in category "Diamonds" needs no suffix.
  return cat && !label.toLowerCase().includes(cat.toLowerCase()) ? `${label} · ${cat}` : label
}

/** The key that identifies a pack: its id (packs from before ids existed fall back to their title). */
export const denomKey = (d: { id?: string | null; label?: string | null }): string => String(d.id || d.label || "")

/**
 * Finds a pack by id, or by title only when no other pack of the product has that title. An
 * ambiguous title finds nothing rather than guessing, so a price or a code is never taken from the
 * wrong pack.
 */
export function findDenomination<T extends { id?: string | null; label?: string | null }>(
  denominations: T[] | null | undefined,
  key: string | null | undefined,
): T | undefined {
  if (!Array.isArray(denominations) || !key) return undefined
  const k = String(key).trim()
  const byId = denominations.find((d) => d?.id && String(d.id) === k)
  if (byId) return byId
  const lower = k.toLowerCase()
  const byTitle = denominations.filter((d) => d?.label && String(d.label).trim().toLowerCase() === lower)
  return byTitle.length === 1 ? byTitle[0] : undefined
}
