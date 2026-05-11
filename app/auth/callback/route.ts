import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { sendWelcomeEmail } from "@/lib/email/resend"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const rawNext = requestUrl.searchParams.get("next") ?? "/"

  // SECURITY: Prevent open-redirect attacks — only allow relative paths
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError && session?.user) {
      // Check if user exists in the public.users table by auth ID
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", session.user.id)
        .single()

      if (!existingUser && session.user.email) {
        // Check if a user with the same email already exists (e.g. signed up with email+password, now logging in with Google)
        const { data: existingByEmail } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email.toLowerCase().trim())
          .single()

        if (existingByEmail) {
          // User already exists with this email — update their ID to the new auth provider ID
          await supabase
            .from("users")
            .update({ id: session.user.id })
            .eq("id", existingByEmail.id)
        } else {
          const userName = session.user.user_metadata.full_name || session.user.email.split("@")[0] || "User"

          // Completely new user — create in the public.users table
          await supabase.from("users").insert({
            id: session.user.id,
            email: session.user.email,
            name: userName,
          })

          // Send welcome email in background
          try {
            sendWelcomeEmail({ email: session.user.email.toLowerCase().trim(), userName }).catch((e) =>
              console.error("Welcome email background error (Google):", e),
            )
          } catch (e) {
            console.error("Welcome email trigger failed (Google):", e)
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(`${next}?login=success`, requestUrl.origin))
}

