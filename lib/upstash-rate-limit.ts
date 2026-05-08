import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Lazy-init a shared Redis instance
let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// ── Tiered Limiters ──────────────────────────────────────────────────────────

/** Strict brute-force protection for /admin/login — 5 req/min per IP */
let loginLimiter: Ratelimit | null = null
function getLoginLimiter(): Ratelimit | null {
  if (loginLimiter) return loginLimiter
  const r = getRedis()
  if (!r) return null
  loginLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: false,
    prefix: "byiora:login",
  })
  return loginLimiter
}

/** Generic mutation protection — 20 req/min per IP */
let mutationLimiter: Ratelimit | null = null
function getMutationLimiter(): Ratelimit | null {
  if (mutationLimiter) return mutationLimiter
  const r = getRedis()
  if (!r) return null
  mutationLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: false,
    prefix: "byiora:mutation",
  })
  return mutationLimiter
}

/** Admin dashboard mutation protection — 30 req/min per IP */
let adminDashLimiter: Ratelimit | null = null
function getAdminDashLimiter(): Ratelimit | null {
  if (adminDashLimiter) return adminDashLimiter
  const r = getRedis()
  if (!r) return null
  adminDashLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: false,
    prefix: "byiora:admin-dash",
  })
  return adminDashLimiter
}

// ── Exported helpers ─────────────────────────────────────────────────────────

const PASS = { success: true as const, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve() }

export async function checkLoginRateLimit(identifier: string) {
  const l = getLoginLimiter()
  if (!l) return PASS
  return await l.limit(identifier)
}

export async function checkMutationRateLimit(identifier: string) {
  const l = getMutationLimiter()
  if (!l) return PASS
  return await l.limit(identifier)
}

export async function checkAdminDashRateLimit(identifier: string) {
  const l = getAdminDashLimiter()
  if (!l) return PASS
  return await l.limit(identifier)
}
