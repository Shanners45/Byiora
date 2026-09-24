import sanitize from "sanitize-html"

/**
 * Decode common HTML entities (&amp;, &lt;, &gt;, &quot;, &#39;, &apos;)
 * Handles nested encodings (e.g. &amp;amp; -> &)
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return ""
  let current = str
  for (let i = 0; i < 3; i++) {
    const next = current
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
    if (next === current) break
    current = next
  }
  return current
}

/**
 * Sanitize plain-text fields (labels, titles, names, questions).
 * Strips HTML tags and decodes HTML entities so characters like &, <, >, ", '
 * are stored and rendered naturally as plain text in React.
 */
export function sanitizePlainText(input: string): string {
  if (!input) return ""
  const stripped = input.replace(/<[^>]*>?/gm, "").trim()
  return decodeHtmlEntities(stripped)
}

/**
 * Strips HTML tags and cleans up whitespace for previewing rich-text content in tables.
 * Hides raw tags like <ul>, <li>, <p>, <a> and decodes HTML entities.
 */
export function stripHtmlTags(input: string): string {
  if (!input) return ""
  return decodeHtmlEntities(
    input
      .replace(/<\/li>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/gm, "")
      .replace(/\s+/g, " ")
      .trim()
  )
}

/**
 * Sanitize user-provided HTML for safe embedding.
 * Allows basic formatting tags and Tailwind CSS classes.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ""
  return sanitize(input, {
    allowedTags: [
      "b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "div", "span"
    ],
    allowedAttributes: {
      "*": ["class"],
      "a": ["href", "name", "target", "rel"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ? String(attribs.href).trim() : ""
        const target = attribs.target ? String(attribs.target) : undefined

        const safe: Record<string, string> = { ...attribs }
        if (href) safe.href = href

        if (target === "_blank") {
          const rel = new Set(
            (safe.rel || "")
              .split(/\s+/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
          rel.add("noopener")
          rel.add("noreferrer")
          safe.rel = Array.from(rel).join(" ")
        }

        return { tagName, attribs: safe }
      },
    },
  })
}
