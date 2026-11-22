"use server"

import { z } from "zod"
import { getAdminSessionAction } from "./admin-utils"
import { rateLimit } from "@/lib/rate-limit"
import { audit, merchantDb, tempPassword, type Merchant } from "@/lib/merchant/server"
import { fillPendingFromStock, loadPriceBook, type PriceBookLine } from "@/lib/merchant/trade"
import { MERCHANT_CATEGORIES } from "@/lib/merchant/pricing"
import { getPostHogLastActive } from "@/lib/analytics/posthog-server"
import { getTopupSettings, loadMonthlyStatement, loadRevenueReport, type MonthlyStatement, type RevenueReport, type TopupSettings } from "@/lib/merchant/reports"
import { checkLowBalance, emitWebhook, orderPayload } from "@/lib/merchant/events"
import { encryptInventoryCode } from "./inventory-encryption"
import { broadcast, merchantTopic, ADMIN_MERCHANTS_TOPIC } from "@/lib/realtime/broadcast"
import { sendMerchantEmail, MERCHANT_PORTAL_URL } from "@/lib/email/resend"

// Merchant management is super-admin only (role "admin").
async function superAdmin() {
  const s = await getAdminSessionAction()
  return s.success && s.data.role === "admin" ? s.data : null
}

export type MerchantListRow = {
  id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  status: "active" | "suspended" | "banned"
  status_reason: string | null
  kyc_status: "not_submitted" | "submitted" | "more_info" | "rejected" | "approved"
  must_change_password: boolean
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
  wallet_balance_paisa: number
  discount_percent: number
  api_rate_limit_per_min: number
  revenue_paisa: number
  month_revenue_paisa: number
  orders: number
  last_order_at: string | null
  pending_topups: number
  credit_limit_paisa: number
  limit_per_order_paisa: number | null
  limit_daily_paisa: number | null
  limit_monthly_paisa: number | null
  low_balance_threshold_paisa: number
  use_global_inventory: boolean
}

export async function listMerchantsAction(): Promise<{ success: true; data: MerchantListRow[] } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const [{ data, error }, { data: totals }, { data: pending }] = await Promise.all([
    db
      .from("merchants")
      .select("id, business_name, contact_name, email, phone, status, status_reason, kyc_status, must_change_password, email_verified_at, last_login_at, created_at, wallet_balance_paisa, discount_percent, api_rate_limit_per_min, credit_limit_paisa, limit_per_order_paisa, limit_daily_paisa, limit_monthly_paisa, low_balance_threshold_paisa, use_global_inventory")
      .order("created_at", { ascending: false }),
    db.rpc("merchant_revenue_totals"),
    db.from("merchant_topups").select("merchant_id").eq("status", "pending"),
  ])
  if (error) return { success: false, error: error.message }
  const totalOf = new Map<string, any>((totals || []).map((t: any) => [t.merchant_id, t]))
  const pendingOf = new Map<string, number>()
  for (const t of pending || []) pendingOf.set(t.merchant_id, (pendingOf.get(t.merchant_id) || 0) + 1)
  return {
    success: true,
    data: (data || []).map((m: any) => {
      const t = totalOf.get(m.id)
      return {
        ...m,
        discount_percent: Number(m.discount_percent),
        revenue_paisa: Number(t?.revenue_paisa || 0),
        month_revenue_paisa: Number(t?.month_revenue_paisa || 0),
        orders: Number(t?.orders || 0),
        last_order_at: t?.last_order_at || null,
        pending_topups: pendingOf.get(m.id) || 0,
      }
    }),
  }
}

const inviteSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is too short").max(120),
  contactName: z.string().trim().min(2, "Contact name is too short").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
})

function credentialsEmail(to: string, businessName: string, password: string, heading: string) {
  return sendMerchantEmail({
    to,
    subject: heading,
    heading,
    paragraphs: [
      `${businessName} has been set up on the Byiora merchant portal.`,
      "Sign in with the details below. You will be asked to choose a new password and confirm your email straight away.",
      "If you were not expecting this email, you can ignore it.",
    ],
    box: [
      { label: "Email", value: to },
      { label: "Temporary password", value: password },
    ],
    cta: { label: "Sign in to the merchant portal", url: `${MERCHANT_PORTAL_URL}/login` },
  })
}

export async function inviteMerchantAction(input: z.input<typeof inviteSchema>): Promise<{ success: true; emailSent: boolean } | { success: false; error: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { businessName, contactName, email, phone } = parsed.data

  const rl = await rateLimit(`merchant-invite:${admin.id}`, { windowMs: 3_600_000, max: 30 })
  if (!rl.ok) return { success: false, error: "Too many invites this hour." }

  const db = merchantDb()
  const password = tempPassword()
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    // Our own email-code step proves the inbox on first sign-in.
    email_confirm: true,
    app_metadata: { role: "merchant" },
  })
  if (authError || !created?.user) {
    const taken = /already|registered|exists/i.test(authError?.message || "")
    return { success: false, error: taken ? "That email already has a Byiora account. Use a different email for the merchant." : "Could not create the merchant login." }
  }

  const { data: merchant, error } = await db
    .from("merchants")
    .insert({ user_id: created.user.id, business_name: businessName, contact_name: contactName, email, phone: phone || null, invited_by: admin.id })
    .select("id")
    .single()
  if (error) {
    await db.auth.admin.deleteUser(created.user.id)
    return { success: false, error: "Could not save the merchant." }
  }

  const sent = await credentialsEmail(email, businessName, password, "You're invited to Byiora Merchants").catch(() => null)
  await audit({ actorType: "admin", actorId: admin.id, merchantId: merchant.id, action: "merchant.invited", details: { email, emailSent: !!sent?.data } })
  return { success: true, emailSent: !!sent?.data }
}

