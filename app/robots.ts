import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/api/*",
          "/auth/*",
          "/settings",
          "/transactions",
          "/checkout/*",
          "/verify-guest/*",
          "/monitoring-tunnel",
        ],
      },
      // AI Answer Engine bots — explicitly ALLOW for AEO visibility
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/auth/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
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
