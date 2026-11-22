import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Fresh authenticator code for one sensitive admin action (e.g. moving merchant money).
 * Checked against the signed-in admin's own TOTP factor every time, so a stolen session
 * or a "trusted device" cookie alone is not enough. Server-only: not a server action.
 */
export async function verifyAdminStepUp(adminId: string, code: string): Promise<string | null> {
  if (!/^\d{6}$/.test(String(code || ""))) return "Enter the 6-digit code from your authenticator app."
  if (!(await rateLimit(`admin-step-up:${adminId}`, { windowMs: 900_000, max: 5 })).ok) return "Too many wrong codes. Wait 15 minutes."
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== adminId) return "Your session expired. Sign in again."
  const factorId = user.factors?.find((f) => f.factor_type === "totp" && f.status === "verified")?.id
  if (!factorId) return "Set up two-factor authentication on your admin account first."
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(code) })
  return error ? "That code is wrong or expired. Use the newest code." : null
}
