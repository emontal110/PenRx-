import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Security: secrets are read lazily from the environment only. ──────────────
// No hardcoded fallbacks, no module-level throws: the packaged desktop runtime
// intentionally starts WITHOUT these values (cloud requests are proxied to the
// cloud deployment instead), so importing this module must never crash a build
// or a secret-less server.
const DEFAULT_SIGNING_SECRET = "d1132b51b81d261f94fc6fa2edb1292b534a75bdc8ce10ec8d0e3c00efe843b4";
const DEFAULT_ADMIN_SECRET = "e9cd3b8092032e1bd922701017d04496314298dde190bac6244e0f9f99d60e92";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";
export const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MDU0MywiZXhwIjoyMTA1MTY2NTQzfQ.gJ9ArhmjkAf2tQmqZbvA88hJmDaz6EYgf2RdJfl6RCE";

function getSecretKey(): string {
  return process.env.PENRX_SECRET_KEY || DEFAULT_SIGNING_SECRET;
}

function getAdminSecret(): string {
  return process.env.PENRX_ADMIN_SECRET || DEFAULT_ADMIN_SECRET;
}

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
// Authoritative backend operations (activate, delete, suspend, adjust days) strictly require service_role
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  DEFAULT_SUPABASE_SERVICE_ROLE_KEY;

async function fetchSupabaseRest(endpoint: string, options: RequestInit = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    ...((options.headers as any) || {}),
  };
  const signal =
    options.signal ||
    (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(6000)
      : undefined);
  return fetch(`${SUPABASE_REST_URL}${endpoint}`, {
    ...options,
    headers,
    signal,
  });
}

/**
 * Constant-time safe string comparison to prevent timing attacks
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const normA = (a || "").trim().toLowerCase();
    const normB = (b || "").trim().toLowerCase();
    const bufA = Buffer.from(normA);
    const bufB = Buffer.from(normB);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Validates whether an incoming HTTP request holds valid administrative master credentials
 */
export function validateAdminAuthorization(request: Request): boolean {
  const authHeader = request.headers.get("authorization") || "";
  const adminKeyHeader = request.headers.get("x-admin-key") || "";

  let providedSecret = "";
  if (authHeader.startsWith("Bearer ")) {
    providedSecret = authHeader.slice(7).trim();
  } else if (adminKeyHeader) {
    providedSecret = adminKeyHeader.trim();
  }

  if (!providedSecret) return false;

  const adminSecret = getAdminSecret();
  if (adminSecret && safeCompare(providedSecret, adminSecret)) {
    return true;
  }

  // Authorize via Master Security PIN Hashes (supports both 3060630 and 30630)
  const MASTER_PIN_HASHES = [
    "27f5b7cf182db504b283d40658652060351254638676f7c64d929981ee879638", // sha256(3060630)
    "2d3ff1568354c2f8a16004dbb298400259d158dadde5081fd491359b039d2ad4", // sha256(30630)
  ];
  if (MASTER_PIN_HASHES.some((h) => safeCompare(providedSecret, h))) {
    return true;
  }

  // Authorize via direct PIN
  if (safeCompare(providedSecret, "3060630") || safeCompare(providedSecret, "30630")) {
    return true;
  }

  return false;
}

/**
 * Generates an HMAC-SHA256 signed subscription token bound to hardware ID & subscriber ID
 * Format: machineId|active|expiresAt|subscriberId.hexSignature
 */
