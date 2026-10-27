import { apiError, apiJson, cleanMachineId, preflight, readJsonBody } from "@/lib/apiHttp";
import { isAdminRequest } from "@/lib/adminAuth";
import { recordAdminAudit } from "@/lib/adminAudit";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import {
  activateSubscription,
  addAllowedDevice,
  adjustSubscriptionDays,
  deleteSubscription,
  editAllowedDevice,
  getSubscriptionById,
  removeAllowedDevice,
  setPrimaryDevice,
  suspendSubscription,
} from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!hasCloudCredentials()) return proxyToCloud(request, `/api/admin/subscriptions/${params.id}`);
  if (!isAdminRequest(request)) return apiError(request, "جلسة إدارية مطلوبة.", 401);

  const subscription = await getSubscriptionById(params.id);
  if (!subscription) return apiError(request, "لم يتم العثور على الاشتراك.", 404);
  return apiJson(request, { success: true, subscription });
}

/**
 * Administrative decisions on one subscription. Every mutation is authorized by
 * the httpOnly session cookie plus the CSRF marker header, and audited.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!hasCloudCredentials()) return proxyToCloud(request, `/api/admin/subscriptions/${params.id}`);
  if (!isAdminRequest(request)) return apiError(request, "جلسة إدارية مطلوبة.", 401);

  if (!checkRateLimit(request, { maxRequests: 120, windowMs: 60_000, prefix: "admin-patch" })) {
    return rateLimitExceededResponse(request, 30);
  }

  const body = await readJsonBody<{
    action?: string;
    durationDays?: number;
    daysDelta?: number;
    machineId?: string;
    oldMachineId?: string;
    newMachineId?: string;
  }>(request);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const { action } = body.data;
  if (!action) return apiError(request, "المُعرّف والإجراء مطلوبان.", 400);

  const existing = await getSubscriptionById(params.id);
  if (!existing) return apiError(request, "لم يتم العثور على الاشتراك.", 404);

  const audit = (detail: Record<string, unknown> = {}) =>
    recordAdminAudit({
      action,
      subscriptionId: existing.id,
      subscriberId: existing.subscriberId,
      detail,
      ip: clientIp(request),
    });

  switch (action) {
    case "ACTIVATE": {
      const updated = await activateSubscription(existing.id, body.data.durationDays);
      if (!updated) return apiError(request, "تعذر تفعيل الاشتراك.", 500);
      await audit({ durationDays: updated.durationDays, expiresAt: updated.expiresAt });
      return apiJson(request, { success: true, subscription: updated });
    }

    case "SUSPEND": {
      const updated = await suspendSubscription(existing.id);
      if (!updated) return apiError(request, "تعذر إيقاف الاشتراك.", 500);
      await audit();
      return apiJson(request, { success: true, subscription: updated });
    }

    case "ADJUST_DAYS": {
      const updated = await adjustSubscriptionDays(existing.id, Number(body.data.daysDelta));
      if (!updated) return apiError(request, "تعذر تعديل المدة.", 500);
      await audit({ daysDelta: body.data.daysDelta, expiresAt: updated.expiresAt });
      return apiJson(request, { success: true, subscription: updated });
    }

    case "ADD_DEVICE": {
      const machineId = cleanMachineId(body.data.machineId);
      if (!machineId) return apiError(request, "معرّف جهاز غير صالح.", 400);
      const updated = await addAllowedDevice(existing.id, machineId);
      if (!updated) return apiError(request, "تعذر إضافة الجهاز.", 500);
      await audit({ machineId });
      return apiJson(request, { success: true, subscription: updated });
    }

    case "REMOVE_DEVICE": {
      const machineId = cleanMachineId(body.data.machineId);
      if (!machineId) return apiError(request, "معرّف جهاز غير صالح.", 400);
      const updated = await removeAllowedDevice(existing.id, machineId);
      if (!updated) return apiError(request, "تعذر إزالة الجهاز.", 500);
      await audit({ machineId });
      return apiJson(request, { success: true, subscription: updated });
    }

    case "SET_PRIMARY_DEVICE": {
      const machineId = cleanMachineId(body.data.machineId);
      if (!machineId) return apiError(request, "معرّف جهاز غير صالح.", 400);
      const updated = await setPrimaryDevice(existing.id, machineId);
      if (!updated) return apiError(request, "تعذر تعيين الجهاز الرئيسي.", 500);
      await audit({ machineId });
      return apiJson(request, { success: true, subscription: updated });
    }

    case "EDIT_DEVICE": {
      const oldMachineId = cleanMachineId(body.data.oldMachineId || body.data.machineId);
      const newMachineId = cleanMachineId(body.data.newMachineId);
      if (!oldMachineId || !newMachineId) {
        return apiError(request, "معرّف الجهاز القديم والجديد مطلوبان.", 400);
      }
      const updated = await editAllowedDevice(existing.id, oldMachineId, newMachineId);
      if (!updated) return apiError(request, "تعذر تعديل الجهاز.", 500);
      await audit({ oldMachineId, newMachineId });
      return apiJson(request, { success: true, subscription: updated });
    }

    default:
      return apiError(request, `إجراء غير معروف: ${action}`, 400);
  }
}

/** Permanently removes the doctor and their synced cloud medical data. */
export async function DELETE(request: Request, { params }: RouteContext) {
  if (!hasCloudCredentials()) return proxyToCloud(request, `/api/admin/subscriptions/${params.id}`);
  if (!isAdminRequest(request)) return apiError(request, "جلسة إدارية مطلوبة.", 401);

  if (!checkRateLimit(request, { maxRequests: 20, windowMs: 60_000, prefix: "admin-delete" })) {
    return rateLimitExceededResponse(request, 60);
  }

  const existing = await getSubscriptionById(params.id);
  if (!existing) return apiError(request, "لم يتم العثور على الاشتراك.", 404);

  await deleteSubscription(existing.id);
  await recordAdminAudit({
    action: "DELETE",
    subscriptionId: existing.id,
    subscriberId: existing.subscriberId,
    ip: clientIp(request),
  });

  return apiJson(request, { success: true, message: "تم حذف الاشتراك وبياناته السحابية." });
}
