import crypto from "crypto"
import { decryptInventoryCode } from "@/lib/crypto/inventory"
import { merchantDb, type Merchant } from "@/lib/merchant/server"
import { merchantPrice, resolvePrice, ruleKey, MERCHANT_CATEGORIES, isMerchantCategory, type PriceRule, type PriceSource } from "@/lib/merchant/pricing"
import { afterLiveOrder, emitWebhook, orderPayload } from "@/lib/merchant/events"
import { audit } from "@/lib/merchant/server"
import { alertStaff } from "@/lib/merchant/alerts"

export { merchantPrice, type PriceRule }

// Server-only ordering and pricing shared by merchant server actions and /api/v1.

/** sku = Byiora's stable code; mySku/displayName = the merchant's optional own code and name. */
export type PricedDenomination = { label: string; retailPaisa: number; pricePaisa: number; available: number; sku: string | null; mySku: string | null; displayName: string | null }
export type PricedProduct = { id: string; name: string; category: string; logo: string | null; denominations: PricedDenomination[] }

export const toPaisa = (price: unknown) => Math.round((parseFloat(String(price ?? "").replace(/,/g, "")) || 0) * 100)
async function loadRules(merchantId: string, productId?: string): Promise<Map<string, PriceRule>> {
  let q = merchantDb().from("merchant_price_rules").select("product_id, denomination_label, visible, discount_percent, fixed_price_paisa").eq("merchant_id", merchantId)
  if (productId) q = q.eq("product_id", productId)
  const { data } = await q
  return new Map((data || []).map((r: any) => [ruleKey(r.product_id, r.denomination_label), { ...r, discount_percent: r.discount_percent == null ? null : Number(r.discount_percent) }]))
}

export type PriceBookLine = {
  productId: string
  productName: string
  category: string
  logo: string | null
  globallyEnabled: boolean
  label: string
  sku: string | null
  retailPaisa: number
  pricePaisa: number
  source: PriceSource
  visible: boolean
  available: number
  rule: PriceRule | null
  productRule: PriceRule | null
}

/** Every active product and amount with this merchant's visibility and price (hidden ones included). */
export async function loadPriceBook(m: Merchant): Promise<PriceBookLine[]> {
  const db = merchantDb()
  const [{ data: products }, { data: stock }, { data: own }, { data: catalog }, rules] = await Promise.all([
    db.from("products").select("id, name, category, logo, denominations").eq("is_active", true).in("category", MERCHANT_CATEGORIES as unknown as string[]).order("name"),
    m.use_global_inventory ? db.rpc("inventory_available_counts") : Promise.resolve({ data: [] }),
    db.rpc("merchant_inventory_counts", { p_merchant_id: m.id }),
    db.from("merchant_catalog").select("product_id, enabled"),
    loadRules(m.id),
  ])
  // Sellable stock = the merchant's own codes + shared stock when they may use it.
  const stockOf = new Map<string, number>()
  for (const s of [...(stock || []), ...(own || [])]) {
    const k = ruleKey(s.product_id, s.denomination_label)
    stockOf.set(k, (stockOf.get(k) || 0) + Number(s.available))
  }
  const enabled = new Set((catalog || []).filter((c: any) => c.enabled).map((c: any) => c.product_id))
  let skuOf = await loadByioraSkus()
  const lines: PriceBookLine[] = []
  for (const p of products || []) {
    for (const d of Array.isArray(p.denominations) ? p.denominations : []) {
      const retailPaisa = toPaisa(d?.price)
      if (!d?.label || retailPaisa <= 0) continue
      const label = String(d.label)
      const r = resolvePrice(m, p.id, label, retailPaisa, enabled.has(p.id), rules)
      lines.push({
        productId: p.id,
        productName: p.name,
        category: p.category,
        logo: p.logo || null,
        globallyEnabled: enabled.has(p.id),
        label,
        sku: skuOf.get(ruleKey(p.id, label)) ?? null,
        retailPaisa,
        pricePaisa: r.pricePaisa,
        source: r.source,
        visible: r.visible && d.in_stock !== false,
        available: d.in_stock === false ? 0 : stockOf.get(ruleKey(p.id, label)) || 0,
        rule: rules.get(ruleKey(p.id, label)) || null,
        productRule: rules.get(ruleKey(p.id, "")) || null,
      })
    }
  }
  // New amounts get a Byiora SKU the first time anyone loads the catalog.
  if (lines.some((l) => !l.sku) && Date.now() - lastSkuSync > 10 * 60_000) {
    lastSkuSync = Date.now()
    await db.rpc("ensure_product_skus")
    skuOf = await loadByioraSkus()
    for (const l of lines) l.sku = skuOf.get(ruleKey(l.productId, l.label)) ?? null
  }
  return lines
}

