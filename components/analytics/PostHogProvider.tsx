"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initPostHog, posthog } from "@/lib/analytics/posthog"
import { touchLastActiveAction } from "@/app/actions/activity"

let lastHeartbeatAt = 0
const HEARTBEAT_INTERVAL_MS = 60_000

/**
 * PostHogProvider
 *
 * Initialises the PostHog SDK on mount and fires a manual $pageview on
 * every client-side navigation.  Wraps nothing — just drop it as a
 * sibling inside the root layout's <body>.
 */
export function PostHogProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialise once
  useEffect(() => {
    initPostHog()
  }, [])

  // Server-side activity heartbeat (works even when PostHog is not configured).
  // Beats on mount, then every minute while the tab is visible so an idle
  // reader still shows as active in the admin dashboard.
  useEffect(() => {
    if (typeof window === "undefined") return

    const beat = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) return
      lastHeartbeatAt = Date.now()
      touchLastActiveAction().catch(() => {})
    }

    beat()
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS)
    document.addEventListener("visibilitychange", beat)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", beat)
    }
  }, [])

  // Fire $pageview on route change
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!posthog.__loaded) return

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    posthog.capture("$pageview", { $current_url: window.location.origin + url })
  }, [pathname, searchParams])

  return null // No DOM — purely a side-effect component
}
