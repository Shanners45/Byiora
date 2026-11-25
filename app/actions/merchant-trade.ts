"use server"

import crypto from "crypto"
import { rateLimit } from "@/lib/rate-limit"
import { audit, merchantDb, requireMerchant } from "@/lib/merchant/server"
import { KYC_MAX_BYTES, KYC_MIME, sniffMime } from "@/lib/merchant/kyc"
import { generateApiKey, loadPricedCatalog, orderCodes, placeOrder, ORDER_ERROR_TEXT, type PricedProduct } from "@/lib/merchant/trade"
import { createFonepayQr, newTopupReference, QR_MINUTES, scheduleTopupPolling, settleFonepayTopup } from "@/lib/merchant/fonepay"
import { alertStaff } from "@/lib/merchant/alerts"
import { getTopupSettings, loadMonthlyStatement, loadRevenueReport, safeTimeZone, type MonthlyStatement, type RevenueReport } from "@/lib/merchant/reports"
import { checkLowBalance, checkWebhookUrl, deliverWebhook, emitWebhook, newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/merchant/events"

const fail = (error: string) => ({ success: false as const, error })
const LOCKED = "Your account is locked until your business is verified."
const lockedText = (e: string) => (e === "KYC_REQUIRED" ? LOCKED : e === "ACCOUNT_SUSPENDED" ? "Your account is suspended." : "Please sign in again.")


// ── Overview insights ────────────────────────────────────────────────────

export type MerchantOverview = {
  balancePaisa: number
  creditLimitPaisa: number
  availablePaisa: number
  month: { spendPaisa: number; orders: number; cards: number }
  prevMonthSpendPaisa: number
  lifetime: { spendPaisa: number; orders: number; cards: number }
  avgOrderPaisa: number
  avgDailySpendPaisa: number
  daysLeft: number | null
  monthly: { month: string; label: string; spendPaisa: number; orders: number }[]
  topProducts: { name: string; spendPaisa: number; cards: number }[]
  recentOrders: { id: string; product: string; denomination: string; quantity: number; totalPaisa: number; status: string; createdAt: string }[]
  pendingTopups: number
  activeKeys: number
  apiShare: number
  limits: { perOrderPaisa: number | null; dailyPaisa: number | null; monthlyPaisa: number | null; dailyUsedPaisa: number; monthlyUsedPaisa: number }
  lowBalanceThresholdPaisa: number
}

/** tz: the viewer's IANA time zone, so "this month" matches their calendar. */
export async function getMerchantOverviewAction(tzRaw?: string): Promise<MerchantOverview | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const m = ctx.merchant
  const tz = safeTimeZone(tzRaw)
  const db = merchantDb()
  const [{ data: orders }, { count: pendingTopups }, { count: activeKeys }] = await Promise.all([
    // shortcut: aggregates the latest 10k orders in memory; move to a SQL rollup past that volume.
    db.from("merchant_orders").select("id, product_name, denomination_label, quantity, total_paisa, status, source, created_at").eq("merchant_id", m.id).eq("is_test", false).order("created_at", { ascending: false }).range(0, 9999),
    db.from("merchant_topups").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("status", "pending"),
    db.from("merchant_api_keys").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).is("revoked_at", null),
  ])

  const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(d).slice(0, 7)
  const now = new Date()
  const thisMonth = monthKey(now)
  const [y, mo] = thisMonth.split("-").map(Number)
  const keyOf = (back: number) => {
    const d = new Date(Date.UTC(y, mo - 1 - back, 1))
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) }
  }
  const prevMonth = keyOf(1).key
  const joinedMonth = monthKey(new Date(m.created_at))
  // Last 6 months, but never months before the merchant joined.
  const months = [5, 4, 3, 2, 1, 0].map(keyOf).filter((k) => k.key >= joinedMonth).map((k) => ({ month: k.key, label: k.label, spendPaisa: 0, orders: 0 }))
  const byMonth = new Map(months.map((x) => [x.month, x]))
  const zero = () => ({ spendPaisa: 0, orders: 0, cards: 0 })
  const month = zero(), lifetime = zero()
  let prevMonthSpendPaisa = 0, apiOrders = 0, last14 = 0, day = 0, days30 = 0
  const top = new Map<string, { name: string; spendPaisa: number; cards: number }>()
  const t = now.getTime()

  const completed = (orders || []).filter((o: any) => o.status === "completed")
  for (const o of completed) {
    const at = new Date(o.created_at)
    const key = monthKey(at)
    for (const b of key === thisMonth ? [lifetime, month] : [lifetime]) {
      b.spendPaisa += o.total_paisa
      b.orders += 1
      b.cards += o.quantity
    }
    if (key === prevMonth) prevMonthSpendPaisa += o.total_paisa
    const mb = byMonth.get(key)
    if (mb) { mb.spendPaisa += o.total_paisa; mb.orders += 1 }
    if (o.source === "api") apiOrders += 1
    const age = t - at.getTime()
    if (age < 14 * 86_400_000) last14 += o.total_paisa
    if (age < 86_400_000) day += o.total_paisa
    if (age < 30 * 86_400_000) {
      days30 += o.total_paisa
      const tp = top.get(o.product_name) || { name: o.product_name, spendPaisa: 0, cards: 0 }
      tp.spendPaisa += o.total_paisa
      tp.cards += o.quantity
      top.set(o.product_name, tp)
    }
  }

  // Average daily spend over the last 14 days (or since joining, if newer).
  const activeDays = Math.max(1, Math.min(14, Math.ceil((t - new Date(m.created_at).getTime()) / 86_400_000)))
  const avgDaily = Math.round(last14 / activeDays)
  const available = m.wallet_balance_paisa + m.credit_limit_paisa
  return {
    balancePaisa: m.wallet_balance_paisa,
    creditLimitPaisa: m.credit_limit_paisa,
    availablePaisa: available,
    month,
    prevMonthSpendPaisa,
    lifetime,
    avgOrderPaisa: lifetime.orders ? Math.round(lifetime.spendPaisa / lifetime.orders) : 0,
    avgDailySpendPaisa: avgDaily,
    daysLeft: avgDaily > 0 ? Math.max(0, Math.floor(available / avgDaily)) : null,
    monthly: months,
    topProducts: [...top.values()].sort((a, b) => b.spendPaisa - a.spendPaisa).slice(0, 5),
    recentOrders: (orders || []).slice(0, 6).map((o: any) => ({ id: o.id, product: o.product_name, denomination: o.denomination_label, quantity: o.quantity, totalPaisa: o.total_paisa, status: o.status, createdAt: o.created_at })),
    pendingTopups: pendingTopups || 0,
    activeKeys: activeKeys || 0,
    apiShare: completed.length ? Math.round((apiOrders / completed.length) * 100) : 0,
    limits: { perOrderPaisa: m.limit_per_order_paisa, dailyPaisa: m.limit_daily_paisa, monthlyPaisa: m.limit_monthly_paisa, dailyUsedPaisa: day, monthlyUsedPaisa: days30 },
    lowBalanceThresholdPaisa: m.low_balance_threshold_paisa,
  }
}

