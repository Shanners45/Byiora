"use server"

/**
 * Fetches the "last seen" timestamp for identified PostHog persons.
 *
 * Uses the PostHog Persons API with the personal API key to query
 * person records by their `distinct_id` (which we set to the Supabase
 * user UUID in the client-side `posthog.identify()` call).
 *
 * Returns a Map<email, lastActiveISO> that the customers action can merge.
 */

const POSTHOG_HOST = "https://us.posthog.com" // API host (not the ingestion proxy host)
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY

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

  return emailToLastSeen
}