/** New temporary password by email; the merchant must change it again on next sign-in. */
export async function resendMerchantInviteAction(merchantId: string): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const { data: m } = await db.from("merchants").select("id, user_id, email, business_name, status").eq("id", merchantId).maybeSingle()
  if (!m) return { success: false, error: "Merchant not found" }
  if (m.status === "banned") return { success: false, error: "Unban the merchant first." }

  const password = tempPassword()
  const { error } = await db.auth.admin.updateUserById(m.user_id, { password })
  if (error) return { success: false, error: "Could not reset the password." }
  await db.from("merchants").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", m.id)
  const sent = await credentialsEmail(m.email, m.business_name, password, "Your new Byiora merchant sign-in").catch(() => null)
  await audit({ actorType: "admin", actorId: admin.id, merchantId: m.id, action: "merchant.credentials_reset", details: { emailSent: !!sent?.data } })
  return sent?.data ? { success: true } : { success: false, error: "Password reset, but the email failed to send. Try again." }
}

export async function setMerchantStatusAction(
  merchantId: string,
  status: "active" | "suspended" | "banned",
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  if (!["active", "suspended", "banned"].includes(status)) return { success: false, error: "Invalid status" }
  const note = String(reason || "").trim().slice(0, 500)
  if (status !== "active" && note.length < 3) return { success: false, error: "Give a reason." }

  const db = merchantDb()
  const { data: m } = await db.from("merchants").select("id, user_id, email, business_name, status").eq("id", merchantId).maybeSingle()
  if (!m) return { success: false, error: "Merchant not found" }

  // A ban also blocks the login itself, so existing sessions cannot refresh.
  const { error: banError } = await db.auth.admin.updateUserById(m.user_id, { ban_duration: status === "banned" ? "876000h" : "none" })
  if (banError) return { success: false, error: "Could not update the login." }
  const { error } = await db
    .from("merchants")
    .update({ status, status_reason: status === "active" ? null : note, updated_at: new Date().toISOString() })
    .eq("id", m.id)
  if (error) return { success: false, error: error.message }

  await audit({ actorType: "admin", actorId: admin.id, merchantId: m.id, action: `merchant.status.${status}`, details: { from: m.status, reason: note } })
  const copy = {
    active: ["Your merchant account is active again", "Your Byiora merchant account has been reactivated. You can sign in as usual."],
    suspended: ["Your merchant account is suspended", `Your Byiora merchant account has been suspended. You can still sign in and view your account, but orders and API access are paused. Reason: ${note}`],
    banned: ["Your merchant account has been closed", `Your Byiora merchant account has been closed and can no longer sign in. Reason: ${note}`],
  }[status]
  await sendMerchantEmail({ to: m.email, subject: copy[0], heading: copy[0], paragraphs: [copy[1]] }).catch(() => null)
  return { success: true }
}

export type KycSubmissionView = {
  id: string
  version: number
  status: "pending" | "approved" | "rejected" | "more_info"
  legal_name: string
  business_type: string
  pan_number: string
  registration_number: string | null
  address: string
  website: string | null
  admin_note: string | null
  reviewed_at: string | null
  created_at: string
  documents: { type: string; mime: string; size: number; url: string | null }[]
}

/** Every KYC version for a merchant; document links are signed for 60 seconds. */
export async function getMerchantKycAction(merchantId: string): Promise<{ success: true; data: KycSubmissionView[] } | { success: false; error: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const { data: rows, error } = await db
    .from("merchant_kyc_submissions")
    .select("id, version, status, legal_name, business_type, pan_number, registration_number, address, website, admin_note, reviewed_at, created_at, documents")
    .eq("merchant_id", merchantId)
    .order("version", { ascending: false })
  if (error) return { success: false, error: error.message }

  const paths: string[] = (rows || []).flatMap((r: any) => (r.documents || []).map((d: any) => d.path))
  const { data: signed } = paths.length ? await db.storage.from("merchant-kyc").createSignedUrls(paths, 60) : { data: [] }
  const urlOf = new Map<string, string>((signed || []).map((s: any) => [s.path, s.signedUrl]))

  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "kyc.viewed", details: { documents: paths.length } })
  return {
    success: true,
    data: (rows || []).map((r: any) => ({
      ...r,
      documents: (r.documents || []).map((d: any) => ({ type: d.type, mime: d.mime, size: d.size, url: urlOf.get(d.path) || null })),
    })),
  }
}

