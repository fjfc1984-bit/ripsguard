/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://checkout.bold.co",
      "style-src 'self' 'unsafe-inline' https://checkout.bold.co",
      "img-src 'self' data: blob: https://*.supabase.co https://checkout.bold.co https://*.bold.co",
      "font-src 'self' https://checkout.bold.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.bold.co",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://checkout.bold.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  experimental: {
    serverActions: {
      // Safeguard para future API routes que reciban archivos RIPS
      bodySizeLimit: '500mb',
    },
  },
  poweredByHeader: false,
  compress: true,
}

export default nextConfig
