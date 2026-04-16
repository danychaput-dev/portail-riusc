import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche le chargement dans un iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Empêche le sniffing MIME type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Active la protection XSS du navigateur
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // Contrôle les infos envoyées dans le Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS pour 1 an (inclut sous-domaines)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  // Désactive les APIs navigateur non nécessaires
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://api.mapbox.com https://cdn.jsdelivr.net https://embed.tawk.to https://*.tawk.to",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com https://*.tawk.to",
      "img-src 'self' data: blob: https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://*.tiles.mapbox.com https://*.tawk.to",
      "font-src 'self' https://fonts.gstatic.com https://*.tawk.to",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://n8n.aqbrs.ca https://*.tawk.to wss://*.tawk.to",
      "frame-src 'self' https://*.tawk.to",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Appliquer à toutes les routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;