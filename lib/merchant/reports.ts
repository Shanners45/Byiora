import { merchantDb } from "@/lib/merchant/server"

// Server-only: top-up switches and revenue reports shared by the merchant portal and admin.

export type TopupSettings = {
  fonepay_topup_enabled: boolean
  manual_topup_enabled: boolean
  fonepay_topup_min_rupees: number
  fonepay_topup_max_rupees: number
}

export async function getTopupSettings(): Promise<TopupSettings> {
  const { data } = await merchantDb().from("merchant_settings").select("fonepay_topup_enabled, manual_topup_enabled, fonepay_topup_min_rupees, fonepay_topup_max_rupees").eq("id", true).maybeSingle()
  return data || { fonepay_topup_enabled: false, manual_topup_enabled: true, fonepay_topup_min_rupees: 100, fonepay_topup_max_rupees: 100000 }
}

export type RevenuePoint = { bucket: string; revenuePaisa: number; orders: number; codes: number; savedPaisa: number; refundedPaisa: number }
export type RevenueReport = {
  startsAt: string
  from: string
  to: string
  bucket: "day" | "week" | "month"
  totals: Omit<RevenuePoint, "bucket">
  previous: { revenuePaisa: number; orders: number }
  series: RevenuePoint[]
  byProduct: { productId: string; productName: string; denomination: string; revenuePaisa: number; orders: number; codes: number }[]
}

/** Valid IANA time zone from the viewer's browser, else UTC. */
export const safeTimeZone = (tz: unknown) => {
  try {
    return typeof tz === "string" && tz.length < 64 && new Intl.DateTimeFormat("en-US", { timeZone: tz }) ? tz : "UTC"
  } catch {
    return "UTC"
  }
}
const localDate = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))

/** Bucket start dates (viewer's calendar) covering [from, to), so quiet days/months still show as zero. */
export function bucketKeys(fromMs: number, toMs: number, bucket: RevenueReport["bucket"], tz: string): string[] {
  const d = new Date(`${localDate(fromMs, tz)}T00:00:00Z`)
  if (bucket === "month") d.setUTCDate(1)
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // Monday, like date_trunc('week')
  const end = localDate(toMs - 1, tz)
  const keys: string[] = []
  while (d.toISOString().slice(0, 10) <= end && keys.length < 800) {
    keys.push(d.toISOString().slice(0, 10))
    if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1)
    else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7)
    else d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return keys
}

/**
 * merchantId null = all merchants (admin overview). Range is [from, to), clipped so it never
 * starts before the merchant (or the first merchant) joined: no empty months before they existed.
 */
export async function loadRevenueReport(merchantId: string | null, fromIso: string, toIso: string, bucket: RevenueReport["bucket"], tzRaw?: string): Promise<RevenueReport | null> {
  const tz = safeTimeZone(tzRaw)
  const db = merchantDb()
  const { data: joined } = merchantId
    ? await db.from("merchants").select("created_at").eq("id", merchantId).maybeSingle()
    : await db.from("merchants").select("created_at").order("created_at").limit(1).maybeSingle()
  const startsAt = joined?.created_at || new Date().toISOString()
  let fromMs = Date.parse(fromIso)
  const toMs = Date.parse(toIso)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs || toMs - fromMs > 732 * 86_400_000) return null
  fromMs = Math.max(fromMs, Date.parse(startsAt))
  if (fromMs >= toMs) fromMs = toMs - 1
  fromIso = new Date(fromMs).toISOString()
  if (!["day", "week", "month"].includes(bucket)) bucket = "day"
  const prevFrom = new Date(fromMs - (toMs - fromMs)).toISOString()

  const [{ data: series }, { data: products }, { data: prev }] = await Promise.all([
    db.rpc("merchant_revenue_series", { p_merchant_id: merchantId, p_from: fromIso, p_to: toIso, p_bucket: bucket, p_tz: tz }),
    db.rpc("merchant_revenue_by_product", { p_merchant_id: merchantId, p_from: fromIso, p_to: toIso }),
    db.rpc("merchant_revenue_series", { p_merchant_id: merchantId, p_from: prevFrom, p_to: fromIso, p_bucket: "month", p_tz: tz }),
  ])

  const byKey = new Map<string, any>((series || []).map((r: any) => [String(r.bucket).slice(0, 10), r]))
  const points: RevenuePoint[] = bucketKeys(fromMs, toMs, bucket, tz).map((k) => {
    const r = byKey.get(k)
    return { bucket: k, revenuePaisa: Number(r?.revenue_paisa || 0), orders: Number(r?.orders || 0), codes: Number(r?.codes || 0), savedPaisa: Number(r?.saved_paisa || 0), refundedPaisa: Number(r?.refunded_paisa || 0) }
  })
  const totals = points.reduce(
    (t, p) => ({ revenuePaisa: t.revenuePaisa + p.revenuePaisa, orders: t.orders + p.orders, codes: t.codes + p.codes, savedPaisa: t.savedPaisa + p.savedPaisa, refundedPaisa: t.refundedPaisa + p.refundedPaisa }),
    { revenuePaisa: 0, orders: 0, codes: 0, savedPaisa: 0, refundedPaisa: 0 },
  )
  return {
    startsAt,
    from: fromIso,
    to: toIso,
    bucket,
    totals,
    previous: (prev || []).reduce((a: any, r: any) => ({ revenuePaisa: a.revenuePaisa + Number(r.revenue_paisa), orders: a.orders + Number(r.orders) }), { revenuePaisa: 0, orders: 0 }),
    series: points,
    byProduct: (products || []).slice(0, 100).map((r: any) => ({ productId: r.product_id, productName: r.product_name, denomination: r.denomination_label, revenuePaisa: Number(r.revenue_paisa), orders: Number(r.orders), codes: Number(r.codes) })),
  }
}

