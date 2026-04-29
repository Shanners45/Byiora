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
    }
  })
}