// ── Catalog and ordering ─────────────────────────────────────────────────

export type CatalogItem = { id: string; name: string; category: string; logo: string | null; denominations: { id: string; label: string; pricePaisa: number; available: number; sku: string | null; mySku: string | null; displayName: string | null }[] }

export async function getPricedCatalogAction(): Promise<{ products: CatalogItem[]; availablePaisa: number; manualDelivery: boolean; comingSoon: { id: string; name: string; logo: string | null }[] } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const [products, { data: topups }] = await Promise.all([
    loadPricedCatalog(ctx.merchant),
    // Player-ID top-ups aren't sold to merchants yet: shown as "Coming soon" only, never orderable.
    merchantDb().from("products").select("id, name, logo").eq("category", "topup").eq("is_active", true).order("name"),
  ])
  return {
    products: products.map((p: PricedProduct) => ({ ...p, denominations: p.denominations.map((d) => ({ id: d.id, label: d.label, pricePaisa: d.pricePaisa, available: d.available, sku: d.sku, mySku: d.mySku, displayName: d.displayName })) })),
    availablePaisa: ctx.merchant.wallet_balance_paisa + ctx.merchant.credit_limit_paisa,
    manualDelivery: ctx.merchant.manual_delivery,
    comingSoon: (topups || []).map((t: any) => ({ id: t.id, name: t.name, logo: t.logo || null })),
  }
}

