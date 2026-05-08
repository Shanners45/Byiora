/** @type {import('next').NextConfig} */

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
    // Mitigation for Next.js image cache exhaustion advisories
    // (keeps cache bounded on disk)
    maximumDiskCacheSize: 512 * 1024 * 1024, // 512MB
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
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://*.supabase.co https://www.byiora.store https://byiora.store https://hebbkx1anhila5yf.public.blob.vercel-storage.com https://cdn.worldvectorlogo.com https://upload.wikimedia.org https://logos-world.net; font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://challenges.cloudflare.com; connect-src 'self' wss://*.supabase.co https://*.supabase.co https://*.resend.com https://api.upstash.com https://cloudflareinsights.com; worker-src 'self' blob:; upgrade-insecure-requests;"
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