export async function reviewKycAction(
  submissionId: string,
  decision: "approved" | "rejected" | "more_info",
  note: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  if (!["approved", "rejected", "more_info"].includes(decision)) return { success: false, error: "Invalid decision" }
  const cleanNote = String(note || "").trim().slice(0, 1000)
  if (decision !== "approved" && cleanNote.length < 5) return { success: false, error: "Tell the merchant what is wrong or missing." }

  const db = merchantDb()
  const now = new Date().toISOString()
  // Only a pending submission can be decided, and only once.
  const { data: sub, error } = await db
    .from("merchant_kyc_submissions")
    .update({ status: decision, admin_note: cleanNote || null, reviewed_by: admin.id, reviewed_at: now })
    .eq("id", submissionId)
    .eq("status", "pending")
    .select("merchant_id, version")
    .maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!sub) return { success: false, error: "This submission was already reviewed." }

  const { data: m } = await db
    .from("merchants")
    .update({ kyc_status: decision, updated_at: now })
    .eq("id", sub.merchant_id)
    .select("email, business_name")
    .single()
  await audit({ actorType: "admin", actorId: admin.id, merchantId: sub.merchant_id, action: `kyc.${decision}`, details: { version: sub.version, note: cleanNote } })

  if (m) {
    const copy = {
      approved: ["Your business is verified", [`Good news: ${m.business_name} has passed verification. Your merchant account is now unlocked.`]],
      more_info: ["We need a little more information", ["We reviewed your verification documents and need a few changes before we can approve them:", cleanNote, "Sign in to the merchant portal to update and resubmit."]],
      rejected: ["Your verification was not approved", ["We could not approve your verification documents:", cleanNote, "You can sign in to the merchant portal to submit again, or reply to this email if you have questions."]],
    }[decision] as [string, string[]]
    await sendMerchantEmail({ to: m.email, subject: copy[0], heading: copy[0], paragraphs: copy[1], cta: { label: "Open the merchant portal", url: `${MERCHANT_PORTAL_URL}/login` } }).catch(() => null)
  }
  return { success: true }
}

// ── Wallet, pricing, orders ──────────────────────────────────────────────

