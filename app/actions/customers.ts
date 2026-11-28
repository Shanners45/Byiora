"use server"

import crypto from "crypto"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getAdminSessionAction } from "./admin-utils"
import { banEntity, unbanEntity, getBannedEntities, cleanupExpiredBans, BannedEntity, PROTECTED_EMAIL_DOMAINS } from "@/lib/security/blacklist"
import { sendPasswordResetEmail, sendReviewRequestEmail } from "@/lib/email/resend"
import { rateLimit } from "@/lib/rate-limit"
import { getPostHogLastActive } from "@/lib/analytics/posthog-server"


export interface CustomerProfile {
  email: string
  name: string
  isRegistered: boolean
  isEmailVerified?: boolean
  isGoogleUser?: boolean
  provider?: string | null
  userId?: string | null
  totalOrders: number
  totalSpent: number
  successfulOrders: number
  failedOrders: number
  lastOrderDate?: string | null
  lastIp?: string | null
  lastDeviceId?: string | null
  lastSignInAt?: string | null
  lastActiveAt?: string | null // Server-recorded activity heartbeat
  isBanned: boolean
  banReason?: string | null
  banId?: string | null
  banVector?: "email" | "ip" | "device_id" | "domain"
  createdAt?: string
  posthogLastSeen?: string | null // PostHog-sourced "last active on site" timestamp
}

export type CustomerFilter = "all" | "registered" | "unverified" | "guest" | "banned" | "ban_related"
export interface CustomerCounts { all: number; registered: number; unverified: number; guest: number; banned: number }

/**
 * One page of the customer directory (registered users + guest buyers, grouped by email) with ban
 * status. Built, filtered and paged in the database (admin_customer_directory), so the admin page
 * loads only the customers it shows. "ban_related" lists every customer a ban refers to, for the
 * blacklist tab.
 */
