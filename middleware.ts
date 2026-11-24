import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - monitoring-tunnel (Sentry telemetry)
     * - ingest (PostHog analytics, proxied by a rewrite; many calls per visitor, no session needed)
     * - favicon.ico (browser icon)
     * - Static assets (svg, png, jpg, jpeg, gif, webp, ico, txt)
     */
    "/((?!_next/static|_next/image|monitoring-tunnel|ingest|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
}