const npr = (paisa: number) => `Rs. ${(paisa / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

export type AdminTopup = { id: string; merchantId: string; businessName?: string; amountPaisa: number; method: string; provider: "manual" | "fonepay"; reference: string; bankTxnId: string | null; proofUrl: string | null; status: "awaiting_payment" | "pending" | "approved" | "rejected" | "expired"; adminNote: string | null; createdAt: string }
export type AdminLedgerRow = { id: number; amountPaisa: number; balanceAfterPaisa: number; kind: string; reference: string | null; note: string | null; createdAt: string }
export type AdminOrderRow = { id: string; product: string; denomination: string; quantity: number; totalPaisa: number; status: "pending" | "completed" | "refunded"; source: string; refundNote: string | null; createdAt: string; isTest: boolean; clientRef: string | null; customer: { email: string; name: string | null; phone: string | null } | null }
const toAdminOrder = (o: any): AdminOrderRow => ({
  id: o.id, product: o.product_name, denomination: o.denomination_label, quantity: o.quantity, totalPaisa: o.total_paisa, status: o.status, source: o.source, refundNote: o.refund_note,
  createdAt: o.created_at, isTest: o.is_test, clientRef: o.client_ref?.replace(/^(api|dash|test)-/, "") ?? null,
  customer: o.customer_email ? { email: o.customer_email, name: o.customer_name, phone: o.customer_phone } : null,
})
const PAGE_SIZE_ADMIN = 10

async function signProofs(rows: any[]): Promise<Map<string, string>> {
  const paths = rows.map((r) => r.proof_path).filter(Boolean)
  if (!paths.length) return new Map()
  const { data } = await merchantDb().storage.from("merchant-kyc").createSignedUrls(paths, 300)
  return new Map((data || []).map((s: any) => [s.path, s.signedUrl]))
}
const toTopup = (t: any, urls: Map<string, string>): AdminTopup => ({
  id: t.id, merchantId: t.merchant_id, businessName: t.merchants?.business_name, amountPaisa: t.amount_paisa, method: t.method, provider: t.provider, reference: t.reference, bankTxnId: t.bank_txn_id,
  proofUrl: t.proof_path ? urls.get(t.proof_path) || null : null, status: t.status, adminNote: t.admin_note, createdAt: t.created_at,
})

/** Top-ups, statement and orders for one merchant (receipt links valid 5 minutes). */
export async function getMerchantTopupsAction(merchantId: string, page = 1): Promise<{ success: true; topups: AdminTopup[]; total: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const from = (Math.max(1, page) - 1) * PAGE_SIZE_ADMIN
  const { data, count } = await merchantDb().from("merchant_topups").select("*", { count: "exact" }).eq("merchant_id", merchantId).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE_ADMIN - 1)
  const urls = await signProofs(data || [])
  return { success: true, topups: (data || []).map((t: any) => toTopup(t, urls)), total: count || 0 }
}

export async function listMerchantLedgerAdminAction(merchantId: string, page = 1): Promise<{ success: true; rows: AdminLedgerRow[]; total: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const from = (Math.max(1, page) - 1) * PAGE_SIZE_ADMIN
  const { data, count } = await merchantDb().from("merchant_wallet_ledger").select("*", { count: "exact" }).eq("merchant_id", merchantId).order("id", { ascending: false }).range(from, from + PAGE_SIZE_ADMIN - 1)
  return { success: true, total: count || 0, rows: (data || []).map((l: any) => ({ id: l.id, amountPaisa: l.amount_paisa, balanceAfterPaisa: l.balance_after_paisa, kind: l.kind, reference: l.reference, note: l.note, createdAt: l.created_at })) }
}

/** Orders with end-customer details. q matches product, customer email/name, order id or reference. */
export async function listMerchantOrdersAdminAction(merchantId: string, page = 1, q = "", includeTest = false): Promise<{ success: true; rows: AdminOrderRow[]; total: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const from = (Math.max(1, page) - 1) * PAGE_SIZE_ADMIN
  let query = merchantDb().from("merchant_orders").select("*", { count: "exact" }).eq("merchant_id", merchantId)
  if (!includeTest) query = query.eq("is_test", false)
  const needle = String(q || "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80)
  if (needle) query = query.or(`product_name.ilike.%${needle}%,customer_email.ilike.%${needle}%,customer_name.ilike.%${needle}%,client_ref.ilike.%${needle}%`)
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE_ADMIN - 1)
  if (error) return { success: false, error: error.message }
  return { success: true, rows: (data || []).map(toAdminOrder), total: count || 0 }
}

/** Every pending top-up across merchants, oldest first. */
export async function listPendingTopupsAction(): Promise<{ success: true; data: AdminTopup[] } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const { data, error } = await merchantDb().from("merchant_topups").select("*, merchants(business_name)").eq("status", "pending").order("created_at").limit(200)
  if (error) return { success: false, error: error.message }
  const urls = await signProofs(data || [])
  return { success: true, data: (data || []).map((t: any) => toTopup(t, urls)) }
}

export async function reviewTopupAction(topupId: string, decision: "approved" | "rejected", note: string): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const cleanNote = String(note || "").trim().slice(0, 500)
  if (decision === "rejected" && cleanNote.length < 3) return { success: false, error: "Tell the merchant why it was rejected." }
  const db = merchantDb()
  const { data: t } = await db.from("merchant_topups").select("id, merchant_id, amount_paisa, reference, status, merchants(email)").eq("id", topupId).maybeSingle()
  if (!t || t.status !== "pending") return { success: false, error: "This top-up was already reviewed." }

  if (decision === "approved") {
    const { error } = await db.rpc("merchant_approve_topup", { p_topup_id: topupId, p_actor: admin.id, p_note: cleanNote || null })
    if (error) return { success: false, error: /NOT_PENDING/.test(error.message) ? "This top-up was already reviewed." : "Could not credit the wallet." }
  } else {
    const { data: done } = await db.from("merchant_topups").update({ status: "rejected", admin_note: cleanNote, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", topupId).eq("status", "pending").select("id").maybeSingle()
    if (!done) return { success: false, error: "This top-up was already reviewed." }
  }
  await audit({ actorType: "admin", actorId: admin.id, merchantId: t.merchant_id, action: `topup.${decision}`, details: { topupId, amountPaisa: t.amount_paisa, note: cleanNote } })
  if (decision === "approved") {
    await emitWebhook(t.merchant_id, "wallet.credited", { reference: t.reference, amount: t.amount_paisa / 100, method: "manual", currency: "NPR" })
    await checkLowBalance(t.merchant_id)
  }
  const to = t.merchants?.email
  if (to) {
    const approved = decision === "approved"
    await sendMerchantEmail({
      to,
      subject: approved ? `${npr(t.amount_paisa)} added to your wallet` : "Your wallet top-up was not approved",
      heading: approved ? "Wallet topped up" : "Top-up not approved",
      paragraphs: approved
        ? [`We received your payment (reference ${t.reference}) and added ${npr(t.amount_paisa)} to your Byiora merchant wallet.`]
        : [`We could not approve your top-up of ${npr(t.amount_paisa)} (reference ${t.reference}).`, cleanNote],
      cta: { label: "Open your wallet", url: `${MERCHANT_PORTAL_URL}/login` },
    }).catch(() => null)
  }
  return { success: true }
}

/** Manual credit (positive) or debit (negative), e.g. a bank deposit you received directly. */
export async function adjustMerchantWalletAction(merchantId: string, amountRupees: number, note: string): Promise<{ success: boolean; error?: string; balancePaisa?: number }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const amount = Math.round(Number(amountRupees) * 100)
  const cleanNote = String(note || "").trim().slice(0, 300)
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000) return { success: false, error: "Enter a non-zero amount." }
  if (cleanNote.length < 3) return { success: false, error: "Add a note explaining the adjustment." }
  const { data, error } = await merchantDb().rpc("merchant_wallet_apply", { p_merchant_id: merchantId, p_amount: amount, p_kind: "adjustment", p_reference: null, p_note: cleanNote, p_actor: admin.id })
  if (error) return { success: false, error: /check|credit/i.test(error.message) ? "That would take the balance below the merchant's credit limit." : "Could not adjust the wallet." }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "wallet.adjusted", details: { amountPaisa: amount, note: cleanNote } })
  if (amount > 0) await emitWebhook(merchantId, "wallet.credited", { amount: amount / 100, method: "adjustment", note: cleanNote, balance: Number(data) / 100, currency: "NPR" })
  await checkLowBalance(merchantId)
  return { success: true, balancePaisa: Number(data) }
}

export type MerchantTermsInput = {
  discountPercent: number
  rateLimitPerMin: number
  creditLimitRupees: number
  perOrderRupees: number | null
  dailyRupees: number | null
  monthlyRupees: number | null
}

/** Pricing default, API rate, credit limit and spend limits (empty limit = no limit). */
export async function updateMerchantTermsAction(merchantId: string, t: MerchantTermsInput): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const discount = Math.round(Number(t.discountPercent) * 100) / 100
  const rate = Math.floor(Number(t.rateLimitPerMin))
  const credit = Math.round(Number(t.creditLimitRupees || 0) * 100)
  const lim = (v: number | null) => (v == null || (v as any) === "" ? null : Math.round(Number(v) * 100))
  const perOrder = lim(t.perOrderRupees), daily = lim(t.dailyRupees), monthly = lim(t.monthlyRupees)
  if (!(discount >= 0 && discount <= 90)) return { success: false, error: "Discount must be between 0% and 90%." }
  if (!(rate >= 1 && rate <= 1000)) return { success: false, error: "API limit must be between 1 and 1000 requests per minute." }
  if (!(credit >= 0 && credit <= 10_000_000_000)) return { success: false, error: "Credit limit must be zero or more." }
  for (const v of [perOrder, daily, monthly]) if (v != null && !(v > 0)) return { success: false, error: "Spend limits must be above zero (or empty for no limit)." }
  const { error } = await merchantDb()
    .from("merchants")
    .update({ discount_percent: discount, api_rate_limit_per_min: rate, credit_limit_paisa: credit, limit_per_order_paisa: perOrder, limit_daily_paisa: daily, limit_monthly_paisa: monthly, updated_at: new Date().toISOString() })
    .eq("id", merchantId)
  if (error) return { success: false, error: /credit/i.test(error.message) ? "The merchant already uses more credit than that. Raise the limit or top up their wallet first." : error.message }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "merchant.terms_updated", details: { discount, rate, credit, perOrder, daily, monthly } })
  await checkLowBalance(merchantId)
  return { success: true }
}

/** Refund an order back to the wallet (e.g. a code that didn't work). Codes are not returned to stock. */
export async function refundMerchantOrderAction(orderId: string, note: string): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const cleanNote = String(note || "").trim().slice(0, 300)
  if (cleanNote.length < 3) return { success: false, error: "Add a reason for the refund." }
  const db = merchantDb()
  const { data: o } = await db.from("merchant_orders").select("merchant_id, total_paisa, product_name, merchants(email)").eq("id", orderId).maybeSingle()
  if (!o) return { success: false, error: "Order not found." }
  const { error } = await db.rpc("merchant_refund_order", { p_order_id: orderId, p_actor: admin.id, p_note: cleanNote })
  if (error) return { success: false, error: /REFUNDABLE/.test(error.message) ? "This order was already refunded." : "Could not refund the order." }
  await audit({ actorType: "admin", actorId: admin.id, merchantId: o.merchant_id, action: "order.refunded", details: { orderId, totalPaisa: o.total_paisa, note: cleanNote } })
  const { data: refunded } = await db.from("merchant_orders").select("*").eq("id", orderId).single()
  if (refunded) await emitWebhook(o.merchant_id, "order.refunded", await orderPayload(refunded))
  await checkLowBalance(o.merchant_id)
  if (o.merchants?.email) {
    await sendMerchantEmail({
      to: o.merchants.email,
      subject: `${npr(o.total_paisa)} refunded to your wallet`,
      heading: "Order refunded",
      paragraphs: [`Your order for ${o.product_name} was refunded and ${npr(o.total_paisa)} is back in your wallet.`, `Reason: ${cleanNote}`],
    }).catch(() => null)
  }
  return { success: true }
}

// ── Pending (backordered) orders ─────────────────────────────────────────

/** API orders accepted while out of stock, oldest first, across every merchant. */
export async function listPendingMerchantOrdersAction(): Promise<{ success: true; rows: (AdminOrderRow & { merchantId: string; businessName: string })[] } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const { data, error } = await merchantDb().from("merchant_orders").select("*, merchants(business_name)").eq("status", "pending").order("created_at").limit(200)
  if (error) return { success: false, error: error.message }
  return { success: true, rows: (data || []).map((o: any) => ({ ...toAdminOrder(o), merchantId: o.merchant_id, businessName: o.merchants?.business_name || "" })) }
}

/** Fills a pending order with codes typed in (one per line), or from stock when codesRaw is null. */
export async function fulfilMerchantOrderAction(orderId: string, codesRaw: string | null): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const { data: o } = await db.from("merchant_orders").select("id, merchant_id, quantity, status, product_name, denomination_label").eq("id", orderId).maybeSingle()
  if (!o || o.status !== "pending") return { success: false, error: "This order is no longer waiting for codes." }

  let payload: { encrypted_code: string; code_hash: string }[] | null = null
  if (codesRaw !== null) {
    const codes = String(codesRaw).split(/\r?\n/).map((c) => c.trim()).filter(Boolean)
    if (new Set(codes).size !== codes.length) return { success: false, error: "The same code is listed twice." }
    if (codes.length !== o.quantity) return { success: false, error: `This order needs exactly ${o.quantity} code${o.quantity === 1 ? "" : "s"}; you entered ${codes.length}.` }
    payload = []
    for (const c of codes) {
      const enc = await encryptInventoryCode(c)
      if (!enc.success || !enc.encryptedBlob || !enc.codeHash) return { success: false, error: "Could not encrypt the codes." }
      payload.push({ encrypted_code: enc.encryptedBlob, code_hash: enc.codeHash })
    }
  }
  const { data: err, error } = await db.rpc("merchant_fulfil_order", { p_order_id: orderId, p_codes: payload, p_actor: admin.id })
  if (error) return { success: false, error: error.code === "23505" ? "One of these codes is already in inventory or was delivered before." : "Could not fill the order." }
  if (err === "NOT_PENDING") return { success: false, error: "This order is no longer waiting for codes." }
  if (err === "OUT_OF_STOCK") return { success: false, error: `Not enough ${o.product_name} · ${o.denomination_label} codes in stock. Add stock or type the codes in.` }
  if (err) return { success: false, error: "Could not fill the order." }

  await audit({ actorType: "admin", actorId: admin.id, merchantId: o.merchant_id, action: "order.fulfilled", details: { orderId, from: payload ? "typed" : "stock" } })
  const { data: done } = await db.from("merchant_orders").select("*").eq("id", orderId).single()
  if (done) await emitWebhook(o.merchant_id, "order.completed", await orderPayload(done))
  return { success: true }
}

// ── Merchant detail ──────────────────────────────────────────────────────

/** One merchant row (same shape as the list) for the detail page. */
export async function getMerchantDetailAction(merchantId: string): Promise<{ success: true; data: MerchantListRow & { catalog_mode: "all" | "selected"; last_active_at: string | null } } | { success: false; error: string }> {
  const res = await listMerchantsAction()
  if (!res.success) return res
  const row = res.data.find((m) => m.id === merchantId)
  if (!row) return { success: false, error: "Merchant not found" }
  const [{ data }, seen] = await Promise.all([
    merchantDb().from("merchants").select("catalog_mode").eq("id", merchantId).single(),
    getPostHogLastActive().catch(() => new Map<string, string>()),
  ])
  // PostHog activity in the merchant portal; falls back to the last sign-in time.
  const candidates = [seen.get(row.email), row.last_login_at].filter(Boolean) as string[]
  const last = candidates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
  return { success: true, data: { ...row, catalog_mode: data?.catalog_mode || "all", last_active_at: last } }
}

export async function getMerchantRevenueReportAction(merchantId: string | null, fromIso: string, toIso: string, bucket: "day" | "week" | "month", tz?: string): Promise<RevenueReport | null> {
  if (!(await superAdmin())) return null
  return loadRevenueReport(merchantId, fromIso, toIso, bucket, tz)
}

// ── Wallet top-up switches ───────────────────────────────────────────────

export async function getTopupSettingsAction(): Promise<TopupSettings | null> {
  if (!(await superAdmin())) return null
  return getTopupSettings()
}

export async function updateTopupSettingsAction(input: Partial<TopupSettings>): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const patch: Record<string, unknown> = {}
  for (const k of ["fonepay_topup_enabled", "manual_topup_enabled"] as const) if (typeof input[k] === "boolean") patch[k] = input[k]
  for (const k of ["fonepay_topup_min_rupees", "fonepay_topup_max_rupees"] as const) {
    if (input[k] == null) continue
    const n = Math.floor(Number(input[k]))
    if (!(n >= 10 && n <= 10_000_000)) return { success: false, error: "Amounts must be between Rs. 10 and Rs. 1,00,00,000." }
    patch[k] = n
  }
  if (!Object.keys(patch).length) return { success: true }
  const { error } = await merchantDb().from("merchant_settings").update({ ...patch, updated_by: admin.id, updated_at: new Date().toISOString() }).eq("id", true)
  if (error) return { success: false, error: /check/i.test(error.message) ? "Maximum must be at least the minimum." : error.message }
  await audit({ actorType: "admin", actorId: admin.id, action: "settings.topups_updated", details: patch })
  await notifyAllMerchants("settings.topups_updated")
  return { success: true }
}

async function notifyAllMerchants(event: string) {
  const { data } = await merchantDb().from("merchants").select("id").neq("status", "banned")
  await broadcast((data || []).map((m: any) => ({ topic: merchantTopic(m.id), event })))
}

// ── Products shown to merchants (global) ─────────────────────────────────

export type CatalogProductRow = { id: string; name: string; category: string; logo: string | null; denominations: number; enabled: boolean }

export async function getMerchantCatalogAdminAction(): Promise<{ success: true; data: CatalogProductRow[] } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const [{ data: products }, { data: catalog }] = await Promise.all([
    db.from("products").select("id, name, category, logo, denominations").eq("is_active", true).in("category", MERCHANT_CATEGORIES as unknown as string[]).order("name"),
    db.from("merchant_catalog").select("product_id, enabled"),
  ])
  const on = new Map((catalog || []).map((c: any) => [c.product_id, c.enabled]))
  return {
    success: true,
    data: (products || []).map((p: any) => ({ id: p.id, name: p.name, category: p.category, logo: p.logo || null, denominations: Array.isArray(p.denominations) ? p.denominations.length : 0, enabled: on.get(p.id) === true })),
  }
}

export async function setMerchantCatalogAction(productIds: string[], enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const requested = [...new Set((productIds || []).map(String))].slice(0, 1000)
  if (!requested.length) return { success: true }
  // Only games and digital goods can be offered to merchants.
  const { data: allowed } = await merchantDb().from("products").select("id").in("id", requested).in("category", MERCHANT_CATEGORIES as unknown as string[])
  const ids: string[] = (allowed || []).map((p: any) => p.id)
  if (!ids.length) return { success: false, error: "Only Games and Digital Goods can be sold through merchants." }
  const now = new Date().toISOString()
  const { error } = await merchantDb().from("merchant_catalog").upsert(ids.map((id: string) => ({ product_id: id, enabled: !!enabled, updated_by: admin.id, updated_at: now })))
  if (error) return { success: false, error: error.message }
  await audit({ actorType: "admin", actorId: admin.id, action: enabled ? "catalog.enabled" : "catalog.disabled", details: { productIds: ids } })
  await notifyAllMerchants("catalog.updated")
  return { success: true }
}

// ── Per-merchant products and prices ─────────────────────────────────────

export async function getMerchantPriceBookAction(merchantId: string): Promise<{ success: true; lines: PriceBookLine[]; catalogMode: "all" | "selected"; discountPercent: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const { data: m } = await merchantDb().from("merchants").select("*").eq("id", merchantId).maybeSingle()
  if (!m) return { success: false, error: "Merchant not found" }
  const merchant = { ...m, discount_percent: Number(m.discount_percent) } as Merchant
  return { success: true, lines: await loadPriceBook(merchant), catalogMode: merchant.catalog_mode, discountPercent: merchant.discount_percent }
}

export type RuleInput = { productId: string; label: string; visible: boolean | null; discountPercent: number | null; fixedPriceRupees: number | null }

/** Upserts rules; a rule with nothing set is deleted (falls back to defaults). */
export async function saveMerchantPriceRulesAction(merchantId: string, rules: RuleInput[]): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  if (!Array.isArray(rules) || !rules.length) return { success: true }
  if (rules.length > 2000) return { success: false, error: "Too many changes at once." }

  const upserts: any[] = []
  const deletes: { productId: string; label: string }[] = []
  const now = new Date().toISOString()
  for (const r of rules) {
    const productId = String(r.productId || "")
    const label = String(r.label ?? "")
    if (!productId) return { success: false, error: "Invalid product." }
    const visible = typeof r.visible === "boolean" ? r.visible : null
    const discount = r.discountPercent == null || (r.discountPercent as any) === "" ? null : Math.round(Number(r.discountPercent) * 100) / 100
    const fixed = r.fixedPriceRupees == null || (r.fixedPriceRupees as any) === "" ? null : Math.round(Number(r.fixedPriceRupees) * 100)
    if (discount != null && !(discount >= 0 && discount <= 90)) return { success: false, error: "Discounts must be between 0% and 90%." }
    if (fixed != null && !(fixed > 0)) return { success: false, error: "Fixed prices must be above zero." }
    if (fixed != null && !label) return { success: false, error: "Fixed prices are set per amount, not per product." }
    if (visible == null && discount == null && fixed == null) deletes.push({ productId, label })
    else upserts.push({ merchant_id: merchantId, product_id: productId, denomination_label: label, visible, discount_percent: discount, fixed_price_paisa: fixed, updated_by: admin.id, updated_at: now })
  }

  const db = merchantDb()
  if (upserts.length) {
    const { error } = await db.from("merchant_price_rules").upsert(upserts)
    if (error) return { success: false, error: error.message }
  }
  for (const d of deletes) await db.from("merchant_price_rules").delete().eq("merchant_id", merchantId).eq("product_id", d.productId).eq("denomination_label", d.label)
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "pricing.updated", details: { changed: upserts.length, cleared: deletes.length } })
  return { success: true }
}

export async function setMerchantCatalogModeAction(merchantId: string, mode: "all" | "selected"): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  if (!["all", "selected"].includes(mode)) return { success: false, error: "Invalid mode" }
  const { error } = await merchantDb().from("merchants").update({ catalog_mode: mode, updated_at: new Date().toISOString() }).eq("id", merchantId)
  if (error) return { success: false, error: error.message }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "pricing.catalog_mode", details: { mode } })
  return { success: true }
}

// ── Per-merchant inventory ───────────────────────────────────────────────

export type MerchantInventoryView = {
  useGlobal: boolean
  manualDelivery: boolean
  rows: { productId: string; productName: string; label: string; available: number; delivered: number }[]
  products: { id: string; name: string; labels: string[] }[]
}

export async function getMerchantInventoryAction(merchantId: string): Promise<{ success: true; data: MerchantInventoryView } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const db = merchantDb()
  const [{ data: m }, { data: counts }, { data: products }] = await Promise.all([
    db.from("merchants").select("use_global_inventory, manual_delivery").eq("id", merchantId).maybeSingle(),
    db.rpc("merchant_inventory_counts", { p_merchant_id: merchantId }),
    db.from("products").select("id, name, denominations").eq("is_active", true).in("category", MERCHANT_CATEGORIES as unknown as string[]).order("name"),
  ])
  if (!m) return { success: false, error: "Merchant not found" }
  const nameOf = new Map((products || []).map((p: any) => [p.id, p.name]))
  return {
    success: true,
    data: {
      useGlobal: m.use_global_inventory,
      manualDelivery: m.manual_delivery,
      rows: (counts || []).map((c: any) => ({ productId: c.product_id, productName: nameOf.get(c.product_id) || c.product_id, label: c.denomination_label, available: Number(c.available), delivered: Number(c.delivered) })),
      products: (products || []).map((p: any) => ({ id: p.id, name: p.name, labels: (Array.isArray(p.denominations) ? p.denominations : []).map((d: any) => String(d?.label || "")).filter(Boolean) })),
    },
  }
}

/** Adds codes that only this merchant can buy (one per line). */
export async function addMerchantInventoryCodesAction(merchantId: string, productId: string, label: string, codesRaw: string): Promise<{ success: boolean; error?: string; added?: number; duplicates?: number; failed?: number; filled?: number }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const codes = [...new Set(String(codesRaw || "").split(/\r?\n/).map((c) => c.trim()).filter(Boolean))]
  if (!codes.length) return { success: false, error: "Paste at least one code." }
  if (codes.length > 500) return { success: false, error: "Up to 500 codes at a time." }
  const db = merchantDb()
  const { data: product } = await db.from("products").select("denominations").eq("id", productId).maybeSingle()
  if (!product || !(product.denominations || []).some((d: any) => d?.label === label)) return { success: false, error: "Pick a valid product and amount." }
  let added = 0, duplicates = 0, failed = 0
  for (const code of codes) {
    const enc = await encryptInventoryCode(code)
    if (!enc.success || !enc.encryptedBlob || !enc.codeHash) { failed++; continue }
    const { error } = await db.from("gift_card_inventory").insert({ product_id: productId, denomination_label: label, encrypted_code: enc.encryptedBlob, code_hash: enc.codeHash, added_by: admin.id, merchant_id: merchantId })
    if (!error) added++
    else if (error.code === "23505") duplicates++
    else failed++
  }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: "inventory.added", details: { productId, label, added, duplicates, failed } })
  const filled = added ? await fillPendingFromStock(productId, label, merchantId).catch(() => 0) : 0
  return { success: true, added, duplicates, failed, filled }
}

/** On: out-of-stock API orders are accepted and wait in Pending orders. Off: they fail with OUT_OF_STOCK. */
export async function setMerchantManualDeliveryAction(merchantId: string, on: boolean): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const { error } = await merchantDb().from("merchants").update({ manual_delivery: !!on, updated_at: new Date().toISOString() }).eq("id", merchantId)
  if (error) return { success: false, error: error.message }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: on ? "delivery.manual_on" : "delivery.manual_off" })
  return { success: true }
}

export async function setMerchantGlobalInventoryAction(merchantId: string, useGlobal: boolean): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const { error } = await merchantDb().from("merchants").update({ use_global_inventory: !!useGlobal, updated_at: new Date().toISOString() }).eq("id", merchantId)
  if (error) return { success: false, error: error.message }
  await audit({ actorType: "admin", actorId: admin.id, merchantId, action: useGlobal ? "inventory.global_on" : "inventory.global_off" })
  return { success: true }
}

// ── Activity log and statements ──────────────────────────────────────────

export type AuditRow = { id: number; actorType: string; action: string; details: Record<string, unknown>; ip: string | null; createdAt: string }

export async function listMerchantAuditAction(merchantId: string, page = 1): Promise<{ success: true; rows: AuditRow[]; total: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const from = (Math.max(1, page) - 1) * PAGE_SIZE_ADMIN
  const { data, count } = await merchantDb().from("audit_log").select("id, actor_type, action, details, ip, created_at", { count: "exact" }).eq("merchant_id", merchantId).order("id", { ascending: false }).range(from, from + PAGE_SIZE_ADMIN - 1)
  return { success: true, total: count || 0, rows: (data || []).map((r: any) => ({ id: r.id, actorType: r.actor_type, action: r.action, details: r.details || {}, ip: r.ip, createdAt: r.created_at })) }
}

export async function getMerchantStatementAdminAction(merchantId: string, month: string, tz?: string): Promise<MonthlyStatement | null> {
  if (!(await superAdmin())) return null
  return loadMonthlyStatement(merchantId, month, tz)
}
