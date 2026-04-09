"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sendWelcomeEmail } from "@/lib/email-service"

export async function loginWithPassword(email: string, password: string, redirectPath: string = "/") {
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

export async function signupWithPassword(email: string, password: string, name: string) {
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

    // Send welcome email from server-side
    // Use try-catch so email failure doesn't break signup
    try {
      await sendWelcomeEmail(email.toLowerCase().trim(), name.trim())
    } catch (e) {
      console.error("Welcome email failed:", e)
      // Don't throw - signup should succeed even if email fails
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
