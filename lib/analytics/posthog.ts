import posthog from "posthog-js"

/**
 * PostHog client singleton — lazy-initialised on first import in the browser.
 *
 * • Autocapture, session recording, and heatmaps are OFF to stay within the
 *   free tier and keep payload tiny.  We only care about $pageview events
 *   and identified-user "last seen" timestamps.
 *
 * • The instance is exported so auth-context can call posthog.identify / reset.
 */

let posthogInitialised = false

const SENSITIVE_QUERY_PARAM = /^(token|code|otp|access_token|refresh_token|password|secret|key)$/i

const ANALYTICS_URL_KEYS = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_referrer",
]

/** Collapses bearer-bearing path segments (e.g. /checkout/BYI-…) for analytics. */
export function sanitizeAnalyticsPath(pathname: string): string {
  return pathname.replace(/^\/checkout\/[^/?#]+/i, "/checkout/[id]")
}

/** Strips reset/verification tokens and checkout IDs from an absolute URL. */
export function sanitizeAnalyticsUrl(value: string): string {
  try {
    const url = new URL(value)
    for (const name of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAM.test(name)) url.searchParams.delete(name)
    }
    url.pathname = sanitizeAnalyticsPath(url.pathname)
    return url.toString()
  } catch {
    return value
  }
}

export function initPostHog() {
  if (typeof window === "undefined") return
  if (posthogInitialised) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  // NEXT_PUBLIC_POSTHOG_HOST is optional: ingestion always goes through the
  // /ingest reverse proxy in next.config.js, so only the project key is required.
  if (!key) {
    console.warn("[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY — skipping init")
    return
  }

  try {
    posthog.init(key, {
      // Use Next.js reverse-proxy rewrite to bypass ad-blockers and adhere to CSP
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      // Only create person profiles for signed-in users (fits free tier, less PII)
      person_profiles: "identified_only",
      // Only capture manual events + $pageview; no autocapture or session replay
      autocapture: false,
      capture_pageview: false, // We fire $pageview manually in the provider so we control it per-route
      capture_pageleave: true,
      disable_session_recording: true,
      persistence: "localStorage+cookie",
      // Respect DNT header
      respect_dnt: true,
      // Reduce network noise
      request_batching: true,
      // Explicitly disable features we don't use — prevents loading external
      // scripts that ad blockers / privacy extensions would block and log errors for
      disable_surveys: true,
      disable_web_experiments: true,
      disable_scroll_properties: true,
      enable_heatmaps: false,
      capture_dead_clicks: false,
      enable_recording_console_log: false,
      before_send: (event) => {
        const properties = event?.properties as Record<string, unknown> | undefined
        if (!properties) return event
        for (const key of ANALYTICS_URL_KEYS) {
          const value = properties[key]
          if (typeof value === "string") properties[key] = sanitizeAnalyticsUrl(value)
        }
        if (typeof properties.$pathname === "string") {
          properties.$pathname = sanitizeAnalyticsPath(properties.$pathname)
        }
        return event
      },
    })
    posthogInitialised = true
  } catch (err) {
    // Failsafe: If an aggressive ad-blocker or environment blocks posthog entirely,
    // don't crash or trigger noisy unhandled console exceptions.
    console.debug("[PostHog] Initialization prevented by client environment:", err)
  }
}

export { posthog }
