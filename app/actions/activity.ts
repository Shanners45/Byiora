"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const THROTTLE_MS = 60_000

/**
 * Records the signed-in user's activity so the admin dashboard can show a
 * reliable "last active" timestamp even when PostHog is unavailable.
 *
 * Throttled to one write per minute per user via a conditional UPDATE.
 */
export async function touchLastActiveAction(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const h = await headers()
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null

    const cutoff = new Date(Date.now() - THROTTLE_MS).toISOString()
    const service = createServiceRoleClient()

    await (service.from("users") as any)
      .update({
        last_active_at: new Date().toISOString(),
        ...(ip ? { last_ip: ip } : {}),
      })
      .eq("id", user.id)
      .or(`last_active_at.is.null,last_active_at.lt.${cutoff}`)
  } catch {
    // Best-effort heartbeat — never block the UI
  }
}
