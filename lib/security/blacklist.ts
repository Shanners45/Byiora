import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { Redis } from "@upstash/redis"

// Shared Redis instance for caching blacklist checks
let redisClient: Redis | null = null
function getRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redisClient = new Redis({ url, token })
  return redisClient
}

export interface BannedEntity {
  id: string
  type: "email" | "ip" | "email_domain" | "device_id"
  value: string
  reason?: string | null
  banned_by?: string | null
  created_at: string
  expires_at?: string | null
}

function isSchemaMissing(error: any): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("schema cache")
  )
}

export interface BanCheckResult {
  banned: boolean
  requiresTurnstile?: boolean
  reason?: string
  banType?: "email" | "ip" | "device_id" | "email_domain"
}

/**
 * Automatically purges all expired bans from the database and Redis cache,
 * and restores Auth accounts if necessary.
 */
export async function cleanupExpiredBans(): Promise<number> {
  try {
    const supabase = createServiceRoleClient() as any
    const nowIso = new Date().toISOString()

    // 1. Find all expired bans in Supabase
    const { data: expiredBans, error: fetchErr } = await supabase
      .from("banned_entities")
      .select("*")
      .not("expires_at", "is", null)
      .lte("expires_at", nowIso)

    if (fetchErr || !expiredBans || expiredBans.length === 0) {
      return 0
    }

    const idsToDelete = expiredBans.map((b: any) => b.id)

    // 2. Delete expired bans from Supabase
    const { error: delErr } = await supabase
      .from("banned_entities")
      .delete()
      .in("id", idsToDelete)

    if (delErr && !isSchemaMissing(delErr)) {
      console.error("[Blacklist] Error deleting expired bans:", delErr)
    }

    // 3. Remove expired entries from Redis (both TTL keys and legacy sets)
    const redis = getRedis()
    if (redis) {
      for (const b of expiredBans) {
        const cleanVal = b.type === "ip" || b.type === "device_id" ? b.value.trim() : b.value.trim().toLowerCase()
        try {
          await redis.del(`byiora:ban:${b.type}:${cleanVal}`)
          if (b.type === "device_id") await redis.srem("byiora:banned:devices", cleanVal)
          if (b.type === "email") await redis.srem("byiora:banned:emails", cleanVal)
          if (b.type === "ip") await redis.srem("byiora:banned:ips", cleanVal)
          if (b.type === "email_domain") await redis.srem("byiora:banned:domains", cleanVal)
        } catch (_) {}
      }
    }

    // 4. If any email bans expired, check if their Supabase Auth user is currently suspended and lift it
    for (const b of expiredBans) {
      if (b.type === "email") {
        try {
          const cleanEmail = b.value.trim().toLowerCase()
          const { data: userRecord } = await supabase
            .from("users")
            .select("id")
            .eq("email", cleanEmail)
            .maybeSingle()

          if (userRecord?.id) {
            await supabase.auth.admin.updateUserById(userRecord.id, {
              ban_duration: "none",
            })
          }
        } catch (_) {}
      }
    }

    return expiredBans.length
  } catch (err) {
    console.error("[Blacklist] Error in cleanupExpiredBans:", err)
    return 0
  }
}

/**
 * Checks if an IP is currently blacklisted.
 */
export async function isIpBanned(ip: string): Promise<boolean> {
  const cleanIp = ip?.trim() || ""
  if (!cleanIp || cleanIp === "unknown") return false

  const redis = getRedis()
  if (redis) {
    try {
      const isBannedKey = await redis.get(`byiora:ban:ip:${cleanIp}`)
      if (isBannedKey) return true
    } catch (_) {}
  }

  try {
    const supabase = createServiceRoleClient() as any
    const { data } = await supabase
      .from("banned_entities")
      .select("id, expires_at")
      .eq("type", "ip")
      .eq("value", cleanIp)
      .limit(1)

    if (data && data.length > 0) {
      const match = data[0]
      if (!match.expires_at || new Date(match.expires_at) > new Date()) {
        // Sync to Redis with remaining TTL
        if (redis) {
          try {
            if (match.expires_at) {
              const remainingSecs = Math.max(1, Math.floor((new Date(match.expires_at).getTime() - Date.now()) / 1000))
              await redis.set(`byiora:ban:ip:${cleanIp}`, "1", { ex: remainingSecs })
            } else {
              await redis.set(`byiora:ban:ip:${cleanIp}`, "1")
            }
          } catch (_) {}
        }
        return true
      } else {
        // Expired! Clean it up immediately
        cleanupExpiredBans().catch(() => {})
        if (redis) {
          try {
            await redis.del(`byiora:ban:ip:${cleanIp}`)
            await redis.srem("byiora:banned:ips", cleanIp)
          } catch (_) {}
        }
        return false
      }
    } else {
      // Not in DB: if it was erroneously lingering in Redis set, clear it
      if (redis) {
        try {
          await redis.srem("byiora:banned:ips", cleanIp)
          await redis.del(`byiora:ban:ip:${cleanIp}`)
        } catch (_) {}
      }
    }
  } catch (_) {}

  return false
}

