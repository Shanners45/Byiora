/**
 * Public base URL for server-to-server callbacks (QStash jobs, webhook relays).
 * Never falls back to localhost in production: QStash refuses loopback addresses,
 * which silently disabled every background job when NEXT_PUBLIC_SITE_URL was unset.
 */
export function publicSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
  if (process.env.VERCEL_ENV === "production") return "https://www.byiora.com.np"
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