export async function placeMerchantOrderAction(input: { productId: string; denominationId?: string; denomination: string; quantity: number; clientRef: string }): Promise<{ success: true; orderId: string; codes: string[]; pending: boolean } | { success: false; error: string }> {
  const ctx = await requireMerchant("active")
  if ("error" in ctx) return fail(lockedText(ctx.error))
  const m = ctx.merchant
  if (!(await rateLimit(`merchant-order:${m.id}`, { windowMs: 60_000, max: 30 })).ok) return fail("Too many orders. Wait a minute.")
  const clientRef = /^[\w-]{8,64}$/.test(String(input.clientRef)) ? `dash-${input.clientRef}` : null
  if (!clientRef) return fail("Invalid request. Refresh and try again.")

  const res = await placeOrder(m, { productId: String(input.productId), denominationId: input.denominationId ? String(input.denominationId) : null, denomination: String(input.denomination), quantity: Math.floor(Number(input.quantity)), clientRef, source: "dashboard" })
  if (!res.ok) return fail(ORDER_ERROR_TEXT[res.error])
  if (res.created) await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "order.placed", details: { orderId: res.orderId, source: "dashboard" } })
  return { success: true, orderId: res.orderId, codes: res.pending ? [] : await orderCodes(res.orderId), pending: res.pending }
}

export type MerchantOrderRow = {
  id: string
  clientRef: string | null
  product: string
  denomination: string
  quantity: number
  unitPaisa: number
  totalPaisa: number
  status: "pending" | "completed" | "refunded"
  source: "dashboard" | "api"
  refundNote: string | null
  createdAt: string
  isTest: boolean
  customer: { email: string; name: string | null; phone: string | null } | null
  sku: string | null
  displayName: string | null
}

const ORDERS_PAGE = 10

/** Server-side paging and search. q matches product, customer email/name or your reference. */
export async function listMerchantOrdersAction(page = 1, q = "", source: "all" | "dashboard" | "api" = "all", includeTest = false): Promise<{ rows: MerchantOrderRow[]; total: number; totals: { orders: number; spendPaisa: number; codes: number; refunded: number; refundedPaisa: number } } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const db = merchantDb()
  const from = (Math.max(1, Math.floor(page)) - 1) * ORDERS_PAGE
  let query = db.from("merchant_orders").select("*", { count: "exact" }).eq("merchant_id", ctx.merchant.id)
  if (!includeTest) query = query.eq("is_test", false)
  if (source !== "all") query = query.eq("source", source)
  const needle = String(q || "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80)
  if (needle) query = query.or(`product_name.ilike.%${needle}%,customer_email.ilike.%${needle}%,customer_name.ilike.%${needle}%,client_ref.ilike.%${needle}%`)
  const [{ data, count }, { data: sums }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + ORDERS_PAGE - 1),
    db.rpc("merchant_order_totals", { p_merchant_id: ctx.merchant.id }),
  ])
  const t = (Array.isArray(sums) ? sums[0] : sums) || {}
  return {
    total: count || 0,
    totals: {
      orders: Number(t.orders || 0),
      spendPaisa: Number(t.spend_paisa || 0),
      codes: Number(t.codes || 0),
      refunded: Number(t.refunded || 0),
      refundedPaisa: Number(t.refunded_paisa || 0),
    },
    rows: (data || []).map((o: any) => ({
      id: o.id,
      clientRef: o.client_ref?.replace(/^(dash|api|test)-/, "") ?? null,
      product: o.product_name,
      denomination: o.denomination_label,
      quantity: o.quantity,
      unitPaisa: o.unit_price_paisa,
      totalPaisa: o.total_paisa,
      status: o.status,
      source: o.source,
      refundNote: o.refund_note,
      createdAt: o.created_at,
      isTest: o.is_test,
      customer: o.customer_email ? { email: o.customer_email, name: o.customer_name, phone: o.customer_phone } : null,
      sku: o.merchant_sku ?? null,
      displayName: o.merchant_display_name ?? null,
    })),
  }
}

/** Up to 10,000 orders for a CSV export of the current filter. */
export async function exportMerchantOrdersAction(q = "", source: "all" | "dashboard" | "api" = "all"): Promise<MerchantOrderRow[] | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  let query = merchantDb().from("merchant_orders").select("*").eq("merchant_id", ctx.merchant.id).eq("is_test", false)
  if (source !== "all") query = query.eq("source", source)
  const needle = String(q || "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80)
  if (needle) query = query.or(`product_name.ilike.%${needle}%,customer_email.ilike.%${needle}%,customer_name.ilike.%${needle}%,client_ref.ilike.%${needle}%`)
  const { data } = await query.order("created_at", { ascending: false }).limit(10000)
  return (data || []).map((o: any) => ({
    id: o.id, clientRef: o.client_ref?.replace(/^(dash|api|test)-/, "") ?? null, product: o.product_name, denomination: o.denomination_label, quantity: o.quantity,
    unitPaisa: o.unit_price_paisa, totalPaisa: o.total_paisa, status: o.status, source: o.source, refundNote: o.refund_note, createdAt: o.created_at, isTest: o.is_test,
    customer: o.customer_email ? { email: o.customer_email, name: o.customer_name, phone: o.customer_phone } : null,
      sku: o.merchant_sku ?? null,
      displayName: o.merchant_display_name ?? null,
  }))
}

