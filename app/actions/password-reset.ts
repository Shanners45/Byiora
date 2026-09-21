"use server"

import crypto from "crypto"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendPasswordChangedEmail } from "@/lib/email/resend"
import { rateLimit } from "@/lib/rate-limit"
import { verifyTurnstileToken } from "@/lib/captcha"
import { checkIsBanned } from "@/lib/security/blacklist"
import { headers } from "next/headers"
import { Redis } from "@upstash/redis"

let redisInstance: Redis | null = null
function getRedis(): Redis | null {
  if (redisInstance) return redisInstance
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redisInstance = new Redis({ url, token })
  return redisInstance
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return email
  if (local.length <= 2) return `${local[0]}*@${domain}`
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`
}

/**
 * Validates a password reset token from the reset URL (?token=...).
 * Links remain valid for multiple clicks within their 24-hour expiration window.
 */
export async function validateResetTokenAction(rawToken: string): Promise<{
  valid: boolean
  maskedEmail?: string
  error?: string
}> {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  // IP Rate limiting: Max 20 token validation attempts per minute
  const rl = await rateLimit(`pw-reset-validate:${ip}`, { windowMs: 60_000, max: 20 })
  if (!rl.ok) {
    return { valid: false, error: "Too many validation attempts. Please wait a moment and try again." }
  }

  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length < 20) {
    return { valid: false, error: "Invalid password reset link." }
  }

  const cleanToken = rawToken.trim()
  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex")

  try {
    const supabase = createServiceRoleClient() as any

    // 1. Look up token in Supabase
    const { data: tokenRow, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return { valid: false, error: "This password reset link is invalid or has already been used." }
    }

    if (tokenRow.used_at) {
      return { valid: false, error: "This password reset link has already been used and is no longer valid." }
    }

    const expiresAt = new Date(tokenRow.expires_at).getTime()
    if (Date.now() > expiresAt) {
      return { valid: false, error: "This password reset link has expired (links are active for 24 hours). Please request a new one." }
    }

    return {
      valid: true,
      maskedEmail: maskEmail(tokenRow.email),
    }
  } catch (err: any) {
    console.error("[validateResetTokenAction] Error:", err)
    return { valid: false, error: "An error occurred while validating the reset link." }
  }
}

/**
 * Completes the password reset using a validated 24-hour token.
 * Sets the new password, revokes all existing sessions everywhere, and marks the token as used.
 */
export async function resetPasswordWithTokenAction({
  token,
  newPassword,
  confirmPassword,
  captchaToken,
}: {
  token: string
  newPassword: string
  confirmPassword: string
  captchaToken?: string | null
}): Promise<{
  success: boolean
  error?: string
}> {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  // 1. IP Rate limiting: Max 5 reset attempts per 15 minutes
  const rl = await rateLimit(`pw-reset-submit:${ip}`, { windowMs: 900_000, max: 5 })
  if (!rl.ok) {
    const waitMinutes = Math.max(1, Math.ceil(rl.retryAfterSeconds / 60))
    return {
      success: false,
      error: `Too many password reset attempts. Please wait ${waitMinutes} minute(s) before trying again.`
    }
  }

  // 2. Token-level Rate limiting: Max 5 submissions per specific token
  const cleanToken = token?.trim() || ""
  if (cleanToken.length >= 20) {
    const rlToken = await rateLimit(`pw-reset-token:${cleanToken.slice(0, 32)}`, { windowMs: 900_000, max: 5 })
    if (!rlToken.ok) {
      return {
        success: false,
        error: "Too many attempts with this link. For security, please request a new password reset link."
      }
    }
  }

  // 3. Security: Check if IP is banned
  const banCheck = await checkIsBanned({ ip })
  if (banCheck.banned) {
    return {
      success: false,
      error: banCheck.reason || "Access restricted in accordance with our security policies."
    }
  }

  // 4. Cloudflare Turnstile Captcha verification
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!captchaToken) {
      return { success: false, error: "Security verification required. Please complete the captcha." }
    }
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, ip)
    if (!isCaptchaValid) {
      return { success: false, error: "Security verification failed. Please refresh and try again." }
    }
  }

  if (!token || cleanToken.length < 20) {
    return { success: false, error: "Invalid password reset token." }
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Passwords do not match." }
  }

  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex")

  try {
    const supabase = createServiceRoleClient() as any

    // 1. Verify token in database
    const { data: tokenRow, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return { success: false, error: "This password reset link is invalid or has already been used." }
    }

    if (tokenRow.used_at) {
      return { success: false, error: "This password reset link has already been used and is no longer valid." }
    }

    const expiresAt = new Date(tokenRow.expires_at).getTime()
    if (Date.now() > expiresAt) {
      return { success: false, error: "This password reset link has expired. Please request a new one." }
    }

    // 2. Update user's password in Supabase Auth
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(tokenRow.user_id, {
      password: newPassword,
    })

    if (updateAuthError) {
      console.error("[resetPasswordWithTokenAction] auth update error:", updateAuthError.message)
      return { success: false, error: updateAuthError.message || "Failed to update account password." }
    }

    // 3. Revoke all active sessions everywhere for this user
    try {
      await supabase.rpc("revoke_all_user_sessions", { target_user_id: tokenRow.user_id })
    } catch (e: any) {
      console.warn("[resetPasswordWithTokenAction] Could not revoke sessions via RPC:", e.message)
    }

    // 4. Mark token as permanently consumed in database and invalidate any other tokens for this user
    const nowIso = new Date().toISOString()
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: nowIso })
      .eq("id", tokenRow.id)

    // Immediately purge any other pending reset tokens for this user
    await supabase
      .from("password_reset_tokens")
      .delete()
      .eq("user_id", tokenRow.user_id)
      .neq("id", tokenRow.id)

    // Clear from Redis cache if present
    try {
      const redis = getRedis()
      if (redis) {
        await redis.del(`pw_reset:${tokenHash}`)
      }
    } catch (e) {}

    // 5. Send confirmation security email alert
    try {
      await sendPasswordChangedEmail({ email: tokenRow.email })
    } catch (e: any) {
      console.warn("[resetPasswordWithTokenAction] Could not send confirmation email:", e.message)
    }

    return { success: true }
  } catch (err: any) {
    console.error("[resetPasswordWithTokenAction] Unexpected error:", err)
    return { success: false, error: err.message || "An unexpected error occurred." }
  }
}
