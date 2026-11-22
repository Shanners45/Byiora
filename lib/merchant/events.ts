import crypto from "crypto"
import { lookup } from "dns/promises"
import { decryptBankCredentials, encryptBankCredentials } from "@/lib/crypto/bank"
import { merchantDb, type Merchant } from "@/lib/merchant/server"
import { sendMerchantEmail, addContactToMerchantSegment, MERCHANT_PORTAL_URL } from "@/lib/email/resend"
import { publicSiteUrl } from "@/lib/site-url"

// Server-only side effects of merchant money/order events: signed webhooks with
// retries, low-balance alerts, and the merchant's own Resend customer segment.

export const WEBHOOK_EVENTS = ["order.completed", "order.refunded", "wallet.credited", "wallet.low_balance"] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | "webhook.test"

const npr = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

// ── Webhook endpoint safety ─────────────────────────────────────────────

/** HTTPS only, and never our own network or private addresses (SSRF guard). */
export function checkWebhookUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return "Enter a full URL, e.g. https://example.com/byiora/webhook"
  }
  if (u.protocol !== "https:") return "The webhook URL must use https://"
  if (u.username || u.password) return "Don't put credentials in the URL."
  const h = u.hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith("byiora.com.np")) return "That address isn't allowed."
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return "Private or reserved IP addresses aren't allowed."
  }
  if (h.startsWith("[") || h.includes(":")) return "Use a domain name, not an IPv6 address."
  return null
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "").match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v6 = ip.toLowerCase()
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff")
}

/** Resolves the webhook host and refuses private targets (guards against DNS pointing at internal systems). */
async function publicTarget(url: string): Promise<string | null> {
  try {
    const addrs = await lookup(new URL(url).hostname, { all: true })
    if (!addrs.length) return "Host did not resolve"
    if (addrs.some((a) => isPrivateIp(a.address))) return "Host resolves to a private address"
    return null
  } catch {
    return "Host did not resolve"
  }
}

export const newWebhookSecret = () => {
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`
  return { secret, enc: encryptBankCredentials(secret) }
}

/** Signature merchants verify: HMAC-SHA256(secret, `${timestamp}.${body}`), hex. */
export const signWebhook = (secret: string, timestamp: string, body: string) => crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")

// ── Delivery ─────────────────────────────────────────────────────────────

/** Queues one webhook. QStash retries failures with backoff; without QStash we try once inline. */
export async function emitWebhook(merchantId: string, event: WebhookEvent, data: Record<string, unknown>, livemode = true): Promise<void> {
  try {
    const db = merchantDb()
    const { data: m } = await db.from("merchants").select("webhook_url, webhook_secret_enc").eq("id", merchantId).maybeSingle()
    if (!m?.webhook_url || !m.webhook_secret_enc) return
    const id = crypto.randomUUID()
    const payload = { id, type: event, livemode, created_at: new Date().toISOString(), data }
    const { error } = await db.from("merchant_webhook_deliveries").insert({ id, merchant_id: merchantId, event, payload, url: m.webhook_url, livemode })
    if (error) return console.error("[webhook] enqueue failed:", error.message)
    await dispatchDelivery(id)
  } catch (e: any) {
    console.error("[webhook] emit failed:", e?.message)
  }
}

export async function dispatchDelivery(deliveryId: string) {
  if (process.env.QSTASH_TOKEN && process.env.QSTASH_URL) {
    const siteUrl = publicSiteUrl()
    const res = await fetch(`${process.env.QSTASH_URL}/v2/publish/${siteUrl}/api/webhooks/merchant-deliver`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}`, "Content-Type": "application/json", "Upstash-Retries": "8" },
      body: JSON.stringify({ deliveryId }),
    }).catch(() => null)
    if (res?.ok) return
  }
  await deliverWebhook(deliveryId)
}

