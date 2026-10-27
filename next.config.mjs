/**
 * PenRX+ Next.js configuration.
 *
 * Hardening notes (security audit remediation):
 * - Type and lint errors are no longer suppressed: a broken or unsafe build fails.
 * - CORS is NOT configured here. Every API route answers with the strict origin
 *   allowlist implemented in `src/lib/httpSecurity.ts`
 *   (`PENRX_ALLOWED_ORIGINS` + `NEXT_PUBLIC_APP_URL` + built-in local origins),
 *   with `Access-Control-Allow-Credentials`. A static `*` header emitted at the
 *   edge would both weaken that allowlist and collide with the per-route header.
 * - `images.remotePatterns` is an explicit allowlist. The app only renders
 *   same-origin artwork through `next/image` (`/logo-penrx.jpg`, `/icon-192.png`);
 *   arbitrary remote pictures (doctor's clinic logo, `data:` uploads) go through a
 *   plain `<img>` element, so no remote host is permitted for the image optimizer.
 * - Static pages: `portal.html`, `download.html`, `mobile.html` and `error.html`
 *   live in `public/` and are reachable through the rewrites below (`/portal`,
 *   `/admin/portal`, `/download`). They are served by the same Next server that
 *   Electron packs, so the `output`/`.next` packaging contract is unchanged.
 */

/** @type {import('next').NextConfig} */

// The Electron desktop shell loads the bundled Next server over plain
// `http://localhost:<port>`, therefore `upgrade-insecure-requests` must NOT be
// emitted (it would rewrite the loopback origin to https and blank the window).
const isProduction = process.env.NODE_ENV === "production";

// The standalone pages in `public/` and the App Router payload both rely on:
//   * inline <script> blocks + Tailwind Play CDN (cdn.tailwindcss.com, JIT styles)
//   * inline style="..." attributes and injected <style> elements
//     (src/components/prescription/LivePrescriptionPreview.tsx injects print CSS)
//   * Google Fonts, lucide from unpkg, QR images from api.qrserver.com
// `script-src`/`style-src` therefore keep `'unsafe-inline'`; tightening them to
// nonces requires an `.html` -> React-page migration of the static portal/landing
// pages and is tracked as a follow-up.
//
// `default-src` and `connect-src` are deliberately NOT declared: `public/mobile.html`
// and `public/portal.html` call the Supabase REST endpoint and `api.fda.gov`
// directly from the browser, and the Capacitor shell talks to whichever
// `PENRX_CLOUD_API_URL` origin the owner configures. A list that missed one of
// those hosts would break drug search and licence verification with no visible
// error — far worse than leaving outbound connections to the (already strict)
// server-side CORS allowlist.
const cspHeader = [
  [
    "script-src 'self' 'unsafe-inline'",
    "https://cdn.tailwindcss.com",
    "https://unpkg.com",
    "https://api.qrserver.com",
    isProduction ? null : "'unsafe-eval'", // webpack dev overlay / HMR in `next dev`
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// HTML document responses only: `/api/**` answers with its own hardened header
// set (`securityHeaders()` in `src/lib/httpSecurity.ts`), so it is excluded here
// to avoid duplicate/conflicting values.
const htmlMatcher = "/((?!api/).*)";

const nextConfig = {
  reactStrictMode: true,
  staticPageGenerationTimeout: 180,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async rewrites() {
    return [
      {
        source: "/download",
        destination: "/download.html",
      },
      {
        source: "/portal",
        destination: "/portal.html",
      },
      {
        source: "/admin/portal",
        destination: "/portal.html",
      },
    ];
  },
  async headers() {
    return [
      {
        source: htmlMatcher,
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
