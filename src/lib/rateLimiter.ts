/**
 * PenRX+ Server-Side Rate Limiter
 *
 * A sliding-window, in-memory rate limiter for API route protection.
 * Prevents brute-force, DoS, and enumeration attacks.
 *
 * Usage:
 *   const allowed = checkRateLimit(request, { maxRequests: 10, windowMs: 60000 });
 *   if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

// Global store: key → list of request timestamps within window
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up stale entries periodically to avoid memory growth.
 * Runs automatically every 5 minutes.
 */
let cleanupScheduled = false;
function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 10 * 60 * 1000);
      if (entry.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Extracts a client identifier from the request for rate limit keying.
 * Uses X-Forwarded-For, X-Real-IP, or falls back to a constant for local.
 */
function getClientKey(request: Request, prefix: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = (fwd?.split(",")[0] || realIp || "localhost").trim();
  return `${prefix}:${ip}`;
}

/**
 * Checks if the request exceeds the rate limit.
 * @returns true if request is ALLOWED, false if it should be BLOCKED (429)
 */
export function checkRateLimit(
  request: Request,
  options: {
    maxRequests: number;
    windowMs: number;
    prefix?: string;
  }
): boolean {
  scheduleCleanup();

  const { maxRequests, windowMs, prefix = "api" } = options;
  const key = getClientKey(request, prefix);
  const now = Date.now();

  const entry = rateLimitStore.get(key) || { timestamps: [] };

  // Slide window: remove timestamps older than windowMs
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    rateLimitStore.set(key, entry);
    return false; // BLOCKED
  }

  entry.timestamps.push(now);
  rateLimitStore.set(key, entry);
  return true; // ALLOWED
}

/**
 * Returns a standard 429 Too Many Requests response.
 */
export function rateLimitExceededResponse(retryAfterSeconds = 60) {
  const { NextResponse } = require("next/server");
  return NextResponse.json(
    {
      error: "طلبات كثيرة جداً. يرجى المحاولة لاحقاً.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": "10",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-master-secret, apikey",
      },
    }
  );
}
