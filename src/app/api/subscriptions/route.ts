import {
  apiError,
  apiJson,
  cleanMachineId,
  cleanOrderId,
  cleanPhone,
  cleanSubscriberId,
  preflight,
  readJsonBody,
} from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import {
  cancelPendingSubscription,
  linkDeviceToSubscriber,
  resolveDeviceSubscription,
  submitSubscription,
  updateSubscriptionDoctorProfile,
} from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * GET returns the caller's own subscription. Payment evidence is redacted unless
 * the requesting device provably owns the record, so an order id cannot be used to
 * read another doctor's data.
 */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/subscriptions");

  if (!checkRateLimit(request, { maxRequests: 120, windowMs: 60_000, prefix: "sub-get" })) {
    return rateLimitExceededResponse(request, 30);
  }

  const { searchParams } = new URL(request.url);
  const machineId = cleanMachineId(searchParams.get("machineId"));
  const altMachineId = cleanMachineId(searchParams.get("altMachineId"));
  const subscriberId = cleanSubscriberId(searchParams.get("subscriberId"));
  const orderId = cleanOrderId(searchParams.get("id"));

  if (!machineId && !subscriberId && !orderId) {
    return apiError(request, "machineId أو subscriberId أو id مطلوب.", 400);
  }
  if (!machineId) {
    // Without a device id there is no ownership proof: nothing is returned.
    return apiJson(request, { subscription: null });
  }

  const subscription = await resolveDeviceSubscription({
    machineId,
    altMachineId: altMachineId || undefined,
    subscriberId: subscriberId || undefined,
    orderId: orderId || undefined,
  });

  if (!subscription) return apiJson(request, { subscription: null });

  const owns =
    subscription.machineId === machineId ||
    (subscription.allowedMachineIds || []).includes(machineId) ||
    (subscriberId && subscription.subscriberId === subscriberId);

  const payload = owns
    ? subscription
    : { ...subscription, senderPhone: undefined, transactionRef: undefined };

  return apiJson(request, { subscription: payload });
}

/**
 * Doctor-facing actions: submit a payment request, link an extra device, cancel a
 * pending request, or correct the clinic profile. Prices and durations are always
 * taken from the server plan catalogue.
 */
export async function POST(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/subscriptions");

  if (!checkRateLimit(request, { maxRequests: 15, windowMs: 10 * 60_000, prefix: "sub-post" })) {
    return rateLimitExceededResponse(request, 600);
  }

  const body = await readJsonBody<Record<string, any>>(request);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const data = body.data;
  const action = String(data.action || "").trim();

  try {
    if (action === "link_device") {
      const subscriberId = cleanSubscriberId(data.subscriberId);
      const machineId = cleanMachineId(data.machineId);
      const phone = cleanPhone(data.verificationPhone);

      if (!subscriberId || !machineId) return apiError(request, "كود المشترك وكود الجهاز مطلوبان.", 400);
      if (!phone) return apiError(request, "رقم هاتف التحقق مطلوب لإتمام ربط الجهاز الجديد.", 400);

      const result = await linkDeviceToSubscriber(subscriberId, machineId, phone);
      if (!result.success) return apiError(request, result.error || "فشل ربط الجهاز.", 400);

      return apiJson(request, {
        success: true,
        message: "تم ربط الجهاز الجديد بنجاح بحساب المشترك",
        subscription: result.subscription,
      });
    }

    if (action === "cancel_request") {
      const id = cleanOrderId(data.id);
      const machineId = cleanMachineId(data.machineId);
      if (!id || !machineId) return apiError(request, "معرّف الطلب وكود الجهاز مطلوبان.", 400);

      const cancelled = await cancelPendingSubscription(id, machineId);
      if (!cancelled) return apiError(request, "لم يتم العثور على الطلب المطلوب إلغاؤه.", 404);

      return apiJson(request, { success: true, message: "تم إلغاء طلب الاشتراك وحذفه." });
    }

    if (action === "update_profile") {
      const machineId = cleanMachineId(data.machineId);
      if (!machineId) return apiError(request, "كود الجهاز مطلوب لتحديث بيانات الاشتراك.", 400);

      const own = await resolveDeviceSubscription({ machineId, subscriberId: cleanSubscriberId(data.subscriberId) || undefined });
      if (!own) return apiError(request, "لم يتم العثور على اشتراك مطابق.", 404);

      const updated = await updateSubscriptionDoctorProfile(
        own.subscriberId,
        String(data.doctorName || ""),
        String(data.clinicName || ""),
        String(data.phone || "")
      );

      return apiJson(request, {
        success: true,
        message: "تم تحديث ومزامنة بيانات الطبيب والعيادة مع البورتال",
        subscription: updated,
      });
    }

    // New subscription request
    const machineId = cleanMachineId(data.machineId);
    if (!machineId) return apiError(request, "كود الجهاز مطلوب.", 400);

    const subscription = await submitSubscription({
      id: cleanOrderId(data.id) || undefined,
      planId: String(data.planId || ""),
      paymentMethod: String(data.paymentMethod || "vodafone"),
      senderPhone: String(data.senderPhone || ""),
      transactionRef: String(data.transactionRef || ""),
      machineId,
      allowedMachineIds: Array.isArray(data.allowedMachineIds) ? data.allowedMachineIds : [machineId],
      doctorName: String(data.doctorName || ""),
      clinicName: String(data.clinicName || ""),
    });

    return apiJson(request, { success: true, subscription });
  } catch (err: any) {
    const message =
      err?.name === "SupabaseRestError"
        ? "تعذر حفظ طلب الاشتراك حالياً. حاول مرة أخرى بعد لحظات."
        : err?.message || "تعذر تنفيذ الطلب.";
    console.error("[Subscriptions POST]", err?.message || err);
    return apiError(request, message, err?.name === "SupabaseRestError" ? 502 : 400);
  }
}

/** Kept for older installed builds: a pending request can also be withdrawn with DELETE. */
export async function DELETE(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/subscriptions");

  if (!checkRateLimit(request, { maxRequests: 10, windowMs: 10 * 60_000, prefix: "sub-delete" })) {
    return rateLimitExceededResponse(request, 600);
  }

  const { searchParams } = new URL(request.url);
  const id = cleanOrderId(searchParams.get("id"));
  const machineId = cleanMachineId(searchParams.get("machineId"));
  if (!id || !machineId) return apiError(request, "معرّف الطلب وكود الجهاز مطلوبان.", 400);

  const cancelled = await cancelPendingSubscription(id, machineId);
  if (!cancelled) return apiError(request, "لم يتم العثور على الطلب.", 404);

  return apiJson(request, { success: true, message: "تم إلغاء طلب الاشتراك." });
}
