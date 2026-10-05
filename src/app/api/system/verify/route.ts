import { NextResponse } from "next/server";
import {
  getSubscriptionByMachine,
  getSubscriptionBySubscriberId,
  getAllSubscriptions,
  activateSubscription,
  suspendSubscription,
  deleteSubscription,
  adjustSubscriptionDays,
  addAllowedDevice,
  removeAllowedDevice,
  setPrimaryDevice,
  editAllowedDevice,
  generateSignedToken,
  verifySignedToken,
  validateAdminAuthorization,
} from "@/lib/subscriptionManager";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";

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
  return NextResponse.json(data, {
    status: init?.status || 200,
    headers: CORS_HEADERS,
  });
}

// ===== GET: Verify subscription status for a machine =====
export async function GET(request: Request) {
  // Rate Limit: 20 verify requests per minute per IP (prevent brute-force on machineId)
  if (!checkRateLimit(request, { maxRequests: 20, windowMs: 60_000, prefix: "verify-get" })) {
    return rateLimitExceededResponse(60);
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Securely provide SUPABASE_SERVICE_ROLE_KEY to authenticated admin portal from local .env
  if (action === "GET_SERVICE_KEY") {
    if (!validateAdminAuthorization(request)) {
      return jsonResponse({ error: "Unauthorized: Master Administrative Secret required" }, { status: 401 });
    }
    return jsonResponse({
      success: true,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    });
  }

  const machineId = searchParams.get("machineId");
  const subscriberId = searchParams.get("subscriberId");

  if (!machineId) {
    return jsonResponse({ error: "machineId is required" }, { status: 400 });
  }

  const now = new Date();

  try {
    let sub = await getSubscriptionByMachine(machineId);
    if (!sub && subscriberId) {
      sub = await getSubscriptionBySubscriberId(subscriberId);
    }

    // [SECURITY FIX CRIT-02]: Removed auto-selection of the sole active subscription.
    // A device must be explicitly registered before it can use the system.

    if (!sub) {
      return jsonResponse({ success: false, status: "none", machineId });
    }

    let status = sub.status;
    const expiry = sub.expiresAt ? new Date(sub.expiresAt) : null;

    // Auto-expire if past expiry date
    if (status === "ACTIVE" && expiry && expiry <= now) {
      status = "EXPIRED";
    }

    if (status === "ACTIVE" && expiry && expiry > now) {
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const token = generateSignedToken(machineId, sub.expiresAt!, sub.subscriberId);
      return jsonResponse({
        success: true,
        status: "active",
        subscription: sub,
        daysRemaining,
        expiresAt: sub.expiresAt,
        token,
      });
    }

    return jsonResponse({
      success: true,
      status: status.toLowerCase(),
      subscription: sub,
      expiresAt: sub.expiresAt,
    });
  } catch (err: any) {
    console.error("[SystemVerify GET] Database query failed:", err.message);

    // Fallback: If DB is unreachable, check client-provided offlineToken
    const offlineToken = searchParams.get("token");
    if (offlineToken) {
      const parsed = verifySignedToken(offlineToken);
      if (
        parsed &&
        parsed.status === "active" &&
        parsed.machineId === machineId.trim() // ← Machine binding check
      ) {
        const expiry = new Date(parsed.expiresAt);
        if (expiry > now) {
          const daysRemaining = Math.max(
            0,
            Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          );
          return jsonResponse({
            success: true,
            status: "active",
            daysRemaining,
            expiresAt: parsed.expiresAt,
            token: offlineToken,
            offlineFallback: true,
          });
        }
      }
    }

    return jsonResponse({
      success: false,
      status: "error",
      message: "فشل الاتصال بقاعدة البيانات",
    });
  }
}

// ===== PATCH: Admin actions (activate, suspend, adjust days, device management) =====
export async function PATCH(request: Request) {
  // Rate Limit: 60 admin operations per minute
  if (!checkRateLimit(request, { maxRequests: 60, windowMs: 60_000, prefix: "verify-patch" })) {
    return rateLimitExceededResponse(60);
  }

  // CRITICAL SECURITY CHECK: Master Administrative Authorization Required
  if (!validateAdminAuthorization(request)) {
    return jsonResponse(
      { error: "Unauthorized: Master Administrative Secret is required to perform this action" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, action, durationDays, daysDelta, machineId, oldMachineId, newMachineId } = body;

    if (!id || !action) {
      return jsonResponse({ error: "id and action are required" }, { status: 400 });
    }

    switch (action) {
      case "ACTIVATE": {
        const days = Number(durationDays) || 30;
        const updated = await activateSubscription(id, days);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        // Generate signed token upon activation bound to subscriber
        const token = generateSignedToken(updated.machineId, updated.expiresAt!, updated.subscriberId);
        return jsonResponse({ success: true, subscription: { ...updated, signatureToken: token } });
      }

      case "SUSPEND": {
        const updated = await suspendSubscription(id);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        return jsonResponse({ success: true, subscription: updated });
      }

      case "ADJUST_DAYS": {
        const delta = Number(daysDelta);
        if (isNaN(delta)) {
          return jsonResponse({ error: "daysDelta must be a number" }, { status: 400 });
        }
        const updated = await adjustSubscriptionDays(id, delta);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        const token = generateSignedToken(updated.machineId, updated.expiresAt!, updated.subscriberId);
        return jsonResponse({ success: true, subscription: { ...updated, signatureToken: token } });
      }

      case "ADD_DEVICE": {
        if (!machineId) {
          return jsonResponse({ error: "machineId is required for ADD_DEVICE" }, { status: 400 });
        }
        const updated = await addAllowedDevice(id, machineId);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        return jsonResponse({ success: true, subscription: updated });
      }

      case "REMOVE_DEVICE": {
        if (!machineId) {
          return jsonResponse({ error: "machineId is required for REMOVE_DEVICE" }, { status: 400 });
        }
        const updated = await removeAllowedDevice(id, machineId);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        return jsonResponse({ success: true, subscription: updated });
      }

      case "SET_PRIMARY_DEVICE": {
        if (!machineId) {
          return jsonResponse({ error: "machineId is required for SET_PRIMARY_DEVICE" }, { status: 400 });
        }
        const updated = await setPrimaryDevice(id, machineId);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        return jsonResponse({ success: true, subscription: updated });
      }

      case "EDIT_DEVICE": {
        const targetOld = oldMachineId || machineId;
        if (!targetOld || !newMachineId) {
          return jsonResponse({ error: "oldMachineId and newMachineId are required for EDIT_DEVICE" }, { status: 400 });
        }
        const updated = await editAllowedDevice(id, targetOld, newMachineId);
        if (!updated) {
          return jsonResponse({ error: "Subscription not found" }, { status: 404 });
        }
        return jsonResponse({ success: true, subscription: updated });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[SystemVerify PATCH] Error:", err.message);
    return jsonResponse({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// ===== DELETE: Remove subscription =====
export async function DELETE(request: Request) {
  // Rate Limit: 10 deletes per minute per IP
  if (!checkRateLimit(request, { maxRequests: 10, windowMs: 60_000, prefix: "verify-delete" })) {
    return rateLimitExceededResponse(60);
  }

  // CRITICAL SECURITY CHECK: Master Administrative Authorization Required
  if (!validateAdminAuthorization(request)) {
    return jsonResponse(
      { error: "Unauthorized: Master Administrative Secret is required to perform this action" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return jsonResponse({ error: "id is required" }, { status: 400 });
    }

    await deleteSubscription(id);
    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[SystemVerify DELETE] Error:", err.message);
    return jsonResponse({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
