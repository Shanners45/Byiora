import crypto from "crypto"
import { Redis } from "@upstash/redis"
import { decryptBankCredentials } from "@/lib/crypto/bank"
import { audit, merchantDb } from "@/lib/merchant/server"
import { sendMerchantEmail, MERCHANT_PORTAL_URL } from "@/lib/email/resend"
import { checkLowBalance, emitWebhook } from "@/lib/merchant/events"
import { publicSiteUrl } from "@/lib/site-url"

// Fonepay dynamic-QR wallet top-ups, through the same payment proxy and bank
// verification as customer checkout. Top-up references start with "WT-" so the
// shared Fonepay webhook and QStash poller can route them here.
// shortcut: proxy calls mirror app/actions/checkout.ts rather than sharing it, so the
// live customer checkout stays untouched; merge into one helper when checkout is next refactored.

const PROXY_URL = process.env.PAYMENT_PROXY_URL || "http://localhost:3001"
const TOKEN_KEY = "payment_token:fonepay"
export const QR_MINUTES = 5
export const isWalletTopupRef = (ref: unknown) => typeof ref === "string" && ref.startsWith("WT-")

const redis = () =>
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null

async function proxy(path: string, body: unknown, timeoutMs: number): Promise<any> {
  try {
    const resp = await fetch(`${PROXY_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_API_SECRET! },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    return await resp.json()
  } catch (e: any) {
    return { success: false, message: `Payment service unreachable: ${e?.message}` }
  }
}

async function fonepayCredentials(): Promise<{ username: string; password: string } | null> {
  const { data } = await merchantDb().from("payment_credentials").select("encrypted_username, encrypted_password").eq("provider", "fonepay").maybeSingle()
  if (!data) return null
  const username = await decryptBankCredentials(data.encrypted_username)
  const password = await decryptBankCredentials(data.encrypted_password)
  return username && password ? { username, password } : null
}

export const newTopupReference = () => {
  const d = new Date().toISOString()
  return `WT-${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

export async function createFonepayQr(reference: string, amountRupees: number): Promise<{ ok: true; qrString: string; validationTraceId: string } | { ok: false; error: string }> {
  const creds = await fonepayCredentials()
  if (!creds) return { ok: false, error: "Fonepay is not set up. Contact support." }
  const r = redis()
  const payload: any = { ...creds, amount: Math.round(amountRupees), remarks: reference, transactionId: reference }
  try {
    const token = await r?.get<string>(TOKEN_KEY)
    if (token) payload.token = token
  } catch {}

  let data = await proxy("/api/trigger-fonepay-qr", payload, 35_000)
  if (!data.success && payload.token) {
    delete payload.token
    data = await proxy("/api/trigger-fonepay-qr", payload, 35_000)
  }
  if (!data.success || !data.qrString) return { ok: false, error: "Couldn't create the Fonepay QR. Try again in a minute." }
  if (data.token && data.token !== payload.token) r?.set(TOKEN_KEY, data.token, { ex: 60 * 60 * 48 }).catch(() => {})
  return { ok: true, qrString: data.qrString, validationTraceId: data.validationTraceId }
}

/** Asks the bank (via proxy) whether this QR was paid. */
async function verifyWithBank(t: { reference: string; validation_trace_id: string; amount_paisa: number; created_at: string }): Promise<{ paid: true; bankTxnId: string | null; paidPaisa: number } | { paid: false } | { error: true }> {
  const payload: any = { nqrTxnId: t.validation_trace_id, amount: Math.round(t.amount_paisa / 100), remarks: t.reference, orderCreatedAt: t.created_at }
  try {
    const token = await redis()?.get<string>(TOKEN_KEY)
    if (token) payload.sessionToken = token
  } catch {}
  let data = await proxy("/api/verify-fonepay-transaction", payload, 10_000)
  if (data.sessionExpired) {
    const creds = await fonepayCredentials()
    if (creds) data = await proxy("/api/verify-fonepay-transaction", { ...payload, ...creds }, 10_000)
  }
  if (data.success && data.data?.status === "SUCCESS") {
    const paidRupees = parseInt(data.data.paidAmount)
    return { paid: true, bankTxnId: data.data.bankTxnId || data.data.txnId || null, paidPaisa: paidRupees > 0 ? paidRupees * 100 : t.amount_paisa }
  }
  if (data.success === false && /unreachable/.test(String(data.message))) return { error: true }
  return { paid: false }
}

const npr = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export type TopupSettlement = "approved" | "awaiting_payment" | "failed" | "not_found" | "error"

/**
 * Checks a Fonepay top-up with the bank and credits the wallet exactly once.
 * Safe to call from the webhook, the QStash poller and the merchant's browser at the same time:
 * the database function only credits a top-up that is still unpaid.
 */
export async function settleFonepayTopup(reference: string): Promise<TopupSettlement> {
  const db = merchantDb()
  const { data: t } = await db.from("merchant_topups").select("id, merchant_id, reference, status, amount_paisa, validation_trace_id, created_at, expires_at, merchants(email)").eq("reference", reference).eq("provider", "fonepay").maybeSingle()
  if (!t) return "not_found"
  if (t.status === "approved") return "approved"
  if (!["awaiting_payment", "failed"].includes(t.status) || !t.validation_trace_id) return t.status as TopupSettlement

  const result = await verifyWithBank(t)
  if ("error" in result) return "error"
  if (!result.paid) {
    // Not paid within the QR's 5 minutes: failed, like customer payments.
    if (t.status === "awaiting_payment" && t.expires_at && Date.now() >= new Date(t.expires_at).getTime()) {
      await db.from("merchant_topups").update({ status: "failed", admin_note: null }).eq("id", t.id).eq("status", "awaiting_payment")
      return "failed"
    }
    return t.status as TopupSettlement
  }

  // Credit what the bank actually received (an over- or under-payment is still real money).
  if (result.paidPaisa !== t.amount_paisa) await db.from("merchant_topups").update({ amount_paisa: result.paidPaisa }).eq("id", t.id).in("status", ["awaiting_payment", "failed"])
  const { data: balance, error } = await db.rpc("merchant_complete_fonepay_topup", { p_topup_id: t.id, p_bank_txn_id: result.bankTxnId, p_paid_paisa: result.paidPaisa })
  if (error) {
    console.error("[fonepay topup] credit failed:", error.message)
    return "error"
  }
  if (balance == null) return "approved" // another caller credited it first

  await audit({ actorType: "system", merchantId: t.merchant_id, action: "topup.fonepay_paid", details: { reference, paidPaisa: result.paidPaisa, bankTxnId: result.bankTxnId } })
  await emitWebhook(t.merchant_id, "wallet.credited", { reference, amount: result.paidPaisa / 100, method: "fonepay", balance: Number(balance) / 100, currency: "NPR" })
  await checkLowBalance(t.merchant_id)
  if (t.merchants?.email) {
    await sendMerchantEmail({
      to: t.merchants.email,
      subject: `${npr(result.paidPaisa)} added to your wallet`,
      heading: "Wallet topped up",
      paragraphs: [`Your Fonepay payment (reference ${reference}) was received and ${npr(result.paidPaisa)} is now in your Byiora merchant wallet.`],
      cta: { label: "Open your wallet", url: `${MERCHANT_PORTAL_URL}/login` },
    }).catch(() => null)
  }
  return "approved"
}

/**
 * Background bank polling via QStash (every 15 s, up to 10 times), same as checkout,
 * plus one final check just after the 5-minute window that marks it failed if unpaid.
 */
export async function scheduleTopupPolling(reference: string, validationTraceId: string) {
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_URL) return
  const siteUrl = publicSiteUrl()
  const publish = (headers: Record<string, string>) =>
    fetch(`${process.env.QSTASH_URL}/v2/publish/${siteUrl}/api/webhooks/qstash`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}`, "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ transactionId: reference, validationTraceId, provider: "fonepay" }),
    }).catch((e) => console.error("[fonepay topup] QStash schedule failed:", e?.message))
  await Promise.all([publish({ "Upstash-Retries": "10", "Upstash-Delay": "15s" }), publish({ "Upstash-Retries": "3", "Upstash-Delay": "315s" })])
}
