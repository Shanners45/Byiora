import sanitize from "sanitize-html"

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