export async function getMerchantOrderCodesAction(orderId: string): Promise<{ success: true; codes: string[] } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const m = ctx.merchant
  if (!(await rateLimit(`merchant-codes:${m.id}`, { windowMs: 60_000, max: 30 })).ok) return fail("Too many requests. Wait a minute.")
  const { data: order } = await merchantDb().from("merchant_orders").select("id, status").eq("id", orderId).eq("merchant_id", m.id).maybeSingle()
  if (!order) return fail("Order not found.")
  // A refunded order's money went back to the wallet, so its codes are no longer theirs to use.
  if (order.status === "refunded") return { success: true, codes: [] }
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "order.codes_viewed", details: { orderId } })
  return { success: true, codes: await orderCodes(order.id) }
}

// ── Wallet ───────────────────────────────────────────────────────────────

export type WalletView = {
  balancePaisa: number
  creditLimitPaisa: number
  lowBalanceThresholdPaisa: number
  limits: { perOrderPaisa: number | null; dailyPaisa: number | null; monthlyPaisa: number | null }
  joinedAt: string
  settings: { fonepay: boolean; manual: boolean; fonepayMin: number; fonepayMax: number }
  topups: { id: string; amountPaisa: number; method: string; provider: "manual" | "fonepay"; reference: string; status: "awaiting_payment" | "pending" | "approved" | "rejected" | "failed"; adminNote: string | null; createdAt: string }[]
  in30Paisa: number
  out30Paisa: number
}

export type LedgerRow = { id: number; amountPaisa: number; balanceAfterPaisa: number; kind: string; reference: string | null; note: string | null; createdAt: string }

export async function getWalletAction(): Promise<WalletView | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const m = ctx.merchant
  const db = merchantDb()
  // Settle Fonepay QRs whose 5 minutes are up (credited if the bank says paid, otherwise failed).
  const { data: stale } = await db.from("merchant_topups").select("reference").eq("merchant_id", m.id).eq("provider", "fonepay").eq("status", "awaiting_payment").lt("expires_at", new Date().toISOString()).limit(5)
  for (const s of stale || []) await settleFonepayTopup(s.reference)

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: topups }, { data: recent }, s] = await Promise.all([
    db.from("merchant_topups").select("id, amount_paisa, method, provider, reference, status, admin_note, created_at").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(100),
    db.from("merchant_wallet_ledger").select("amount_paisa").eq("merchant_id", m.id).gte("created_at", since).limit(10000),
    getTopupSettings(),
  ])
  const { data: fresh } = await db.from("merchants").select("wallet_balance_paisa").eq("id", m.id).single()
  return {
    balancePaisa: Number(fresh?.wallet_balance_paisa ?? m.wallet_balance_paisa),
    creditLimitPaisa: m.credit_limit_paisa,
    lowBalanceThresholdPaisa: m.low_balance_threshold_paisa,
    limits: { perOrderPaisa: m.limit_per_order_paisa, dailyPaisa: m.limit_daily_paisa, monthlyPaisa: m.limit_monthly_paisa },
    joinedAt: m.created_at,
    settings: { fonepay: s.fonepay_topup_enabled, manual: s.manual_topup_enabled, fonepayMin: s.fonepay_topup_min_rupees, fonepayMax: s.fonepay_topup_max_rupees },
    topups: (topups || []).map((t: any) => ({ id: t.id, amountPaisa: t.amount_paisa, method: t.method, provider: t.provider, reference: t.reference, status: t.status, adminNote: t.admin_note, createdAt: t.created_at })),
    in30Paisa: (recent || []).filter((r: any) => r.amount_paisa > 0).reduce((a: number, r: any) => a + Number(r.amount_paisa), 0),
    out30Paisa: (recent || []).filter((r: any) => r.amount_paisa < 0).reduce((a: number, r: any) => a - Number(r.amount_paisa), 0),
  }
}

