import {
  LeanCloudPrescription,
  LeanPrescriptionItem,
  RETENTION_MS,
  decompressPrescription,
} from "@/lib/prescriptionSync";
import {
  deletePrescriptionRelational,
  savePrescriptionRelational,
} from "@/lib/relationalStorage";
import { apiError, apiJson, cleanSubscriberId, preflight, readJsonBody } from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { readDeviceToken } from "@/lib/deviceAuth";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabaseRest } from "@/lib/supabaseRest";
import { getSubscriptionBySubscriberId, machineOwnsSubscription } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

const TABLE = "CloudPrescription";
const MAX_RECORDS = 300;

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/** Minifies medication items before storing in JSONB to keep free-tier usage low. */
function minifyItemsForDb(items: LeanPrescriptionItem[]): LeanPrescriptionItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map((it) => {
    const out: LeanPrescriptionItem = { n: String(it.n || "").trim().slice(0, 120) };
    if (it.a && String(it.a).trim()) out.a = String(it.a).trim().slice(0, 120);
    if (it.q && String(it.q).trim() && String(it.q).trim() !== "1") out.q = String(it.q).trim().slice(0, 20);
    if (it.f && String(it.f).trim()) out.f = String(it.f).trim().slice(0, 40);
    if (it.fr && String(it.fr).trim()) out.fr = String(it.fr).trim().slice(0, 80);
    if (it.d && String(it.d).trim()) out.d = String(it.d).trim().slice(0, 50);
    if (it.i && String(it.i).trim()) out.i = String(it.i).trim().slice(0, 160);
    return out;
  });
}

function toLean(row: any): LeanCloudPrescription {
  return {
    id: row.id,
    subId: row.subscriberId,
    pNo: row.prescriptionNo,
    bId: row.branchId || undefined,
    bName: row.branchName || undefined,
    pName: row.patientName,
    pPhone: row.patientPhone || undefined,
    pAge: row.patientAge || undefined,
    pGen: row.patientGender || undefined,
    diag: row.diagnosis || undefined,
    notes: row.notes || undefined,
    items: Array.isArray(row.itemsJson) ? row.itemsJson : [],
    ts: row.createdAt,
    arc: row.isArchived ? true : undefined,
    arcAt: row.archivedAt || undefined,
  } as LeanCloudPrescription;
}

/**
 * Tenant gate. Access requires a device token minted by this server for an ACTIVE
 * subscription; the subscription is re-read every call so suspension or expiry is
 * enforced immediately, and the token's device must still belong to it.
 */
async function authorizeTenant(
  request: Request
): Promise<{ ok: true; subscriberId: string } | { ok: false; message: string; status: number }> {
  const token = readDeviceToken(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: "انتهت صلاحية رمز الجهاز. سيتم إعادة التحقق من الاشتراك تلقائياً.",
    };
  }

  const subscriberId = cleanSubscriberId(token.subscriberId);
  if (!subscriberId) return { ok: false, status: 400, message: "معرّف مشترك غير صالح." };

  const sub = await getSubscriptionBySubscriberId(subscriberId).catch(() => null);
  if (!sub) return { ok: false, status: 403, message: "حساب المشترك غير مسجل." };
  if (sub.status !== "ACTIVE") {
    return { ok: false, status: 403, message: "الاشتراك موقوف أو منتهي. يرجى التجديد للوصول للسجلات السحابية." };
  }
  if (!machineOwnsSubscription(sub, token.machineId)) {
    return { ok: false, status: 403, message: "هذا الجهاز غير مرتبط بحساب المشترك المطلوب." };
  }

  return { ok: true, subscriberId };
}

/** The doctor's own prescriptions inside the retention window, always read from PostgreSQL. */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/prescriptions/sync");

  if (!checkRateLimit(request, { maxRequests: 30, windowMs: 60_000, prefix: "rx-sync-get" })) {
    return rateLimitExceededResponse(request, 60);
  }

  const auth = await authorizeTenant(request);
  if (!auth.ok) return apiError(request, auth.message, auth.status);

  const minDate = new Date(Date.now() - RETENTION_MS).toISOString();
  let rows: any[] | null;
  try {
    rows = await supabaseRest<any[]>(TABLE, {
      query:
        `subscriberId=eq.${encodeURIComponent(auth.subscriberId)}` +
        `&createdAt=gte.${encodeURIComponent(minDate)}` +
        `&order=createdAt.desc&limit=${MAX_RECORDS}`,
    });
  } catch (err: any) {
    console.error("[RxSync GET]", err?.message || err);
    return apiError(request, "تعذر الوصول للسجلات السحابية حالياً.", 502);
  }

  const prescriptions = (Array.isArray(rows) ? rows : []).map(toLean);
  return apiJson(request, {
    success: true,
    subscriberId: auth.subscriberId,
    prescriptions,
    count: prescriptions.length,
    retentionDays: Math.round(RETENTION_MS / 86_400_000),
  });
}

