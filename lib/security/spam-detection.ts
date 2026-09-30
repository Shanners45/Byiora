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

// ── Rate Limit Violation Tracking ────────────────────────────────────────────
// Tracks how many times an IP gets rejected by rate limiters.
// If an IP keeps hammering endpoints after being told to slow down,
// that's automated behavior → auto-ban.

const RL_VIOLATION_WINDOW = 600 // 10 minutes
const RL_VIOLATION_BAN_THRESHOLD = 5 // 5 rejections in 10 min = bot

/**
 * Tracks a rate limit violation for an IP. If the IP exceeds the threshold,
 * it is automatically soft-banned (Turnstile required for 90 days) and its
 * device_id is hard-banned.
 */
export async function trackRateLimitViolation({
  ip,
  deviceId,
}: {
  ip: string
  deviceId?: string | null
}): Promise<void> {
  const redis = getRedis()
  if (!redis || !ip || ip === "unknown") return

  try {
    const key = `byiora:rl-violations:${ip}`
    const count = await redis.incr(key)
    // Only set expiry on the first violation (when count === 1)
    if (count === 1) {
      await redis.expire(key, RL_VIOLATION_WINDOW)
    }

    if (count >= RL_VIOLATION_BAN_THRESHOLD) {
      const { banEntity } = await import("./blacklist")

      // IP soft-ban (Turnstile for 90 days)
      await banEntity({
        type: "ip",
        value: ip,
        reason: "Automated Ban: Excessive rate limit violations (bot-like behavior)",
        bannedBy: "System (Anti-Spam)",
        durationHours: 2160, // 90 days
      })

      // Device hard-ban
      if (deviceId) {
        await banEntity({
          type: "device_id",
          value: deviceId,
          reason: "Automated Ban: Excessive rate limit violations (bot-like behavior)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }

      // Clear the violation counter after banning to prevent re-triggering
      await redis.del(key)
    }
  } catch (err: any) {
    console.error("[Spam Detection] Rate limit violation tracking error:", err.message)
  }
}

// ── Multi-Email Velocity Detection ───────────────────────────────────────────
// Tracks how many distinct email addresses are used from a single IP or device.
// Legitimate customers use 1 (maybe 2) emails. Spammers cycle through many.

const EMAIL_VELOCITY_WINDOW = 1800 // 30 minutes
const EMAIL_VELOCITY_THRESHOLD = 3 // 3+ distinct emails = email cycling

/**
 * Tracks distinct emails used per IP/device. If 3+ distinct emails are
 * detected from the same source within 30 minutes, auto-bans the source.
 *
 * Returns { blocked: true } if the velocity threshold was exceeded.
 */
export async function trackEmailVelocity({
  email,
  ip,
  deviceId,
}: {
  email: string
  ip?: string | null
  deviceId?: string | null
}): Promise<{ blocked: boolean }> {
  const redis = getRedis()
  if (!redis) return { blocked: false }

  const cleanEmail = email.trim().toLowerCase()
  const cleanIp = ip && ip !== "unknown" ? ip.trim() : null
  const cleanDevice = deviceId?.trim() || null

  // Need at least one identifier to track velocity
  if (!cleanIp && !cleanDevice) return { blocked: false }

  try {
    let isSpam = false

    // Track distinct emails per IP
    if (cleanIp) {
      const ipKey = `byiora:email-velocity:ip:${cleanIp}`
      await redis.sadd(ipKey, cleanEmail)
      await redis.expire(ipKey, EMAIL_VELOCITY_WINDOW)
      const distinctCount = await redis.scard(ipKey)
      if (distinctCount >= EMAIL_VELOCITY_THRESHOLD) isSpam = true
    }

    // Track distinct emails per device
    if (cleanDevice) {
      const deviceKey = `byiora:email-velocity:device:${cleanDevice}`
      await redis.sadd(deviceKey, cleanEmail)
      await redis.expire(deviceKey, EMAIL_VELOCITY_WINDOW)
      const distinctCount = await redis.scard(deviceKey)
      if (distinctCount >= EMAIL_VELOCITY_THRESHOLD) isSpam = true
    }

    if (isSpam) {
      const { banEntity } = await import("./blacklist")

      if (cleanIp) {
        await banEntity({
          type: "ip",
          value: cleanIp,
          reason: "Automated Ban: Multiple email addresses used from same source (email cycling)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }
      if (cleanDevice) {
        await banEntity({
          type: "device_id",
          value: cleanDevice,
          reason: "Automated Ban: Multiple email addresses used from same source (email cycling)",
          bannedBy: "System (Anti-Spam)",
          durationHours: 2160,
        })
      }

      return { blocked: true }
    }

    return { blocked: false }
  } catch (err: any) {
    console.error("[Spam Detection] Email velocity tracking error:", err.message)
    return { blocked: false }
  }
}

// ── Trusted Buyer Cache ──────────────────────────────────────────────────────
// When a payment completes successfully, the buyer is marked as "trusted"
// in Redis. Trusted buyers get higher rate limits (10 orders/10 min vs 5).

const TRUSTED_BUYER_TTL = 2592000 // 30 days

/**
 * Marks a buyer as trusted after a successful payment.
 * Sets Redis keys for both userId and IP with 30-day TTL.
 */
export async function markTrustedBuyer({
  userId,
  ip,
}: {
  userId?: string | null
  ip?: string | null
}): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    if (userId) {
      await redis.set(`byiora:trusted-buyer:user:${userId}`, "1", { ex: TRUSTED_BUYER_TTL })
    }
    if (ip && ip !== "unknown") {
      await redis.set(`byiora:trusted-buyer:ip:${ip}`, "1", { ex: TRUSTED_BUYER_TTL })
    }
  } catch (err: any) {
    console.error("[Spam Detection] Failed to mark trusted buyer:", err.message)
  }
}

/**
 * Checks whether a buyer is trusted (has a previous successful payment).
 * Used to apply higher rate limits for legitimate returning customers.
 */
export async function isTrustedBuyer({
  userId,
  ip,
}: {
  userId?: string | null
  ip?: string | null
}): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    if (userId) {
      const userTrust = await redis.get(`byiora:trusted-buyer:user:${userId}`)
      if (userTrust) return true
    }
    if (ip && ip !== "unknown") {
      const ipTrust = await redis.get(`byiora:trusted-buyer:ip:${ip}`)
      if (ipTrust) return true
    }
    return false
  } catch (_) {
    return false
  }
}