// ── Monthly statement ────────────────────────────────────────────────────

/** UTC instant of local midnight on y-m-d in `tz`. */
function zonedMidnight(y: number, m: number, d: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d)
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]))
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return guess - (asLocal - guess)
}

export type MonthlyStatement = {
  month: string
  timeZone: string
  merchant: { businessName: string; legalName: string | null; pan: string | null; address: string | null; email: string; phone: string | null }
  openingPaisa: number
  closingPaisa: number
  creditsPaisa: number
  debitsPaisa: number
  orders: number
  codes: number
  rows: { date: string; kind: string; reference: string | null; note: string | null; amountPaisa: number; balanceAfterPaisa: number }[]
}

export async function loadMonthlyStatement(merchantId: string, month: string, tzRaw?: string): Promise<MonthlyStatement | null> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const tz = safeTimeZone(tzRaw)
  const [y, m] = month.split("-").map(Number)
  const start = new Date(zonedMidnight(y, m, 1, tz)).toISOString()
  const end = new Date(zonedMidnight(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1, tz)).toISOString()
  const db = merchantDb()
  const [{ data: mer }, { data: kyc }, { data: before }, { data: rows }, { data: orders }] = await Promise.all([
    db.from("merchants").select("business_name, email, phone").eq("id", merchantId).maybeSingle(),
    db.from("merchant_kyc_submissions").select("legal_name, pan_number, address").eq("merchant_id", merchantId).eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("merchant_wallet_ledger").select("balance_after_paisa").eq("merchant_id", merchantId).lt("created_at", start).order("id", { ascending: false }).limit(1).maybeSingle(),
    db.from("merchant_wallet_ledger").select("created_at, kind, reference, note, amount_paisa, balance_after_paisa").eq("merchant_id", merchantId).gte("created_at", start).lt("created_at", end).order("id").limit(10000),
    db.from("merchant_orders").select("quantity").eq("merchant_id", merchantId).eq("status", "completed").eq("is_test", false).gte("created_at", start).lt("created_at", end).limit(10000),
  ])
  if (!mer) return null
  const list = rows || []
  const opening = Number(before?.balance_after_paisa || 0)
  return {
    month,
    timeZone: tz,
    merchant: { businessName: mer.business_name, legalName: kyc?.legal_name || null, pan: kyc?.pan_number || null, address: kyc?.address || null, email: mer.email, phone: mer.phone },
    openingPaisa: opening,
    closingPaisa: list.length ? Number(list[list.length - 1].balance_after_paisa) : opening,
    creditsPaisa: list.filter((r: any) => r.amount_paisa > 0).reduce((s: number, r: any) => s + Number(r.amount_paisa), 0),
    debitsPaisa: list.filter((r: any) => r.amount_paisa < 0).reduce((s: number, r: any) => s - Number(r.amount_paisa), 0),
    orders: (orders || []).length,
    codes: (orders || []).reduce((s: number, o: any) => s + o.quantity, 0),
    rows: list.map((r: any) => ({ date: r.created_at, kind: r.kind, reference: r.reference, note: r.note, amountPaisa: Number(r.amount_paisa), balanceAfterPaisa: Number(r.balance_after_paisa) })),
  }
}