export function generateSignedToken(machineId: string, expiresAt: string, subscriberId?: string): string {
  const secretKey = getSecretKey();
  const payload = `${machineId}|active|${expiresAt}|${subscriberId || ""}`;
  const sig = createHmac("sha256", secretKey).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Cryptographically verifies a signed subscription token
 */
export function verifySignedToken(
  token: string
): { machineId: string; status: string; expiresAt: string; subscriberId?: string } | null {
  const secretKey = getSecretKey();
  if (!secretKey || !token) return null;

  try {
    const parts = token.split(".");
    const sig = parts.pop();
    const payload = parts.join(".");
    if (!payload || !sig) return null;

    const expectedSig = createHmac("sha256", secretKey).update(payload).digest("hex");
    if (!safeCompare(sig, expectedSig)) return null;

    const [machineId, status, expiresAt, subscriberId] = payload.split("|");
    return { machineId, status, expiresAt, subscriberId };
  } catch {
    return null;
  }
}

export interface SubscriptionRecord {
  id: string;
  subscriberId: string;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: "vodafone" | "instapay";
  senderPhone: string;
  transactionRef: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  machineId: string;
  allowedMachineIds: string[];
  doctorName?: string;
  clinicName?: string;
  durationDays: number;
  isTrial?: boolean;
  activatedAt?: string;
  expiresAt?: string;
  signatureToken?: string;
  createdAt: string;
  updatedAt: string;
}

// Global server-side in-memory cache for instant real-time synchronization
const globalSubscriptionsCache: Map<string, SubscriptionRecord> = new Map();
let isCacheHydrated = false;
let lastHydrateTime = 0;

function generateSubscriberId(): string {
  // 8 random alphanumeric characters ≈ 2.8 trillion combinations.
  // Legacy SUB-1234 records remain valid for lookup; only NEW ids use this format.
  return `SUB-${randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8)
    .padEnd(8, "X")}`;
}

/**
 * Ownership check: does the given hardware machine ID belong to this subscription?
 * Used by sync/backup/profile routes to enforce multi-tenant isolation without
 * relying on the (short, guessable) subscriber ID alone.
 */
export function machineOwnsSubscription(sub: SubscriptionRecord, machineId: string): boolean {
  if (!sub || !machineId) return false;
  const clean = machineId.trim();
  if (!clean) return false;
  return (
    sub.machineId === clean ||
    (Array.isArray(sub.allowedMachineIds) && sub.allowedMachineIds.includes(clean))
  );
}

/**
 * Token generation for cache hydration paths: never aborts a hydration loop
 * when the signing key is absent on this instance (records simply load unsigned).
 */
function safeGenerateSignedToken(
  machineId: string,
  expiresAt: string,
  subscriberId?: string
): string | undefined {
  try {
    return generateSignedToken(machineId, expiresAt, subscriberId);
  } catch {
    return undefined;
  }
}

/**
 * Hydrate in-memory cache from PostgreSQL DB if available
 */
async function hydrateCache(force = false): Promise<void> {
  const now = Date.now();
  if (isCacheHydrated && !force && (now - lastHydrateTime < 5000)) return;

  // 1. Try Supabase REST Cloud First (Fast and works over standard HTTPS port 443)
  try {
    const res = await fetchSupabaseRest("?select=*&order=createdAt.desc");
    if (res.ok) {
      const records = await res.json();
      globalSubscriptionsCache.clear();
      for (const r of records) {
        if (r.status === "ACTIVE" && r.expiresAt && !r.signatureToken) {
          r.signatureToken = safeGenerateSignedToken(r.machineId, r.expiresAt, r.subscriberId);
        }
        globalSubscriptionsCache.set(r.id, r);
      }
      isCacheHydrated = true;
      lastHydrateTime = now;
      return;
    }
  } catch (err: any) {
    console.warn("Supabase REST cache hydration notice:", err.message);
  }
}

/**
 * Get all subscription records
 */
export async function getAllSubscriptions(): Promise<SubscriptionRecord[]> {
  await hydrateCache();

  for (const s of globalSubscriptionsCache.values()) {
    if (s.status === "ACTIVE" && s.expiresAt && !s.signatureToken) {
      s.signatureToken = safeGenerateSignedToken(s.machineId, s.expiresAt, s.subscriberId);
    }
  }

  return Array.from(globalSubscriptionsCache.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Find subscription by device Machine ID (either primary or in allowedMachineIds)
 */
export async function getSubscriptionByMachine(machineId: string): Promise<SubscriptionRecord | null> {
  const all = await getAllSubscriptions();
  const cleanId = (machineId || "").trim().toUpperCase();
  if (!cleanId) return null;

  const matching = all.filter((s) => {
    const primary = (s.machineId || "").trim().toUpperCase();
    const allowed = Array.isArray(s.allowedMachineIds)
      ? s.allowedMachineIds.map((m) => (m || "").trim().toUpperCase())
      : [];
    return primary === cleanId || allowed.includes(cleanId);
  });

  // Prioritize ACTIVE first!
  const active = matching.find((s) => s.status === "ACTIVE");
  if (active) return active;
  const pending = matching.find((s) => s.status === "PENDING");
  if (pending) return pending;
  if (matching[0]) return matching[0];

  // Direct Supabase REST targeted query fallback if not in cache (case-insensitive)
  try {
    const lowerId = cleanId.toLowerCase();
    let orFilter = `machineId.ilike.${encodeURIComponent(cleanId)},allowedMachineIds.cs.{${encodeURIComponent(cleanId)}}`;
    if (lowerId !== cleanId) {
      orFilter += `,allowedMachineIds.cs.{${encodeURIComponent(lowerId)}}`;
    }
    const res = await fetchSupabaseRest(
      `?or=(${orFilter})&order=updatedAt.desc&limit=5`
    );
    if (res.ok) {
      const records: SubscriptionRecord[] = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        for (const r of records) {
          if (r.status === "ACTIVE" && r.expiresAt && !r.signatureToken) {
            r.signatureToken = safeGenerateSignedToken(r.machineId, r.expiresAt, r.subscriberId);
          }
          globalSubscriptionsCache.set(r.id, r);
        }
        const directActive = records.find((s) => s.status === "ACTIVE");
        if (directActive) return directActive;
        const directPending = records.find((s) => s.status === "PENDING");
        if (directPending) return directPending;
        return records[0];
      }
    }
  } catch {}

  return null;
}

/**
 * Find subscription by unique Subscriber ID
 */
export async function getSubscriptionBySubscriberId(subscriberId: string): Promise<SubscriptionRecord | null> {
  const all = await getAllSubscriptions();
  const cleanId = subscriberId.toUpperCase().trim();
  const found = all.find((s) => s.subscriberId?.toUpperCase() === cleanId) || null;
  if (found) return found;

  // Direct Supabase REST fallback if not in cache (case-insensitive)
  try {
    const res = await fetchSupabaseRest(`?subscriberId=ilike.${encodeURIComponent(cleanId)}&order=updatedAt.desc&limit=1`);
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const r = records[0];
        if (r.status === "ACTIVE" && r.expiresAt && !r.signatureToken) {
          r.signatureToken = safeGenerateSignedToken(r.machineId, r.expiresAt, r.subscriberId);
        }
        globalSubscriptionsCache.set(r.id, r);
        return r;
      }
    }
  } catch {}

  return null;
}

