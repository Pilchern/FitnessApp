import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * The app had none. The most load-bearing of these is the Content-Security
 * Policy: the Supabase session cookies are now `httpOnly` (see
 * `src/lib/auth-cookie-options.ts`), and a CSP is the other half of that
 * defence — it limits what an injected script could reach even if one ran.
 *
 * `'unsafe-inline'` on script-src is required by Next's App Router, which
 * inlines its bootstrap and flight payloads without a nonce unless the whole
 * app opts into nonce-based CSP via middleware. That is a larger change than
 * belongs here; the directive is still worth setting for the connect-src,
 * frame-ancestors, and object-src restrictions it does enforce.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Next's App Router inlines its bootstrap without a nonce.
      "script-src 'self' 'unsafe-inline'",
      // Tailwind's runtime style injection.
      "style-src 'self' 'unsafe-inline'",
      // Supabase (auth + REST) is the only cross-origin destination.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@fitness-app/application",
    "@fitness-app/domain",
    "@fitness-app/infrastructure",
    "@fitness-app/integrations",
    "@fitness-app/jobs",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