/**
 * Checks if a given email, IP address, email domain, or device fingerprint is currently banned.
 * If Email, Device ID, or Domain is banned -> HARD BAN (banned: true, checkout blocked).
 * If ONLY IP is banned and Device/Email are different -> SOFT CHALLENGE (banned: false, requiresTurnstile: true).
 */
export async function checkIsBanned({
  email,
  ip,
  deviceId,
}: {
  email?: string | null
  ip?: string | null
  deviceId?: string | null
}): Promise<BanCheckResult> {
  const cleanEmail = email?.trim().toLowerCase() || ""
  const cleanIp = ip?.trim() || ""
  const cleanDevice = deviceId?.trim() || ""
  const domain = cleanEmail.includes("@") ? cleanEmail.split("@")[1]?.trim() : ""

  const redis = getRedis()

  // 1. Ultra-fast Redis in-memory check using TTL-backed keys (takes <1ms, zero latency penalty)
  if (redis) {
    try {
      if (cleanDevice && (await redis.get(`byiora:ban:device_id:${cleanDevice}`))) {
        return { banned: true, reason: "This device has been restricted from placing orders in accordance with our security policies. Please contact support for assistance.", banType: "device_id" }
      }
      if (cleanEmail && (await redis.get(`byiora:ban:email:${cleanEmail}`))) {
        return { banned: true, reason: "This account has been restricted in accordance with our security policies. Please contact support for assistance.", banType: "email" }
      }
      if (domain && (await redis.get(`byiora:ban:email_domain:${domain}`))) {
        return { banned: true, reason: "Email domain has been restricted in accordance with our security policies. Please contact support for assistance.", banType: "email_domain" }
      }
      if (cleanIp && cleanIp !== "unknown" && (await redis.get(`byiora:ban:ip:${cleanIp}`))) {
        return { banned: false, requiresTurnstile: true, reason: "Security verification required for this network connection.", banType: "ip" }
      }
    } catch (e) {
      // Continue to Supabase if Redis is offline
    }
  }

  // 2. Supabase Query Fallback
  try {
    const supabase = createServiceRoleClient() as any
    const safeDevice = cleanDevice.replace(/[,()"]/g, "")
    const safeEmail = cleanEmail.replace(/[,()"]/g, "")
    const safeIp = cleanIp.replace(/[,()"]/g, "")
    const safeDomain = domain.replace(/[,()"]/g, "")

    // A. Check Hard Bans: Device ID, Email, Email Domain
    const hardConditions: string[] = []
    if (safeDevice) hardConditions.push(`and(type.eq.device_id,value.eq.${safeDevice})`)
    if (safeEmail) hardConditions.push(`and(type.eq.email,value.ilike.${safeEmail})`)
    if (safeDomain) hardConditions.push(`and(type.eq.email_domain,value.ilike.${safeDomain})`)

    if (hardConditions.length > 0) {
      const { data, error } = await supabase
        .from("banned_entities")
        .select("*")
        .or(hardConditions.join(","))
        .limit(1)

      if (!error && data && data.length > 0) {
        const match = data[0]
        const isNotExpired = !match.expires_at || new Date(match.expires_at) > new Date()
        if (isNotExpired) {
          if (redis) {
            try {
              const val = match.type === "device_id" || match.type === "ip" ? match.value : match.value.toLowerCase()
              const rKey = `byiora:ban:${match.type}:${val}`
              if (match.expires_at) {
                const remainingSecs = Math.max(1, Math.floor((new Date(match.expires_at).getTime() - Date.now()) / 1000))
                await redis.set(rKey, "1", { ex: remainingSecs })
              } else {
                await redis.set(rKey, "1")
              }
            } catch (_) {}
          }

          return {
            banned: true,
            reason: match.reason || "This account or device has been restricted in accordance with our security policies. Please contact support for assistance.",
            banType: match.type,
          }
        } else {
          // Ban has expired!
          cleanupExpiredBans().catch(() => {})
        }
      }
    }

    // B. Check Soft Ban: IP Address only (requires Turnstile, not hard block)
    if (safeIp && safeIp !== "unknown") {
      const { data: ipData, error: ipError } = await supabase
        .from("banned_entities")
        .select("*")
        .eq("type", "ip")
        .eq("value", safeIp)
        .limit(1)

      if (!ipError && ipData && ipData.length > 0) {
        const match = ipData[0]
        const isNotExpired = !match.expires_at || new Date(match.expires_at) > new Date()
        if (isNotExpired) {
          if (redis) {
            try {
              const rKey = `byiora:ban:ip:${match.value}`
              if (match.expires_at) {
                const remainingSecs = Math.max(1, Math.floor((new Date(match.expires_at).getTime() - Date.now()) / 1000))
                await redis.set(rKey, "1", { ex: remainingSecs })
              } else {
                await redis.set(rKey, "1")
              }
            } catch (_) {}
          }

          return {
            banned: false,
            requiresTurnstile: true,
            reason: "Security verification required for this network connection.",
            banType: "ip",
          }
        } else {
          // IP Ban has expired!
          cleanupExpiredBans().catch(() => {})
        }
      }
    }
  } catch (err: any) {
    // Graceful fallback
  }

  return { banned: false, requiresTurnstile: false }
}

/**
 * Adds an entity to the blacklist with optional expiration duration.
 */
export async function banEntity({
  type,
  value,
  reason,
  bannedBy,
  durationHours,
}: {
  type: "email" | "ip" | "email_domain" | "device_id"
  value: string
  reason?: string
  bannedBy?: string
  durationHours?: number // 0 or undefined = permanent
}): Promise<{ success: boolean; error?: string }> {
  const cleanValue = type === "ip" || type === "device_id" ? value.trim() : value.trim().toLowerCase()
  if (!cleanValue) return { success: false, error: "Value cannot be empty" }

  const expiresAt =
    durationHours && durationHours > 0
      ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
      : null

  try {
    const supabase = createServiceRoleClient() as any
    const { error } = await supabase.from("banned_entities").upsert(
      {
        type,
        value: cleanValue,
        reason: reason || "Banned by administrator",
        banned_by: bannedBy || "admin",
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "type,value" }
    )

    if (error && !isSchemaMissing(error)) {
      console.error("Error banning entity in DB:", error)
      return { success: false, error: error.message }
    }

    // Sync to Redis with exact TTL
    const redis = getRedis()
    if (redis) {
      try {
        const rKey = `byiora:ban:${type}:${cleanValue}`
        if (durationHours && durationHours > 0) {
          const ttlSeconds = durationHours * 3600
          await redis.set(rKey, "1", { ex: ttlSeconds })
        } else {
          await redis.set(rKey, "1")
        }

        // Remove from legacy indefinite sets so they never cause stale permanent blocks
        if (type === "device_id") await redis.srem("byiora:banned:devices", cleanValue)
        if (type === "email") await redis.srem("byiora:banned:emails", cleanValue)
        if (type === "ip") await redis.srem("byiora:banned:ips", cleanValue)
        if (type === "email_domain") await redis.srem("byiora:banned:domains", cleanValue)
      } catch (_) {}
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Removes an entity from the blacklist.
 */
export async function unbanEntity(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceRoleClient() as any

    // Retrieve entity to clear from Redis
    const { data: entity } = await supabase.from("banned_entities").select("*").eq("id", id).single()

    const { error } = await supabase.from("banned_entities").delete().eq("id", id)
    if (error && !isSchemaMissing(error)) return { success: false, error: error.message }

    if (entity) {
      const redis = getRedis()
      if (redis) {
        try {
          const val = entity.value
          const lowerVal = entity.value.toLowerCase()
          await redis.del(`byiora:ban:${entity.type}:${val}`)
          await redis.del(`byiora:ban:${entity.type}:${lowerVal}`)
          if (entity.type === "device_id") await redis.srem("byiora:banned:devices", val)
          if (entity.type === "email") await redis.srem("byiora:banned:emails", lowerVal)
          if (entity.type === "ip") await redis.srem("byiora:banned:ips", val)
          if (entity.type === "email_domain") await redis.srem("byiora:banned:domains", lowerVal)
        } catch (_) {}
      }

      // If email ban lifted, reset Auth account ban if registered
      if (entity.type === "email") {
        try {
          const { data: userRecord } = await supabase
            .from("users")
            .select("id")
            .eq("email", entity.value.toLowerCase().trim())
            .maybeSingle()

          if (userRecord?.id) {
            await supabase.auth.admin.updateUserById(userRecord.id, {
              ban_duration: "none",
            })
          }
        } catch (_) {}
      }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Retrieves all active banned entities.
 * Automatically filters out expired bans and initiates background cleanup.
 */
export async function getBannedEntities(): Promise<BannedEntity[]> {
  try {
    const supabase = createServiceRoleClient() as any
    const now = new Date()

    const { data, error } = await supabase
      .from("banned_entities")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      if (isSchemaMissing(error)) {
        return []
      }
      return []
    }

    const allBans = (data as BannedEntity[]) || []
    const activeBans: BannedEntity[] = []
    let hasExpired = false

    for (const b of allBans) {
      if (b.expires_at && new Date(b.expires_at) <= now) {
        hasExpired = true
      } else {
        activeBans.push(b)
      }
    }

    // If any expired bans exist, clean them up immediately in the background
    if (hasExpired) {
      cleanupExpiredBans().catch((e) => console.warn("[Blacklist] Background cleanup error:", e))
    }

    return activeBans
  } catch (err) {
    return []
  }
}
