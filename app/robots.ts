import type { MetadataRoute } from "next"

// A named user-agent group replaces "*" for that bot, so every group must repeat the full list.
const PRIVATE_PATHS = [
  "/admin",
  "/admin/*",
  "/api/*",
  "/auth/*",
  "/settings",
  "/transactions",
  "/checkout/*",
  "/verify-guest/*",
  "/monitoring-tunnel",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // AI Answer Engine bots — explicitly ALLOW for AEO visibility
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Block known bad bots
      {
        userAgent: "AhrefsBot",
        disallow: "/",
      },
      {
        userAgent: "SemrushBot",
        disallow: "/",
      },
      {
        userAgent: "MJ12bot",
        disallow: "/",
      },
    ],
    sitemap: "https://www.byiora.com.np/sitemap.xml",
    host: "https://www.byiora.com.np",
  }
}
