"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sendWelcomeEmail, sendPasswordChangedEmail } from "@/lib/email/resend"
import { headers } from "next/headers"
import { verifyTurnstileToken } from "@/lib/captcha"

// Must match your Supabase Dashboard → Auth → Email OTP Length
const OTP_LENGTH = 6

// ─── Login ──────────────────────────────────────────────────────────────────
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
    email: email.toLowerCase().trim(),
    password,
  })

  // We explicitly serialize error since native Error objects cannot be passed from server action without serialization
  if (error) {
    return { error: error.message }
  }

  revalidatePath(redirectPath)
  return { success: true, data: { user: data.user } }
}

// ─── Signup Step 1: Register (sends OTP email automatically) ────────────────
export async function signupWithPassword(email: string, password: string, name: string, captchaToken?: string) {
  if (!name || name.trim().length === 0) {
    return { error: "Full name is required" }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long" }
  }
  if (!captchaToken) return { error: "Captcha verification required." }
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please try again." }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase().trim(),
    password,
    options: {
      data: { pending_name: name.trim() }
    }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/")
  return { success: true }
}

// ─── Signup Step 2: Verify OTP ──────────────────────────────────────────────
export async function verifySignupOtp(email: string, token: string) {
  const cleanToken = token.replace(/\s/g, "")
  if (!cleanToken || cleanToken.length !== OTP_LENGTH) {
    return { error: `Please enter a valid ${OTP_LENGTH}-digit code` }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.toLowerCase().trim(),
    token: cleanToken,
    type: "signup",
  })

  if (error) {
    return { error: error.message }
  }

  // Now the user is verified — create profile in public.users
  if (data.user) {
    const userName = data.user.user_metadata?.pending_name || email.split("@")[0]

    const { error: insertError } = await supabase
      .from("users")
      .insert([{ id: data.user.id, email: email.toLowerCase().trim(), name: userName }])

    if (insertError) {
      // User might already exist (e.g. race condition), not a fatal error
      console.error("User insert after OTP:", insertError.message)
    }

    // Send welcome email in background
    try {
      sendWelcomeEmail({ email: email.toLowerCase().trim(), userName }).catch((e) =>
        console.error("Welcome email background error:", e),
      )
    } catch (e) {
      console.error("Welcome email trigger failed:", e)
    }
  }

  revalidatePath("/")
  return { success: true }
}

// ─── Resend OTP (signup) ────────────────────────────────────────────────────
export async function resendSignupOtp(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.toLowerCase().trim(),
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// ─── Forgot Password Step 1: Send OTP ──────────────────────────────────────
// Security: Always returns success to prevent email enumeration.
// Supabase silently ignores non-existent emails.
export async function requestPasswordReset(email: string, captchaToken?: string) {
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address" }
  }
  if (!captchaToken) return { error: "Captcha verification required." }
  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const captchaOk = await verifyTurnstileToken(captchaToken, ip)
  if (!captchaOk) return { error: "Captcha validation failed. Please try again." }

  const normalizedEmail = email.toLowerCase().trim()
  const supabase = await createClient()

  // Fire-and-forget: Supabase will silently ignore if email doesn't exist
  await supabase.auth.resetPasswordForEmail(normalizedEmail).catch(() => {})

  // Always return success — never reveal whether the email is registered
  return { success: true }
}

// ─── Forgot Password Step 2: Verify OTP + Set New Password ─────────────────
export async function verifyRecoveryAndResetPassword(
  email: string,
  token: string,
  newPassword: string,
) {
  const cleanToken = token.replace(/\s/g, "")
  if (!cleanToken || cleanToken.length !== OTP_LENGTH) {
    return { error: `Please enter a valid ${OTP_LENGTH}-digit code` }
  }
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters long" }
  }

  const supabase = await createClient()

  // Step 1: Verify the recovery OTP
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    email: email.toLowerCase().trim(),
    token: cleanToken,
    type: "recovery",
  })

  if (verifyError) {
    return { error: verifyError.message }
  }

  // Step 2: Update the password (user is now authenticated by the OTP)
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  // Send password changed confirmation email
  try {
    sendPasswordChangedEmail({ email: email.toLowerCase().trim() }).catch((e) =>
      console.error("Password changed email error:", e),
    )
  } catch (e) {
    console.error("Password changed email trigger failed:", e)
  }

  // Sign the user out so they have to log in fresh with their new password
  await supabase.auth.signOut()

  return { success: true }
}

// ─── Change Password (from account settings) ───────────────────────────────
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
) {
  if (!newPassword || newPassword.length < 8) {
    return { error: "New password must be at least 8 characters long" }
  }

  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: "Not authenticated" }
  }

  // Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (signInError) {
    return { error: "Current password is incorrect" }
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  // Send password changed email notification
  try {
    sendPasswordChangedEmail({ email: user.email.toLowerCase().trim() }).catch((e) =>
      console.error("Password changed email error:", e),
    )
  } catch (e) {
    console.error("Password changed email trigger failed:", e)
  }

  return { success: true }
}

// ─── Logout ─────────────────────────────────────────────────────────────────
export async function logoutUser(redirectPath: string = "/") {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath(redirectPath)
  redirect(redirectPath)
}
