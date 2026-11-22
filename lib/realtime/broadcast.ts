// Server → browser "something changed" pings over Supabase Realtime private channels.
// Payloads carry no data: listeners refetch through their normal authorised actions,
// and RLS on realtime.messages decides who may join each channel.

export async function broadcast(messages: { topic: string; event: string; payload?: Record<string, unknown> }[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !messages.length) return
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.map((m) => ({ topic: m.topic, event: m.event, payload: m.payload ?? {}, private: true })) }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (e: any) {
    console.error("[realtime] broadcast failed:", e?.message)
  }
}

export const merchantTopic = (merchantId: string) => `merchant:${merchantId}`
export const ADMIN_MERCHANTS_TOPIC = "admin:merchants"
