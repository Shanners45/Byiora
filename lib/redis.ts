import { Redis } from "@upstash/redis"

let redis: Redis | null = null

/**
 * Returns a shared, singleton instance of Upstash Redis.
 * Avoids creating redundant HTTP clients across multiple files and server actions.
 */
export function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  redis = new Redis({ url, token })
  return redis
}
