type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

type Bucket = {
  count: number
  resetAtMs: number
}

declare global {
  // eslint-disable-next-line no-var
  var __byioraRateLimitBuckets: Map<string, Bucket> | undefined
}

function getStore() {
  if (!globalThis.__byioraRateLimitBuckets) {
    globalThis.__byioraRateLimitBuckets = new Map()
  }
  return globalThis.__byioraRateLimitBuckets
}

export function rateLimit(key: string, opts: { windowMs: number; max: number }): RateLimitResult {
  const store = getStore()
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAtMs) {
    store.set(key, { count: 1, resetAtMs: now + opts.windowMs })
    return { ok: true }
  }

  if (bucket.count >= opts.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000))
    return { ok: false, retryAfterSeconds }
  }

  bucket.count += 1
  store.set(key, bucket)
  return { ok: true }
}

