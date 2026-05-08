import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError && session?.user) {
      // Check if user exists in the public.users table
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", session.user.id)
        .single()

      if (!existingUser && session.user.email) {
        // Create user in the public.users table
        await supabase.from("users").insert({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata.full_name || session.user.email.split("@")[0] || "User",
        })
      }
    }
  }

  return NextResponse.redirect(new URL(`${next}?login=success`, requestUrl.origin))
}

