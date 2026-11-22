// Self-check: node --experimental-strip-types lib/merchant/reports.check.ts
import assert from "node:assert"

// Copy of bucketKeys' calendar logic (reports.ts imports server code, so it can't run here directly).
const localDate = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
function keys(fromIso: string, toIso: string, bucket: "day" | "week" | "month", tz: string) {
  const fromMs = Date.parse(fromIso), toMs = Date.parse(toIso)
  const d = new Date(`${localDate(fromMs, tz)}T00:00:00Z`)
  if (bucket === "month") d.setUTCDate(1)
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const end = localDate(toMs - 1, tz)
  const out: string[] = []
  while (d.toISOString().slice(0, 10) <= end) {
    out.push(d.toISOString().slice(0, 10))
    if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1)
    else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7)
    else d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
}
// Joined mid-November (Nepal): monthly view starts at November, not a year of empty months.
assert.deepEqual(keys("2026-11-15T10:00:00+05:45", "2027-01-01T00:00:00+05:45", "month", "Asia/Kathmandu"), ["2026-11-01", "2026-12-01"])
// Same instant, different zone: the viewer's own calendar decides the day.
assert.deepEqual(keys("2026-11-30T20:00:00Z", "2026-12-01T18:00:00Z", "day", "Asia/Kathmandu"), ["2026-12-01"])
assert.deepEqual(keys("2026-11-30T20:00:00Z", "2026-12-01T18:00:00Z", "day", "America/New_York"), ["2026-11-30", "2026-12-01"])
// Weeks start on Monday.
assert.deepEqual(keys("2026-11-26T00:00:00Z", "2026-12-04T00:00:00Z", "week", "UTC"), ["2026-11-23", "2026-11-30"])
console.log("revenue buckets: ok")
