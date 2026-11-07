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
      const forwardedFor = request.headers.get("x-forwarded-for")
      const realIp = request.headers.get("x-real-ip")
      const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || null)

      // Check if user exists in the public.users table by auth ID
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", session.user.id)
        .single()

      if (existingUser) {
        if (clientIp) {
          await (supabase.from("users") as any)
            .update({ last_ip: clientIp, updated_at: new Date().toISOString() })
            .eq("id", session.user.id)
        }
      } else if (session.user.email) {
        // Check if a user with the same email already exists (e.g. signed up with email+password, now logging in with Google)
        const { data: existingByEmail } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email.toLowerCase().trim())
          .single()

        if (existingByEmail) {
          // User already exists with this email — update their ID to the new auth provider ID
          await (supabase.from("users") as any)
            .update({
              id: session.user.id,
              ...(clientIp ? { last_ip: clientIp } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingByEmail.id)
        } else {
          const userName = session.user.user_metadata?.full_name || session.user.email.split("@")[0] || "User"

          // Completely new user — create in the public.users table with signup IP
          await (supabase.from("users") as any).insert({
            id: session.user.id,
            email: session.user.email,
            name: userName,
            signup_ip: clientIp,
            last_ip: clientIp,
          })

          // Send welcome email (awaited so serverless execution does not terminate before Resend receives it)
          try {
            const emailRes = await sendWelcomeEmail({ email: session.user.email.toLowerCase().trim(), userName })
            if (emailRes?.error) {
              console.error("Resend welcome email error (Google):", emailRes.error)
            }
          } catch (e) {
            console.error("Welcome email trigger failed (Google):", e)
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(`${next}?login=success`, requestUrl.origin))
}

