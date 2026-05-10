import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  checkLoginRateLimit,
  checkMutationRateLimit,
  checkAdminDashRateLimit,
} from "@/lib/upstash-rate-limit"

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  )
}

function json429(message: string) {
  return new NextResponse(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  })
}

// ── Main Middleware ──────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
  const url = request.nextUrl.clone()
  const method = request.method
  const pathname = url.pathname
  const ip = getClientIP(request)
  const isServerAction = request.headers.has("next-action")
  const isMutation = method !== "GET" || isServerAction

  // ── Admin subdomain detection ───────────────────────────────────────────
  const host = request.headers.get("host") || ""
  const isAdminHost = host === "admin.byiora.store" || host === "www.admin.byiora.store"

  // ┌──────────────────────────────────────────────────────────────────────────
  // │ QUOTA SAVER: Let all public GET browsing pass WITHOUT touching Upstash.
  // └──────────────────────────────────────────────────────────────────────────
  const isAdminRoute = pathname.startsWith("/admin") || isAdminHost
  const isApiRoute = pathname.startsWith("/api")

  if (!isMutation && !isAdminRoute && !isApiRoute) {
    return await refreshSupabaseSession(request)
  }

  // ── Admin subdomain rewrite ───────────────────────────────────────────
  if (isAdminHost) {
    if (pathname === "/") {
      url.pathname = "/admin/login"
      return NextResponse.rewrite(url)
    }
    // DO NOT rewrite API routes or we break the dashboard backend calls
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/api")) {
      url.pathname = `/admin${pathname}`
      return NextResponse.rewrite(url)
    }
  }

  // ┌──────────────────────────────────────────────────────────────────────────
  // │ ADMIN ROUTES — Layered protection
  // └──────────────────────────────────────────────────────────────────────────
  if (isAdminRoute) {
    // ── Layer A: Admin Login — strict brute-force shield (5/min per IP) ────
    if (pathname === "/admin/login") {
      if (isMutation) {
        const limit = await checkLoginRateLimit(`login:${ip}`)
        if (!limit.success) {
          // POST to login form → redirect with error
          url.searchParams.set("error", "too_many_attempts")
          return NextResponse.redirect(url)
        }
      }
      // GET /admin/login always passes — no Upstash cost
      return await refreshSupabaseSession(request)
    }

    // ── Layer B: Admin Dashboard — only rate-limit mutations ───────────────
    if (pathname.startsWith("/admin/dashboard")) {
      if (isMutation) {
        const limit = await checkAdminDashRateLimit(`admin-dash:${ip}`)
        if (!limit.success) {
          // Check if this is an RSC / Server Action request
          const isRSC = request.headers.has("rsc") || isServerAction
          if (isRSC) {
            return json429("Rate limit exceeded. Please wait a moment.")
          }
          // Regular browser navigation → redirect
          url.pathname = "/admin/dashboard"
          url.searchParams.set("error", "rate_limited")
          return NextResponse.redirect(url)
        }
      }
    }

    // ── Admin Auth Guard — require Supabase user for /admin/dashboard/* ────
    const supabaseResponse = await refreshSupabaseSession(request)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()

    // If on admin subdomain root and logged in -> go to dashboard
    if (isAdminHost && pathname === "/" && user) {
      url.pathname = "/admin/dashboard"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/admin/dashboard") || (isAdminHost && pathname !== "/admin/login")) {
      if (!user) {
        url.pathname = "/admin/login"
        return NextResponse.redirect(url)
      }

      // SECURITY: Check if user is actually an active admin
      const adminClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get() { return "" },
            set() {},
            remove() {},
          },
        }
      )

      const { data: adminUser } = await adminClient
        .from("admin_users")
        .select("status")
        .eq("id", user.id)
        .single()

      if (!adminUser || adminUser.status !== "active") {
        url.pathname = "/"
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  }

  // ┌──────────────────────────────────────────────────────────────────────────
  // │ GLOBAL MUTATION PROTECTION — catches Sign Up, Sign In, checkout, etc.
  // │ Only fires on POST / Server Actions, never on GETs.
  // └──────────────────────────────────────────────────────────────────────────
  if (isMutation) {
    const limit = await checkMutationRateLimit(`mutation:${ip}`)
    if (!limit.success) {
      return json429("Too many requests. Please slow down.")
    }
  }

  // ┌──────────────────────────────────────────────────────────────────────────
  // │ LEGACY REDIRECTS — category slug rewrites
  // └──────────────────────────────────────────────────────────────────────────
  const segments = pathname.split("/").filter(Boolean)
  const productCategories = new Set(["digital-goods", "topup", "games", "direct-login"])
  if (segments.length === 2 && productCategories.has(segments[0])) {
    url.pathname = `/en-np/${segments[1]}`
    return NextResponse.redirect(url, 308)
  }

  // ── Default: refresh Supabase session and continue ─────────────────────
  return await refreshSupabaseSession(request)
}

// ── Supabase Session Refresher ──────────────────────────────────────────────
// Extracted to avoid duplicating the cookie-handling boilerplate.

async function refreshSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: "", ...options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value: "", ...options })
        },
      },
    }
  )

  // Refresh the session token if expired
  await supabase.auth.getUser()

  return supabaseResponse
}
