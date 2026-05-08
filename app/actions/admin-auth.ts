"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { verifyTurnstileToken } from "@/lib/captcha"
import { checkAdminRateLimit } from "@/lib/upstash-rate-limit"
import { getAdminSessionAction } from "@/app/actions/admin-utils"

export async function loginAdminWithPassword(email: string, password: string, captchaToken: string) {
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  const limit = await checkAdminRateLimit(`admin-login:${ip}`)
  if (!limit.success) {
    return { error: "Too many attempts. Please try again in a minute." }
  }

  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please retry." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) return { error: error?.message || "Invalid credentials" }

  const session = await getAdminSessionAction()
  if (!session.success) {
    await supabase.auth.signOut()
    return { error: "Not an active admin account." }
  }

  return { success: true as const }
}

