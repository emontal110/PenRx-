/**
 * Sliding-window in-memory rate limiter for PenRX+ API routes.
 *
 * Per-server-instance is acceptable here: it is a brute-force damper, not the
 * authorization layer. Keys combine the route purpose and the client IP so a
 * noisy mobile poller cannot exhaust the admin login budget.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const ENTRY_RETENTION_MS = 10 * 60 * 1000;

let cleanupScheduled = false;
function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < ENTRY_RETENTION_MS);
      if (entry.timestamps.length === 0) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "local";
}

export function checkRateLimit(
  request: Request,
  options: { maxRequests: number; windowMs: number; prefix?: string; keySuffix?: string }
): boolean {
  scheduleCleanup();

  const { maxRequests, windowMs, prefix = "api", keySuffix = "" } = options;
  const key = `${prefix}:${clientIp(request)}:${keySuffix}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { timestamps: [] };

  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= maxRequests) {
    rateLimitStore.set(key, entry);
    return false;
  }

  entry.timestamps.push(now);
  rateLimitStore.set(key, entry);
  return true;
}

export function retryAfterSeconds(options: { windowMs: number }): number {
  return Math.max(1, Math.ceil(options.windowMs / 1000));
}

/** Builds a 429 response; CORS/no-store headers come from the shared helpers. */
export function rateLimitExceededResponse(request: Request, retryAfter = 60) {
  // Imported lazily so this module stays usable from non-route contexts.
  const { NextResponse } = require("next/server");
  return NextResponse.json(
    { error: "طلبات كثيرة جداً. يرجى المحاولة لاحقاً.", success: false, retryAfterSeconds: retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
