// Pure pricing rules, shared by the server (orders, API, catalog) and the admin
// price editor's live preview. No server imports here.

export const merchantPrice = (retailPaisa: number, discountPercent: number) =>
  Math.max(1, Math.round((retailPaisa * (100 - Number(discountPercent || 0))) / 100))

export type PriceRule = { product_id: string; denomination_label: string; visible: boolean | null; discount_percent: number | null; fixed_price_paisa: number | null }
export type PriceSource = "fixed" | "amount_discount" | "product_discount" | "merchant_discount"
export const ruleKey = (productId: string, label: string) => `${productId}\u0000${label}`

/**
 * What a merchant sees and pays for one amount.
 * Visibility: product enabled for merchants globally, then the merchant's catalog mode
 * and product rule, then the amount rule. Price: fixed > amount % > product % > merchant %.
 */
export function resolvePrice(
  m: { discount_percent: number; catalog_mode: "all" | "selected" },
  productId: string,
  label: string,
  retailPaisa: number,
  globallyEnabled: boolean,
  rules: Map<string, PriceRule>,
): { visible: boolean; pricePaisa: number; source: PriceSource } {
  const pr = rules.get(ruleKey(productId, ""))
  const dr = rules.get(ruleKey(productId, label))
  const productVisible = m.catalog_mode === "selected" ? pr?.visible === true : pr?.visible !== false
  const visible = globallyEnabled && productVisible && dr?.visible !== false
  if (dr?.fixed_price_paisa) return { visible, pricePaisa: Number(dr.fixed_price_paisa), source: "fixed" }
  if (dr?.discount_percent != null) return { visible, pricePaisa: merchantPrice(retailPaisa, dr.discount_percent), source: "amount_discount" }
  if (pr?.discount_percent != null) return { visible, pricePaisa: merchantPrice(retailPaisa, pr.discount_percent), source: "product_discount" }
  return { visible, pricePaisa: merchantPrice(retailPaisa, m.discount_percent), source: "merchant_discount" }
}

/** Only code-based products can be sold through merchants (no top-ups or direct-login services). */
export const MERCHANT_CATEGORIES = ["games", "digital-goods"] as const
export const isMerchantCategory = (c: unknown) => (MERCHANT_CATEGORIES as readonly string[]).includes(String(c))
