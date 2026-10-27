import { apiError, apiJson, preflight } from "@/lib/apiHttp";
import { isAdminRequest } from "@/lib/adminAuth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { countPendingSubscriptions, getAllSubscriptions } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

const LIST_PREFIX = "admin-sub-list";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Portal queue: every subscription, optionally filtered by status or search text. */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/admin/subscriptions");
  if (!isAdminRequest(request)) return apiError(request, "جلسة إدارية مطلوبة.", 401);

  if (!checkRateLimit(request, { maxRequests: 240, windowMs: 60_000, prefix: LIST_PREFIX })) {
    return rateLimitExceededResponse(request, 30);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  const subscriptions = await getAllSubscriptions({ status, search });
  const pending = await countPendingSubscriptions().catch(() => 0);

  return apiJson(request, {
    success: true,
    subscriptions,
    counts: {
      total: subscriptions.length,
      pending,
      active: subscriptions.filter((s) => s.status === "ACTIVE").length,
    },
  });
}
