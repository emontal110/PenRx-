import { apiError, apiJson, preflight, readJsonBody } from "@/lib/apiHttp";
import {
  ADMIN_CSRF_HEADER,
  buildAdminLogoutCookie,
  buildAdminSessionCookie,
  createAdminSessionToken,
  isAdminRequest,
  verifyAdminCredentials,
  verifySupabaseAdminAuth,
  sendSupabasePasswordReset,
} from "@/lib/adminAuth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** The local desktop server holds no admin configuration: always defer to the cloud. */
function shouldProxy(): boolean {
  return !hasCloudCredentials();
}

export async function GET(request: Request) {
  if (shouldProxy()) return proxyToCloud(request, "/api/admin/session");

  const authenticated = isAdminRequest(request);
  return apiJson(request, {
    success: true,
    authenticated,
    csrfHeader: ADMIN_CSRF_HEADER,
  });
}

/**
 * Portal login & password recovery via Supabase Auth (or legacy credentials fallback).
 */
export async function POST(request: Request) {
  if (shouldProxy()) return proxyToCloud(request, "/api/admin/session");

  if (!checkRateLimit(request, { maxRequests: 10, windowMs: 15 * 60_000, prefix: "admin-login" })) {
    return rateLimitExceededResponse(request, 900);
  }

  const body = await readJsonBody<{
    action?: string;
    email?: string;
    password?: string;
    pin?: string;
  }>(request, 8 * 1024);
  if (!body.ok) return apiError(request, "بيانات غير صالحة.", 400);

  // Handle password recovery request
  if (body.data.action === "recover") {
    const email = String(body.data.email || "").trim();
    if (!email) return apiError(request, "يرجى كتابة البريد الإلكتروني.", 400);
    const result = await sendSupabasePasswordReset(email);
    return apiJson(request, { success: result.ok, message: result.message }, { status: result.ok ? 200 : 400 });
  }

  const email = String(body.data.email || "").trim();
  const password = String(body.data.password || "");

  if (!email || !password) {
    return apiError(request, "يرجى إدخال البريد الإلكتروني وكلمة المرور.", 400);
  }

  // 1. Primary: Verify through Supabase GoTrue Auth
  let authResult = await verifySupabaseAdminAuth(email, password);

  // 2. Fallback: If Supabase Auth fails, check if legacy PBKDF2 credentials match (if configured)
  if (!authResult.ok) {
    const legacy = verifyAdminCredentials({
      email,
      password,
      pin: String(body.data.pin || ""),
    });
    if (legacy.ok) {
      authResult = { ok: true };
    }
  }

  if (!authResult.ok) {
    // 500ms delay protects against brute force attacks
    await new Promise((r) => setTimeout(r, 500));
    return apiError(request, authResult.reason || "بيانات الدخول غير صحيحة.", 401);
  }

  return apiJson(
    request,
    { success: true, message: "تم تسجيل الدخول بنجاح.", ttlSeconds: 8 * 60 * 60 },
    { headers: { "Set-Cookie": buildAdminSessionCookie(createAdminSessionToken()) } }
  );
}

export async function DELETE(request: Request) {
  if (shouldProxy()) return proxyToCloud(request, "/api/admin/session");

  return apiJson(
    request,
    { success: true, message: "تم إنهاء الجلسة." },
    { headers: { "Set-Cookie": buildAdminLogoutCookie() } }
  );
}
