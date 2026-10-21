import { NextResponse } from "next/server";
import {
  getAllSubscriptions,
  getSubscriptionByMachine,
  getSubscriptionBySubscriberId,
  submitSubscription,
  linkDeviceToSubscriber,
  updateSubscriptionDoctorProfile,
  deleteSubscription,
  validateAdminAuthorization,
  machineOwnsSubscription,
} from "@/lib/subscriptionManager";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-key, x-master-secret, apikey",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function jsonResponse(data: any, init?: { status?: number }) {
  return NextResponse.json(
    { ...data, serverTime: Date.now() },
    {
      status: init?.status || 200,
      headers: CORS_HEADERS,
    }
  );
}

export async function GET(request: Request) {
  // Packaged desktop runtime holds no cloud credentials — forward to the cloud API transparently
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/subscriptions");
  }

  // Rate Limit: 30 requests per minute per IP (prevent subscription enumeration)
  if (!checkRateLimit(request, { maxRequests: 30, windowMs: 60_000, prefix: "sub-get" })) {
    return rateLimitExceededResponse(60);
  }

  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");
    const subscriberId = searchParams.get("subscriberId");

    // Redact payment metadata unless the caller's machine actually owns the record
    const redactPaymentFields = (sub: any) =>
      sub ? { ...sub, senderPhone: undefined, transactionRef: undefined } : sub;

    // Machine-specific or Subscriber-specific lookup
    if (machineId) {
      const cleanMachineId = machineId.trim();
      let match = await getSubscriptionByMachine(cleanMachineId);

      // If not matched directly by machine, check subscriberId
      if (!match && subscriberId) {
        match = await getSubscriptionBySubscriberId(subscriberId.trim());
        if (match && !machineOwnsSubscription(match, cleanMachineId)) {
          match = redactPaymentFields(match);
        }
      }

      // [SECURITY FIX CRIT-02]: Auto-linking unknown devices has been REMOVED.
      // Devices must now be explicitly linked by an admin or via the link_device flow.

      return jsonResponse({ subscription: match });
    }

    if (subscriberId) {
      const match = await getSubscriptionBySubscriberId(subscriberId.trim());
      return jsonResponse({ subscription: redactPaymentFields(match) });
    }

    // CRITICAL SECURITY CHECK: Viewing all subscriptions requires Master Administrative Secret
    if (!validateAdminAuthorization(request)) {
      return jsonResponse(
        { error: "Unauthorized: Master Administrative credentials required to list all subscriptions" },
        { status: 401 }
      );
    }

    const subscriptions = await getAllSubscriptions();
    return jsonResponse({ success: true, subscriptions });
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Failed to fetch subscriptions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Packaged desktop runtime holds no cloud credentials — forward to the cloud API transparently
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/subscriptions");
  }

  // Rate Limit: 5 subscription submissions per 10 minutes per IP
  if (!checkRateLimit(request, { maxRequests: 5, windowMs: 10 * 60_000, prefix: "sub-post" })) {
    return rateLimitExceededResponse(600);
  }

  try {
    const body = await request.json();
    const { action } = body;

    // Doctor linking their second/third device to existing subscriber ID
    if (action === "link_device") {
      const { subscriberId, machineId, verificationPhone } = body;
      if (!subscriberId || !machineId) {
        return jsonResponse(
          { error: "معرّف المشترك وكود الجهاز مطلوبان لإتمام عملية الربط" },
          { status: 400 }
        );
      }
      if (!verificationPhone || !String(verificationPhone).trim()) {
        return jsonResponse(
          { error: "رقم هاتف التحقق مطلوب لإتمام ربط الجهاز الجديد (يجب أن يطابق الرقم المسجل)" },
          { status: 400 }
        );
      }

      const result = await linkDeviceToSubscriber(subscriberId, machineId, verificationPhone);
      if (!result.success) {
        return jsonResponse({ error: result.error || "فشل ربط الجهاز" }, { status: 400 });
      }

      return jsonResponse({
        success: true,
        message: "تم ربط الجهاز الجديد بنجاح بحساب المشترك",
        subscription: result.subscription,
      });
    }

    // Doctor cancelling their own PENDING request before admin review
    if (action === "cancel_request") {
      const { id, subscriberId, machineId } = body;
      if (!id || !machineId) {
        return jsonResponse(
          { error: "معرّف الطلب وكود الجهاز مطلوبان لإلغاء الطلب" },
          { status: 400 }
        );
      }

      const sub = subscriberId
        ? await getSubscriptionBySubscriberId(String(subscriberId).trim())
        : await getSubscriptionByMachine(String(machineId).trim());
      if (!sub || sub.id !== id) {
        return jsonResponse({ error: "لم يتم العثور على الطلب المطلوب إلغاؤه" }, { status: 404 });
      }
      if (sub.status !== "PENDING") {
        return jsonResponse(
          { error: "لا يمكن إلغاء طلب تمت مراجعته أو تفعيله مسبقاً" },
          { status: 400 }
        );
      }
      if (!machineOwnsSubscription(sub, String(machineId).trim())) {
        return jsonResponse(
          { error: "هذا الجهاز غير مصرح له بإلغاء هذا الطلب" },
          { status: 403 }
        );
      }

      await deleteSubscription(sub.id);
      return jsonResponse({
        success: true,
        message: "تم إلغاء طلب الاشتراك وحذفه من البورتال بنجاح",
      });
    }

    // Update mandatory doctor/clinic profile on subscription for Admin Portal sync
    if (action === "update_profile") {
      const { subscriberId, machineId, doctorName, clinicName, phone } = body;
      if (!machineId) {
        return jsonResponse(
          { error: "كود الجهاز (machineId) مطلوب لتحديث بيانات الاشتراك" },
          { status: 400 }
        );
      }

      const existing = subscriberId
        ? await getSubscriptionBySubscriberId(String(subscriberId).trim())
        : await getSubscriptionByMachine(String(machineId).trim());
      if (!existing) {
        return jsonResponse(
          { error: "لم يتم العثور على اشتراك مطابق لتحديث بيانات الطبيب" },
          { status: 404 }
        );
      }
      if (!machineOwnsSubscription(existing, String(machineId).trim())) {
        return jsonResponse(
          { error: "هذا الجهاز غير مصرح له بتحديث بيانات هذا الاشتراك" },
          { status: 403 }
        );
      }

      const updated = await updateSubscriptionDoctorProfile(
        existing.subscriberId || String(machineId).trim(),
        doctorName || "",
        clinicName || "",
        phone || ""
      );

      return jsonResponse({
        success: true,
        message: "تم تحديث ومزامنة بيانات الطبيب والعيادة مع البورتال بنجاح",
        subscription: updated,
      });
    }

    // New subscription submission
    const {
      id,
      subscriberId,
      planId,
      planName,
      price,
      paymentMethod,
      senderPhone,
      transactionRef,
      machineId,
      doctorName,
      clinicName,
      durationDays,
      isTrial,
    } = body;

    if (!machineId) {
      return jsonResponse({ error: "Machine ID is required" }, { status: 400 });
    }

    // Security: Prevent Free Trial Abuse on the server
    const wantsTrial = Boolean(isTrial) || planId === "trial";
    if (wantsTrial) {
      const existing = await getSubscriptionByMachine(machineId);
      if (existing && (existing.isTrial || existing.planId === "trial")) {
        return jsonResponse(
          { error: "لقد تم الاستفادة من الفترة التجريبية المجانية مسبقاً على هذا الجهاز" },
          { status: 400 }
        );
      }
    }

    const newSub = await submitSubscription({
      id,
      subscriberId,
      planId: planId || "standard",
      planName: planName || "باقة الاشتراك",
      price: wantsTrial ? 0 : Number(price) || 0,
      paymentMethod: paymentMethod || "vodafone",
      senderPhone: senderPhone || "",
      transactionRef: transactionRef || "",
      machineId,
      doctorName,
      clinicName,
      durationDays: wantsTrial ? 30 : Number(durationDays) || 30,
      isTrial: wantsTrial,
    });

    return jsonResponse({ success: true, subscription: newSub });
  } catch (err: any) {
    console.error("Subscription create error:", err);
    return jsonResponse({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}
