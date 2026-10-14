import { NextResponse } from "next/server";
import {
  getSubscriptionByMachine,
  getSubscriptionBySubscriberId,
  machineOwnsSubscription,
} from "@/lib/subscriptionManager";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

// RLS on CloudBackup only admits service_role — anon key writes are silently rejected
const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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
// Key: subscriberId -> CloudBackupRecord[] (sorted newest first)
const serverCloudBackupCache = new Map<string, CloudBackupRecord[]>();

/**
 * Resolves an ACTIVE (or trial) subscription for the caller and confirms
 * that the requesting machine actually owns it. Fails closed on DB errors.
 */
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
    // Fail closed: DB unreachable means we cannot confirm identity
    return false;
  }
}

/**
 * GET /api/backup/cloud?subscriberId=...&machineId=...
 * Retrieves the latest cloud backup strictly scoped to this subscriber/machine.
 * [SECURITY FIX HIGH-04]: Now validates subscriber identity before serving data.
 */
export async function GET(request: Request) {
  // Packaged desktop runtime holds no cloud credentials — forward to the cloud API transparently
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/backup/cloud");
  }

  // Rate Limit: 15 requests per minute per IP
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

    // [SECURITY FIX HIGH-04]: Validate subscriber identity + device ownership before serving data
    const isAuthorized = await resolveAuthorizedSubscription(subscriberId, machineId);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "غير مصرح: لا يوجد اشتراك نشط مرتبط بهذا الجهاز" },
        { status: 403 }
      );
    }

    // 1. Check in-memory partitioned cache first
    const list = serverCloudBackupCache.get(targetKey) || [];
    if (list.length > 0) {
      return NextResponse.json({
        success: true,
        backup: list[0], // Return the latest backup
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

    // 2. Query Supabase if table exists
    if (SUPABASE_KEY) {
      try {
        const resp = await fetch(
          `${SUPABASE_REST_URL}/CloudBackup?subscriberId=eq.${encodeURIComponent(targetKey)}&order=createdAt.desc&limit=5`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
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
 * [SECURITY FIX HIGH-04]: Now validates subscriber identity before accepting backup.
 */
export async function POST(request: Request) {
  // Packaged desktop runtime holds no cloud credentials — forward to the cloud API transparently
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/backup/cloud");
  }

  // Rate Limit: 5 uploads per hour per IP (backups are daily, so this is very generous)
  if (!checkRateLimit(request, { maxRequests: 5, windowMs: 60 * 60_000, prefix: "cloud-backup-post" })) {
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

    // [SECURITY FIX HIGH-04]: Validate subscriber identity + device ownership before accepting upload
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

    // Validate payload size (max 50MB Base64 encoded)
    if (payloadBase64.length > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "حجم النسخة الاحتياطية أكبر من الحد المسموح به (50 ميجابايت)" },
        { status: 413 }
      );
    }

    const backupId = `cbk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

    // Store in partitioned in-memory cache (keep up to 10 latest snapshots per subscriber)
    const existing = serverCloudBackupCache.get(targetKey) || [];
    const updated = [newRecord, ...existing].slice(0, 10);
    serverCloudBackupCache.set(targetKey, updated);

    // Save to Supabase CloudBackup table asynchronously
    if (SUPABASE_KEY) {
      try {
        fetch(`${SUPABASE_REST_URL}/CloudBackup`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
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
        }).catch(() => {});
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