/** One delivery attempt. Returns true when the merchant's endpoint answered 2xx. */
export async function deliverWebhook(deliveryId: string): Promise<boolean> {
  const db = merchantDb()
  const { data: d } = await db.from("merchant_webhook_deliveries").select("*, merchants(webhook_secret_enc)").eq("id", deliveryId).maybeSingle()
  if (!d) return true // nothing to retry
  if (d.status === "delivered") return true
  const secret = d.merchants?.webhook_secret_enc ? decryptBankCredentials(d.merchants.webhook_secret_enc) : null
  if (!secret) {
    await db.from("merchant_webhook_deliveries").update({ status: "failed", last_error: "Webhook secret missing" }).eq("id", deliveryId)
    return true
  }
  const body = JSON.stringify(d.payload)
  const ts = String(Math.floor(Date.now() / 1000))
  let status = 0
  let err: string | null = await publicTarget(d.url)
  // shortcut: DNS is checked just before the request, not pinned to it; a host that flips its record in between could slip through. Pin the resolved IP with a custom agent if that matters.
  if (!err) try {
    const res = await fetch(d.url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Byiora-Webhooks/1.0",
        "X-Byiora-Event": d.event,
        "X-Byiora-Delivery": d.id,
        "X-Byiora-Timestamp": ts,
        "X-Byiora-Signature": `sha256=${signWebhook(secret, ts, body)}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    status = res.status
  } catch (e: any) {
    err = e?.name === "TimeoutError" ? "Timed out after 10 seconds" : e?.message || "Connection failed"
  }
  const ok = status >= 200 && status < 300
  const attempts = (d.attempts || 0) + 1
  await db
    .from("merchant_webhook_deliveries")
    .update({ attempts, response_status: status || null, last_error: ok ? null : err || `HTTP ${status}`, status: ok ? "delivered" : attempts >= 9 ? "failed" : "pending", delivered_at: ok ? new Date().toISOString() : null })
    .eq("id", deliveryId)
  return ok
}

// ── Low balance ──────────────────────────────────────────────────────────

/** Alerts once when spendable balance drops below the merchant's threshold; re-arms after a top-up. */
export async function checkLowBalance(merchantId: string): Promise<void> {
  try {
    const db = merchantDb()
    const { data: m } = await db.from("merchants").select("id, email, business_name, wallet_balance_paisa, credit_limit_paisa, low_balance_threshold_paisa, low_balance_alerted_at").eq("id", merchantId).maybeSingle()
    if (!m || !m.low_balance_threshold_paisa) return
    const available = Number(m.wallet_balance_paisa) + Number(m.credit_limit_paisa)
    const below = available < Number(m.low_balance_threshold_paisa)
    if (!below) {
      if (m.low_balance_alerted_at) await db.from("merchants").update({ low_balance_alerted_at: null }).eq("id", m.id)
      return
    }
    if (m.low_balance_alerted_at) return
    // Claim the alert atomically so parallel orders send it only once.
    const { data: claimed } = await db.from("merchants").update({ low_balance_alerted_at: new Date().toISOString() }).eq("id", m.id).is("low_balance_alerted_at", null).select("id").maybeSingle()
    if (!claimed) return
    await sendMerchantEmail({
      to: m.email,
      subject: `Low wallet balance: ${npr(available)} left`,
      heading: "Your wallet balance is low",
      paragraphs: [`${m.business_name} has ${npr(available)} available to spend, below your alert level of ${npr(m.low_balance_threshold_paisa)}.`, "Top up now so orders and API calls don't fail."],
      cta: { label: "Top up wallet", url: `${MERCHANT_PORTAL_URL}/login` },
    }).catch(() => null)
    await emitWebhook(m.id, "wallet.low_balance", { available: available / 100, balance: Number(m.wallet_balance_paisa) / 100, threshold: Number(m.low_balance_threshold_paisa) / 100, currency: "NPR" })
  } catch (e: any) {
    console.error("[low balance] check failed:", e?.message)
  }
}

// ── After-order work (never blocks or fails the order) ──────────────────

export async function afterLiveOrder(m: Merchant, orderId: string): Promise<void> {
  const db = merchantDb()
  const { data: o } = await db.from("merchant_orders").select("*").eq("id", orderId).maybeSingle()
  if (!o) return
  await Promise.all([
    // A waiting order sends order.completed only once its codes are delivered.
    o.status === "pending" ? null : orderPayload(o).then((data) => emitWebhook(m.id, "order.completed", data)),
    checkLowBalance(m.id),
    o.customer_email ? addCustomerToSegment(m, o.customer_email, o.customer_name) : null,
  ])
}

/** Order payload including Byiora's SKU (looked up from product_skus). */
export async function orderPayload(o: any) {
  const { data } = await merchantDb().from("product_skus").select("sku").eq("product_id", o.product_id).eq("denomination_label", o.denomination_label).maybeSingle()
  return orderWebhookData({ ...o, byiora_sku: data?.sku ?? null })
}

export function orderWebhookData(o: any) {
  return {
    order_id: o.id,
    client_ref: o.client_ref?.replace(/^(api|dash|test)-/, "") ?? null,
    status: o.status === "completed" ? "COMPLETED" : o.status === "pending" ? "PROCESSING" : "REFUNDED",
    sku: o.byiora_sku ?? null,
    merchant_sku: o.merchant_sku ?? null,
    display_name: o.merchant_display_name ?? null,
    product_id: o.product_id,
    product_name: o.product_name,
    denomination: o.denomination_label,
    quantity: o.quantity,
    unit_price: o.unit_price_paisa / 100,
    total: o.total_paisa / 100,
    currency: "NPR",
    customer: o.customer_email ? { email: o.customer_email, name: o.customer_name, phone: o.customer_phone } : null,
    created_at: o.created_at,
    ...(o.fulfilled_at ? { fulfilled_at: o.fulfilled_at } : {}),
    ...(o.refunded_at ? { refunded_at: o.refunded_at, refund_reason: o.refund_note } : {}),
  }
}

async function addCustomerToSegment(m: Merchant, email: string, name: string | null) {
  try {
    const segmentId = await addContactToMerchantSegment({ segmentId: m.resend_segment_id, segmentName: `Merchant: ${m.business_name}`.slice(0, 100), email, name })
    if (segmentId && segmentId !== m.resend_segment_id) await merchantDb().from("merchants").update({ resend_segment_id: segmentId }).eq("id", m.id).is("resend_segment_id", null)
  } catch (e: any) {
    console.error("[merchant segment] failed:", e?.message)
  }
}
