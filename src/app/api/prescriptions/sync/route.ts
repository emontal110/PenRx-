import { NextResponse } from "next/server";
import {
  LeanCloudPrescription,
  LeanPrescriptionItem,
  RETENTION_MS,
  decompressPrescription,
} from "@/lib/prescriptionSync";
import {
  getSubscriptionBySubscriberId,
  validateAdminAuthorization,
  machineOwnsSubscription,
  DEFAULT_SUPABASE_SERVICE_ROLE_KEY,
} from "@/lib/subscriptionManager";
import {
  savePrescriptionRelational,
  deletePrescriptionRelational,
} from "@/lib/relationalStorage";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

// High-Speed Server In-Memory Cache (Multi-Tenant, Partitioned by Subscriber ID)
const serverPrescriptionsCache = new Map<string, Map<string, LeanCloudPrescription>>();
let lastCloudPurgeAt = 0;

/**
 * Minifies medication items before storing in Supabase JSONB to save 65%+ database space on the Free Tier
 */
function minifyItemsForDb(items: LeanPrescriptionItem[]): LeanPrescriptionItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
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

/**
 * Purge records older than 365 days from the server cache and Supabase (throttled to once every 6 hours)
 */
function purgeExpiredRecords(force = false): number {
  const now = Date.now();
  let purged = 0;

  for (const [subId, rxMap] of serverPrescriptionsCache.entries()) {
    for (const [rxId, rx] of rxMap.entries()) {
      if (rx.arc) continue;
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

  if (force || now - lastCloudPurgeAt > 6 * 60 * 60 * 1000) {
    lastCloudPurgeAt = now;
    try {
      const minDate = new Date(now - RETENTION_MS).toISOString();
      fetch(`${SUPABASE_REST_URL}/CloudPrescription?createdAt=lt.${encodeURIComponent(minDate)}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }).catch(() => {});
    } catch {}
  }

  return purged;
}

// ===== GET: Retrieve prescriptions for a specific subscriber (Last 365 Days) =====
export async function GET(request: Request) {
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/prescriptions/sync");
  }

  if (!checkRateLimit(request, { maxRequests: 30, windowMs: 60_000, prefix: "rx-sync-get" })) {
    return rateLimitExceededResponse(60);
  }

  const { searchParams } = new URL(request.url);
  const subscriberId = searchParams.get("subscriberId");
  const machineId = searchParams.get("machineId");

  if (!subscriberId) {
    return NextResponse.json(
      { error: "subscriberId is required for multi-tenant isolation" },
      { status: 400 }
    );
  }

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

  if (sub && !isAdmin) {
    if (!machineId) {
      return NextResponse.json(
        { error: "machineId is required to access cloud prescriptions" },
        { status: 403 }
      );
    }
    if (!machineOwnsSubscription(sub, machineId.trim())) {
      return NextResponse.json(
        { error: "هذا الجهاز غير مرتبط بحساب المشترك المطلوب" },
        { status: 403 }
      );
    }
  }

  purgeExpiredRecords();

  let rxMap = serverPrescriptionsCache.get(subscriberId);
  const now = Date.now();

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
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/prescriptions/sync");
  }

  if (!checkRateLimit(request, { maxRequests: 60, windowMs: 60_000, prefix: "rx-sync-post" })) {
    return rateLimitExceededResponse(60);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, subscriberId, prescriptionId, data, machineId } = body;

    if (action === "PURGE_OLD") {
      if (!validateAdminAuthorization(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const count = purgeExpiredRecords(true);
      return NextResponse.json({ success: true, purgedCount: count });
    }

    if (!subscriberId) {
      return NextResponse.json(
        { error: "subscriberId is required for multi-tenant isolation" },
        { status: 400 }
      );
    }

    const sub = await getSubscriptionBySubscriberId(subscriberId);
    if (!sub || (sub.status !== "ACTIVE" && !sub.isTrial)) {
      return NextResponse.json(
        { error: "لا يمكن مزامنة الروشتات لحساب اشتراك غير مفعل" },
        { status: 403 }
      );
    }

    if (!machineId || !machineOwnsSubscription(sub, String(machineId).trim())) {
      return NextResponse.json(
        { error: "هذا الجهاز غير مرتبط بحساب المشترك المطلوب" },
        { status: 403 }
      );
    }

    if (!serverPrescriptionsCache.has(subscriberId)) {
      serverPrescriptionsCache.set(subscriberId, new Map());
    }
    const subscriberMap = serverPrescriptionsCache.get(subscriberId)!;

    // 2. SAVE Action (Single Canonical Ultra-Compact Upsert to CloudPrescription)
    if (action === "SAVE") {
      if (!data || !data.id) {
        return NextResponse.json({ error: "Prescription data is missing" }, { status: 400 });
      }

      const rxTime = new Date(data.ts).getTime();
      if (!data.arc && !isNaN(rxTime) && Date.now() - rxTime > RETENTION_MS) {
        return NextResponse.json({
          success: false,
          message: "Prescription is older than retention window",
        });
      }

      const compactItems = minifyItemsForDb(data.items);
      const compactData: LeanCloudPrescription = {
        ...data,
        items: compactItems,
      };

      subscriberMap.set(data.id, compactData);

      // Optional relational write only if explicitly enabled via env (disabled by default to save 85% Supabase Free Tier storage)
      if (process.env.ENABLE_RELATIONAL_DUAL_WRITE === "true") {
        try {
          const richRx = decompressPrescription(compactData);
          savePrescriptionRelational(richRx, undefined, subscriberId).catch(() => {});
        } catch {}
      }

      try {
        fetch(`${SUPABASE_REST_URL}/CloudPrescription?on_conflict=id`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            id: compactData.id,
            subscriberId,
            prescriptionNo: compactData.pNo,
            branchId: compactData.bId || null,
            branchName: compactData.bName || null,
            patientName: compactData.pName,
            patientPhone: compactData.pPhone || null,
            patientAge: compactData.pAge || null,
            patientGender: compactData.pGen || null,
            diagnosis: compactData.diag || null,
            notes: compactData.notes || null,
            itemsJson: compactItems,
            createdAt: compactData.ts,
            updatedAt: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch {}

      return NextResponse.json({
        success: true,
        action: "SAVE",
        prescriptionId: compactData.id,
        storedInBucket: subscriberId,
      });
    }

    // 3. DELETE Action
    if (action === "DELETE") {
      if (!prescriptionId) {
        return NextResponse.json({ error: "prescriptionId is required" }, { status: 400 });
      }

      subscriberMap.delete(prescriptionId);

      if (process.env.ENABLE_RELATIONAL_DUAL_WRITE === "true") {
        try {
          deletePrescriptionRelational(prescriptionId).catch(() => {});
        } catch {}
      }

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