export async function listMyLedgerAction(page = 1): Promise<{ rows: LedgerRow[]; total: number } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const from = (Math.max(1, Math.floor(page)) - 1) * ORDERS_PAGE
  const { data, count } = await merchantDb().from("merchant_wallet_ledger").select("id, amount_paisa, balance_after_paisa, kind, reference, note, created_at", { count: "exact" }).eq("merchant_id", ctx.merchant.id).order("id", { ascending: false }).range(from, from + ORDERS_PAGE - 1)
  return { total: count || 0, rows: (data || []).map((l: any) => ({ id: l.id, amountPaisa: l.amount_paisa, balanceAfterPaisa: l.balance_after_paisa, kind: l.kind, reference: l.reference, note: l.note, createdAt: l.created_at })) }
}

export async function setLowBalanceThresholdAction(rupees: number): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const paisa = Math.round(Number(rupees) * 100)
  if (!(paisa >= 0 && paisa <= 1_000_000_000)) return fail("Enter an amount of zero or more.")
  await merchantDb().from("merchants").update({ low_balance_threshold_paisa: paisa, low_balance_alerted_at: null }).eq("id", ctx.merchant.id)
  await checkLowBalance(ctx.merchant.id)
  return { success: true }
}

export async function getMyStatementAction(month: string, tz?: string): Promise<MonthlyStatement | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  return loadMonthlyStatement(ctx.merchant.id, month, tz)
}

export async function createTopupProofUploadAction(mime: string, size: number): Promise<{ success: true; path: string; token: string } | { success: false; error: string }> {
  const ctx = await requireMerchant("active")
  if ("error" in ctx) return fail(lockedText(ctx.error))
  if (!(await getTopupSettings()).manual_topup_enabled) return fail("Manual wallet top-up is turned off.")
  if (!(mime in KYC_MIME)) return fail("Upload a PDF, JPG or PNG.")
  if (!(size > 0 && size <= KYC_MAX_BYTES)) return fail("The file must be 5 MB or smaller.")
  if (!(await rateLimit(`merchant-topup-upload:${ctx.merchant.id}`, { windowMs: 3_600_000, max: 20 })).ok) return fail("Too many uploads. Try again later.")
  const path = `${ctx.merchant.id}/topups/${crypto.randomUUID()}.${KYC_MIME[mime as keyof typeof KYC_MIME]}`
  const { data, error } = await merchantDb().storage.from("merchant-kyc").createSignedUploadUrl(path)
  if (error || !data) return fail("Could not prepare the upload.")
  return { success: true, path: data.path, token: data.token }
}

const TOPUP_METHODS = ["bank_transfer", "esewa", "khalti", "fonepay", "other"]

export async function requestTopupAction(input: { amountRupees: number; method: string; reference: string; proofPath?: string }): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("active")
  if ("error" in ctx) return fail(lockedText(ctx.error))
  const m = ctx.merchant
  if (!(await getTopupSettings()).manual_topup_enabled) return fail("Manual wallet top-up is turned off.")
  const amount = Number(input.amountRupees)
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) return fail("Enter an amount between Rs. 100 and Rs. 1,00,00,000.")
  if (!TOPUP_METHODS.includes(input.method)) return fail("Choose how you paid.")
  const reference = String(input.reference || "").trim().slice(0, 80)
  if (reference.length < 3) return fail("Enter the transaction ID or reference from your payment.")
  if (!(await rateLimit(`merchant-topup:${m.id}`, { windowMs: 3_600_000, max: 10 })).ok) return fail("Too many requests. Try again later.")

  const db = merchantDb()
  const { count } = await db.from("merchant_topups").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("status", "pending")
  if ((count || 0) >= 5) return fail("You already have 5 top-ups waiting for approval.")
  const { data: dupRef } = await db.from("merchant_topups").select("id").eq("provider", "manual").in("status", ["pending", "approved"]).ilike("reference", reference).limit(1)
  if (dupRef?.length) return fail("That payment reference has already been submitted.")

  let proofPath: string | null = null
  if (input.proofPath) {
    const p = String(input.proofPath)
    if (!p.startsWith(`${m.id}/topups/`) || p.includes("..")) return fail("Invalid receipt. Upload it again.")
    const { data: blob } = await db.storage.from("merchant-kyc").download(p)
    if (!blob || blob.size > KYC_MAX_BYTES || !sniffMime(new Uint8Array(await blob.slice(0, 8).arrayBuffer()))) return fail("The receipt must be a PDF, JPG or PNG under 5 MB.")
    proofPath = p
  }

  const { data: topup, error } = await db
    .from("merchant_topups")
    .insert({ merchant_id: m.id, amount_paisa: Math.round(amount * 100), method: input.method, reference, proof_path: proofPath })
    .select("id")
    .single()
  if (error) return fail(error.code === "23505" ? "That payment reference has already been submitted." : "Could not save the request.")
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "topup.requested", details: { topupId: topup.id, amount } })
  await alertStaff("💰 Manual wallet top-up to approve", [
    { name: "Merchant", value: m.business_name, inline: true },
    { name: "Amount", value: `Rs. ${amount.toLocaleString("en-IN")}`, inline: true },
    { name: "Method / reference", value: `${input.method} · ${reference}`, inline: false },
    { name: "Receipt", value: proofPath ? "Attached" : "None", inline: true },
  ], 0xf59e0b)
  return { success: true }
}

