import { NextResponse } from "next/server";
import {
  getSubscriptionByMachine,
  getSubscriptionBySubscriberId,
  machineOwnsSubscription,
  getSupabaseServiceRoleKey,
} from "@/lib/subscriptionManager";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || getSupabaseServiceRoleKey();

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

// In-Memory Multi-Tenant Cache partitioned strictly by Subscriber ID
const serverCloudBackupCache = new Map<string, CloudBackupRecord[]>();

async function resolveAuthorizedSubscription(
  subscriberId?: string,
  machineId?: string
): Promise<boolean> {
  if (!subscriberId && !machineId) return false;
  try {
    const sub = subscriberId
      ? await getSubscriptionBySubscriberId(subscriberId)
      : await getSubscriptionByMachine(machineId!);
    if (!sub) return false;
    if (!(sub.status === "ACTIVE" || sub.isTrial)) return false;
    if (machineId && !machineOwnsSubscription(sub, machineId.trim())) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/backup/cloud?subscriberId=...&machineId=...
 */
export async function GET(request: Request) {
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/backup/cloud");
  }

  if (!checkRateLimit(request, { maxRequests: 15, windowMs: 60_000, prefix: "cloud-backup-get" })) {
    return rateLimitExceededResponse(60);
  }

  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get("subscriberId")?.trim();
    const machineId = searchParams.get("machineId")?.trim();
    const targetKey = subscriberId || machineId;

    if (!targetKey) {
      return NextResponse.json(
        { error: "subscriberId or machineId is required" },
        { status: 400 }
      );
    }

    const isAuthorized = await resolveAuthorizedSubscription(subscriberId, machineId);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "غير مصرح: لا يوجد اشتراك نشط مرتبط بهذا الجهاز" },
        { status: 403 }
      );
    }

    const list = serverCloudBackupCache.get(targetKey) || [];
    if (list.length > 0) {
      return NextResponse.json({
        success: true,
        backup: list[0],
        totalBackups: list.length,
        allBackups: list.map((b) => ({
          id: b.id,
          fileName: b.fileName,
          fileSizeKb: b.fileSizeKb,
          metadata: b.metadata,
          createdAt: b.createdAt,
        })),
      });
    }

    if (SUPABASE_KEY) {
      try {
        const resp = await fetch(
          `${SUPABASE_REST_URL}/CloudBackup?subscriberId=eq.${encodeURIComponent(targetKey)}&order=createdAt.desc&limit=1`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            cache: "no-store",
          }
        );
        if (resp.ok) {
          const records = await resp.json();
          if (Array.isArray(records) && records.length > 0) {
            serverCloudBackupCache.set(targetKey, records);
            return NextResponse.json({
              success: true,
              backup: records[0],
              totalBackups: records.length,
              allBackups: records.map((b: any) => ({
                id: b.id,
                fileName: b.fileName,
                fileSizeKb: b.fileSizeKb,
                metadata: b.metadataJson || b.metadata,
                createdAt: b.createdAt,
              })),
            });
          }
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      backup: null,
      message: "لا توجد نسخ احتياطية محفوظة سحابياً لهذا المشترك بعد",
    });
  } catch (err: any) {
    console.error("[CloudBackup GET Error]:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/backup/cloud
 * Uploads an encrypted and compressed backup payload for this subscriber.
 * Uses single-slot upsert per subscriberId and purges older snapshots so Supabase Free Tier (500MB)
 * never accumulates duplicate daily blobs across thousands of doctors!
 */
export async function POST(request: Request) {
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/backup/cloud");
  }

  if (!checkRateLimit(request, { maxRequests: 10, windowMs: 60 * 60_000, prefix: "cloud-backup-post" })) {
    return rateLimitExceededResponse(3600);
  }

  try {
    const body = await request.json();
    const {
      subscriberId,
      machineId,
      fileName,
      fileSizeKb,
      payloadBase64,
      metadata,
    } = body;

    const targetKey = (subscriberId || machineId)?.trim();
    if (!targetKey) {
      return NextResponse.json(
        { error: "subscriberId or machineId is required" },
        { status: 400 }
      );
    }

    if (!payloadBase64) {
      return NextResponse.json(
        { error: "payloadBase64 is required" },
        { status: 400 }
      );
    }

    const isAuthorized = await resolveAuthorizedSubscription(
      subscriberId?.trim(),
      machineId?.trim()
    );
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "غير مصرح: لا يوجد اشتراك نشط مرتبط بهذا الجهاز" },
        { status: 403 }
      );
    }

    if (payloadBase64.length > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "حجم النسخة الاحتياطية أكبر من الحد المسموح به (25 ميجابايت)" },
        { status: 413 }
      );
    }

    // Canonical single-slot ID per subscriber: overwrites previous backup in-place!
    const backupId = `cbk_${targetKey.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const newRecord: CloudBackupRecord = {
      id: backupId,
      subscriberId: targetKey,
      machineId: machineId?.trim(),
      fileName: fileName || `PenRX_Backup_${new Date().toISOString().slice(0, 10)}.penrx`,
      fileSizeKb: Number(fileSizeKb) || 0,
      payloadBase64,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };

    // Keep only the single latest snapshot in memory per subscriber
    serverCloudBackupCache.set(targetKey, [newRecord]);

    // Upsert canonical row in Supabase CloudBackup AND delete any legacy historical rows for this subscriber
    if (SUPABASE_KEY) {
      try {
        fetch(`${SUPABASE_REST_URL}/CloudBackup?on_conflict=id`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            id: backupId,
            subscriberId: targetKey,
            fileName: newRecord.fileName,
            fileSizeKb: newRecord.fileSizeKb,
            payloadBase64: newRecord.payloadBase64,
            metadataJson: newRecord.metadata,
            createdAt: newRecord.createdAt,
          }),
        })
          .then(() => {
            // Clean up any legacy timestamped cbk_* rows for this subscriber to free space
            return fetch(
              `${SUPABASE_REST_URL}/CloudBackup?subscriberId=eq.${encodeURIComponent(targetKey)}&id=neq.${encodeURIComponent(backupId)}`,
              {
                method: "DELETE",
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                },
              }
            );
          })
          .catch(() => {});
      } catch {}
    }

    return NextResponse.json({
      success: true,
      id: backupId,
      message: "تم حفظ النسخة الاحتياطية سحابياً بنجاح وتأمينها",
      backup: {
        id: newRecord.id,
        fileName: newRecord.fileName,
        fileSizeKb: newRecord.fileSizeKb,
        createdAt: newRecord.createdAt,
      },
    });
  } catch (err: any) {
    console.error("[CloudBackup POST Error]:", err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
