import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let limiter: Ratelimit | null = null

function getLimiter() {
  if (limiter) return limiter

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const redis = new Redis({ url, token })
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "byiora:admin",
  })
  return limiter
}

export async function checkAdminRateLimit(identifier: string) {
  const l = getLimiter()
  if (!l) return { success: true as const, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() }
  return await l.limit(identifier)
}

