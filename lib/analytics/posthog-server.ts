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

interface PostHogPerson {
  id: number
  distinct_ids: string[]
  properties: Record<string, any>
  created_at: string
}

interface PostHogPersonsResponse {
  results: PostHogPerson[]
  next?: string | null
}

/**
 * Fetch all identified persons from PostHog and return a map of
 * email → last_seen_at ISO string.
 *
 * We page through results in batches of 100 (PostHog default) and
 * cap at 2000 persons to avoid runaway queries.
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
    let url: string | null = `${POSTHOG_HOST}/api/projects/${PROJECT_ID}/persons/?format=json`
    let pages = 0
    const MAX_PAGES = 20 // Safety cap: 20 × 100 = 2000 persons max

    while (url && pages < MAX_PAGES) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes in Next.js fetch cache
      })

      if (!res.ok) {
        console.error(`[PostHog] Persons API returned ${res.status}: ${await res.text().catch(() => "")}`)
        break
      }

      const data: PostHogPersonsResponse = await res.json()

      for (const person of data.results || []) {
        const email = (
          person.properties?.email ||
          person.properties?.$email ||
          ""
        ).toLowerCase().trim()

        if (!email) continue

        // PostHog stores `$last_seen_at` automatically for identified persons
        const lastSeen =
          person.properties?.$last_seen_at ||
          person.properties?.last_seen_at ||
          person.created_at

        if (lastSeen) {
          // If we already have a value, keep the more recent one
          const existing = emailToLastSeen.get(email)
          if (!existing || new Date(lastSeen) > new Date(existing)) {
            emailToLastSeen.set(email, lastSeen)
          }
        }
      }

      url = data.next || null
      pages++
    }
  } catch (err) {
    console.error("[PostHog] Error fetching persons for last-active:", err)
  }

  cachedResult = { at: Date.now(), data: emailToLastSeen }
  return emailToLastSeen
}