let lastSkuSync = 0

async function loadByioraSkus(): Promise<Map<string, string>> {
  const { data } = await merchantDb().from("product_skus").select("sku, product_id, denomination_label").limit(20000)
  return new Map((data || []).map((r: any) => [ruleKey(r.product_id, r.denomination_label), r.sku]))
}

/** What the merchant (and the API) sees: visible products only, grouped. */
export async function loadPricedCatalog(m: Merchant): Promise<PricedProduct[]> {
  const byProduct = new Map<string, PricedProduct>()
  const [book, skus] = await Promise.all([loadPriceBook(m), loadSkus(m.id)])
  for (const l of book) {
    if (!l.visible) continue
    const p = byProduct.get(l.productId) || { id: l.productId, name: l.productName, category: l.category, logo: l.logo, denominations: [] }
    const s = skus.get(ruleKey(l.productId, l.label))
    p.denominations.push({ label: l.label, retailPaisa: l.retailPaisa, pricePaisa: l.pricePaisa, available: l.available, sku: l.sku, mySku: s?.sku ?? null, displayName: s?.display_name ?? null })
    byProduct.set(l.productId, p)
  }
  return [...byProduct.values()]
}

/** The merchant's own codes and names for our product amounts. */
export async function loadSkus(merchantId: string): Promise<Map<string, { sku: string; display_name: string | null }>> {
  const { data } = await merchantDb().from("merchant_skus").select("sku, product_id, denomination_label, display_name").eq("merchant_id", merchantId)
  return new Map((data || []).map((r: any) => [ruleKey(r.product_id, r.denomination_label), { sku: r.sku, display_name: r.display_name }]))
}

/** Resolves a SKU: the merchant's own alias first, then Byiora's SKU. */
export async function findSku(merchantId: string, sku: string): Promise<{ productId: string; label: string } | null> {
  const db = merchantDb()
  const { data } = await db.from("merchant_skus").select("product_id, denomination_label").eq("merchant_id", merchantId).eq("sku", sku).maybeSingle()
  if (data) return { productId: data.product_id, label: data.denomination_label }
  const { data: ours } = await db.from("product_skus").select("product_id, denomination_label").eq("sku", sku.toUpperCase()).maybeSingle()
  return ours ? { productId: ours.product_id, label: ours.denomination_label } : null
}

export async function byioraSkuFor(productId: string, label: string): Promise<string | null> {
  const { data } = await merchantDb().from("product_skus").select("sku").eq("product_id", productId).eq("denomination_label", label).maybeSingle()
  return data?.sku ?? null
}

export type OrderError = "INVALID_QUANTITY" | "INVALID_PRICE" | "MERCHANT_INACTIVE" | "INSUFFICIENT_BALANCE" | "OUT_OF_STOCK" | "PRODUCT_NOT_FOUND" | "PRICE_CHANGED" | "ORDER_LIMIT" | "DAILY_LIMIT" | "MONTHLY_LIMIT" | "ORDER_FAILED"

export const ORDER_ERROR_TEXT: Record<OrderError, string> = {
  INVALID_QUANTITY: "Quantity must be between 1 and 20.",
  INVALID_PRICE: "This item has no valid price.",
  MERCHANT_INACTIVE: "Your account can't place orders right now.",
  INSUFFICIENT_BALANCE: "Not enough wallet balance. Top up your wallet first.",
  OUT_OF_STOCK: "Not enough codes in stock for this amount.",
  PRODUCT_NOT_FOUND: "That product or amount isn't available.",
  PRICE_CHANGED: "The price changed. Check the new price and try again.",
  ORDER_LIMIT: "This order is above your per-order limit.",
  DAILY_LIMIT: "This order would go over your 24-hour spending limit.",
  MONTHLY_LIMIT: "This order would go over your 30-day spending limit.",
  ORDER_FAILED: "The order could not be placed. You were not charged.",
}

