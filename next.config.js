/** @type {import('next').NextConfig} */

const remotePatterns = [
  { protocol: "https", hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com" },
  { protocol: "https", hostname: "cdn.worldvectorlogo.com" },
  { protocol: "https", hostname: "upload.wikimedia.org" },
  { protocol: "https", hostname: "logos-world.net" },
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
  typescript: {
    ignoreBuildErrors: true,
  },
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
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig
