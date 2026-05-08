import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ── Shared Redis instance (reuse from upstash-rate-limit.ts pattern) ────────

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// ── Per-route limiters ──────────────────────────────────────────────────────

const limiters = new Map<string, Ratelimit>()

function getOrCreateLimiter(prefix: string, maxRequests: number, windowMs: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const key = `${prefix}:${maxRequests}:${windowMs}`
  if (limiters.has(key)) return limiters.get(key)!

  // Convert windowMs to a duration string Upstash understands
  const windowSec = Math.ceil(windowMs / 1000)
  const window = windowSec >= 60 ? `${Math.ceil(windowSec / 60)} m` : `${windowSec} s`

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: false,
    prefix: `byiora:api:${prefix}`,
  })
  limiters.set(key, limiter)
  return limiter
}

// ── Public API (drop-in replacement for the old in-memory rateLimit) ────────

type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

export async function rateLimit(
  key: string,
  opts: { windowMs: number; max: number }
): Promise<RateLimitResult> {
  // Extract a stable prefix from the key (e.g. "contact" from "contact:1.2.3.4")
  const prefix = key.split(":")[0] || "generic"
  const limiter = getOrCreateLimiter(prefix, opts.max, opts.windowMs)

  // Graceful fallback: if Upstash is not configured, always allow
  if (!limiter) return { ok: true }

  const result = await limiter.limit(key)
  if (result.success) return { ok: true }

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  return { ok: false, retryAfterSeconds }
}
