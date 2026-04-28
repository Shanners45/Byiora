import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/settings", "/transactions"],
      },
    ],
    sitemap: "https://www.byiora.store/sitemap.xml",
  }
}
