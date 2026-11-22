import { NextResponse, type NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { merchantDb, type Merchant } from "@/lib/merchant/server"
import { hashApiKey } from "@/lib/merchant/trade"

// Auth for /api/v1: "Authorization: Bearer byk_live_...". Keys are stored hashed;
// optional per-key IP allowlist; per-merchant requests-per-minute limit set by admin.

export function apiError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export function apiOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function authenticateApi(req: NextRequest): Promise<{ merchant: Merchant; keyId: string; test: boolean } | NextResponse> {
  const key = req.headers.get("authorization")?.match(/^Bearer\s+(byk_(?:live|test)_[\w-]{20,})$/)?.[1]
  if (!key) return apiError(401, "UNAUTHORIZED", "Send your API key as 'Authorization: Bearer byk_live_...' (or byk_test_... in test mode).")

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || ""
  // Cheap guard against key guessing before touching the database.
  if (!(await rateLimit(`mapi-ip:${ip}`, { windowMs: 60_000, max: 600 })).ok) return apiError(429, "RATE_LIMITED", "Too many requests.", { "Retry-After": "60" })

  const db = merchantDb()
  const { data: row } = await db.from("merchant_api_keys").select("id, merchant_id, ip_allowlist, revoked_at, mode, last_used_at").eq("secret_hash", hashApiKey(key)).maybeSingle()
  if (!row || row.revoked_at) return apiError(401, "UNAUTHORIZED", "This API key is invalid or revoked.")
  if (row.ip_allowlist?.length && !row.ip_allowlist.includes(ip)) return apiError(403, "IP_NOT_ALLOWED", `Requests from ${ip || "this IP"} are not allowed for this key.`)

  const { data: merchant } = await db.from("merchants").select("*").eq("id", row.merchant_id).single()
  if (!merchant || merchant.status === "banned") return apiError(401, "UNAUTHORIZED", "This API key is invalid or revoked.")
  const test = row.mode === "test"
  // Test keys work before verification so merchants can build their integration early.
  if (!test && merchant.status !== "active") return apiError(403, "ACCOUNT_SUSPENDED", "Your merchant account is suspended.")
  if (!test && merchant.kyc_status !== "approved") return apiError(403, "KYC_REQUIRED", "Your business verification is not approved yet.")

  const rl = await rateLimit(`mapi:${merchant.id}:${merchant.api_rate_limit_per_min}`, { windowMs: 60_000, max: merchant.api_rate_limit_per_min })
  if (!rl.ok) return apiError(429, "RATE_LIMITED", `Limit is ${merchant.api_rate_limit_per_min} requests per minute.`, { "Retry-After": String(rl.retryAfterSeconds) })

  // Informational only: at most one write a minute per key, never awaited.
  if (!row.last_used_at || Date.now() - Date.parse(row.last_used_at) > 60_000) {
    db.from("merchant_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(() => {})
  }
  return { merchant: { ...merchant, discount_percent: Number(merchant.discount_percent) }, keyId: row.id, test }
}

export const rupees = (paisa: number) => Math.round(paisa) / 100
