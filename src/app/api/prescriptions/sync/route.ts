import { NextResponse } from "next/server";
import {
  LeanCloudPrescription,
  RETENTION_MS,
  decompressPrescription,
} from "@/lib/prescriptionSync";
import {
  getSubscriptionBySubscriberId,
  validateAdminAuthorization,
} from "@/lib/subscriptionManager";
import {
  savePrescriptionRelational,
  deletePrescriptionRelational,
} from "@/lib/relationalStorage";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
// [SECURITY FIX]: No hardcoded Supabase key fallback
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// High-Speed Server In-Memory Cache (Multi-Tenant, Partitioned by Subscriber ID)
// Key: subscriberId -> Map<prescriptionId, LeanCloudPrescription>
const serverPrescriptionsCache = new Map<string, Map<string, LeanCloudPrescription>>();

/**
 * Purge records older than 90 days from the server cache
 */
function purgeExpiredRecords(): number {
  const now = Date.now();
  let purged = 0;

  for (const [subId, rxMap] of serverPrescriptionsCache.entries()) {
    for (const [rxId, rx] of rxMap.entries()) {
      if (rx.arc) continue; // Never purge archived prescriptions
      const rxTime = new Date(rx.ts).getTime();
      if (!isNaN(rxTime) && now - rxTime > RETENTION_MS) {
        rxMap.delete(rxId);
        purged++;
      }
    }
    if (rxMap.size === 0) {
      serverPrescriptionsCache.delete(subId);
    }
  }

  // Also trigger cloud purge for records older than 90 days
  try {
    const minDate = new Date(Date.now() - RETENTION_MS).toISOString();
    fetch(`${SUPABASE_REST_URL}/CloudPrescription?createdAt=lt.${encodeURIComponent(minDate)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }).catch(() => {});
  } catch {}

  return purged;
}

// ===== GET: Retrieve prescriptions for a specific subscriber (Last 365 Days Only) =====
export async function GET(request: Request) {
  // Rate Limit: 30 sync requests per minute per IP
  if (!checkRateLimit(request, { maxRequests: 30, windowMs: 60_000, prefix: "rx-sync-get" })) {
    return rateLimitExceededResponse(60);
  }

  const { searchParams } = new URL(request.url);
  const subscriberId = searchParams.get("subscriberId");

  if (!subscriberId) {
    return NextResponse.json(
      { error: "subscriberId is required for multi-tenant isolation" },
      { status: 400 }
    );
  }

  // Security Check: Verify that the subscriber exists and has an active license or trial
  const sub = await getSubscriptionBySubscriberId(subscriberId);
  const isAdmin = validateAdminAuthorization(request);

  if (!sub && !isAdmin) {
    return NextResponse.json(
      { error: "حساب المشترك غير مسجل أو غير مصرح له بالوصول" },
      { status: 403 }
    );
  }

  if (sub && sub.status !== "ACTIVE" && !sub.isTrial && !isAdmin) {
    return NextResponse.json(
      { error: "الاشتراك معلق أو غير نشط. يرجى تجديد الترخيص للوصول للسجلات السحابية" },
      { status: 403 }
    );
  }

  // Periodic automatic purge of expired items
  purgeExpiredRecords();

  let rxMap = serverPrescriptionsCache.get(subscriberId);
  const now = Date.now();

  // If local server cache is empty, query Supabase CloudPrescription table
  if (!rxMap || rxMap.size === 0) {
    try {
      const minDate = new Date(now - RETENTION_MS).toISOString();
      const sRes = await fetch(
        `${SUPABASE_REST_URL}/CloudPrescription?subscriberId=eq.${encodeURIComponent(subscriberId)}&createdAt=gte.${encodeURIComponent(minDate)}&order=createdAt.desc&limit=300`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          cache: "no-store",
        }
      );
      if (sRes.ok) {
        const rows = await sRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          if (!serverPrescriptionsCache.has(subscriberId)) {
            serverPrescriptionsCache.set(subscriberId, new Map());
          }
          const map = serverPrescriptionsCache.get(subscriberId)!;
          for (const row of rows) {
            const lean: LeanCloudPrescription = {
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
            };
            map.set(lean.id, lean);
          }
          rxMap = map;
        }
      }
    } catch {}
  }

  const prescriptions: LeanCloudPrescription[] = [];
  if (rxMap) {
    for (const rx of rxMap.values()) {
      const rxTime = new Date(rx.ts).getTime();
      if (!isNaN(rxTime) && now - rxTime <= RETENTION_MS) {
        prescriptions.push(rx);
      }
    }
  }

  // Sort descending by creation date (newest first)
  prescriptions.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return NextResponse.json({
    success: true,
    subscriberId,
    prescriptions,
    count: prescriptions.length,
    retentionDays: 365,
  });
}

// ===== POST: Save, Delete, or Purge Prescriptions =====
export async function POST(request: Request) {
  // Rate Limit: 60 sync operations per minute per IP (save/delete happen often)
  if (!checkRateLimit(request, { maxRequests: 60, windowMs: 60_000, prefix: "rx-sync-post" })) {
    return rateLimitExceededResponse(60);
  }

  try {
    const body = await request.json();
    const { action, subscriberId, prescriptionId, data } = body;

    // 1. Global Purge Action - Admin Only
    if (action === "PURGE_OLD") {
      if (!validateAdminAuthorization(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const count = purgeExpiredRecords();
      return NextResponse.json({ success: true, purgedCount: count });
    }

    if (!subscriberId) {
      return NextResponse.json(
        { error: "subscriberId is required for multi-tenant isolation" },
        { status: 400 }
      );
    }

    // Security check: Only active subscribers can sync or save prescriptions
    const sub = await getSubscriptionBySubscriberId(subscriberId);
    if (!sub || (sub.status !== "ACTIVE" && !sub.isTrial)) {
      return NextResponse.json(
        { error: "لا يمكن مزامنة الروشتات لحساب اشتراك غير مفعل" },
        { status: 403 }
      );
    }

    // Get or initialize subscriber bucket
    if (!serverPrescriptionsCache.has(subscriberId)) {
      serverPrescriptionsCache.set(subscriberId, new Map());
    }
    const subscriberMap = serverPrescriptionsCache.get(subscriberId)!;

    // 2. SAVE Action (Insert or Update)
    if (action === "SAVE") {
      if (!data || !data.id) {
        return NextResponse.json({ error: "Prescription data is missing" }, { status: 400 });
      }

      // Check 90-day retention before accepting
      const rxTime = new Date(data.ts).getTime();
      if (!isNaN(rxTime) && Date.now() - rxTime > RETENTION_MS) {
        return NextResponse.json({
          success: false,
          message: "Prescription is older than 90 days retention window",
        });
      }

      // Store in subscriber bucket
      subscriberMap.set(data.id, data);

      // Relational persistence in PostgreSQL via Prisma (Clinic -> Patient -> Prescription -> Items)
      try {
        const richRx = decompressPrescription(data);
        savePrescriptionRelational(richRx, undefined, subscriberId).catch((err) => {
          console.warn("[SyncAPI] Prisma relational save deferred:", err.message);
        });
      } catch {}

      // Attempt background write to Supabase Cloud if available
      try {
        fetch(`${SUPABASE_REST_URL}/CloudPrescription`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: data.id,
            subscriberId,
            prescriptionNo: data.pNo,
            branchId: data.bId || null,
            branchName: data.bName || null,
            patientName: data.pName,
            patientPhone: data.pPhone || null,
            patientAge: data.pAge || null,
            patientGender: data.pGen || null,
            diagnosis: data.diag || null,
            notes: data.notes || null,
            itemsJson: data.items,
            createdAt: data.ts,
            updatedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch {}

      return NextResponse.json({
        success: true,
        action: "SAVE",
        prescriptionId: data.id,
        storedInBucket: subscriberId,
      });
    }

    // 3. DELETE Action
    if (action === "DELETE") {
      if (!prescriptionId) {
        return NextResponse.json({ error: "prescriptionId is required" }, { status: 400 });
      }

      subscriberMap.delete(prescriptionId);

      // Delete from Prisma relational tables
      try {
        deletePrescriptionRelational(prescriptionId).catch(() => {});
      } catch {}

      // Attempt background delete in Supabase Cloud
      try {
        fetch(
          `${SUPABASE_REST_URL}/CloudPrescription?id=eq.${encodeURIComponent(prescriptionId)}&subscriberId=eq.${encodeURIComponent(subscriberId)}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        ).catch(() => {});
      } catch {}

      return NextResponse.json({
        success: true,
        action: "DELETE",
        prescriptionId,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("[PrescriptionSyncAPI] Error:", err);
    return NextResponse.json(
      { error: "Internal server error during sync", details: err?.message },
      { status: 500 }
    );
  }
}
