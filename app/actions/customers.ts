"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getAdminSessionAction } from "./admin-utils"
import { banEntity, unbanEntity, getBannedEntities, BannedEntity } from "@/lib/security/blacklist"
import { sendPasswordResetEmail } from "@/lib/email/resend"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export interface CustomerProfile {
  email: string
  name: string
  isRegistered: boolean
  userId?: string | null
  totalOrders: number
  totalSpent: number
  successfulOrders: number
  failedOrders: number
  lastOrderDate?: string | null
  lastIp?: string | null
  lastDeviceId?: string | null
  lastSignInAt?: string | null
  isBanned: boolean
  banReason?: string | null
  banId?: string | null
  createdAt?: string
}

/**
 * Loads aggregated customer data (Registered users + Guest purchasers) along with ban status.
 */
export async function getCustomersOverviewAction(): Promise<{
  success: boolean
  data?: CustomerProfile[]
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  try {
    const supabase = createServiceRoleClient() as any

    // 1. Fetch registered users from public.users & Supabase Auth for last_sign_in_at
    const { data: registeredUsers, error: usersErr } = await supabase
      .from("users")
      .select("id, email, name, created_at")

    if (usersErr) {
      console.error("Error fetching registered users:", usersErr)
      return { success: false, error: usersErr.message }
    }

    const authUsersMap = new Map<string, any>()
    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (authData?.users) {
        for (const u of authData.users) {
          if (u.email) authUsersMap.set(u.email.toLowerCase().trim(), u)
        }
      }
    } catch (authErr: any) {
      console.warn("Could not list auth users for login times:", authErr.message)
    }

    // 2. Fetch all transactions to aggregate orders and spend per customer email
    const { data: transactions, error: txnsErr } = await supabase
      .from("transactions")
      .select("transaction_id, user_id, user_email, price, status, created_at, guest_user_data")
      .order("created_at", { ascending: false })

    if (txnsErr) {
      console.error("Error fetching transactions:", txnsErr)
      return { success: false, error: txnsErr.message }
    }

    // 3. Fetch all active bans across email, IP, and device ID
    const bans: BannedEntity[] = await getBannedEntities()
    const bannedEmailMap = new Map<string, BannedEntity>()
    const bannedDomainSet = new Set<string>()
    const bannedIpMap = new Map<string, BannedEntity>()
    const bannedDeviceMap = new Map<string, BannedEntity>()

    for (const b of bans) {
      if (b.type === "email") bannedEmailMap.set(b.value.toLowerCase(), b)
      if (b.type === "email_domain") bannedDomainSet.add(b.value.toLowerCase())
      if (b.type === "ip") bannedIpMap.set(b.value, b)
      if (b.type === "device_id") bannedDeviceMap.set(b.value, b)
    }

    // Map to group all customer profiles by email
    const customerMap = new Map<string, CustomerProfile>()

    // Seed registered users first
    for (const u of registeredUsers || []) {
      if (!u.email) continue
      const cleanEmail = u.email.trim().toLowerCase()
      const domain = cleanEmail.split("@")[1] || ""
      const directBan = bannedEmailMap.get(cleanEmail)
      const domainBan = bannedDomainSet.has(domain)
      const authUser = authUsersMap.get(cleanEmail)

      customerMap.set(cleanEmail, {
        email: cleanEmail,
        name: u.name || cleanEmail.split("@")[0],
        isRegistered: true,
        userId: u.id,
        totalOrders: 0,
        totalSpent: 0,
        successfulOrders: 0,
        failedOrders: 0,
        lastOrderDate: null,
        lastIp: null,
        lastDeviceId: null,
        lastSignInAt: authUser?.last_sign_in_at || null,
        isBanned: !!directBan || domainBan,
        banReason: directBan?.reason || (domainBan ? "Domain blacklisted" : null),
        banId: directBan?.id || null,
        createdAt: u.created_at,
      })
    }

    // Aggregate transactions
    for (const t of transactions || []) {
      if (!t.user_email) continue
      const cleanEmail = t.user_email.trim().toLowerCase()
      const domain = cleanEmail.split("@")[1] || ""
      const directBan = bannedEmailMap.get(cleanEmail)
      const domainBan = bannedDomainSet.has(domain)

      let profile = customerMap.get(cleanEmail)
      if (!profile) {
        // Pure guest buyer
        const guestName = (t.guest_user_data as any)?.name || cleanEmail.split("@")[0]
        profile = {
          email: cleanEmail,
          name: guestName,
          isRegistered: false,
          userId: null,
          totalOrders: 0,
          totalSpent: 0,
          successfulOrders: 0,
          failedOrders: 0,
          lastOrderDate: t.created_at,
          lastIp: (t.guest_user_data as any)?.ip || null,
          lastDeviceId: (t.guest_user_data as any)?.deviceId || null,
          lastSignInAt: null,
          isBanned: !!directBan || domainBan,
          banReason: directBan?.reason || (domainBan ? "Domain blacklisted" : null),
          banId: directBan?.id || null,
          createdAt: t.created_at,
        }
        customerMap.set(cleanEmail, profile)
      }

      // Update lastIp / lastDeviceId from latest transactions
      const txIp = (t.guest_user_data as any)?.ip
      const txDev = (t.guest_user_data as any)?.deviceId
      if (txIp && !profile.lastIp) profile.lastIp = txIp
      if (txDev && !profile.lastDeviceId) profile.lastDeviceId = txDev

      profile.totalOrders += 1

      const numPrice = parseFloat(String(t.price).replace(/,/g, "")) || 0
      const isSuccess = ["Completed", "Paid"].includes(t.status)
      const isFailed = ["Payment Failed", "Cancelled", "Failed"].includes(t.status)

      if (isSuccess) {
        profile.successfulOrders += 1
        profile.totalSpent += numPrice
      }
      if (isFailed) {
        profile.failedOrders += 1
      }

      if (!profile.lastOrderDate || new Date(t.created_at) > new Date(profile.lastOrderDate)) {
        profile.lastOrderDate = t.created_at
      }
      if (!profile.lastIp && (t.guest_user_data as any)?.ip) {
        profile.lastIp = (t.guest_user_data as any).ip
      }
    }

    for (const profile of customerMap.values()) {
      const directBan = bannedEmailMap.get(profile.email)
      const domain = profile.email.split("@")[1] || ""
      const domainBan = bannedDomainSet.has(domain)
      const ipBan = profile.lastIp ? bannedIpMap.get(profile.lastIp) : null
      const deviceBan = profile.lastDeviceId ? bannedDeviceMap.get(profile.lastDeviceId) : null

      const activeBan = directBan || ipBan || deviceBan
      if (activeBan || domainBan) {
        profile.isBanned = true
        profile.banReason = activeBan?.reason || (domainBan ? "Domain blacklisted" : "Banned by administrator")
        profile.banId = activeBan?.id || null
      }
    }

    const customerList = Array.from(customerMap.values())
    // Sort by most recent order date descending (most recent buyers on top)
    customerList.sort((a, b) => {
      const timeA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      const timeB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
      return timeB - timeA
    })

    return { success: true, data: customerList }
  } catch (err: any) {
    console.error("getCustomersOverviewAction error:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Sends an official password reset link to a registered user from the admin panel.
 */
export async function sendCustomerPasswordResetAction(email: string): Promise<{
  success: boolean
  error?: string
}> {
  const session = await getAdminSessionAction()
  if (!session.success) return { success: false, error: "Unauthorized" }

  const cleanEmail = email.trim().toLowerCase()

  try {
    const supabase = createServiceRoleClient() as any

    // Generate password recovery link via Supabase Auth Admin API
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.byiora.com.np"
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: {
        redirectTo: `${origin}/en-np/forgot-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      if (linkError?.message?.toLowerCase().includes("not found") || (linkError as any)?.code === "user_not_found") {
        return {
          success: false,
          error: "This customer ordered as a Guest and does not have a registered account password yet. They can sign up on the website.",
        }
      }
      return { success: false, error: linkError?.message || "Could not generate password reset link" }
    }

    const resetLink = linkData.properties.action_link

    // Dispatch branded email via official Byiora email template
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
}: {
  email: string
  reason?: string
  durationHours?: number
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

    // 4. Ban associated IP addresses
    for (const ip of ips) {
      await banEntity({
        type: "ip",
        value: ip,
        reason: `${banReason} (Associated with ${cleanEmail})`,
        bannedBy: adminEmail,
        durationHours,
      })
    }

    // 5. Ban associated Device IDs (anti-VPN)
    for (const deviceId of deviceIds) {
      await banEntity({
        type: "device_id",
        value: deviceId,
        reason: `${banReason} (Associated with ${cleanEmail})`,
        bannedBy: adminEmail,
        durationHours,
      })
    }

    return {
      success: true,
      message: `Customer banned successfully across all vectors (Email, ${ips.size} IP(s), ${deviceIds.size} Device(s), and Account suspended).`,
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
      const isMatch =
        valuesToUnban.has(b.value) ||
        valuesToUnban.has(val) ||
        (b.reason && b.reason.toLowerCase().includes(cleanEmail))

      if (isMatch) {
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

  const data = await getBannedEntities()
  return { success: true, data }
}
