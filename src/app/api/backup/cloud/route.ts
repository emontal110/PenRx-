import {
  apiError,
  apiJson,
  cleanSubscriberId,
  preflight,
  readJsonBody,
} from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { readDeviceToken } from "@/lib/deviceAuth";
import { supabaseRest } from "@/lib/supabaseRest";
import { getSubscriptionBySubscriberId, machineOwnsSubscription } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

const TABLE = "CloudBackup";

/**
 * Vercel rejects request bodies above ~4.5MB, so anything larger must be refused
 * here with a message the doctor can act on instead of failing at the edge.
 */
const MAX_PAYLOAD_B64 = 4 * 1024 * 1024;

export interface CloudBackupRecord {
  id: string;
  subscriberId: string;
  machineId?: string;
  fileName: string;
  fileSizeKb: number;
  payloadBase64: string;
  metadata: any;
  createdAt: string;
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}

async function authorizeTenant(
  request: Request
): Promise<{ ok: true; subscriberId: string; machineId: string } | { ok: false; message: string; status: number }> {
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
    return { ok: false, status: 403, message: "الاشتراك موقوف أو منتهي. يرجى التجديد للوصول للنسخ السحابية." };
  }
  if (!machineOwnsSubscription(sub, token.machineId)) {
    return { ok: false, status: 403, message: "هذا الجهاز غير مرتبط بحساب المشترك المطلوب." };
  }

  return { ok: true, subscriberId, machineId: token.machineId };
}

/** Single canonical backup slot per subscriber so free-tier storage never grows. */
function backupRowId(subscriberId: string): string {
  return `cbk_${subscriberId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function toRecord(row: any): CloudBackupRecord {
  return {
    id: row.id,
    subscriberId: row.subscriberId,
    machineId: row.machineId || undefined,
    fileName: row.fileName,
    fileSizeKb: Number(row.fileSizeKb) || 0,
    payloadBase64: row.payloadBase64,
    metadata: row.metadataJson || row.metadata || {},
    createdAt: row.createdAt,
  };
}

/** GET /api/backup/cloud — always read the encrypted blob from PostgreSQL. */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/backup/cloud");

  if (!checkRateLimit(request, { maxRequests: 15, windowMs: 60_000, prefix: "cloud-backup-get" })) {
    return rateLimitExceededResponse(request, 60);
  }

  const auth = await authorizeTenant(request);
  if (!auth.ok) return apiError(request, auth.message, auth.status);

  let rows: any[] | null;
  try {
    rows = await supabaseRest<any[]>(TABLE, {
      query:
        `subscriberId=eq.${encodeURIComponent(auth.subscriberId)}` +
        `&order=createdAt.desc&limit=20`,
    });
  } catch (err: any) {
    console.error("[CloudBackup GET]", err?.message || err);
    return apiError(request, "تعذر الوصول للنسخ الاحتياطية السحابية حالياً.", 502);
  }

  const records = (Array.isArray(rows) ? rows : []).map(toRecord);
  if (records.length === 0) {
    return apiJson(request, {
      success: true,
      backup: null,
      message: "لا توجد نسخ احتياطية محفوظة سحابياً لهذا المشترك بعد",
    });
  }

  return apiJson(request, {
    success: true,
    backup: records[0],
    totalBackups: records.length,
    allBackups: records.map((b) => ({
      id: b.id,
      fileName: b.fileName,
      fileSizeKb: b.fileSizeKb,
      metadata: b.metadata,
      createdAt: b.createdAt,
    })),
  });
}

/**
 * POST /api/backup/cloud — stores the encrypted payload in the subscriber's single
 * slot. The write is awaited: acknowledging an unsaved backup is silent data loss.
 */
export async function POST(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/backup/cloud");

  if (!checkRateLimit(request, { maxRequests: 10, windowMs: 60 * 60_000, prefix: "cloud-backup-post" })) {
    return rateLimitExceededResponse(request, 3600);
  }

  const auth = await authorizeTenant(request);
  if (!auth.ok) return apiError(request, auth.message, auth.status);

  const body = await readJsonBody<{
    fileName?: string;
    fileSizeKb?: number;
    payloadBase64?: string;
    metadata?: any;
  }>(request, MAX_PAYLOAD_B64 + 64 * 1024);
  if (!body.ok) {
    return apiError(
      request,
      body.error === "payload_too_large"
        ? `حجم النسخة الاحتياطية أكبر من الحد المسموح (${Math.round(MAX_PAYLOAD_B64 / 1024 / 1024)} ميجابايت). احذف صور الروشتات القديمة ثم أعد المحاولة.`
        : "محتوى الطلب غير صالح.",
      body.error === "payload_too_large" ? 413 : 400
    );
  }

  const { fileName, fileSizeKb, payloadBase64, metadata } = body.data;
  if (!payloadBase64 || typeof payloadBase64 !== "string") {
    return apiError(request, "بيانات النسخة الاحتياطية مفقودة.", 400);
  }
  if (payloadBase64.length > MAX_PAYLOAD_B64) {
    return apiError(request, "حجم النسخة الاحتياطية أكبر من الحد المسموح به.", 413);
  }

  const id = backupRowId(auth.subscriberId);
  const createdAt = new Date().toISOString();
  const row = {
    id,
    subscriberId: auth.subscriberId,
    machineId: auth.machineId,
    fileName:
      String(fileName || "").slice(0, 120) ||
      `PenRX_Backup_${createdAt.slice(0, 10)}.penrx`,
    fileSizeKb: Math.max(0, Number(fileSizeKb) || 0),
    payloadBase64,
    metadataJson: metadata && typeof metadata === "object" ? metadata : {},
    createdAt,
  };

  try {
    await supabaseRest(TABLE, {
      method: "POST",
      query: "on_conflict=id",
      body: row,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    // Free space held by pre-canonical timestamped rows for this subscriber.
    await supabaseRest(TABLE, {
      method: "DELETE",
      query:
        `subscriberId=eq.${encodeURIComponent(auth.subscriberId)}` +
        `&id=neq.${encodeURIComponent(id)}`,
    }).catch(() => null);
  } catch (err: any) {
    console.error("[CloudBackup POST]", err?.message || err);
    return apiError(request, "تعذر حفظ النسخة الاحتياطية سحابياً. ستعاد المحاولة لاحقاً.", 502);
  }

  return apiJson(request, {
    success: true,
    id,
    message: "تم حفظ النسخة الاحتياطية سحابياً بنجاح وتأمينها",
    backup: {
      id: row.id,
      fileName: row.fileName,
      fileSizeKb: row.fileSizeKb,
      createdAt: row.createdAt,
    },
  });
}