// ── API keys ─────────────────────────────────────────────────────────────

export type ApiKeyRow = { id: string; name: string; prefix: string; mode: "live" | "test"; ipAllowlist: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string }

export async function listApiKeysAction(): Promise<{ keys: ApiKeyRow[]; rateLimitPerMin: number } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const { data } = await merchantDb().from("merchant_api_keys").select("id, name, prefix, mode, ip_allowlist, last_used_at, revoked_at, created_at").eq("merchant_id", ctx.merchant.id).order("created_at", { ascending: false })
  return {
    keys: (data || []).map((k: any) => ({ id: k.id, name: k.name, prefix: k.prefix, mode: k.mode, ipAllowlist: k.ip_allowlist || [], lastUsedAt: k.last_used_at, revokedAt: k.revoked_at, createdAt: k.created_at })),
    rateLimitPerMin: ctx.merchant.api_rate_limit_per_min,
  }
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i

/** Live keys need a verified, active account; test keys work as soon as onboarding is done. */
export async function createApiKeyAction(name: string, ipList: string, mode: "live" | "test" = "live"): Promise<{ success: true; key: string } | { success: false; error: string }> {
  if (mode !== "live" && mode !== "test") return fail("Invalid key type.")
  const ctx = await requireMerchant(mode === "test" ? "onboarded" : "active")
  if ("error" in ctx) return fail(lockedText(ctx.error))
  const m = ctx.merchant
  const cleanName = String(name || "").trim().slice(0, 60)
  if (!cleanName) return fail("Give the key a name, e.g. 'Production server'.")
  const ips = [...new Set(String(ipList || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))]
  if (ips.length > 20) return fail("Up to 20 IP addresses per key.")
  const bad = ips.find((ip) => !IP_RE.test(ip))
  if (bad) return fail(`"${bad}" is not a valid IP address.`)

  const db = merchantDb()
  const { count } = await db.from("merchant_api_keys").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).is("revoked_at", null)
  if ((count || 0) >= 5) return fail("You can have up to 5 active keys. Revoke one first.")

  const { key, prefix, hash } = generateApiKey(mode)
  const { data, error } = await db.from("merchant_api_keys").insert({ merchant_id: m.id, name: cleanName, prefix, secret_hash: hash, ip_allowlist: ips, mode }).select("id").single()
  if (error) return fail("Could not create the key.")
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "api_key.created", details: { keyId: data.id, prefix, ips, mode } })
  return { success: true, key }
}

