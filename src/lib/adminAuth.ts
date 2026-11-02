/**
 * Administrator session for the control portal.
 *
 * The portal is a static page: it holds NO credentials and NO hashes. The
 * administrator types their email, password and PIN, the server derives the
 * hashes and compares them with the values configured in the environment, and
 * the browser only ever receives an httpOnly signed session cookie.
 */

import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { getAdminSecret } from "@/lib/env";

export const ADMIN_COOKIE_NAME = "penrx_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Custom header required on admin mutations: cross-origin forms cannot set it. */
export const ADMIN_CSRF_HEADER = "x-penrx-admin";

const LEGACY_PASSWORD_SALT = "rosheta_secure_salt_2026_v1";
const PASSWORD_ITERATIONS = 10000;
const PASSWORD_KEY_LENGTH_BYTES = 64;

function readEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function adminSalt(): string {
  return readEnv("PENRX_ADMIN_SALT") || LEGACY_PASSWORD_SALT;
}

export function deriveAdminPasswordHash(password: string): string {
  return pbkdf2Sync(
    String(password || ""),
    Buffer.from(adminSalt(), "utf8"),
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH_BYTES,
    "sha512"
  ).toString("hex");
}

export function deriveAdminPinHash(pin: string): string {
  return createHash("sha256").update(String(pin || "").trim(), "utf8").digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || "").toLowerCase(), "hex");
  const bufB = Buffer.from(String(b || "").toLowerCase(), "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

function constantTimeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies admin credentials via Supabase GoTrue Auth API.
 * Allows easy login with Email and Password from any device, with dashboard management.
 */
export async function verifySupabaseAdminAuth(
  email: string,
  password: string
): Promise<{ ok: boolean; reason?: string; user?: any }> {
  try {
    const projectUrl = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).trim().replace(/\/+$/, "");

    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    const apiKey = anonKey || serviceKey;

    if (!projectUrl || (!serviceKey && !anonKey)) {
      return { ok: false, reason: "إعدادات Supabase غير مهيأة على السيرفر." };
    }

    const authUrl = `${projectUrl}/auth/v1/token?grant_type=password`;
    const res = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      const errDetail =
        data.error_description || data.msg || data.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      return { ok: false, reason: errDetail };
    }

    // Optional admin email restriction: if configured in env, ensure it matches
    const expectedEmail = (process.env.PENRX_ADMIN_EMAIL || "").trim();
    if (expectedEmail && data.user?.email) {
      if (data.user.email.toLowerCase() !== expectedEmail.toLowerCase()) {
        return { ok: false, reason: "هذا الحساب غير مصرح له بالدخول كمسؤول للنظام." };
      }
    }

    return { ok: true, user: data.user };
  } catch (err: any) {
    return { ok: false, reason: err?.message || "تعذر الاتصال بخدمة المصادقة." };
  }
}

/**
 * Sends a password reset email to the admin via Supabase Auth.
 */
export async function sendSupabasePasswordReset(email: string): Promise<{ ok: boolean; message: string }> {
  try {
    const projectUrl = (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).trim().replace(/\/+$/, "");

    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    const apiKey = anonKey || serviceKey;

    if (!projectUrl || (!serviceKey && !anonKey)) {
      return { ok: false, message: "إعدادات Supabase غير مهيأة على السيرفر." };
    }

    const res = await fetch(`${projectUrl}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, message: data.msg || data.message || "تعذر إرسال رابط الاستعادة." };
    }

    return { ok: true, message: "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "خطأ أثناء الاتصال بخادم الاستعادة." };
  }
}

/**
 * Verifies portal credentials against environment configuration only.
 * Returns null when the portal is not configured, so callers can fail closed.
 */
export function verifyAdminCredentials(input: {
  email: string;
  password: string;
  pin: string;
}): { ok: boolean; reason?: string } {
  const expectedEmail = readEnv("PENRX_ADMIN_EMAIL");
  const expectedPasswordHash = readEnv("PENRX_ADMIN_PASSWORD_HASH");
  const expectedPinHash = readEnv("PENRX_ADMIN_PIN_HASH");

  if (!expectedEmail || !expectedPasswordHash || !expectedPinHash) {
    return {
      ok: false,
      reason:
        "بوابة الإدارة غير مُهيّأة: اضبط PENRX_ADMIN_EMAIL و PENRX_ADMIN_PASSWORD_HASH و PENRX_ADMIN_PIN_HASH على Vercel.",
    };
  }

  if (!constantTimeEqualText(String(input.email || "").trim().toLowerCase(), expectedEmail.toLowerCase())) {
    return { ok: false, reason: "invalid" };
  }
  if (!constantTimeEqualHex(deriveAdminPasswordHash(input.password), expectedPasswordHash)) {
    return { ok: false, reason: "invalid" };
  }
  if (!constantTimeEqualHex(deriveAdminPinHash(input.pin), expectedPinHash)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}

/** Hashes credentials with the configured salt so they can be pasted into Vercel env. */
export function buildAdminCredentialEnv(password: string, pin: string): Record<string, string> {
  return {
    PENRX_ADMIN_SALT: adminSalt(),
    PENRX_ADMIN_PASSWORD_HASH: deriveAdminPasswordHash(password),
    PENRX_ADMIN_PIN_HASH: deriveAdminPinHash(pin),
  };
}

function sessionSignature(expiry: number, issuedAt: number, nonce: string): string {
  return createHmac("sha256", getAdminSecret())
    .update(`penrx-admin-session|${expiry}|${issuedAt}|${nonce}`)
    .digest("hex");
}

export function createAdminSessionToken(now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const expiry = issuedAt + ADMIN_SESSION_TTL_SECONDS;
  const nonce = randomBytes(8).toString("hex");
  return `${expiry}.${issuedAt}.${nonce}.${sessionSignature(expiry, issuedAt, nonce)}`;
}

export function verifyAdminSessionToken(token: string, now = Date.now()): boolean {
  const [expiryRaw, issuedRaw, nonce, signature] = (token || "").split(".");
  if (!expiryRaw || !issuedRaw || !nonce || !signature) return false;

  const expiry = Number(expiryRaw);
  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(expiry) || !Number.isFinite(issuedAt)) return false;
  if (expiry * 1000 <= now) return false;
  if (issuedAt * 1000 > now + 60_000) return false;
  if (expiry - issuedAt > ADMIN_SESSION_TTL_SECONDS + 60) return false;

  try {
    return constantTimeEqualHex(signature, sessionSignature(expiry, issuedAt, nonce));
  } catch {
    return false;
  }
}

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return "";
}

/** Admin mutations must also carry the custom header, which cross-site requests cannot add. */
export function isAdminRequest(request: Request, now = Date.now()): boolean {
  if (!verifyAdminSessionToken(readCookie(request, ADMIN_COOKIE_NAME), now)) return false;
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method.toUpperCase())) {
    return request.headers.get(ADMIN_CSRF_HEADER) === "1";
  }
  return true;
}

export function buildAdminSessionCookie(token: string): string {
  return [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
  ].join("; ");
}

export function buildAdminLogoutCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Machine-to-machine secret (scripts and automation), never used by the browser. */
export function checkAdminSecret(candidate: string): boolean {
  try {
    return constantTimeEqualText((candidate || "").trim(), getAdminSecret());
  } catch {
    return false;
  }
}
