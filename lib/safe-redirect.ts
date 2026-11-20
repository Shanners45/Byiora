/**
 * Returns a same-origin path safe to assign to window.location.href.
 * Anything that could leave the site (absolute URLs, protocol-relative URLs,
 * backslash tricks, control characters, javascript: schemes) falls back.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return fallback

  try {
    const base = "https://byiora.internal"
    const url = new URL(value, base)
    if (url.origin !== base) return fallback
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
