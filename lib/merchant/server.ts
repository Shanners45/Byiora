import crypto from "crypto"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { broadcast, merchantTopic, ADMIN_MERCHANTS_TOPIC } from "@/lib/realtime/broadcast"

// Server-only helpers for merchant server actions. Not a "use server" file on
// purpose: nothing here should be callable from the browser.

export type Merchant = {
  id: string
  user_id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  status: "active" | "suspended" | "banned"
  status_reason: string | null
  kyc_status: "not_submitted" | "submitted" | "more_info" | "rejected" | "approved"
  must_change_password: boolean
  email_verified_at: string | null
  email_otp_hash: string | null
  email_otp_expires_at: string | null
  email_otp_attempts: number
  wallet_balance_paisa: number
  discount_percent: number
  api_rate_limit_per_min: number
  catalog_mode: "all" | "selected"
  credit_limit_paisa: number
  limit_per_order_paisa: number | null
  limit_daily_paisa: number | null
  limit_monthly_paisa: number | null
  low_balance_threshold_paisa: number
  low_balance_alerted_at: string | null
  webhook_url: string | null
  webhook_secret_enc: string | null
  use_global_inventory: boolean
  /** Out-of-stock API orders: true = accept and deliver manually later, false = fail with OUT_OF_STOCK. */
  manual_delivery: boolean
  notifications_seen_at: string | null
  resend_segment_id: string | null
  created_at: string
}

/** Where a signed-in merchant is: 2FA code pending, first-login steps, or through to the dashboard. */
export type MerchantStage = "mfa" | "password" | "email" | "ready"

export type MerchantContext = { merchant: Merchant; stage: MerchantStage; mfaEnabled: boolean }

// The merchant tables are not in the generated Database types yet.
export const merchantDb = () => createServiceRoleClient() as any

export async function clientIp(): Promise<string | null> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null
}

export async function getMerchantContext(): Promise<MerchantContext | null> {
  const supabase = await createClient({ readOnly: true, merchant: true })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== "merchant") return null

  const { data: merchant } = await merchantDb().from("merchants").select("*").eq("user_id", user.id).maybeSingle()
  if (!merchant || merchant.status === "banned") return null

  const { data: { session } } = await supabase.auth.getSession()
  const { data: aal } = session?.access_token
    ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session.access_token)
    : { data: null }
  const mfaEnabled = aal?.nextLevel === "aal2"
  const stage: MerchantStage =
    mfaEnabled && aal?.currentLevel !== "aal2" ? "mfa"
    : merchant.must_change_password ? "password"
    : !merchant.email_verified_at ? "email"
    : "ready"
  return { merchant, stage, mfaEnabled }
}

/**
 * Gate for every merchant server action.
 * - "signed_in": 2FA done (first-login steps may still be open)
 * - "onboarded": first-login steps done; can view everything
 * - "active":    onboarded, not suspended and KYC approved; can use features
 */
export async function requireMerchant(level: "signed_in" | "onboarded" | "active"): Promise<MerchantContext | { error: string }> {
  const ctx = await getMerchantContext()
  if (!ctx) return { error: "Unauthorized" }
  if (ctx.stage === "mfa") return { error: "MFA_REQUIRED" }
  if (level === "signed_in") return ctx
  if (ctx.stage !== "ready") return { error: "ONBOARDING_REQUIRED" }
  if (level === "onboarded") return ctx
  if (ctx.merchant.status !== "active") return { error: "ACCOUNT_SUSPENDED" }
  if (ctx.merchant.kyc_status !== "approved") return { error: "KYC_REQUIRED" }
  return ctx
}

// Read-only events don't need to refresh anyone's screen.
const QUIET_ACTIONS = new Set(["kyc.viewed", "order.codes_viewed", "merchant.login"])

/** Append-only audit trail, plus a realtime refresh ping to the merchant and admins. Never blocks the action it records. */
export async function audit(entry: {
  actorType: "admin" | "merchant" | "system"
  actorId?: string | null
  merchantId?: string | null
  action: string
  details?: Record<string, unknown>
}) {
  const { error } = await merchantDb().from("audit_log").insert({
    actor_type: entry.actorType,
    actor_id: entry.actorId ?? null,
    merchant_id: entry.merchantId ?? null,
    action: entry.action,
    details: entry.details ?? {},
    ip: await clientIp(),
  })
  if (error) console.error("[audit] insert failed:", error.message)
  if (QUIET_ACTIONS.has(entry.action)) return
  await broadcast([
    ...(entry.merchantId ? [{ topic: merchantTopic(entry.merchantId), event: entry.action }] : []),
    { topic: ADMIN_MERCHANTS_TOPIC, event: entry.action, payload: entry.merchantId ? { merchantId: entry.merchantId } : {} },
  ])
}

/** Random temporary password that satisfies common strength rules. */
export function tempPassword(): string {
  return `${crypto.randomBytes(12).toString("base64url")}Aa1!`
}