export async function revokeApiKeyAction(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const { data } = await merchantDb()
    .from("merchant_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("merchant_id", ctx.merchant.id)
    .is("revoked_at", null)
    .select("prefix")
    .maybeSingle()
  if (!data) return fail("Key not found.")
  await audit({ actorType: "merchant", actorId: ctx.merchant.user_id, merchantId: ctx.merchant.id, action: "api_key.revoked", details: { keyId: id, prefix: data.prefix } })
  return { success: true }
}

// ── Fonepay wallet top-up ────────────────────────────────────────────────

export type FonepayTopupView = { reference: string; amountPaisa: number; qrString: string; expiresIn: number }

/** Starts (or resumes) a Fonepay QR top-up. The wallet is credited only after the bank confirms payment. */
export async function createFonepayTopupAction(amountRupees: number): Promise<{ success: true; topup: FonepayTopupView } | { success: false; error: string }> {
  const ctx = await requireMerchant("active")
  if ("error" in ctx) return fail(lockedText(ctx.error))
  const m = ctx.merchant
  const s = await getTopupSettings()
  if (!s.fonepay_topup_enabled) return fail("Fonepay top-up is turned off right now.")
  const amount = Number(amountRupees)
  if (!Number.isInteger(amount) || amount < s.fonepay_topup_min_rupees || amount > s.fonepay_topup_max_rupees) {
    return fail(`Enter a whole amount between Rs. ${s.fonepay_topup_min_rupees.toLocaleString("en-IN")} and Rs. ${s.fonepay_topup_max_rupees.toLocaleString("en-IN")}.`)
  }
  if (!(await rateLimit(`merchant-fonepay-qr:${m.id}`, { windowMs: 600_000, max: 6 })).ok) return fail("Too many QR codes requested. Wait a few minutes.")

  const db = merchantDb()
  // One live QR at a time: reuse it if the amount matches, otherwise retire it.
  const { data: open } = await db.from("merchant_topups").select("id, reference, amount_paisa, qr_payload, expires_at").eq("merchant_id", m.id).eq("provider", "fonepay").eq("status", "awaiting_payment")
  for (const t of open || []) {
    const left = Math.floor((new Date(t.expires_at).getTime() - Date.now()) / 1000)
    if (left > 30 && t.amount_paisa === amount * 100 && t.qr_payload) return { success: true, topup: { reference: t.reference, amountPaisa: t.amount_paisa, qrString: t.qr_payload, expiresIn: left } }
    if (left <= 0) await settleFonepayTopup(t.reference)
  }
  if ((open || []).some((t: any) => new Date(t.expires_at).getTime() > Date.now())) return fail("Finish or wait out your current QR (5 minutes) before starting another.")

  const reference = newTopupReference()
  const { data: row, error } = await db
    .from("merchant_topups")
    .insert({ merchant_id: m.id, amount_paisa: amount * 100, method: "fonepay", provider: "fonepay", reference, status: "awaiting_payment", expires_at: new Date(Date.now() + QR_MINUTES * 60_000).toISOString() })
    .select("id")
    .single()
  if (error) return fail("Could not start the top-up.")

  const qr = await createFonepayQr(reference, amount)
  if (!qr.ok) {
    await db.from("merchant_topups").delete().eq("id", row.id).eq("status", "awaiting_payment")
    return fail(qr.error)
  }
  await db.from("merchant_topups").update({ qr_payload: qr.qrString, validation_trace_id: qr.validationTraceId }).eq("id", row.id)
  await scheduleTopupPolling(reference, qr.validationTraceId)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "topup.fonepay_started", details: { reference, amount } })
  return { success: true, topup: { reference, amountPaisa: amount * 100, qrString: qr.qrString, expiresIn: QR_MINUTES * 60 } }
}

/** The browser polls this while the QR is open (and "I've paid, check again" after it closes). */
export async function checkFonepayTopupAction(reference: string): Promise<{ status: string } | { error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return { error: "Please sign in again." }
  if (!(await rateLimit(`merchant-fonepay-check:${ctx.merchant.id}`, { windowMs: 60_000, max: 30 })).ok) return { error: "Checking too often. Wait a moment." }
  const { data: t } = await merchantDb().from("merchant_topups").select("id").eq("reference", String(reference)).eq("merchant_id", ctx.merchant.id).maybeSingle()
  if (!t) return { error: "Top-up not found." }
  return { status: await settleFonepayTopup(String(reference)) }
}

// ── Revenue report ───────────────────────────────────────────────────────

export async function getMyRevenueReportAction(fromIso: string, toIso: string, bucket: "day" | "week" | "month", tz?: string): Promise<RevenueReport | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  return loadRevenueReport(ctx.merchant.id, fromIso, toIso, bucket, tz)
}

// ── Webhooks ─────────────────────────────────────────────────────────────

export type WebhookDeliveryRow = { id: string; event: string; status: "pending" | "delivered" | "failed"; attempts: number; responseStatus: number | null; lastError: string | null; livemode: boolean; createdAt: string; deliveredAt: string | null }

export async function getWebhookSettingsAction(): Promise<{ url: string | null; hasSecret: boolean; events: readonly string[] } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  return { url: ctx.merchant.webhook_url, hasSecret: !!ctx.merchant.webhook_secret_enc, events: WEBHOOK_EVENTS }
}

/** Saves the endpoint. Creates a signing secret the first time and returns it once. */
export async function saveWebhookUrlAction(url: string): Promise<{ success: true; secret?: string } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const m = ctx.merchant
  const clean = String(url || "").trim()
  const db = merchantDb()
  if (!clean) {
    await db.from("merchants").update({ webhook_url: null }).eq("id", m.id)
    await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "webhook.updated", details: { url: null } })
    return { success: true }
  }
  const bad = checkWebhookUrl(clean)
  if (bad) return fail(bad)
  const fresh = m.webhook_secret_enc ? null : newWebhookSecret()
  await db.from("merchants").update({ webhook_url: clean, ...(fresh ? { webhook_secret_enc: fresh.enc } : {}) }).eq("id", m.id)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "webhook.updated", details: { url: clean } })
  return { success: true, ...(fresh ? { secret: fresh.secret } : {}) }
}

