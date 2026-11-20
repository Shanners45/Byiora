"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { verifyTurnstileToken } from "@/lib/captcha"
import { checkLoginRateLimit } from "@/lib/upstash-rate-limit"
import { rateLimit } from "@/lib/rate-limit"
import { recordAbuse, getLockMinutes } from "@/lib/security/auto-ban"
import { getAdminMfaStageAction } from "@/app/actions/admin-utils"

export async function loginAdminWithPassword(email: string, password: string, captchaToken: string) {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  const limit = await checkLoginRateLimit(`login:${ip}`)
  if (!limit.success) {
    return { error: "Too many attempts. Please try again in a minute." }
  }
  // Per-account limit: attackers rotate IPs, the target account stays the same.
  const emailRl = await rateLimit(`admin-login-email:${String(email || "").trim().toLowerCase()}`, { windowMs: 900_000, max: 5 })
  if (!emailRl.ok) {
    return { error: "Too many attempts. Please try again in a minute." }
  }

  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please retry." }

  const lockedFor = await getLockMinutes("admin_login_failure", { email, ip })
  if (lockedFor > 0) return { error: `Admin sign-in is locked for ${lockedFor} more minute${lockedFor === 1 ? "" : "s"} after repeated failures.` }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    await recordAbuse("admin_login_failure", { email, ip })
    return { error: "Invalid credentials" }
  }

  const { stage } = await getAdminMfaStageAction()
  if (stage === "none") {
    await supabase.auth.signOut()
    return { error: "Not an active admin account." }
  }

  // The password alone opens nothing: the dashboard requires the 2FA step too.
  return { success: true as const, mfa: stage }
}

