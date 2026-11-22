import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  checkLoginRateLimit,
  checkMutationRateLimit,
  checkAdminDashRateLimit,
} from "@/lib/upstash-rate-limit"
import { MERCHANT_AUTH_COOKIE } from "@/lib/supabase/cookies"

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

// ── Helper to preserve refreshed cookies across redirects ────────────────────
function redirectWithCookies(destUrl: URL | string, sourceResponse: NextResponse) {
  const redirectRes = NextResponse.redirect(destUrl)
  sourceResponse.cookies.getAll().forEach((c) => {
    redirectRes.cookies.set(c.name, c.value, c)
  })
  return redirectRes
}

// ── Main Middleware ──────────────────────────────────────────────────────────

export async function updateSession(request: NextRequest) {
  const url = request.nextUrl.clone()
  const method = request.method
  const pathname = url.pathname
  const ip = getClientIP(request)
  const isServerAction = request.headers.has("next-action")
  const isMutation = method !== "GET" || isServerAction

  // ── Telemetry bypass: never rate-limit Sentry error tunnels ─────────────
  if (pathname.startsWith("/monitoring-tunnel")) {
    return NextResponse.next()
  }

  // Merchant API: API-key auth and per-merchant limits live in the route (lib/merchant/api.ts), no cookies involved.
  // The merchant webhook relay is authenticated by QStash's signature in the route.
  if (pathname.startsWith("/api/v1/") || pathname === "/api/webhooks/merchant-deliver") {
    return NextResponse.next()
  }

  // ── Admin subdomain detection ───────────────────────────────────────────
  const host = request.headers.get("host") || ""
  const isAdminHost = host === "admin.byiora.com.np" || host === "www.admin.byiora.com.np"
  const isMerchantHost = host === "merchant.byiora.com.np"

  // ── Merchant portal: merchant.byiora.com.np/* serves /merchant/* ─────────
  if (pathname.startsWith("/merchant") || (isMerchantHost && !pathname.startsWith("/api") && !pathname.startsWith("/ingest"))) {
    const target = pathname.startsWith("/merchant") ? pathname : pathname === "/" ? "/merchant/login" : `/merchant${pathname}`
    if (target === "/merchant") {
      url.pathname = isMerchantHost ? "/dashboard" : "/merchant/dashboard"
      return NextResponse.redirect(url)
    }
    if (isMutation) {
      const limit = await checkMutationRateLimit(`merchant:${ip}`)
      if (!limit.success) return json429("Too many requests. Please slow down.")
    }
    const { supabaseResponse, user } = await refreshSupabaseSession(request, MERCHANT_AUTH_COOKIE)
    // Coarse gate only; every merchant action re-checks status, 2FA and KYC on the server.
    if (target.startsWith("/merchant/dashboard") && user?.app_metadata?.role !== "merchant") {
      url.pathname = isMerchantHost ? "/login" : "/merchant/login"
      return redirectWithCookies(url, supabaseResponse)
    }
    if (target === pathname) return supabaseResponse
    url.pathname = target
    const rewrite = NextResponse.rewrite(url)
    supabaseResponse.cookies.getAll().forEach((c) => rewrite.cookies.set(c.name, c.value, c))
    return rewrite
  }

  // ┌──────────────────────────────────────────────────────────────────────────
  // │ QUOTA SAVER: Let all public GET browsing pass WITHOUT touching Upstash.
  // └──────────────────────────────────────────────────────────────────────────
  const isAdminRoute = pathname.startsWith("/admin") || isAdminHost
  const isApiRoute = pathname.startsWith("/api")

  if (!isMutation && !isAdminRoute && !isApiRoute) {
    const { supabaseResponse } = await refreshSupabaseSession(request)
    return supabaseResponse
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
    // Root /admin -> dashboard; the dashboard guard below sends signed-out users to /admin/login
    if (pathname === "/admin") {
      url.pathname = "/admin/dashboard"
      return NextResponse.redirect(url)
    }

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
      const { supabaseResponse } = await refreshSupabaseSession(request)
      return supabaseResponse
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
    const { supabaseResponse, user } = await refreshSupabaseSession(request)

    // If on admin subdomain root and logged in -> go to dashboard
    if (isAdminHost && pathname === "/" && user) {
      url.pathname = "/admin/dashboard"
      return redirectWithCookies(url, supabaseResponse)
    }

    if (pathname.startsWith("/admin/dashboard") || (isAdminHost && pathname !== "/admin/login")) {
      if (!user) {
        url.pathname = "/admin/login"
        return redirectWithCookies(url, supabaseResponse)
      }

      // SECURITY: Check if user is actually an active admin
      const adminClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            getAll() { return [] },
            setAll() {},
          },
        }
      )

      const { data: adminUser } = await adminClient
        .from("admin_users")
        .select("status")
        .eq("id", user.id)
        .single()

      if (!adminUser || adminUser.status !== "active") {
        url.pathname = "/admin/login"
        return redirectWithCookies(url, supabaseResponse)
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
  // Skip session refresh for Server Actions to prevent cookie clobbering
  // and unnecessary getUser() rate limits from frequent polling actions.
  if (isServerAction) {
    return NextResponse.next()
  }

  const { supabaseResponse } = await refreshSupabaseSession(request)
  return supabaseResponse
}

// ── Supabase Session Refresher ──────────────────────────────────────────────
// Extracted to avoid duplicating the cookie-handling boilerplate.

async function refreshSupabaseSession(request: NextRequest, cookieName?: string): Promise<{ supabaseResponse: NextResponse; user: any }> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session token if expired and extract user safely
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      user = data.user
    }
  } catch {
    user = null
  }

  return { supabaseResponse, user }
}