export async function rotateWebhookSecretAction(): Promise<{ success: true; secret: string } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const fresh = newWebhookSecret()
  await merchantDb().from("merchants").update({ webhook_secret_enc: fresh.enc }).eq("id", ctx.merchant.id)
  await audit({ actorType: "merchant", actorId: ctx.merchant.user_id, merchantId: ctx.merchant.id, action: "webhook.updated", details: { rotatedSecret: true } })
  return { success: true, secret: fresh.secret }
}

export async function sendTestWebhookAction(): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  if (!ctx.merchant.webhook_url) return fail("Save a webhook URL first.")
  if (!(await rateLimit(`merchant-webhook-test:${ctx.merchant.id}`, { windowMs: 60_000, max: 5 })).ok) return fail("Wait a minute before sending another test.")
  await emitWebhook(ctx.merchant.id, "webhook.test", { message: "Hello from Byiora. Your webhook endpoint works." }, false)
  return { success: true }
}

export async function listWebhookDeliveriesAction(page = 1): Promise<{ rows: WebhookDeliveryRow[]; total: number } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const from = (Math.max(1, Math.floor(page)) - 1) * ORDERS_PAGE
  const { data, count } = await merchantDb().from("merchant_webhook_deliveries").select("id, event, status, attempts, response_status, last_error, livemode, created_at, delivered_at", { count: "exact" }).eq("merchant_id", ctx.merchant.id).order("created_at", { ascending: false }).range(from, from + ORDERS_PAGE - 1)
  return { total: count || 0, rows: (data || []).map((d: any) => ({ id: d.id, event: d.event, status: d.status, attempts: d.attempts, responseStatus: d.response_status, lastError: d.last_error, livemode: d.livemode, createdAt: d.created_at, deliveredAt: d.delivered_at })) }
}

export async function redeliverWebhookAction(id: string): Promise<{ success: true; delivered: boolean } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  if (!(await rateLimit(`merchant-webhook-redeliver:${ctx.merchant.id}`, { windowMs: 60_000, max: 10 })).ok) return fail("Too many retries. Wait a minute.")
  const db = merchantDb()
  const { data: d } = await db.from("merchant_webhook_deliveries").select("id").eq("id", id).eq("merchant_id", ctx.merchant.id).maybeSingle()
  if (!d) return fail("Delivery not found.")
  await db.from("merchant_webhook_deliveries").update({ status: "pending", attempts: 0 }).eq("id", id)
  return { success: true, delivered: await deliverWebhook(id) }
}

// ── Your own SKUs and names ──────────────────────────────────────────────

/** Gives one of our product packs (by its permanent id) the merchant's own code and display name (empty sku removes it). */
export async function saveMerchantSkuAction(productId: string, denominationId: string, sku: string, displayName: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const m = ctx.merchant
  const cleanSku = String(sku || "").trim()
  const name = String(displayName || "").trim().slice(0, 100) || null
  const db = merchantDb()
  if (!cleanSku) {
    await db.from("merchant_skus").delete().eq("merchant_id", m.id).eq("product_id", String(productId)).eq("denomination_id", String(denominationId))
    return { success: true }
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(cleanSku)) return fail("SKU can use letters, digits, dot, _ and -, up to 64 characters.")
  if (!(await rateLimit(`merchant-sku:${m.id}`, { windowMs: 60_000, max: 60 })).ok) return fail("Too many changes. Wait a minute.")
  // Only amounts this merchant can actually buy.
  const pack = (await loadPricedCatalog(m)).find((p) => p.id === productId)?.denominations.find((d) => d.id === denominationId)
  if (!pack) return fail("That product isn't available to you.")
  const { error } = await db.from("merchant_skus").upsert(
    { merchant_id: m.id, sku: cleanSku, product_id: String(productId), denomination_id: pack.id, denomination_label: pack.label, display_name: name, updated_at: new Date().toISOString() },
    { onConflict: "merchant_id,product_id,denomination_id" },
  )
  if (error) return fail(error.code === "23505" ? `You already use SKU "${cleanSku}" for another product.` : "Could not save the SKU.")
  return { success: true }
}
