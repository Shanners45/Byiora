"use server"

import { rateLimit } from "@/lib/rate-limit"
import { audit, merchantDb, requireMerchant } from "@/lib/merchant/server"
import { getAdminSessionAction } from "./admin-utils"
import { sendMerchantEmail, MERCHANT_PORTAL_URL } from "@/lib/email/resend"
import { alertStaff } from "@/lib/merchant/alerts"
import { TICKET_CATEGORIES, toTicketRow, type TicketMessage, type TicketRow } from "@/lib/merchant/support"

const fail = (error: string) => ({ success: false as const, error })
const PAGE = 10
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
const toMessage = (m: any): TicketMessage => ({ id: m.id, authorType: m.author_type, body: m.body, createdAt: m.created_at })

// ── Merchant side ────────────────────────────────────────────────────────

export async function listMyTicketsAction(page = 1, status: "active" | "all" = "all"): Promise<{ rows: TicketRow[]; total: number; openCount: number } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const db = merchantDb()
  const from = (Math.max(1, Math.floor(page)) - 1) * PAGE
  let q = db.from("merchant_tickets").select("*", { count: "exact" }).eq("merchant_id", ctx.merchant.id)
  if (status === "active") q = q.in("status", ["open", "awaiting_merchant"])
  const [{ data, count }, { count: openCount }] = await Promise.all([
    q.order("last_message_at", { ascending: false }).range(from, from + PAGE - 1),
    db.from("merchant_tickets").select("id", { count: "exact", head: true }).eq("merchant_id", ctx.merchant.id).in("status", ["open", "awaiting_merchant"]),
  ])
  return { rows: (data || []).map(toTicketRow), total: count || 0, openCount: openCount || 0 }
}

export async function getMyTicketAction(id: string): Promise<{ ticket: TicketRow; messages: TicketMessage[] } | null> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return null
  const db = merchantDb()
  const { data: t } = await db.from("merchant_tickets").select("*").eq("id", id).eq("merchant_id", ctx.merchant.id).maybeSingle()
  if (!t) return null
  const { data: msgs } = await db.from("merchant_ticket_messages").select("*").eq("ticket_id", t.id).order("id").limit(500)
  return { ticket: toTicketRow(t), messages: (msgs || []).map(toMessage) }
}

export async function createTicketAction(input: { category: string; subject: string; orderRef?: string; body: string }): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const m = ctx.merchant
  if (!(input.category in TICKET_CATEGORIES)) return fail("Choose what this is about.")
  const subject = clean(input.subject, 150)
  const body = clean(input.body, 5000)
  const orderRef = clean(input.orderRef, 100) || null
  if (subject.length < 3) return fail("Add a short subject.")
  if (body.length < 10) return fail("Describe the problem in a few words (at least 10 characters).")
  if (!(await rateLimit(`merchant-ticket:${m.id}`, { windowMs: 3_600_000, max: 10 })).ok) return fail("You've opened many tickets in the last hour. Add to an existing one instead.")

  const db = merchantDb()
  const { data: t, error } = await db
    .from("merchant_tickets")
    .insert({ merchant_id: m.id, category: input.category, subject, order_ref: orderRef, priority: input.category === "order" || input.category === "refund" ? "high" : "normal" })
    .select("id, number")
    .single()
  if (error || !t) return fail("Could not open the ticket.")
  await db.from("merchant_ticket_messages").insert({ ticket_id: t.id, author_type: "merchant", author_id: m.user_id, body })
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "support.opened", details: { ticket: t.number, category: input.category } })
  await alertStaff(`🎫 Merchant ticket #${t.number}`, [
    { name: "Merchant", value: m.business_name, inline: true },
    { name: "Category", value: TICKET_CATEGORIES[input.category as keyof typeof TICKET_CATEGORIES], inline: true },
    { name: "Subject", value: subject, inline: false },
  ])
  await sendMerchantEmail({
    to: "support@byiora.com.np",
    subject: `[Merchant #${t.number}] ${subject}`,
    heading: `New merchant ticket #${t.number}`,
    paragraphs: [`${m.business_name} (${m.email}) opened a ticket: ${TICKET_CATEGORIES[input.category as keyof typeof TICKET_CATEGORIES]}.`, orderRef ? `Order reference: ${orderRef}` : "", body].filter(Boolean),
  }).catch(() => null)
  return { success: true, id: t.id }
}