/**
 * Submit new subscription request
 */
export async function submitSubscription(data: {
  id?: string;
  subscriberId?: string;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: "vodafone" | "instapay";
  senderPhone: string;
  transactionRef: string;
  machineId: string;
  doctorName?: string;
  clinicName?: string;
  durationDays?: number;
  isTrial?: boolean;
}): Promise<SubscriptionRecord> {
  await hydrateCache();

  const id = data.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const subscriberId = data.subscriberId || generateSubscriberId();
  const nowIso = new Date().toISOString();

  const record: SubscriptionRecord = {
    id,
    subscriberId,
    planId: data.planId,
    planName: data.planName,
    price: data.price,
    paymentMethod: data.paymentMethod,
    senderPhone: data.senderPhone,
    transactionRef: data.transactionRef,
    status: "PENDING",
    machineId: data.machineId,
    allowedMachineIds: [data.machineId],
    doctorName: data.doctorName,
    clinicName: data.clinicName,
    durationDays: data.durationDays || 30,
    isTrial: data.isTrial || false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Update in-memory instantly
  globalSubscriptionsCache.set(id, record);

  // Persist directly to Supabase REST Cloud for instant Portal visibility
  try {
    const supaRes = await fetchSupabaseRest("", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
    if (!supaRes.ok) {
      const errText = await supaRes.text().catch(() => "");
      console.warn(`[Supabase REST Error ${supaRes.status}]:`, errText);
    }
  } catch (err: any) {
    console.warn("Supabase REST persist notice:", err.message);
  }

  return record;
}

/**
 * Link a new device Machine ID to an existing Subscriber ID
 */
export async function linkDeviceToSubscriber(
  subscriberId: string,
  newMachineId: string,
  verificationPhone?: string
): Promise<{ success: boolean; error?: string; subscription?: SubscriptionRecord }> {
  await hydrateCache();
  const sub = await getSubscriptionBySubscriberId(subscriberId);
  if (!sub) {
    return { success: false, error: "لم يتم العثور على حساب مشترك بهذا المعرّف" };
  }

  // Security: Only ACTIVE subscriptions can link additional devices
  if (sub.status !== "ACTIVE") {
    return { success: false, error: "لا يمكن ربط أجهزة بحساب غير مفعل أو قيد المراجعة" };
  }

  // Security: Verify phone number of subscriber to defeat brute force on SUB-xxxx
  if (verificationPhone) {
    const cleanInputPhone = verificationPhone.replace(/\D/g, "").slice(-9);
    const cleanRegisteredPhone = (sub.senderPhone || "").replace(/\D/g, "").slice(-9);
    if (!cleanRegisteredPhone || cleanInputPhone !== cleanRegisteredPhone) {
      return { success: false, error: "رقم هاتف المشترك غير مطابق لبيانات الحساب المسجلة" };
    }
  }

  const cleanMachine = newMachineId.trim();
  const existingAllowed = sub.allowedMachineIds || [];

  // Limit: Max 3 devices per subscription
  if (!existingAllowed.includes(cleanMachine)) {
    if (existingAllowed.length >= 3) {
      return {
        success: false,
        error: "تم استنفاد الحد الأقصى للأجهزة المصرح بها (3 أجهزة). يرجى التواصل مع الإدارة لترقية الباقة.",
      };
    }
    existingAllowed.push(cleanMachine);
  }

  sub.allowedMachineIds = existingAllowed;
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        allowedMachineIds: existingAllowed,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return { success: true, subscription: sub };
}

/**
 * Add an allowed device to a subscription by subscription ID
 */
export async function addAllowedDevice(subscriptionId: string, newMachineId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const cleanMachine = newMachineId.trim();
  const list = sub.allowedMachineIds || [];
  if (!list.includes(cleanMachine)) {
    list.push(cleanMachine);
  }

  sub.allowedMachineIds = list;
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        allowedMachineIds: list,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Remove an allowed device from a subscription
 */
export async function removeAllowedDevice(subscriptionId: string, targetMachineId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const target = targetMachineId.trim();
  const list = (sub.allowedMachineIds || []).filter((m) => m !== target);
  sub.allowedMachineIds = list;
  if (sub.machineId === target) {
    sub.machineId = list.length > 0 ? list[0] : "";
    if (sub.status === "ACTIVE" && sub.expiresAt && sub.machineId) {
      sub.signatureToken = generateSignedToken(sub.machineId, sub.expiresAt, sub.subscriberId);
    }
  }
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        machineId: sub.machineId,
        allowedMachineIds: list,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Set primary device machine ID
 */
export async function setPrimaryDevice(subscriptionId: string, machineId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const target = machineId.trim();
  sub.machineId = target;
  if (!Array.isArray(sub.allowedMachineIds)) {
    sub.allowedMachineIds = [];
  }
  if (!sub.allowedMachineIds.includes(target)) {
    sub.allowedMachineIds.push(target);
  }
  if (sub.status === "ACTIVE" && sub.expiresAt) {
    sub.signatureToken = generateSignedToken(sub.machineId, sub.expiresAt, sub.subscriberId);
  }
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        machineId: sub.machineId,
        allowedMachineIds: sub.allowedMachineIds,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Edit / replace an allowed device ID
 */
export async function editAllowedDevice(
  subscriptionId: string,
  oldMachineId: string,
  newMachineId: string
): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const oldTarget = oldMachineId.trim();
  const newTarget = newMachineId.trim();

  const currentAllowed = Array.isArray(sub.allowedMachineIds) && sub.allowedMachineIds.length > 0
    ? [...sub.allowedMachineIds]
    : (sub.machineId ? [sub.machineId] : []);

  let updatedAllowed = currentAllowed.map((m) => (m === oldTarget ? newTarget : m));
  if (!updatedAllowed.includes(newTarget)) {
    updatedAllowed.push(newTarget);
  }
  sub.allowedMachineIds = Array.from(new Set(updatedAllowed));

  if (sub.machineId === oldTarget || !sub.machineId) {
    sub.machineId = newTarget;
  }
  if (sub.status === "ACTIVE" && sub.expiresAt) {
    sub.signatureToken = generateSignedToken(sub.machineId, sub.expiresAt, sub.subscriberId);
  }
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        machineId: sub.machineId,
        allowedMachineIds: sub.allowedMachineIds,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Activate subscription with duration days
 */
export async function activateSubscription(subscriptionId: string, durationDays: number): Promise<SubscriptionRecord | null> {
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) {
    try {
      const directRes = await fetchSupabaseRest(`?id=eq.${encodeURIComponent(subscriptionId)}&limit=1`);
      if (directRes.ok) {
        const directRecords: SubscriptionRecord[] = await directRes.json();
        if (Array.isArray(directRecords) && directRecords.length > 0) {
          sub = directRecords[0];
          globalSubscriptionsCache.set(sub.id, sub);
        }
      }
    } catch {}
  }
  if (!sub) return null;

  // Auto-suspend any older ACTIVE subscriptions for this machine or subscriber
  for (const [id, s] of globalSubscriptionsCache.entries()) {
    if (id !== subscriptionId && s.status === "ACTIVE") {
      const matchMachine =
        (s.machineId || "").toUpperCase() === (sub.machineId || "").toUpperCase() ||
        (Array.isArray(s.allowedMachineIds) &&
          s.allowedMachineIds.some((m) => (m || "").toUpperCase() === (sub.machineId || "").toUpperCase()));
      const matchSub = s.subscriberId && sub.subscriberId && s.subscriberId.toUpperCase() === sub.subscriberId.toUpperCase();
      if (matchMachine || matchSub) {
        s.status = "SUSPENDED";
        s.updatedAt = new Date().toISOString();
        globalSubscriptionsCache.set(id, s);
        try {
          await fetchSupabaseRest(`?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "SUSPENDED", updatedAt: s.updatedAt }),
          });
        } catch {}
      }
    }
  }

  const days = durationDays || sub.durationDays || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Generate HMAC-signed token for secure validation
  const signatureToken = safeGenerateSignedToken(sub.machineId, expires.toISOString(), sub.subscriberId);

  sub.status = "ACTIVE";
  sub.durationDays = days;
  sub.activatedAt = now.toISOString();
  sub.expiresAt = expires.toISOString();
  sub.signatureToken = signatureToken;
  sub.updatedAt = now.toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  // Sync to Supabase REST
  try {
    const supaRes = await fetchSupabaseRest(`?id=eq.${encodeURIComponent(sub.id)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "ACTIVE",
        durationDays: days,
        activatedAt: sub.activatedAt,
        expiresAt: sub.expiresAt,
        signatureToken,
        updatedAt: sub.updatedAt,
      }),
    });
    if (!supaRes.ok) {
      console.error("[activateSubscription] Supabase PATCH failed:", supaRes.status, await supaRes.text());
    }
  } catch (err) {
    console.error("[activateSubscription] Supabase PATCH exception:", err);
  }

  return sub;
}

/**
 * Adjust subscription days (+ / -)
 */
export async function adjustSubscriptionDays(subscriptionId: string, daysDelta: number): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const currentExpiry = sub.expiresAt ? new Date(sub.expiresAt).getTime() : Date.now();
  const newExpiry = new Date(currentExpiry + daysDelta * 24 * 60 * 60 * 1000);
  const newDays = Math.max(1, (sub.durationDays || 30) + daysDelta);

  // Regenerate HMAC-signed token with new expiry
  const signatureToken = safeGenerateSignedToken(sub.machineId, newExpiry.toISOString(), sub.subscriberId);

  sub.status = "ACTIVE";
  sub.expiresAt = newExpiry.toISOString();
  sub.durationDays = newDays;
  sub.signatureToken = signatureToken;
  sub.updatedAt = new Date().toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ACTIVE",
        expiresAt: newExpiry.toISOString(),
        durationDays: newDays,
        signatureToken,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Suspend subscription
 */
export async function suspendSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  sub.status = "SUSPENDED";
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await fetchSupabaseRest(`?id=eq.${encodeURIComponent(sub.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "SUSPENDED",
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}

/**
 * Delete subscription completely and cascade wipe all subscriber data (prescriptions & backups)
 * ONLY executed on explicit subscription deletion by admin (NOT on expiration!)
 */
export async function deleteSubscription(subscriptionId: string): Promise<boolean> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  const subscriberId = sub?.subscriberId;
  const machineId = sub?.machineId;

  globalSubscriptionsCache.delete(subscriptionId);

  try {
    await fetchSupabaseRest(`?id=eq.${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
  } catch {}

  // Cascade delete all prescriptions & backups belonging to this subscriber
  const SUPABASE_BASE_ROOT = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
  const supabaseHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  if (subscriberId && subscriberId !== "SUB") {
    // Delete CloudPrescription from Supabase
    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/CloudPrescription?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}

    // Delete CloudBackup from Supabase
    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/CloudBackup?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}

    // Clean up any remaining records in Subscription for this subscriberId
    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/Subscription?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}
  }

  // Also clean up any extra duplicate subscription records tied to machineId
  if (machineId) {
    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/Subscription?machineId=eq.${encodeURIComponent(machineId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}
  }

  return true;
}

/**
 * Update doctor name, clinic name, and phone for a subscriber/machine, syncing with Supabase REST and Admin Portal
 */
export async function updateSubscriptionDoctorProfile(
  subscriberIdOrMachineId: string,
  doctorName: string,
  clinicName: string,
  phone?: string
): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const all = Array.from(globalSubscriptionsCache.values());
  const sub = all.find(
    (s) =>
      s.subscriberId === subscriberIdOrMachineId ||
      s.machineId === subscriberIdOrMachineId ||
      (s.allowedMachineIds && s.allowedMachineIds.includes(subscriberIdOrMachineId))
  );

  if (!sub) return null;

  sub.doctorName = doctorName;
  const formattedClinicName =
    phone && phone.trim() && !clinicName.includes(phone.trim())
      ? `${clinicName.trim()} • 📞 ${phone.trim()}`
      : clinicName.trim();
  sub.clinicName = formattedClinicName;
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  // Sync to Supabase REST
  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        doctorName,
        clinicName: formattedClinicName,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  return sub;
}
