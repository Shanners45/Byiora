"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initPostHog, posthog, sanitizeAnalyticsUrl } from "@/lib/analytics/posthog"
import { touchLastActiveAction } from "@/app/actions/activity"

let lastHeartbeatAt = 0
const HEARTBEAT_INTERVAL_MS = 5 * 60_000

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

  // Initialise once, when the browser is idle, so analytics never delays first paint.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined
    if (idle) idle(() => initPostHog(), { timeout: 4000 })
    else setTimeout(initPostHog, 2000)
  }, [])

  // Server-side "last active" timestamp (works even when PostHog is not
  // configured). Beats on mount, every five minutes while visible, and once
  // when the tab is hidden. The green online dot is Realtime presence.
  useEffect(() => {
    if (typeof window === "undefined") return

    const beat = () => {
      if (document.visibilityState !== "visible") {
        // Leaving: record the real last-active time, not the last 5-minute tick.
        touchLastActiveAction(true).catch(() => {})
        return
      }
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

    posthog.capture("$pageview", { $current_url: sanitizeAnalyticsUrl(window.location.href) })
  }, [pathname, searchParams])

  return null // No DOM — purely a side-effect component
}