export async function placeOrder(
  merchant: Merchant,
  input: {
    productId: string
    denomination: string
    quantity: number
    clientRef: string | null
    source: "dashboard" | "api"
    maxUnitPricePaisa?: number
    customer?: { email: string; name?: string | null; phone?: string | null } | null
    test?: boolean
    /** Out of stock: accept as "pending" (wallet charged) for an admin to fill later, instead of failing. */
    allowPending?: boolean
  },
): Promise<{ ok: true; orderId: string; created: boolean; pending: boolean } | { ok: false; error: OrderError }> {
  const db = merchantDb()
  const [{ data: product }, { data: catalogRow }, rules] = await Promise.all([
    db.from("products").select("id, name, category, denominations, is_active").eq("id", input.productId).maybeSingle(),
    db.from("merchant_catalog").select("enabled").eq("product_id", input.productId).maybeSingle(),
    loadRules(merchant.id, input.productId),
  ])
  const denom = product?.is_active && isMerchantCategory(product.category) ? (product.denominations || []).find((d: any) => d?.label === input.denomination) : null
  if (!denom || denom.in_stock === false) return { ok: false, error: "PRODUCT_NOT_FOUND" }

  const retailPaisa = toPaisa(denom.price)
  const priced = resolvePrice(merchant, product.id, denom.label, retailPaisa, !!catalogRow?.enabled, rules)
  if (!priced.visible) return { ok: false, error: "PRODUCT_NOT_FOUND" }
  const unitPaisa = priced.pricePaisa
  if (input.maxUnitPricePaisa != null && unitPaisa > input.maxUnitPricePaisa) return { ok: false, error: "PRICE_CHANGED" }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) return { ok: false, error: "INVALID_QUANTITY" }

  // Test mode: same validation and pricing, but no money, stock or limits are touched.
  if (input.test) {
    const ref = input.clientRef ? `test-${input.clientRef}` : null
    if (ref) {
      const { data: dup } = await db.from("merchant_orders").select("id").eq("merchant_id", merchant.id).eq("client_ref", ref).maybeSingle()
      if (dup) return { ok: true, orderId: dup.id, created: false, pending: false }
    }
    const { data: o, error } = await db
      .from("merchant_orders")
      .insert({
        merchant_id: merchant.id, client_ref: ref, product_id: product.id, product_name: product.name, denomination_label: denom.label, quantity: input.quantity,
        unit_price_paisa: unitPaisa, total_paisa: unitPaisa * input.quantity, retail_unit_price_paisa: retailPaisa, source: "api", is_test: true,
        customer_email: input.customer?.email ?? null, customer_name: input.customer?.name ?? null, customer_phone: input.customer?.phone ?? null,
      })
      .select("id")
      .single()
    if (error) return { ok: false, error: "ORDER_FAILED" }
    await tagOrderWithSku(merchant.id, o.id, product.id, denom.label)
    return { ok: true, orderId: o.id, created: true, pending: false }
  }

  const { data, error } = await db.rpc("merchant_place_order", {
    p_merchant_id: merchant.id,
    p_product_id: product.id,
    p_product_name: product.name,
    p_denomination: denom.label,
    p_quantity: input.quantity,
    p_unit_price_paisa: unitPaisa,
    p_retail_unit_price_paisa: retailPaisa,
    p_client_ref: input.clientRef,
    p_source: input.source,
    p_customer_email: input.customer?.email ?? null,
    p_customer_name: input.customer?.name ?? null,
    p_customer_phone: input.customer?.phone ?? null,
    p_allow_pending: !!input.allowPending,
  })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) {
    console.error("[merchant order] rpc failed:", error?.message)
    return { ok: false, error: "ORDER_FAILED" }
  }
  if (row.error === "OUT_OF_STOCK") {
    await alertStaff("📦 Merchant order failed: out of stock", [
      { name: "Merchant", value: merchant.business_name, inline: true },
      { name: "Product", value: `${product.name} · ${denom.label}`, inline: true },
      { name: "Quantity wanted", value: String(input.quantity), inline: true },
    ], 0xff5722, `oos:${product.id}:${denom.label}`)
  }
  if (row.error) return { ok: false, error: row.error as OrderError }
  if (row.created) {
    await tagOrderWithSku(merchant.id, row.order_id, product.id, denom.label)
    if (row.pending) {
      // Not deduped: every pending order is money taken that someone must fill or refund.
      await alertStaff("⏳ Merchant order waiting for codes", [
        { name: "Merchant", value: merchant.business_name, inline: true },
        { name: "Product", value: `${product.name} · ${denom.label}`, inline: true },
        { name: "Quantity", value: String(input.quantity), inline: true },
        { name: "Fill it", value: "Admin → Merchants → Pending orders", inline: false },
      ], 0xf59e0b)
    }
    await afterLiveOrder(merchant, row.order_id)
  }
  return { ok: true, orderId: row.order_id, created: row.created, pending: !!row.pending }
}

