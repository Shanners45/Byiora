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

/**
 * Increments failure strikes for an email and/or IP address after a failed or cancelled order.
 */
export async function incrementFailureStrike({
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
    const pipeline = redis.pipeline()

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

    await pipeline.exec()
  } catch (err: any) {
    console.error("Failed to increment failure strike:", err.message)
  }
}

/**
 * Resets failure strikes to 0 when a payment completes successfully.
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
    if (cleanEmail) keysToDelete.push(`strike:fail:${cleanEmail}`)
    if (cleanIp) keysToDelete.push(`strike:fail-ip:${cleanIp}`)

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
