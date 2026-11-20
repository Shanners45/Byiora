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

/** Set of user IDs currently tracked on the presence channel, pushed on change. */
export function useOnlineUserIds(): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(PRESENCE_CHANNEL)

    channel
      .on("presence", { event: "sync" }, () => {
        const next = new Set(Object.keys(channel.presenceState()))
        setOnlineIds((prev) => {
          if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev
          return next
        })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return onlineIds
}
