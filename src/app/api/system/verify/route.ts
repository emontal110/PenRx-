import {
  apiError,
  apiJson,
  cleanMachineId,
  cleanOrderId,
  cleanSubscriberId,
  preflight,
} from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { resolveDeviceSubscription } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * License verification for the installed app on a specific device.
 *
 * The answer always comes from PostgreSQL, so a portal activation is visible on
 * the very next poll. A successful ACTIVE check returns a short-lived signed
 * device token which the app must present to the medical-data endpoints; a token
 * supplied by the client is never accepted as proof of a license.
 */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/system/verify");

  if (!checkRateLimit(request, { maxRequests: 120, windowMs: 60_000, prefix: "verify-get" })) {
    return rateLimitExceededResponse(request, 15);
  }

  const { searchParams } = new URL(request.url);
  const machineId = cleanMachineId(searchParams.get("machineId"));
  const altMachineId = cleanMachineId(searchParams.get("altMachineId"));
  const subscriberId = cleanSubscriberId(searchParams.get("subscriberId"));
  const orderId = cleanOrderId(searchParams.get("id"));

  if (!machineId && !subscriberId && !orderId) {
    return apiError(request, "machineId أو subscriberId أو id مطلوب.", 400);
  }
  if (!machineId) return apiJson(request, { success: true, status: "none" });

  const sub = await resolveDeviceSubscription({
    machineId,
    altMachineId: altMachineId || undefined,
    subscriberId: subscriberId || undefined,
    orderId: orderId || undefined,
  });

  if (!sub) {
    return apiJson(request, { success: false, status: "none", machineId });
  }

  if (sub.status !== "ACTIVE") {
    return apiJson(request, {
      success: true,
      status: sub.status.toLowerCase(),
      subscription: sub,
      expiresAt: sub.expiresAt || null,
    });
  }

  const now = Date.now();
  const expiryTime = sub.expiresAt ? new Date(sub.expiresAt).getTime() : 0;
  const daysRemaining = expiryTime
    ? Math.max(0, Math.ceil((expiryTime - now) / 86_400_000))
    : sub.durationDays;

  return apiJson(request, {
    success: true,
    status: "active",
    subscription: sub,
    daysRemaining,
    expiresAt: sub.expiresAt,
    token: sub.signatureToken,
  });
}
