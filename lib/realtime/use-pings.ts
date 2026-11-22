"use client"

import { useEffect, useRef } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Listens on a private Realtime channel for data-free "something changed" pings
 * (see lib/realtime/broadcast.ts). Bursts are coalesced into one callback.
 */
export function useRealtimePings(client: SupabaseClient<any>, topic: string | null, onPing: (events: string[]) => void, debounceMs = 400) {
  const cb = useRef(onPing)
  cb.current = onPing

  useEffect(() => {
    if (!topic) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: string[] = []
    let channel: ReturnType<SupabaseClient<any>["channel"]> | undefined

    ;(async () => {
      // Private channels authorise with the signed-in user's token (RLS on realtime.messages).
      await client.realtime.setAuth()
      if (cancelled) return
      channel = client
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "*" }, (msg) => {
          pending.push(msg.event)
          clearTimeout(timer)
          timer = setTimeout(() => {
            const events = pending
            pending = []
            cb.current(events)
          }, debounceMs)
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (channel) client.removeChannel(channel)
    }
  }, [client, topic, debounceMs])
}
