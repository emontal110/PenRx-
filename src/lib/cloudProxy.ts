/**
 * PenRX+ Cloud Proxy Layer
 *
 * The desktop build ships a local Next.js server inside a publicly distributed
 * installer. That local server must NEVER hold server-side secrets (Supabase
 * service role key, HMAC signing key, database URL).
 *
 * When cloud credentials are absent (packaged desktop runtime), privileged API
 * routes transparently forward the request to the authoritative cloud
 * deployment (Vercel), which holds the secrets in its environment. Clients are
 * completely unaffected: same endpoints, same request/response shapes.
 */

const DEFAULT_CLOUD_API_URL = "https://pen-rx.vercel.app";

export const CLOUD_API_BASE = (
  process.env.PENRX_CLOUD_API_URL ||
  DEFAULT_CLOUD_API_URL
).replace(/\/+$/, "");

/**
 * Universal API URL Resolver for Capacitor APK, Electron EXE, and Web
 * Converts relative `/api/...` endpoints to absolute Vercel cloud URLs
 * when running in Capacitor native WebView or static origins.
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (typeof window === "undefined") {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.PENRX_CLOUD_API_URL || DEFAULT_CLOUD_API_URL;
    return `${base.replace(/\/+$/, "")}${cleanEndpoint}`;
  }

  // Check if running inside Capacitor Android/iOS Native, localhost, or file://
  const isCapacitor =
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "file:" ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    Boolean((window as any).Capacitor?.getPlatform?.() === "android") ||
    Boolean((window as any).Capacitor?.getPlatform?.() === "ios") ||
    (typeof navigator !== "undefined" && /capacitor/i.test(navigator.userAgent));

  const isStaticHost = window.location.origin.includes("github.io");

  if (isCapacitor || isStaticHost) {
    const cloudBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      DEFAULT_CLOUD_API_URL
    ).replace(/\/+$/, "");
    return `${cloudBase}${cleanEndpoint}`;
  }

  return cleanEndpoint;
}

const PROXY_TIMEOUT_MS = 20_000;

const PROXY_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-admin-key, x-master-secret, apikey",
};

/**
 * True when this server instance holds server-side cloud credentials
 * (cloud deployment / local development with a full .env).
 * False for the packaged desktop runtime → routes must proxy.
 */
export function hasCloudCredentials(): boolean {
  if (process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return true;
  }
  // The desktop runtime (Electron) must always proxy to authoritative cloud
  if (process.env.PENRX_DESKTOP_RUNTIME === "1" || process.env.ELECTRON_RUN_AS_NODE === "1") {
    return false;
  }
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DATABASE_URL);
}

/**
 * Forwards a request to the cloud deployment, preserving method, query,
 * body, and authorization headers. Returns the cloud response as-is.
 */
export async function proxyToCloud(request: Request, path: string): Promise<Response> {
  const incoming = new URL(request.url);
  const target = `${CLOUD_API_BASE}${path}${incoming.search}`;

  const headers = new Headers();
  for (const name of ["authorization", "x-admin-key", "x-master-secret", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: string | undefined;
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    body = await request.text();
  }

  try {
    const cloudRes = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const text = await cloudRes.text();
    return new Response(text, {
      status: cloudRes.status,
      headers: {
        "Content-Type": cloudRes.headers.get("content-type") || "application/json",
        ...PROXY_CORS_HEADERS,
      },
    });
  } catch (err: any) {
    const message =
      err?.name === "TimeoutError"
        ? "انتهت مهلة الاتصال بخدمة PenRX+ السحابية. تحقق من اتصالك بالإنترنت."
        : "تعذر الاتصال بخدمة PenRX+ السحابية. تحقق من اتصالك بالإنترنت.";
    return new Response(JSON.stringify({ error: message, proxied: true }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...PROXY_CORS_HEADERS },
    });
  }
}
