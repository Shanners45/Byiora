import type { PostHog } from "posthog-js"

/**
 * PostHog client — the SDK (~100 KB gzipped) is downloaded only when initPostHog() runs, which the
 * provider does once the browser is idle, so it never competes with the page's own JavaScript.
 * Calls made before it arrives (identify on sign-in, reset on sign-out, the first $pageview) are
 * queued and replayed once it has loaded.
 *
 * • Autocapture, session recording, and heatmaps are OFF to stay within the
 *   free tier and keep payload tiny.  We only care about $pageview events
 *   and identified-user "last seen" timestamps.
 *
 * • The instance is exported so auth-context can call posthog.identify / reset.
 */

let instance: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
const queue: Array<(ph: PostHog) => void> = []
const MAX_QUEUE = 50

function run(fn: (ph: PostHog) => void) {
  if (instance) {
    try { fn(instance) } catch { /* analytics must never break the page */ }
  } else if (queue.length < MAX_QUEUE) {
    queue.push(fn)
  }
}

/** Same calls the app used on posthog-js, safe to use before the SDK has loaded. */
export const posthog = {
  get __loaded() {
    return Boolean(instance?.__loaded)
  },
  identify: (...args: Parameters<PostHog["identify"]>) => run((ph) => ph.identify(...args)),
  reset: () => run((ph) => ph.reset()),
  capture: (...args: Parameters<PostHog["capture"]>) => run((ph) => { ph.capture(...args) }),
}

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
  if (loading) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  // NEXT_PUBLIC_POSTHOG_HOST is optional: ingestion always goes through the
  // /ingest reverse proxy in next.config.js, so only the project key is required.
  if (!key) {
    console.warn("[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY — skipping init")
    queue.length = 0
    return
  }

  loading = import("posthog-js").then(({ default: ph }) => {
    ph.init(key, {
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
    instance = ph
    for (const fn of queue.splice(0)) {
      try { fn(ph) } catch { /* ignore */ }
    }
    return ph
  }).catch((err) => {
    // Failsafe: an ad-blocker or privacy setting can block the SDK; never crash or spam the console.
    console.debug("[PostHog] Initialization prevented by client environment:", err)
    queue.length = 0
    return null
  })
}