/**
 * SAVE and DELETE are persisted before responding. Acknowledging a write that was
 * never stored is how prescriptions get silently lost, so failures return 502 and
 * the device keeps the item in its retry queue.
 */
export async function POST(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/prescriptions/sync");

  if (!checkRateLimit(request, { maxRequests: 60, windowMs: 60_000, prefix: "rx-sync-post" })) {
    return rateLimitExceededResponse(request, 60);
  }

  const body = await readJsonBody<{
    action?: string;
    prescriptionId?: string;
    data?: any;
  }>(request, 256 * 1024);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const { action, prescriptionId, data } = body.data;

  if (action === "PURGE_OLD") {
    if (!isAdminRequest(request)) return apiError(request, "جلسة إدارية مطلوبة.", 401);
    const minDate = new Date(Date.now() - RETENTION_MS).toISOString();
    const removed = await supabaseRest<any[]>(TABLE, {
      method: "DELETE",
      query: `createdAt=lt.${encodeURIComponent(minDate)}`,
      prefer: "return=representation",
    }).catch(() => null);
    return apiJson(request, { success: true, purgedCount: Array.isArray(removed) ? removed.length : 0 });
  }

  const auth = await authorizeTenant(request);
  if (!auth.ok) return apiError(request, auth.message, auth.status);

  try {
    if (action === "SAVE") {
      if (!data || !data.id) return apiError(request, "بيانات الروشتة مفقودة.", 400);

      const rxTime = new Date(data.ts).getTime();
      if (!data.arc && !isNaN(rxTime) && Date.now() - rxTime > RETENTION_MS) {
        return apiJson(request, { success: false, message: "الروشتة أقدم من فترة الاحتفاظ السحابي." });
      }

      const compactItems = minifyItemsForDb(data.items);
      const row = {
        id: String(data.id).slice(0, 64),
        subscriberId: auth.subscriberId,
        prescriptionNo: String(data.pNo || "").slice(0, 40),
        branchId: data.bId ? String(data.bId).slice(0, 64) : null,
        branchName: data.bName ? String(data.bName).slice(0, 80) : null,
        patientName: String(data.pName || "").slice(0, 120),
        patientPhone: data.pPhone ? String(data.pPhone).replace(/\D/g, "").slice(0, 15) : null,
        patientAge: data.pAge ? String(data.pAge).slice(0, 10) : null,
        patientGender: data.pGen ? String(data.pGen).slice(0, 10) : null,
        diagnosis: data.diag ? String(data.diag).slice(0, 500) : null,
        notes: data.notes ? String(data.notes).slice(0, 1000) : null,
        itemsJson: compactItems,
        createdAt: data.ts || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await supabaseRest(TABLE, {
        method: "POST",
        query: "on_conflict=id",
        body: row,
        prefer: "resolution=merge-duplicates,return=minimal",
      });

      if (process.env.ENABLE_RELATIONAL_DUAL_WRITE === "true") {
        savePrescriptionRelational(
          decompressPrescription({ ...data, items: compactItems }),
          undefined,
          auth.subscriberId
        ).catch((err) => console.warn("[RxSync dual-write] notice:", err?.message || err));
      }

      return apiJson(request, {
        success: true,
        action: "SAVE",
        prescriptionId: row.id,
        storedInBucket: auth.subscriberId,
      });
    }

    if (action === "DELETE") {
      const id = String(prescriptionId || data?.id || "").slice(0, 64);
      if (!id) return apiError(request, "معرّف الروشتة مطلوب.", 400);

      await supabaseRest(TABLE, {
        method: "DELETE",
        query: `id=eq.${encodeURIComponent(id)}&subscriberId=eq.${encodeURIComponent(auth.subscriberId)}`,
      });

      if (process.env.ENABLE_RELATIONAL_DUAL_WRITE === "true") {
        deletePrescriptionRelational(id).catch((err) => console.warn("[RxSync dual-delete] notice:", err?.message || err));
      }

      return apiJson(request, { success: true, action: "DELETE", prescriptionId: id });
    }

    return apiError(request, `إجراء غير معروف: ${action}`, 400);
  } catch (err: any) {
    console.error("[PrescriptionSyncAPI]", err?.message || err);
    return apiError(request, "تعذر حفظ الروشتة سحابياً. ستعاد المحاولة تلقائياً من الجهاز.", 502);
  }
}
