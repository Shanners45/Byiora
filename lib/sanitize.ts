/**
 * Sanitize user-provided strings for safe HTML embedding.
 * Escapes characters that could lead to XSS attacks.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ""
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}