export async function replyMyTicketAction(id: string, text: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const m = ctx.merchant
  const body = clean(text, 5000)
  if (!body) return fail("Write a message first.")
  if (!(await rateLimit(`merchant-ticket-reply:${m.id}`, { windowMs: 60_000, max: 20 })).ok) return fail("Slow down a little.")
  const db = merchantDb()
  const { data: t } = await db.from("merchant_tickets").select("id, number, status").eq("id", id).eq("merchant_id", m.id).maybeSingle()
  if (!t) return fail("Ticket not found.")
  if (t.status === "closed") return fail("This ticket is closed. Open a new one.")
  await db.from("merchant_ticket_messages").insert({ ticket_id: t.id, author_type: "merchant", author_id: m.user_id, body })
  // A merchant reply always puts the ticket back in our queue.
  await db.from("merchant_tickets").update({ status: "open", last_message_at: new Date().toISOString(), last_message_by: "merchant", updated_at: new Date().toISOString() }).eq("id", t.id)
  await audit({ actorType: "merchant", actorId: m.user_id, merchantId: m.id, action: "support.replied", details: { ticket: t.number } })
  return { success: true }
}

export async function resolveMyTicketAction(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requireMerchant("onboarded")
  if ("error" in ctx) return fail("Please sign in again.")
  const { data } = await merchantDb().from("merchant_tickets").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", id).eq("merchant_id", ctx.merchant.id).in("status", ["open", "awaiting_merchant"]).select("number").maybeSingle()
  if (!data) return fail("Ticket not found.")
  await audit({ actorType: "merchant", actorId: ctx.merchant.user_id, merchantId: ctx.merchant.id, action: "support.resolved", details: { ticket: data.number } })
  return { success: true }
}

// ── Admin side ───────────────────────────────────────────────────────────

async function superAdmin() {
  const s = await getAdminSessionAction()
  return s.success && s.data.role === "admin" ? s.data : null
}

export type SellerTickets = { merchantId: string; businessName: string; email: string; open: number; tickets: TicketRow[] }

/**
 * Tickets grouped by seller, most recently active sellers first, 10 sellers per page.
 * status: "active" = open + waiting for merchant.
 */
export async function listSupportBySellerAction(page = 1, status: "active" | "open" | "awaiting_merchant" | "resolved" | "closed" | "all" = "active", q = ""): Promise<{ sellers: SellerTickets[]; totalSellers: number; counts: Record<string, number> } | null> {
  if (!(await superAdmin())) return null
  const db = merchantDb()
  let query = db.from("merchant_tickets").select("*, merchants(business_name, email)").order("last_message_at", { ascending: false }).limit(2000)
  if (status === "active") query = query.in("status", ["open", "awaiting_merchant"])
  else if (status !== "all") query = query.eq("status", status)
  const [{ data }, { data: all }] = await Promise.all([query, db.from("merchant_tickets").select("status").limit(20000)])

  const needle = clean(q, 80).toLowerCase()
  const groups = new Map<string, SellerTickets>()
  for (const t of data || []) {
    const name = t.merchants?.business_name || "Unknown"
    if (needle && !`${name} ${t.merchants?.email || ""} ${t.subject} #${t.number} ${t.order_ref || ""}`.toLowerCase().includes(needle)) continue
    const g: SellerTickets = groups.get(t.merchant_id) || { merchantId: t.merchant_id, businessName: name, email: t.merchants?.email || "", open: 0, tickets: [] }
    g.tickets.push(toTicketRow(t))
    if (t.status === "open") g.open += 1
    groups.set(t.merchant_id, g)
  }
  const counts: Record<string, number> = { open: 0, awaiting_merchant: 0, resolved: 0, closed: 0 }
  for (const t of all || []) counts[t.status] = (counts[t.status] || 0) + 1
  const sellers = [...groups.values()]
  const from = (Math.max(1, Math.floor(page)) - 1) * PAGE
  return { sellers: sellers.slice(from, from + PAGE), totalSellers: sellers.length, counts }
}

