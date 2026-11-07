"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initPostHog, posthog } from "@/lib/analytics/posthog"

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

  // Fire $pageview on route change
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!posthog.__loaded) return

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
    posthog.capture("$pageview", { $current_url: window.location.origin + url })
  }, [pathname, searchParams])

  return null // No DOM — purely a side-effect component
}