/**
 * Fills waiting orders for one product amount from stock, oldest first. Called right after an
 * admin adds codes, inside that request, so no cron or background job is needed.
 * Each merchant only gets shared stock if they are allowed to use it.
 */
export async function fillPendingFromStock(productId: string, label: string, onlyMerchantId?: string): Promise<number> {
  const db = merchantDb()
  let q = db.from("merchant_orders").select("id, merchant_id, merchants(use_global_inventory)").eq("status", "pending").eq("product_id", productId).eq("denomination_label", label)
  if (onlyMerchantId) q = q.eq("merchant_id", onlyMerchantId)
  const { data: waiting } = await q.order("created_at").limit(50)
  let filled = 0
  for (const o of waiting || []) {
    const { data: err, error } = await db.rpc("merchant_fulfil_order", { p_order_id: o.id, p_codes: null, p_actor: null, p_allow_global: !!(o as any).merchants?.use_global_inventory })
    if (error || err) continue // out of stock for this one (a smaller or other-merchant order may still fit)
    filled++
    await audit({ actorType: "system", merchantId: o.merchant_id, action: "order.fulfilled", details: { orderId: o.id, from: "stock_added" } })
    const { data: done } = await db.from("merchant_orders").select("*").eq("id", o.id).single()
    if (done) await emitWebhook(o.merchant_id, "order.completed", await orderPayload(done))
  }
  return filled
}

/** Decrypted codes for one of this merchant's orders. Callers must check ownership first. */
export async function orderCodes(orderId: string): Promise<string[]> {
  const db = merchantDb()
  const { data: o } = await db.from("merchant_orders").select("is_test, quantity").eq("id", orderId).maybeSingle()
  // Test orders get obviously fake, stable codes.
  if (o?.is_test) return Array.from({ length: o.quantity }, (_, i) => `TEST-${orderId.slice(0, 8).toUpperCase()}-${String(i + 1).padStart(2, "0")}`)
  const { data } = await db.from("gift_card_inventory").select("encrypted_code").eq("transaction_id", `MO-${orderId}`).order("delivered_at")
  return (data || []).map((r: any) => decryptInventoryCode(r.encrypted_code) || "[unavailable, contact support]")
}

// ── API keys: shown once, stored only as a SHA-256 hash ─────────────────────
export const hashApiKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex")
export function generateApiKey(mode: "live" | "test" = "live") {
  const key = `byk_${mode}_${crypto.randomBytes(24).toString("base64url")}`
  return { key, prefix: key.slice(0, 16), hash: hashApiKey(key) }
}

async function tagOrderWithSku(merchantId: string, orderId: string, productId: string, label: string) {
  const s = (await loadSkus(merchantId)).get(ruleKey(productId, label))
  if (s) await merchantDb().from("merchant_orders").update({ merchant_sku: s.sku, merchant_display_name: s.display_name }).eq("id", orderId)
}
