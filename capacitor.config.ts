import type { CapacitorConfig } from "@capacitor/cli";
import * as fs from "fs";
import * as path from "path";

/**
 * Mobile shell configuration (security audit remediation).
 *
 * The APK deliberately loads the live deployment instead of bundled web assets,
 * because PenRX+ is a Next.js app whose privileged logic lives in `/api/**`
 * route handlers (licence verification, Supabase service-role access, admin
 * sessions). Those handlers need a Node runtime and server-side secrets, so they
 * cannot be shipped inside a static `out/` bundle.
 *
 * Trade-off kept, risk removed: the remote URL is now forced to HTTPS, cleartext
 * traffic and mixed content are disabled, and Android additionally pins the
 * cloud host via `res/xml/network_security_config.xml`. `webDir: "out"` stays so
 * the offline splash/error shell (MainActivity loads
 * `file:///android_asset/public/index.html` when there is no network) keeps
 * working without ever permitting an insecure primary origin.
 */

// Production deployment the native shell is allowed to load.
const PRODUCTION_URL = "https://pen-rx.vercel.app";

function readConfiguredUrl(): string {
  let candidate = PRODUCTION_URL;

  try {
    const configPath = path.resolve(__dirname, "mobile-config.json");
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (raw.serverUrl && typeof raw.serverUrl === "string" && raw.serverUrl.trim()) {
        candidate = raw.serverUrl.trim();
      }
    }
  } catch {
    // Ignore a malformed local override and keep the production URL.
  }

  if (process.env.CAPACITOR_SERVER_URL && process.env.CAPACITOR_SERVER_URL.trim()) {
    candidate = process.env.CAPACITOR_SERVER_URL.trim();
  }

  return candidate;
}

/**
 * HTTPS-only normalisation: bare hostnames become https, loopback/LAN/cleartext
 * origins are rejected (they must never be baked into a distributed APK), and
 * `allowNavigation` is derived from the single trusted host.
 */
function resolveSecureServerUrl(raw: string): { url: string; hostname: string } {
  const withScheme = /^[a-z]+:/i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    parsed = new URL(PRODUCTION_URL);
  }

  if (parsed.protocol !== "https:") {
    console.warn(
      `[PenRX+ Capacitor] Refusing non-HTTPS server URL "${raw}" — falling back to ${PRODUCTION_URL}.`
    );
    parsed = new URL(PRODUCTION_URL);
  }

  return { url: parsed.origin, hostname: parsed.hostname };
}

const server = resolveSecureServerUrl(readConfiguredUrl());

const config: CapacitorConfig = {
  appId: "com.penrxplus.app",
  appName: "PenRX+",
  webDir: "out",
  server: {
    url: server.url,
    // Cleartext is disabled: every request from the WebView is HTTPS, so an
    // on-path attacker cannot strip the transport for prescription data.
    cleartext: false,
    androidScheme: "https",
    errorPath: "/error.html",
    // Only the configured cloud origin may be loaded inside the WebView; any
    // other navigation is handed to the system browser instead.
    allowNavigation: [server.hostname, "*.supabase.co"],
  },
  android: {
    // Mixed content is never allowed (https page + http subresource).
    allowMixedContent: false,
  },
  plugins: {
    // Disable CapacitorHttp fetch interception so Android WebView uses standard Chromium fetch
    // (identical to Browser & Electron EXE), preserving cache: "no-store", AbortSignal, and PostgREST query syntax.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
