/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Fuerza HTTPS durante 2 años, incluye subdominios y preload
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Evita que la app sea embebida en iframes de otros dominios (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Evita MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Controla información de referrer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deshabilita features del browser que no necesitamos
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // XSS filter legacy browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Content Security Policy
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
  poweredByHeader: false,
  compress: true,
}

export default nextConfig
