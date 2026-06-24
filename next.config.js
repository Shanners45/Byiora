/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs")

const remotePatterns = [
  { protocol: "https", hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com" },
  { protocol: "https", hostname: "cdn.worldvectorlogo.com" },
  { protocol: "https", hostname: "upload.wikimedia.org" },
  { protocol: "https", hostname: "logos-world.net" },
  { protocol: "https", hostname: "tkovigthghwpwbtjikyp.supabase.co" },
]

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    const host = new URL(supabaseUrl).hostname
    if (host && !remotePatterns.some((p) => p.hostname === host)) {
      remotePatterns.push({ protocol: "https", hostname: host })
    }
  }
} catch {
  // ignore invalid env at build time
}

const nextConfig = {
  allowedDevOrigins: ["192.168.1.70", "localhost"],
  images: {
    remotePatterns,
    // Serve AVIF (30% smaller than WebP) where supported, with WebP fallback
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days (trace showed max-age=0 on banner LCP)
    minimumCacheTTL: 2592000,
    // Explicit breakpoints for responsive images — prevents oversized images on mobile
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), xr-spatial-tracking=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://*.supabase.co https://www.byiora.com.np https://byiora.com.np https://hebbkx1anhila5yf.public.blob.vercel-storage.com https://cdn.worldvectorlogo.com https://upload.wikimedia.org https://logos-world.net; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' wss://*.supabase.co https://*.supabase.co https://*.resend.com https://api.upstash.com https://cloudflareinsights.com https://raw.githubusercontent.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io; worker-src 'self' blob:; upgrade-insecure-requests;"
          }
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
