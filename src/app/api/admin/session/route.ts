import { apiError, apiJson, preflight, readJsonBody } from "@/lib/apiHttp";
import {
  ADMIN_CSRF_HEADER,
  buildAdminLogoutCookie,
  buildAdminSessionCookie,
  createAdminSessionToken,
  isAdminRequest,
  verifyAdminCredentials,
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
 * Portal login. Credentials are verified server-side against environment hashes;
 * the browser only receives an httpOnly session cookie.
 */
export async function POST(request: Request) {
  if (shouldProxy()) return proxyToCloud(request, "/api/admin/session");

  if (!checkRateLimit(request, { maxRequests: 8, windowMs: 15 * 60_000, prefix: "admin-login" })) {
    return rateLimitExceededResponse(request, 900);
  }

  const body = await readJsonBody<{ email?: string; password?: string; pin?: string }>(request, 8 * 1024);
  if (!body.ok) return apiError(request, "بيانات دخول غير صالحة.", 400);

  const result = verifyAdminCredentials({
    email: String(body.data.email || ""),
    password: String(body.data.password || ""),
    pin: String(body.data.pin || ""),
  });

  if (!result.ok) {
    // 600ms damper slows automated guessing without harming a real operator.
    await new Promise((r) => setTimeout(r, 600));
    return apiError(
      request,
      result.reason === "invalid"
        ? "بيانات الدخول أو رمز الأمان غير صحيحة."
        : result.reason || "فشل التحقق من بيانات الدخول.",
      401
    );
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