export async function getCustomersOverviewAction(opts: {
  page?: number
  pageSize?: number
  search?: string
  filter?: CustomerFilter
} = {}): Promise<{
  success: boolean
  data?: CustomerProfile[]
  total?: number
  counts?: CustomerCounts
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  const FILTERS: CustomerFilter[] = ["all", "registered", "unverified", "guest", "banned", "ban_related"]
  const filter = FILTERS.includes(opts.filter as CustomerFilter) ? (opts.filter as CustomerFilter) : "all"
  const pageSize = Math.min(Math.max(Math.floor(Number(opts.pageSize) || 10), 1), 1000)
  const page = Math.max(Math.floor(Number(opts.page) || 1), 1)
  const search = String(opts.search || "").trim().slice(0, 200)

  try {
    // Proactively clean up any expired bans before listing
    await cleanupExpiredBans().catch(() => {})

    const supabase = createServiceRoleClient() as any
    const { data, error } = await supabase.rpc("admin_customer_directory", {
      p_search: search,
      p_filter: filter,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    if (error) {
      console.error("admin_customer_directory error:", error)
      return { success: false, error: error.message }
    }

    const rows: CustomerProfile[] = Array.isArray(data?.rows) ? data.rows : []

    // PostHog "last active on site", merged into just this page's customers.
    try {
      const posthogLastSeen = await getPostHogLastActive()
      for (const profile of rows) {
        const phTimestamp = posthogLastSeen.get(profile.email)
        if (!phTimestamp) continue
        // Keep whichever signal is more recent between the DB heartbeat and PostHog
        if (!profile.lastActiveAt || new Date(phTimestamp) > new Date(profile.lastActiveAt)) {
          profile.posthogLastSeen = phTimestamp
        }
      }
    } catch (phErr) {
      console.warn("[Customers] PostHog last-active merge failed (non-critical):", phErr)
    }

    return { success: true, data: rows, total: Number(data?.total) || 0, counts: data?.counts }
  } catch (err: any) {
    console.error("getCustomersOverviewAction error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Sends an official password reset link to a registered user from the admin panel.
 * Immediately logs out that user from every place, randomizes their current password,
 * and sends a 24-hour active password reset link to their email.
 */
export async function sendCustomerPasswordResetAction(email: string): Promise<{
  success: boolean
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success || session.data.role !== "admin") {
    return { success: false, error: "Unauthorized: Super admin access required" }
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    const supabase = createServiceRoleClient() as any

    // Administrator accounts must never be reset from the customer directory.
    const { data: adminTarget } = await supabase
      .from("admin_users")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle()
    if (adminTarget) {
      return { success: false, error: "Administrator accounts cannot be reset from the customer directory." }
    }

    // 1. Locate user ID in Supabase
    let targetUserId: string | null = null
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle()

    if (userRow?.id) {
      targetUserId = userRow.id
    } else {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const match = authData?.users?.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail)
      if (match?.id) targetUserId = match.id
    }

    if (!targetUserId) {
      return {
        success: false,
        error: "This customer ordered as a Guest and does not have a registered account password yet. They can sign up on the website.",
      }
    }

    // 2. LOGOUT that user from every place (revoke all active sessions and refresh tokens)
    try {
      await supabase.rpc("revoke_all_user_sessions", { target_user_id: targetUserId })
    } catch (rpcErr: any) {
      console.warn("[Reset Password Action] revoke_all_user_sessions RPC warning:", rpcErr.message)
    }

    // 3. CHANGE his current password to something random immediately
    const tempRandomPassword =
      crypto.randomBytes(24).toString("base64") + "!Aa9" + Math.floor(100 + Math.random() * 900)
    const { error: randomizePwError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: tempRandomPassword,
    })
    if (randomizePwError) {
      console.error("[Reset Password Action] Failed to randomize current password:", randomizePwError.message)
      return { success: false, error: "Failed to randomize current password: " + randomizePwError.message }
    }

    // 4. Generate high-entropy 24-hour active reset token
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Invalidate previous unconsumed reset tokens for this user
    await supabase.from("password_reset_tokens").delete().eq("user_id", targetUserId)

    const { error: tokenInsertErr } = await supabase.from("password_reset_tokens").insert({
      user_id: targetUserId,
      email: cleanEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })

    if (tokenInsertErr) {
      console.error("[Reset Password Action] Failed to store reset token:", tokenInsertErr.message)
      return { success: false, error: "Could not create password reset token: " + tokenInsertErr.message }
    }

    // 5. Build direct reset link (active for 24 hours)
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.byiora.com.np"
    const resetLink = `${origin}/en-np/reset-password?token=${rawToken}`

    // 6. Dispatch branded email via official Byiora email template
    const sendRes = await sendPasswordResetEmail({
      email: cleanEmail,
      resetLink,
    })

    if (sendRes.error) {
      console.error("[Customer Reset Password] Resend error:", sendRes.error)
      return { success: false, error: sendRes.error.message || "Failed to deliver reset email via Resend" }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Bans a user, IP, or email domain from the admin panel.
 */
export async function banCustomerAction({
  type,
  value,
  reason,
  durationHours,
}: {
  type: "email" | "ip" | "email_domain" | "device_id"
  value: string
  reason?: string
  durationHours?: number
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: false, error: "Only full administrators can manage blacklist rules" }

  return await banEntity({
    type,
    value,
    reason: reason || "Banned by administrator",
    bannedBy: session.data.email,
    durationHours,
  })
}

/**
 * Fetches all orders placed by a specific customer email (registered or guest).
 */
export async function getCustomerOrdersAction(email: string): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  const cleanEmail = email.trim().toLowerCase()
  try {
    const supabase = createServiceRoleClient() as any
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .ilike("user_email", cleanEmail)
      .order("created_at", { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Unbans an entity by its blacklist ID.
 */
export async function unbanCustomerAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: false, error: "Only full administrators can manage blacklist rules" }

  return await unbanEntity(id)
}

/**
 * Unbans a customer directly by email.
 */
export async function unbanCustomerByEmailAction(email: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: false, error: "Only full administrators can manage blacklist rules" }

  const cleanEmail = email.trim().toLowerCase()
  try {
    const supabase = createServiceRoleClient() as any
    const { data: existing } = await supabase
      .from("banned_entities")
      .select("id")
      .eq("type", "email")
      .ilike("value", cleanEmail)

    if (existing && existing.length > 0) {
      for (const item of existing) {
        await unbanEntity(item.id)
      }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Comprehensive 1-Click Ban:
 * Automatically bans the customer's email, associated IP address, browser device ID (anti-VPN),
 * and suspends their registered authentication account.
 */
export async function banEntireCustomerAction({
  email,
  reason,
  durationHours,
  banIp = false,
  banDomain = false,
}: {
  email: string
  reason?: string
  durationHours?: number
  banIp?: boolean
  banDomain?: boolean
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: false, error: "Only full administrators can ban customers" }

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return { success: false, error: "Email is required" }

  const banReason = reason?.trim() || "Banned by administrator"
  const adminEmail = session.data.email

  try {
    const supabase = createServiceRoleClient() as any

    // 1. Fetch transactions to discover all associated IPs and Device IDs
    const { data: txns } = await supabase
      .from("transactions")
      .select("guest_user_data, user_id")
      .ilike("user_email", cleanEmail)

    const ips = new Set<string>()
    const deviceIds = new Set<string>()
    let matchedUserId: string | null = null

    for (const t of txns || []) {
      if (t.user_id && !matchedUserId) matchedUserId = t.user_id
      const guestData = t.guest_user_data as any
      if (guestData?.ip && guestData.ip !== "unknown") ips.add(guestData.ip)
      if (guestData?.deviceId) deviceIds.add(guestData.deviceId)
    }

    if (!matchedUserId) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle()
      if (userRecord?.id) matchedUserId = userRecord.id
    }

    // 2. Suspend Supabase Auth account if registered
    if (matchedUserId) {
      try {
        const banDur = durationHours && durationHours > 0 ? `${durationHours}h` : "876000h"
        await supabase.auth.admin.updateUserById(matchedUserId, {
          ban_duration: banDur,
        })
      } catch (authErr: any) {
        console.warn("[Ban Action] Could not update auth ban duration:", authErr.message)
      }
    }

    // 3. Ban primary Email
    await banEntity({
      type: "email",
      value: cleanEmail,
      reason: banReason,
      bannedBy: adminEmail,
      durationHours,
    })

    // 4. Ban associated Device IDs (anti-VPN & hardware anchor)
    for (const deviceId of deviceIds) {
      await banEntity({
        type: "device_id",
        value: deviceId,
        reason: `${banReason} (Associated with ${cleanEmail})`,
        bannedBy: adminEmail,
        durationHours,
      })
    }

    // 5. Optionally ban associated IP addresses (kept optional due to Nepal CGNAT)
    if (banIp) {
      for (const ip of ips) {
        await banEntity({
          type: "ip",
          value: ip,
          reason: `${banReason} (Associated with ${cleanEmail})`,
          bannedBy: adminEmail,
          durationHours,
        })
      }
    }

    // 6. Optionally ban entire email domain (never ban major public providers like gmail.com)
    if (banDomain) {
      const domain = cleanEmail.split("@")[1]?.trim()
      if (domain && !PROTECTED_EMAIL_DOMAINS.has(domain.toLowerCase())) {
        await banEntity({
          type: "email_domain",
          value: domain,
          reason: `${banReason} (Domain banned for ${cleanEmail})`,
          bannedBy: adminEmail,
          durationHours,
        })
      }
    }

    const summaryParts = [`Email (${cleanEmail})`, `${deviceIds.size} Device(s)`]
    if (banIp) summaryParts.push(`${ips.size} IP(s)`)
    if (banDomain) summaryParts.push(`Domain (@${cleanEmail.split("@")[1]})`)

    return {
      success: true,
      message: `Customer banned successfully across: ${summaryParts.join(", ")}.`,
    }
  } catch (err: any) {
    console.error("Error banning customer completely:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Lifts all bans associated with a customer (Email, IP, Device, and Auth Account).
 */
export async function unbanEntireCustomerAction(email: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: false, error: "Only full administrators can unban customers" }

  const cleanEmail = email.trim().toLowerCase()
  try {
    const supabase = createServiceRoleClient() as any

    const { data: txns } = await supabase
      .from("transactions")
      .select("guest_user_data, user_id")
      .ilike("user_email", cleanEmail)

    const valuesToUnban = new Set<string>([cleanEmail])
    let matchedUserId: string | null = null

    for (const t of txns || []) {
      if (t.user_id && !matchedUserId) matchedUserId = t.user_id
      const guestData = t.guest_user_data as any
      if (guestData?.ip && guestData.ip !== "unknown") valuesToUnban.add(guestData.ip)
      if (guestData?.deviceId) valuesToUnban.add(guestData.deviceId)
    }

    if (!matchedUserId) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle()
      if (userRecord?.id) matchedUserId = userRecord.id
    }

    // Restore Auth account
    if (matchedUserId) {
      try {
        await supabase.auth.admin.updateUserById(matchedUserId, {
          ban_duration: "none",
        })
      } catch (authErr: any) {
        console.warn("[Unban Action] Could not reset auth ban duration:", authErr.message)
      }
    }

    // Lift bans in banned_entities
    const { data: matchingBans } = await supabase
      .from("banned_entities")
      .select("id, type, value, reason")

    for (const b of matchingBans || []) {
      const val = b.value?.toLowerCase()
      // Only lift direct email and associated device ID for this customer.
      // IP and Domain bans are maintained as distinct blacklist rules that can be lifted independently!
      const isDirectEmail = b.type === "email" && (val === cleanEmail || valuesToUnban.has(b.value))
      const isDevice = b.type === "device_id" && (valuesToUnban.has(b.value) || (b.reason && b.reason.toLowerCase().includes(cleanEmail)))

      if (isDirectEmail || isDevice) {
        await unbanEntity(b.id)
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Retrieves full list of active bans for the Security & Blacklist tab.
 */
export async function getBannedListAction(): Promise<{
  success: boolean
  data?: BannedEntity[]
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }
  if (session.data.role !== "admin") return { success: true, data: [] }

  await cleanupExpiredBans().catch(() => {})
  const data = await getBannedEntities()
  return { success: true, data }
}

/**
 * Emails a customer asking for a Trustpilot review. Admin only, at most once per
 * customer every 14 days and 100 per hour overall, so nobody gets nagged.
 */
export async function sendReviewRequestAction(email: string, name?: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSessionAction()
  if (!session.success || session.data.role !== "admin") return { success: false, error: "Unauthorized" }

  const cleanEmail = String(email || "").trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { success: false, error: "Invalid email address." }

  const global = await rateLimit("review-request:global", { windowMs: 3_600_000, max: 100 })
  if (!global.ok) return { success: false, error: "Hourly review-request limit reached. Try again later." }
  const perCustomer = await rateLimit(`review-request:${cleanEmail}`, { windowMs: 14 * 24 * 3_600_000, max: 1 })
  if (!perCustomer.ok) return { success: false, error: "A review request was already sent to this customer in the last 14 days." }

  try {
    const { error } = await sendReviewRequestEmail({ email: cleanEmail, userName: name })
    if (error) return { success: false, error: error.message || "Email could not be sent." }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Email could not be sent." }
  }
}
