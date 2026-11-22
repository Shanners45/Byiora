import { getRedis } from "@/lib/redis"
import { banEntity } from "./blacklist"

/**
 * Automatic suspension rules (sliding counters in Redis).
 *
 * lock = short block of one specific action (sign-in, webhooks), checked by the
 *        caller with getLockMinutes(). Locks never become permanent, so an
 *        attacker can't lock a real customer out for long.
 * ban  = a banned_entities row (shows in Admin > Security & Blacklist).
 *
 * Repeat offenders escalate: each new trigger within 90 days multiplies the
 * duration by 4; the third ban is permanent.
 */
type Kind = "email" | "ip" | "device_id"
type Rule = {
  windowSec: number
  threshold: number
  on: Kind[]
  label: string
  lockMinutes?: number
  banHours?: number
}

export const AUTO_RULES = {
  login_failure: { windowSec: 3600, threshold: 10, on: ["email", "ip"], lockMinutes: 30, label: "10+ failed sign-ins in 1 hour" },
  admin_login_failure: { windowSec: 900, threshold: 5, on: ["email", "ip"], lockMinutes: 60, label: "5+ failed admin sign-ins in 15 minutes" },
  merchant_login_failure: { windowSec: 900, threshold: 5, on: ["email", "ip"], lockMinutes: 60, label: "5+ failed merchant sign-ins in 15 minutes" },
  webhook_probe: { windowSec: 3600, threshold: 3, on: ["ip"], lockMinutes: 7 * 24 * 60, banHours: 168, label: "3+ forged payment-webhook calls in 1 hour" },
  partial_payment: { windowSec: 7 * 86400, threshold: 2, on: ["email"], banHours: 72, label: "2+ underpaid orders in 7 days" },
  signup_burst: { windowSec: 86400, threshold: 3, on: ["device_id"], banHours: 168, label: "3+ accounts created from one device in 24 hours" },
} satisfies Record<string, Rule>

export type AutoRule = keyof typeof AUTO_RULES
type Subject = { email?: string | null; ip?: string | null; deviceId?: string | null }

const REPEAT_WINDOW_SEC = 90 * 86400
const MAX_LOCK_MINUTES = 24 * 60

/** Duration for the nth offence (n >= 1): x4 each time; bans go permanent (0) at n >= 3. */
export function escalate(base: number, offence: number, kind: "lock" | "ban"): number {
  if (kind === "ban" && offence >= 3) return 0
  const value = base * Math.pow(4, Math.max(0, offence - 1))
  return kind === "lock" ? Math.min(value, Math.max(base, MAX_LOCK_MINUTES)) : value
}

function ids(rule: Rule, s: Subject): { kind: Kind; value: string }[] {
  const out: { kind: Kind; value: string }[] = []
  const email = s.email?.trim().toLowerCase()
  const ip = s.ip && s.ip !== "unknown" ? s.ip.trim() : null
  const device = s.deviceId?.trim()
  if (rule.on.includes("email") && email) out.push({ kind: "email", value: email })
  if (rule.on.includes("ip") && ip) out.push({ kind: "ip", value: ip })
  if (rule.on.includes("device_id") && device) out.push({ kind: "device_id", value: device })
  return out
}

/** Count one occurrence; applies the lock/ban when the threshold is reached. Never throws. */
export async function recordAbuse(ruleName: AutoRule, subject: Subject): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const rule: Rule = AUTO_RULES[ruleName]
  try {
    for (const { kind, value } of ids(rule, subject)) {
      const countKey = `autoban:count:${ruleName}:${kind}:${value}`
      const count = await redis.incr(countKey)
      if (count === 1) await redis.expire(countKey, rule.windowSec)
      if (count < rule.threshold) continue

      await redis.del(countKey)
      const repeatKey = `autoban:repeat:${ruleName}:${kind}:${value}`
      const offence = await redis.incr(repeatKey)
      await redis.expire(repeatKey, REPEAT_WINDOW_SEC)

      if (rule.lockMinutes) {
        const minutes = escalate(rule.lockMinutes, offence, "lock")
        await redis.set(`autoban:lock:${ruleName}:${kind}:${value}`, "1", { ex: minutes * 60 })
      }
      if (rule.banHours) {
        const hours = escalate(rule.banHours, offence, "ban")
        await banEntity({
          type: kind,
          value,
          reason: `Automated: ${rule.label}${offence > 1 ? ` (repeat offence #${offence})` : ""}`,
          bannedBy: "System (Auto-Ban)",
          durationHours: hours,
        })
      }
      console.warn(`[AutoBan] ${ruleName} triggered for ${kind} (offence #${offence})`)
    }
  } catch (err: any) {
    console.error(`[AutoBan] ${ruleName} failed:`, err?.message || err)
  }
}

/** Minutes left on an active lock for any of the subject's identifiers (0 = not locked). */
export async function getLockMinutes(ruleName: AutoRule, subject: Subject): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0
  try {
    let longest = 0
    for (const { kind, value } of ids(AUTO_RULES[ruleName], subject)) {
      const ttl = await redis.ttl(`autoban:lock:${ruleName}:${kind}:${value}`)
      if (ttl > 0) longest = Math.max(longest, Math.ceil(ttl / 60))
    }
    return longest
  } catch {
    return 0 // fail open: Redis outage must not lock everyone out
  }
}
