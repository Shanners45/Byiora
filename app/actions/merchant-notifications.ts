"use server"

import { getAdminSessionAction } from "./admin-utils"
import { audit, merchantDb, requireMerchant } from "@/lib/merchant/server"
import { broadcast, merchantTopic } from "@/lib/realtime/broadcast"
import { sendMerchantEmail, MERCHANT_PORTAL_URL } from "@/lib/email/resend"

export type NotificationRow = { id: string; title: string; body: string; createdAt: string; toAll: boolean; unread: boolean }
export type SentNotificationRow = { id: string; title: string; body: string; createdAt: string; emailed: boolean; to: string | null }

const PAGE = 10
const toRow = (n: any, seenAt: string | null): NotificationRow => ({
  id: n.id, title: n.title, body: n.body, createdAt: n.created_at, toAll: !n.merchant_id, unread: !seenAt || n.created_at > seenAt,
})

// ── Merchant side ────────────────────────────────────────────────────────

/** This merchant's messages (their own + broadcasts sent since they joined), newest first. */
export async function listMyNotificationsAction(page = 1): Promise<{ rows: NotificationRow[]; total: number } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const m = ctx.merchant
  const from = (Math.max(1, page) - 1) * PAGE
  const { data, count } = await merchantDb()
    .from("merchant_notifications")
    .select("id, merchant_id, title, body, created_at", { count: "exact" })
    .or(`merchant_id.is.null,merchant_id.eq.${m.id}`)
    .gte("created_at", m.created_at)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE - 1)
  return { rows: (data || []).map((n: any) => toRow(n, m.notifications_seen_at)), total: count || 0 }
}

export async function markNotificationsSeenAction(): Promise<void> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return
  await merchantDb().from("merchants").update({ notifications_seen_at: new Date().toISOString() }).eq("id", ctx.merchant.id)
}

// ── Admin side ───────────────────────────────────────────────────────────

async function superAdmin() {
  const s = await getAdminSessionAction()
  return s.success && s.data.role === "admin" ? s.data : null
}

/** merchantId null = every merchant. Optionally also emails it. */
export async function sendMerchantNotificationAction(input: { merchantId: string | null; title: string; body: string; email: boolean }): Promise<{ success: boolean; error?: string; recipients?: number }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const title = String(input.title || "").trim().slice(0, 120)
  const body = String(input.body || "").trim().slice(0, 2000)
  if (title.length < 3) return { success: false, error: "Add a title (at least 3 characters)." }
  if (body.length < 3) return { success: false, error: "Write the message." }
  const db = merchantDb()

  let q = db.from("merchants").select("id, email, business_name").neq("status", "banned")
  if (input.merchantId) q = q.eq("id", input.merchantId)
  const { data: targets } = await q
  if (!targets?.length) return { success: false, error: input.merchantId ? "Merchant not found." : "There are no merchants yet." }

  const { error } = await db.from("merchant_notifications").insert({ merchant_id: input.merchantId || null, title, body, emailed: !!input.email, created_by: admin.id })
  if (error) return { success: false, error: "Could not send the notification." }

  // Live bell update in every open portal.
  await broadcast(targets.map((t: any) => ({ topic: merchantTopic(t.id), event: "notification" })))
  if (input.email) {
    // shortcut: one email at a time with a short gap (Resend free plan allows ~2/s); move to Resend batch sends past a few hundred merchants.
    for (const t of targets) {
      await sendMerchantEmail({ to: t.email, subject: title, heading: title, paragraphs: body.split(/\n{2,}/), cta: { label: "Open the merchant portal", url: `${MERCHANT_PORTAL_URL}/dashboard` } }).catch(() => null)
      if (targets.length > 1) await new Promise((r) => setTimeout(r, 600))
    }
  }
  await audit({ actorType: "admin", actorId: admin.id, merchantId: input.merchantId || null, action: "notification.sent", details: { title, toAll: !input.merchantId, email: !!input.email, recipients: targets.length } })
  return { success: true, recipients: targets.length }
}

/** q matches the title or message; merchantId narrows to messages sent to that merchant (broadcasts excluded). */
export async function listSentNotificationsAction(page = 1, q = "", merchantId: string | null = null): Promise<{ success: true; rows: SentNotificationRow[]; total: number } | { success: false; error: string }> {
  if (!(await superAdmin())) return { success: false, error: "Unauthorized" }
  const from = (Math.max(1, page) - 1) * PAGE
  let query = merchantDb().from("merchant_notifications").select("id, title, body, created_at, emailed, merchants(business_name)", { count: "exact" })
  const needle = String(q || "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80)
  if (needle) query = query.or(`title.ilike.%${needle}%,body.ilike.%${needle}%`)
  if (merchantId) query = query.eq("merchant_id", merchantId)
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE - 1)
  if (error) return { success: false, error: error.message }
  return { success: true, total: count || 0, rows: (data || []).map((n: any) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.created_at, emailed: n.emailed, to: n.merchants?.business_name ?? null })) }
}

/** Removes a message from merchants' portals (emails already sent can't be recalled). */
export async function deleteNotificationAction(id: string): Promise<{ success: boolean; error?: string }> {
  const admin = await superAdmin()
  if (!admin) return { success: false, error: "Unauthorized" }
  const { data, error } = await merchantDb().from("merchant_notifications").delete().eq("id", id).select("merchant_id, title").maybeSingle()
  if (error || !data) return { success: false, error: "Could not delete it." }
  await audit({ actorType: "admin", actorId: admin.id, merchantId: data.merchant_id, action: "notification.deleted", details: { title: data.title } })
  return { success: true }
}
