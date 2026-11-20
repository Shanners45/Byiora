/**
 * Server-only PostHog last-active lookup.
 *
 * IMPORTANT: This module must NOT have the "use server" directive. It holds
 * POSTHOG_PERSONAL_API_KEY and returns data for every customer, so exposing
 * these functions as Server Actions would leak the full customer activity
 * graph to any client. Only trusted server code (admin-gated actions) may
 * import this module.
 */

const POSTHOG_HOST = "https://us.posthog.com" // API host (not the ingestion proxy host)
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY

const CACHE_TTL_MS = 5 * 60 * 1000
let cachedResult: { at: number; data: Map<string, string> } | null = null

/**
 * Map of email → most recent event timestamp (ISO) over the last 30 days.
 *
 * PostHog person profiles have no "last seen" property, so this asks the
 * events table directly with one HogQL query. The personal API key needs the
 * `query:read` scope.
 */
export async function getPostHogLastActive(): Promise<Map<string, string>> {
  if (cachedResult && Date.now() - cachedResult.at < CACHE_TTL_MS) {
    return cachedResult.data
  }

  const emailToLastSeen = new Map<string, string>()

  if (!PROJECT_ID || !API_KEY) {
    console.warn("[PostHog] Missing POSTHOG_PROJECT_ID or POSTHOG_PERSONAL_API_KEY — skipping last-active fetch")
    return emailToLastSeen
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query:
            "SELECT lower(person.properties.email) AS email, max(timestamp) AS last_seen " +
            "FROM events WHERE timestamp > now() - INTERVAL 30 DAY AND notEmpty(person.properties.email) " +
            "GROUP BY email LIMIT 10000",
        },
      }),
      cache: "no-store",
    })

    if (!res.ok) {
      console.error(`[PostHog] Query API returned ${res.status}: ${await res.text().catch(() => "")}`)
      return emailToLastSeen
    }

    const data: { results?: [string, string][] } = await res.json()
    for (const [email, lastSeen] of data.results || []) {
      if (!email || !lastSeen) continue
      // HogQL returns "YYYY-MM-DD HH:MM:SS[.fff]" in UTC without a zone marker.
      const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(lastSeen) ? lastSeen : `${lastSeen.replace(" ", "T")}Z`
      emailToLastSeen.set(email.trim(), iso)
    }
  } catch (err) {
    console.error("[PostHog] Error fetching last-active:", err)
    return emailToLastSeen
  }

  cachedResult = { at: Date.now(), data: emailToLastSeen }
  return emailToLastSeen
}
