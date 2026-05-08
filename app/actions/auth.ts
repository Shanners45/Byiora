"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sendWelcomeEmail } from "@/lib/email/resend"
import { headers } from "next/headers"
import { verifyTurnstileToken } from "@/lib/captcha"

export async function loginWithPassword(
  email: string,
  password: string,
  redirectPath: string = "/",
  captchaToken?: string,
) {
  if (!captchaToken) return { error: "Captcha verification required." }
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please try again." }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // We explicitly serialize error since native Error objects cannot be passed from server action without serialization
  if (error) {
    return { error: error.message }
  }

  revalidatePath(redirectPath)
  return { success: true, data: { user: data.user } }
}

export async function signupWithPassword(email: string, password: string, name: string, captchaToken?: string) {
  if (!name || name.trim().length === 0) {
    return { error: "Full name is required" }
  }
  if (!captchaToken) return { error: "Captcha verification required." }
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please try again." }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Insert user profile in users table
  if (data.user) {
    const { error: insertError } = await supabase
      .from("users")
      .insert([{ id: data.user.id, email: email.toLowerCase().trim(), name: name.trim() }])

    if (insertError) {
      return { error: "Failed to create user profile" }
    }

    // Trigger welcome email in background (server-side only)
    try {
      sendWelcomeEmail({ email: email.toLowerCase().trim(), userName: name.trim() }).catch((e) =>
        console.error("Welcome email background error:", e),
      )
    } catch (e) {
      console.error("Welcome email trigger failed:", e)
    }
  }

  revalidatePath("/")
  return { success: true }
}

export async function logoutUser(redirectPath: string = "/") {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath(redirectPath)
  redirect(redirectPath)
}
