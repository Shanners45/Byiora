import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/settings", "/transactions", "/checkout/*", "/verify-guest/*"],
      },
    ],
    sitemap: "https://www.byiora.com.np/sitemap.xml",
    host: "https://www.byiora.com.np",
  }
}
