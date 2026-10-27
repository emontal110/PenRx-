/**
 * Cross-origin policy for PenRX+ APIs.
 *
 * Wildcard CORS is disabled: the admin endpoints authenticate with cookies and
 * the medical-data endpoints are tenant-scoped, so responses may only be shared
 * with origins on the explicit allowlist.
 */

const BUILTIN_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function normalizeOrigin(value: string): string {
  return (value || "").trim().replace(/\/+$/, "");
}

export function allowedOrigins(): string[] {
  const fromEnv = (process.env.PENRX_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  const appUrl = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || "");
  const extra = appUrl && !appUrl.includes("your-penrx-app") ? [appUrl] : [];

  return Array.from(new Set([...BUILTIN_ORIGINS, ...extra, ...fromEnv]));
}

export function resolveOrigin(request: Request): string | null {
  const origin = normalizeOrigin(request.headers.get("origin") || "");
  if (!origin) return null;
  return allowedOrigins().includes(origin) ? origin : null;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = resolveOrigin(request);
  if (!origin) {
    return { Vary: "Origin" };
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Device-Token, X-Penrx-Admin, Pragma, Cache-Control",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Baseline response headers for every API response. */
export function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
  };
}

export const NO_STORE_HEADERS = securityHeaders();
