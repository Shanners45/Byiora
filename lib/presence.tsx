"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"

/**
 * Live "who is on the site right now" via Supabase Realtime Presence.
 *
 * Presence is push-based over the websocket the app already opens for
 * notifications: no polling, no database writes, and a closed tab disappears
 * immediately because the socket drops. A user is only tracked while their tab
 * is visible, and multiple tabs share one presence key, so hiding one tab does
 * not mark them offline while another is still open.
 *
 * The only data on the channel is the user's UUID and a timestamp — no name,
 * email or IP. Presence is a cosmetic indicator and is never used for
 * authorization.
 */
export const PRESENCE_CHANNEL = "site:presence"

export function PresenceTracker() {
  const { user } = useAuth()
  const pathname = usePathname()
  const userId = user?.id ?? null
  const isAdminArea = Boolean(pathname?.startsWith("/admin"))

  useEffect(() => {
    if (!userId || isAdminArea) return

    const supabase = createClient()
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    })
    let joined = false

    const syncTracking = async () => {
      if (!joined) return
      try {
        if (document.visibilityState === "visible") {
          await channel.track({ online_at: new Date().toISOString() })
        } else {
          await channel.untrack()
        }
      } catch {
        // Presence is best-effort; the next sync or visibility change retries.
      }
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        joined = true
        void syncTracking()
      }
    })

    const onVisibilityChange = () => void syncTracking()
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      joined = false
      document.removeEventListener("visibilitychange", onVisibilityChange)
      void channel.untrack()
      void supabase.removeChannel(channel)
    }
  }, [userId, isAdminArea])

  return null
}

/**
 * Who is online now (Realtime presence), plus when each user went offline
 * while this page was open. The leave time is exact even if the user's last
 * heartbeat write was cut off by closing the tab.
 */
export function usePresence(): { online: Set<string>; leftAt: Record<string, string> } {
  const [online, setOnline] = useState<Set<string>>(new Set())
  const [leftAt, setLeftAt] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(PRESENCE_CHANNEL)

    channel
      .on("presence", { event: "sync" }, () => {
        const next = new Set(Object.keys(channel.presenceState()))
        setOnline((prev) => {
          if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev
          const gone = [...prev].filter((id) => !next.has(id))
          if (gone.length) {
            const now = new Date().toISOString()
            setLeftAt((m) => ({ ...m, ...Object.fromEntries(gone.map((id) => [id, now])) }))
          }
          return next
        })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return { online, leftAt }
}