export async function getTicketAdminAction(id: string): Promise<{ ticket: TicketRow & { email: string }; messages: TicketMessage[] } | null> {
  if (!(await superAdmin())) return null
  const db = merchantDb()
  const { data: t } = await db.from("merchant_tickets").select("*, merchants(business_name, email)").eq("id", id).maybeSingle()
  if (!t) return null
  const { data: msgs } = await db.from("merchant_ticket_messages").select("*").eq("ticket_id", t.id).order("id").limit(500)
  return { ticket: { ...toTicketRow(t), email: t.merchants?.email || "" }, messages: (msgs || []).map(toMessage) }
}

/** Reply as Byiora. By default the ticket then waits for the merchant. */
export async function replyTicketAdminAction(id: string, text: string, nextStatus: "awaiting_merchant" | "resolved" | "open" = "awaiting_merchant"): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await superAdmin()
  if (!admin) return fail("Unauthorized")
  const body = clean(text, 5000)
  if (!body) return fail("Write a reply first.")
  if (!["awaiting_merchant", "resolved", "open"].includes(nextStatus)) return fail("Invalid status.")
  const db = merchantDb()
  const { data: t } = await db.from("merchant_tickets").select("id, number, subject, merchant_id, merchants(email)").eq("id", id).maybeSingle()
  if (!t) return fail("Ticket not found.")
  await db.from("merchant_ticket_messages").insert({ ticket_id: t.id, author_type: "admin", author_id: admin.id, body })
  await db.from("merchant_tickets").update({ status: nextStatus, last_message_at: new Date().toISOString(), last_message_by: "admin", updated_at: new Date().toISOString() }).eq("id", t.id)
  await audit({ actorType: "admin", actorId: admin.id, merchantId: t.merchant_id, action: "support.answered", details: { ticket: t.number, status: nextStatus } })
  if (t.merchants?.email) {
    await sendMerchantEmail({
      to: t.merchants.email,
      subject: `Re: [#${t.number}] ${t.subject}`,
      heading: `Reply to your ticket #${t.number}`,
      paragraphs: [body, nextStatus === "resolved" ? "We've marked this ticket as resolved. Reply in the portal if you still need help." : "Reply in the merchant portal's Support page."],
      cta: { label: "Open Support", url: `${MERCHANT_PORTAL_URL}/dashboard/support` },
    }).catch(() => null)
  }
  return { success: true }
}

export async function updateTicketAdminAction(id: string, patch: { status?: string; priority?: string }): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await superAdmin()
  if (!admin) return fail("Unauthorized")
  const update: Record<string, string> = { updated_at: new Date().toISOString() }
  if (patch.status) {
    if (!["open", "awaiting_merchant", "resolved", "closed"].includes(patch.status)) return fail("Invalid status.")
    update.status = patch.status
  }
  if (patch.priority) {
    if (!["low", "normal", "high", "urgent"].includes(patch.priority)) return fail("Invalid priority.")
    update.priority = patch.priority
  }
  const { data } = await merchantDb().from("merchant_tickets").update(update).eq("id", id).select("number, merchant_id").maybeSingle()
  if (!data) return fail("Ticket not found.")
  await audit({ actorType: "admin", actorId: admin.id, merchantId: data.merchant_id, action: "support.updated", details: { ticket: data.number, ...patch } })
  return { success: true }
}
