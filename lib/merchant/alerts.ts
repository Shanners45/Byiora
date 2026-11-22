import { rateLimit } from "@/lib/rate-limit"

// Staff alerts for merchant events, posted to the same Discord channel as storefront order alerts.

export async function alertStaff(title: string, fields: { name: string; value: string; inline?: boolean }[], color = 0x7e3af2, dedupeKey?: string) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  try {
    // Repeats of the same alert (e.g. one product out of stock) are sent at most once an hour.
    if (dedupeKey && !(await rateLimit(`staff-alert:${dedupeKey}`, { windowMs: 3_600_000, max: 1 })).ok) return
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{ title, color, fields: fields.map((f) => ({ ...f, value: f.value.slice(0, 1000) || "-" })), timestamp: new Date().toISOString() }] }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (e: any) {
    console.error("[staff alert] failed:", e?.message)
  }
}
