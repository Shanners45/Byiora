import type { NextRequest } from "next/server"
import { apiError, apiOk, authenticateApi, rupees } from "@/lib/merchant/api"
import { audit, merchantDb } from "@/lib/merchant/server"
import { byioraSkuFor, findSku, orderCodes, placeOrder, ORDER_ERROR_TEXT, type OrderError } from "@/lib/merchant/trade"
import { emitWebhook, orderPayload, orderWebhookData } from "@/lib/merchant/events"

export const dynamic = "force-dynamic"

const STATUS: Record<OrderError, number> = {
  INVALID_QUANTITY: 422,
  INVALID_PRICE: 422,
  PRODUCT_NOT_FOUND: 404,
  DENOMINATION_AMBIGUOUS: 422,
  INVALID_DENOMINATION: 404,
  PRICE_CHANGED: 409,
  INSUFFICIENT_BALANCE: 402,
  OUT_OF_STOCK: 409,
  MERCHANT_INACTIVE: 403,
  ORDER_LIMIT: 403,
  DAILY_LIMIT: 403,
  MONTHLY_LIMIT: 403,
  ORDER_FAILED: 500,
}
const ALLOWED = new Set(["sku", "product_id", "denomination", "denomination_id", "quantity", "client_ref", "max_unit_price", "customer"])
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i

function parseCustomer(c: any): { email: string; name: string | null; phone: string | null } | string {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "customer is required: { \"email\": \"buyer@example.com\", \"name\"?: \"...\", \"phone\"?: \"...\" }"
  const unknown = Object.keys(c).find((k) => !["email", "name", "phone"].includes(k))
  if (unknown) return `Unknown field "customer.${unknown}".`
  if (typeof c.email !== "string" || !EMAIL.test(c.email.trim())) return "customer.email must be a valid email address."
  if (c.name != null && (typeof c.name !== "string" || c.name.length > 100)) return "customer.name must be text up to 100 characters."
  if (c.phone != null && (typeof c.phone !== "string" || !/^[+\d][\d\s-]{5,19}$/.test(c.phone))) return "customer.phone must be a phone number."
  return { email: c.email.trim().toLowerCase(), name: c.name?.trim() || null, phone: c.phone?.trim() || null }
}

/** Place an order. Same client_ref returns the same order instead of charging again. */
export async function POST(req: NextRequest) {
  const auth = await authenticateApi(req)
  if (!("merchant" in auth)) return auth
  const m = auth.merchant

  let body: any
  try {
    body = await req.json()
  } catch {
    return apiError(400, "INVALID_JSON", "Body must be JSON.")
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(400, "INVALID_JSON", "Body must be a JSON object.")
  const unknown = Object.keys(body).find((k) => !ALLOWED.has(k))
  if (unknown) return apiError(422, "UNKNOWN_FIELD", `Unknown field "${unknown}".`)
  const { quantity = 1, client_ref, max_unit_price, sku } = body
  let { product_id, denomination, denomination_id } = body
  // Either a SKU (yours or ours), or our product_id + denomination_id (or a denomination name that is unique in the product).
  if (sku != null) {
    if (product_id != null || denomination != null || denomination_id != null) return apiError(422, "INVALID_FIELD", "Send either sku, or product_id and denomination_id, not both.")
    if (typeof sku !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(sku)) return apiError(422, "INVALID_FIELD", "sku must be 1-64 letters, digits, dot, _ or -.")
    const found = await findSku(m.id, sku)
    if (!found) return apiError(404, "SKU_NOT_FOUND", `No product has SKU "${sku}". Use a sku from GET /products, or your own SKU set in the merchant portal.`)
    product_id = found.productId
    denomination = found.label
    denomination_id = found.denominationId
  }
  if (denomination_id != null && (typeof denomination_id !== "string" || denomination_id.length > 64)) return apiError(422, "INVALID_FIELD", "denomination_id must be the id from GET /products.")
  if (typeof product_id !== "string" || (typeof denomination !== "string" && typeof denomination_id !== "string")) return apiError(422, "INVALID_FIELD", "Send sku, or product_id and denomination_id.")
  if (!Number.isInteger(quantity)) return apiError(422, "INVALID_QUANTITY", ORDER_ERROR_TEXT.INVALID_QUANTITY)
  if (typeof client_ref !== "string" || !/^[\w-]{4,64}$/.test(client_ref)) return apiError(422, "INVALID_CLIENT_REF", "client_ref is required: 4-64 letters, digits, _ or -. Reuse it when retrying.")
  if (max_unit_price != null && !(typeof max_unit_price === "number" && max_unit_price > 0)) return apiError(422, "INVALID_FIELD", "max_unit_price must be a positive number in NPR.")
  const customer = parseCustomer(body.customer)
  if (typeof customer === "string") return apiError(422, "INVALID_CUSTOMER", customer)

  const res = await placeOrder(m, {
    productId: product_id,
    denomination: typeof denomination === "string" ? denomination : "",
    denominationId: denomination_id ?? null,
    quantity,
    clientRef: `${auth.test ? "" : "api-"}${client_ref}`,
    source: "api",
    maxUnitPricePaisa: max_unit_price != null ? Math.round(max_unit_price * 100) : undefined,
    customer,
    test: auth.test,
    // Out of stock: with manual delivery on, the order is accepted and waits in admin Pending orders; off, it fails with OUT_OF_STOCK.
    allowPending: m.manual_delivery,
  })
  if (!res.ok) return apiError(STATUS[res.error], res.error, ORDER_ERROR_TEXT[res.error])

  const { data: o } = await merchantDb().from("merchant_orders").select("*").eq("id", res.orderId).single()
  if (res.created) {
    if (auth.test) await emitWebhook(m.id, "order.completed", await orderPayload(o), false)
    else await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "order.placed", details: { orderId: res.orderId, source: "api", keyId: auth.keyId } })
  }
  return apiOk({ ...orderWebhookData({ ...o, byiora_sku: await byioraSkuFor(o.product_id, o.denomination_id, o.denomination_label) }), livemode: !auth.test, client_ref, duplicate: !res.created, codes: await orderCodes(o.id) }, res.created ? 201 : 200)
}

/** Orders made with this key's mode, newest first, 50 per page (?page=2). No codes. */
export async function GET(req: NextRequest) {
  const auth = await authenticateApi(req)
  if (!("merchant" in auth)) return auth
  const page = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get("page")) || 1))
  const { data, count } = await merchantDb()
    .from("merchant_orders")
    .select("*", { count: "exact" })
    .eq("merchant_id", auth.merchant.id)
    .eq("source", "api")
    .eq("is_test", auth.test)
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1)
  return apiOk({ livemode: !auth.test, page, per_page: 50, total: count || 0, orders: (data || []).map(orderWebhookData) })
}
