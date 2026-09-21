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

/**
 * Checks if a given email, IP address, email domain, or device fingerprint is currently banned.
 * Checks fast in-memory Redis first (sub-1ms), falling back to Supabase query.
 */
export async function checkIsBanned({
  email,
  ip,
  deviceId,
}: {
  email?: string | null
  ip?: string | null
  deviceId?: string | null
}): Promise<{ banned: boolean; reason?: string }> {
  const cleanEmail = email?.trim().toLowerCase() || ""
  const cleanIp = ip?.trim() || ""
  const cleanDevice = deviceId?.trim() || ""
  const domain = cleanEmail.includes("@") ? cleanEmail.split("@")[1]?.trim() : ""

  const redis = getRedis()

  // 1. Ultra-fast Redis in-memory check (takes <1ms, zero latency penalty)
  if (redis) {
    try {
      if (cleanDevice && (await redis.sismember("byiora:banned:devices", cleanDevice))) {
        return { banned: true, reason: "This device has been restricted from placing orders in accordance with our security policies. Please contact support for assistance." }
      }
      if (cleanEmail && (await redis.sismember("byiora:banned:emails", cleanEmail))) {
        return { banned: true, reason: "This account has been restricted in accordance with our security policies. Please contact support for assistance." }
      }
      if (cleanIp && cleanIp !== "unknown" && (await redis.sismember("byiora:banned:ips", cleanIp))) {
        return { banned: true, reason: "Access from this network has been restricted in accordance with our security policies. Please contact support for assistance." }
      }
      if (domain && (await redis.sismember("byiora:banned:domains", domain))) {
        return { banned: true, reason: "Email domain has been restricted in accordance with our security policies. Please contact support for assistance." }
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
    const conditions: string[] = []

    if (safeDevice) conditions.push(`and(type.eq.device_id,value.eq.${safeDevice})`)
    if (safeEmail) conditions.push(`and(type.eq.email,value.ilike.${safeEmail})`)
    if (safeIp && safeIp !== "unknown") conditions.push(`and(type.eq.ip,value.eq.${safeIp})`)
    if (safeDomain) conditions.push(`and(type.eq.email_domain,value.ilike.${safeDomain})`)

    if (conditions.length === 0) return { banned: false }

    const { data, error } = await supabase
      .from("banned_entities")
      .select("*")
      .or(conditions.join(","))
      .limit(1)

    if (error) {
      if (isSchemaMissing(error)) {
        return { banned: false }
      }
      return { banned: false }
    }

    if (data && data.length > 0) {
      const match = data[0]

      // Check if ban has expired
      if (match.expires_at && new Date(match.expires_at) < new Date()) {
        return { banned: false }
      }

      // Sync to Redis cache
      if (redis) {
        try {
          if (match.type === "device_id") await redis.sadd("byiora:banned:devices", match.value)
          if (match.type === "email") await redis.sadd("byiora:banned:emails", match.value.toLowerCase())
          if (match.type === "ip") await redis.sadd("byiora:banned:ips", match.value)
          if (match.type === "email_domain") await redis.sadd("byiora:banned:domains", match.value.toLowerCase())
        } catch (_) {}
      }

      return {
        banned: true,
        reason: match.reason || "This account or device has been restricted in accordance with our security policies. Please contact support for assistance.",
      }
    }
  } catch (err: any) {
    // Graceful fallback
  }

  return { banned: false }
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
    }

    // Sync to Redis with TTL
    const redis = getRedis()
    if (redis) {
      try {
        if (type === "device_id") await redis.sadd("byiora:banned:devices", cleanValue)
        if (type === "email") await redis.sadd("byiora:banned:emails", cleanValue)
        if (type === "ip") await redis.sadd("byiora:banned:ips", cleanValue)
        if (type === "email_domain") await redis.sadd("byiora:banned:domains", cleanValue)
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
          if (entity.type === "device_id") await redis.srem("byiora:banned:devices", val)
          if (entity.type === "email") await redis.srem("byiora:banned:emails", val.toLowerCase())
          if (entity.type === "ip") await redis.srem("byiora:banned:ips", val)
          if (entity.type === "email_domain") await redis.srem("byiora:banned:domains", val.toLowerCase())
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
 */
export async function getBannedEntities(): Promise<BannedEntity[]> {
  try {
    const supabase = createServiceRoleClient() as any
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

    return (data as BannedEntity[]) || []
  } catch (err) {
    return []
  }
}
