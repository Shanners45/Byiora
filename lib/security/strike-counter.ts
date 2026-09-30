import { Redis } from "@upstash/redis"

let redisClient: Redis | null = null
function getRedis(): Redis | null {
  if (redisClient) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redisClient = new Redis({ url, token })
  return redisClient
}

const STRIKE_WINDOW_SECONDS = 3600 // 1 hour cooldown penalty
export const MAX_STRIKES = 3

// ── Escalation thresholds (24-hour window) ──────────────────────────────────
// After the 1-hour lockout expires, a persistent attacker can try again.
// These 24-hour counters catch that pattern and auto-ban.
const ESCALATION_WINDOW_SECONDS = 86400 // 24 hours
const ESCALATION_SOFT_BAN_THRESHOLD = 6  // 6 failures in 24h → IP soft-ban + device ban (90 days Turnstile)
const ESCALATION_HARD_BAN_THRESHOLD = 9  // 9 failures in 24h → email hard-ban + device + IP

/**
 * Increments failure strikes for an email and/or IP address after a failed or cancelled order.
 * Now also tracks a 24-hour escalation counter. When the escalation threshold is reached,
 * the attacker is automatically banned via the blacklist system.
 */
export async function incrementFailureStrike({
  email,
  ip,
  deviceId,
}: {
  email?: string | null
  ip?: string | null
  deviceId?: string | null
}): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  const cleanEmail = email?.trim().toLowerCase()
  const cleanIp = ip && ip !== "unknown" ? ip.trim() : null
  const cleanDevice = deviceId?.trim() || null

  try {
    const pipeline = redis.pipeline()

    // ── 1-hour strike window (existing behavior — triggers temporary lockout) ──
    if (cleanEmail) {
      const emailKey = `strike:fail:${cleanEmail}`
      pipeline.incr(emailKey)
      pipeline.expire(emailKey, STRIKE_WINDOW_SECONDS)
    }

    if (cleanIp) {
      const ipKey = `strike:fail-ip:${cleanIp}`
      pipeline.incr(ipKey)
      pipeline.expire(ipKey, STRIKE_WINDOW_SECONDS)
    }

    // ── 24-hour escalation window (new — triggers auto-ban) ──
    if (cleanIp) {
      const escIpKey = `strike:escalation-ip:${cleanIp}`
      pipeline.incr(escIpKey)
      pipeline.expire(escIpKey, ESCALATION_WINDOW_SECONDS)
    }
    if (cleanEmail) {
      const escEmailKey = `strike:escalation-email:${cleanEmail}`
      pipeline.incr(escEmailKey)
      pipeline.expire(escEmailKey, ESCALATION_WINDOW_SECONDS)
    }

    await pipeline.exec()

    // ── Check escalation thresholds and auto-ban if exceeded ──
    let ipEscalationCount = 0
    let emailEscalationCount = 0

    if (cleanIp) {
      ipEscalationCount = (await redis.get<number>(`strike:escalation-ip:${cleanIp}`)) || 0
    }
    if (cleanEmail) {
      emailEscalationCount = (await redis.get<number>(`strike:escalation-email:${cleanEmail}`)) || 0
    }

    const maxEscalation = Math.max(ipEscalationCount, emailEscalationCount)

    if (maxEscalation >= ESCALATION_HARD_BAN_THRESHOLD) {
      // ── 9+ failures in 24h → Full ban: email + device + IP ──
      const { banEntity } = await import("./blacklist")

      if (cleanEmail) {
        await banEntity({
          type: "email",
          value: cleanEmail,
          reason: "Automated Ban: Excessive payment failures (9+ in 24h)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160, // 90 days
        })
      }
      if (cleanDevice) {
        await banEntity({
          type: "device_id",
          value: cleanDevice,
          reason: "Automated Ban: Excessive payment failures (9+ in 24h)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }
      if (cleanIp) {
        await banEntity({
          type: "ip",
          value: cleanIp,
          reason: "Automated Ban: Excessive payment failures (9+ in 24h)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }

      console.warn(`[Strike Escalation] HARD BAN triggered for email=${cleanEmail} ip=${cleanIp} device=${cleanDevice} (${maxEscalation} failures in 24h)`)
    } else if (maxEscalation >= ESCALATION_SOFT_BAN_THRESHOLD) {
      // ── 6+ failures in 24h → Soft ban: IP (Turnstile) + device ──
      const { banEntity } = await import("./blacklist")

      if (cleanIp) {
        await banEntity({
          type: "ip",
          value: cleanIp,
          reason: "Automated Ban: Repeated payment failures (6+ in 24h)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }
      if (cleanDevice) {
        await banEntity({
          type: "device_id",
          value: cleanDevice,
          reason: "Automated Ban: Repeated payment failures (6+ in 24h)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }

      console.warn(`[Strike Escalation] SOFT BAN triggered for ip=${cleanIp} device=${cleanDevice} (${maxEscalation} failures in 24h)`)
    }
  } catch (err: any) {
    console.error("Failed to increment failure strike:", err.message)
  }
}

/**
 * Resets failure strikes to 0 when a payment completes successfully.
 * Also resets escalation counters so a successful payment clears the record.
 */
export async function resetFailureStrikes({
  email,
  ip,
}: {
  email?: string | null
  ip?: string | null
}): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  const cleanEmail = email?.trim().toLowerCase()
  const cleanIp = ip && ip !== "unknown" ? ip.trim() : null

  try {
    const keysToDelete: string[] = []
    if (cleanEmail) {
      keysToDelete.push(`strike:fail:${cleanEmail}`)
      keysToDelete.push(`strike:escalation-email:${cleanEmail}`)
    }
    if (cleanIp) {
      keysToDelete.push(`strike:fail-ip:${cleanIp}`)
      keysToDelete.push(`strike:escalation-ip:${cleanIp}`)
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete)
    }
  } catch (err: any) {
    console.error("Failed to reset failure strikes:", err.message)
  }
}

/**
 * Checks if the email or IP is currently locked out by the 3-strike rule.
 */
export async function checkStrikePenalty({
  email,
  ip,
}: {
  email?: string | null
  ip?: string | null
}): Promise<{ isBlocked: boolean; strikeCount: number }> {
  const redis = getRedis()
  if (!redis) return { isBlocked: false, strikeCount: 0 }

  const cleanEmail = email?.trim().toLowerCase()
  const cleanIp = ip && ip !== "unknown" ? ip.trim() : null

  try {
    let emailStrikes = 0
    let ipStrikes = 0

    if (cleanEmail) {
      emailStrikes = (await redis.get<number>(`strike:fail:${cleanEmail}`)) || 0
    }
    if (cleanIp) {
      ipStrikes = (await redis.get<number>(`strike:fail-ip:${cleanIp}`)) || 0
    }

    const highestStrikes = Math.max(emailStrikes, ipStrikes)
    return {
      isBlocked: highestStrikes >= MAX_STRIKES,
      strikeCount: highestStrikes,
    }
  } catch (err: any) {
    console.error("checkStrikePenalty error:", err.message)
    return { isBlocked: false, strikeCount: 0 }
  }
}
