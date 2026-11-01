import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BUILTIN_ORIGINS = [
  "capacitor://localhost",
  "https://localhost",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function normalizeOrigin(value: string): string {
  return (value || "").trim().replace(/\/+$/, "");
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  const clean = normalizeOrigin(origin);
  if (BUILTIN_ORIGINS.includes(clean)) return true;

  const appUrl = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || "");
  if (appUrl && clean === appUrl) return true;

  const envOrigins = (process.env.PENRX_ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return envOrigins.includes(clean);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "";

  // 1. Centralized CORS Preflight for /api/* routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const isAllowed = isAllowedOrigin(origin);
    const headers = new Headers();

    if (isAllowed && origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, X-Device-Token, X-Penrx-Admin, Pragma, Cache-Control"
      );
      headers.set("Access-Control-Max-Age", "600");
    }

    headers.set("Vary", "Origin");
    return new NextResponse(null, { status: 204, headers });
  }

  // 2. Process request & set security headers
  const response = NextResponse.next();

  // If valid origin, set CORS headers on response
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  // Baseline Security Headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico)).*)",
  ],
};

