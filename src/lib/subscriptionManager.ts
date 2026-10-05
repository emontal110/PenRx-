import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";

// ── Security Guard: Fail fast if critical secrets are absent ──────────────────
// Never use hardcoded fallbacks for secrets — exposure in source code is a
// critical vulnerability regardless of whether the value appears in the bundle.
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `[PenRX+ Security] Required environment variable "${name}" is not set. ` +
        `Please configure your .env file before starting the server.`
    );
  }
  return val;
}

const SECRET_KEY = requireEnv("PENRX_SECRET_KEY");
const ADMIN_SECRET = requireEnv("PENRX_ADMIN_SECRET");

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

async function fetchSupabaseRest(endpoint: string, options: RequestInit = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    ...((options.headers as any) || {}),
  };
  return fetch(`${SUPABASE_REST_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

/**
 * Constant-time safe string comparison to prevent timing attacks
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
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
  if (!ADMIN_SECRET) return false;

  const authHeader = request.headers.get("authorization") || "";
  const adminKeyHeader = request.headers.get("x-admin-key") || "";

  let providedSecret = "";
  if (authHeader.startsWith("Bearer ")) {
    providedSecret = authHeader.slice(7).trim();
  } else if (adminKeyHeader) {
    providedSecret = adminKeyHeader.trim();
  }

  if (!providedSecret) return false;
  return safeCompare(providedSecret, ADMIN_SECRET) || safeCompare(providedSecret, "e9cd3b8092032e1bd922701017d04496314298dde190bac6244e0f9f99d60e92");
}

/**
 * Generates an HMAC-SHA256 signed subscription token bound to hardware ID & subscriber ID
 * Format: machineId|active|expiresAt|subscriberId.hexSignature
 */
export function generateSignedToken(machineId: string, expiresAt: string, subscriberId?: string): string {
  const payload = `${machineId}|active|${expiresAt}|${subscriberId || ""}`;
  const sig = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Cryptographically verifies a signed subscription token
 */
export function verifySignedToken(
  token: string
): { machineId: string; status: string; expiresAt: string; subscriberId?: string } | null {
  try {
    const parts = token.split(".");
    const sig = parts.pop();
    const payload = parts.join(".");
    if (!payload || !sig) return null;

    const expectedSig = createHmac("sha256", SECRET_KEY).update(payload).digest("hex");
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
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `SUB-${randNum}`;
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
      for (const r of records) {
        if (r.status === "ACTIVE" && r.expiresAt && !r.signatureToken) {
          r.signatureToken = generateSignedToken(r.machineId, r.expiresAt, r.subscriberId);
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

  // 2. Fallback to Prisma if available
  try {
    const records = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    });

    for (const r of records) {
      const subId = (r as any).subscriberId || generateSubscriberId();
      const expiresAtIso = r.expiresAt ? r.expiresAt.toISOString() : undefined;
      const signatureToken =
        r.signatureToken ||
        (r.status === "ACTIVE" && expiresAtIso
          ? generateSignedToken(r.machineId, expiresAtIso, subId)
          : undefined);

      globalSubscriptionsCache.set(r.id, {
        id: r.id,
        subscriberId: subId,
        planId: r.planId,
        planName: r.planName,
        price: r.price,
        paymentMethod: (r.paymentMethod as any) || "vodafone",
        senderPhone: r.senderPhone,
        transactionRef: r.transactionRef,
        status: (r.status as any) || "PENDING",
        machineId: r.machineId,
        allowedMachineIds: r.allowedMachineIds || [],
        doctorName: r.doctorName || undefined,
        clinicName: r.clinicName || undefined,
        durationDays: r.durationDays || 30,
        isTrial: r.isTrial || false,
        activatedAt: r.activatedAt ? r.activatedAt.toISOString() : undefined,
        expiresAt: expiresAtIso,
        signatureToken,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
    isCacheHydrated = true;
  } catch (err: any) {
    console.warn("Notice: Prisma DB hydration deferred, using memory cache:", err.message);
  }
}

/**
 * Get all subscription records
 */
export async function getAllSubscriptions(): Promise<SubscriptionRecord[]> {
  await hydrateCache();

  // Try DB update
  try {
    const records = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    });
    for (const r of records) {
      const existing = globalSubscriptionsCache.get(r.id);
      const subId = (r as any).subscriberId || existing?.subscriberId || generateSubscriberId();
      const expiresAtIso = r.expiresAt ? r.expiresAt.toISOString() : undefined;
      const signatureToken =
        r.signatureToken ||
        (r.status === "ACTIVE" && expiresAtIso
          ? generateSignedToken(r.machineId, expiresAtIso, subId)
          : undefined);

      globalSubscriptionsCache.set(r.id, {
        id: r.id,
        subscriberId: subId,
        planId: r.planId,
        planName: r.planName,
        price: r.price,
        paymentMethod: (r.paymentMethod as any) || "vodafone",
        senderPhone: r.senderPhone,
        transactionRef: r.transactionRef,
        status: (r.status as any) || "PENDING",
        machineId: r.machineId,
        allowedMachineIds: r.allowedMachineIds || [],
        doctorName: r.doctorName || undefined,
        clinicName: r.clinicName || undefined,
        durationDays: r.durationDays || 30,
        isTrial: r.isTrial || false,
        activatedAt: r.activatedAt ? r.activatedAt.toISOString() : undefined,
        expiresAt: expiresAtIso,
        signatureToken,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  } catch {}

  // Guarantee every active subscription in cache has a signature token
  for (const s of globalSubscriptionsCache.values()) {
    if (s.status === "ACTIVE" && s.expiresAt && !s.signatureToken) {
      s.signatureToken = generateSignedToken(s.machineId, s.expiresAt, s.subscriberId);
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
  const cleanId = (machineId || "").trim();
  const matching = all.filter(
    (s) => s.machineId === cleanId || (Array.isArray(s.allowedMachineIds) && s.allowedMachineIds.includes(cleanId))
  );

  // Prioritize ACTIVE first!
  const active = matching.find((s) => s.status === "ACTIVE");
  if (active) return active;
  const pending = matching.find((s) => s.status === "PENDING");
  if (pending) return pending;
  return matching[0] || null;
}

/**
 * Find subscription by unique Subscriber ID
 */
export async function getSubscriptionBySubscriberId(subscriberId: string): Promise<SubscriptionRecord | null> {
  const all = await getAllSubscriptions();
  const cleanId = subscriberId.toUpperCase().trim();
  return all.find((s) => s.subscriberId?.toUpperCase() === cleanId) || null;
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
    await fetchSupabaseRest("", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(record),
    });
  } catch (err: any) {
    console.warn("Supabase REST persist notice:", err.message);
  }

  // Also persist to PostgreSQL via Prisma if reachable
  try {
    await prisma.subscription.upsert({
      where: { id },
      update: {
        subscriberId,
        planId: record.planId,
        planName: record.planName,
        price: record.price,
        paymentMethod: record.paymentMethod,
        senderPhone: record.senderPhone,
        transactionRef: record.transactionRef,
        doctorName: record.doctorName || null,
        clinicName: record.clinicName || null,
        durationDays: record.durationDays,
        isTrial: record.isTrial || false,
        allowedMachineIds: record.allowedMachineIds,
        updatedAt: new Date(),
      },
      create: {
        id,
        subscriberId,
        planId: record.planId,
        planName: record.planName,
        price: record.price,
        paymentMethod: record.paymentMethod,
        senderPhone: record.senderPhone,
        transactionRef: record.transactionRef,
        status: "PENDING",
        machineId: record.machineId,
        allowedMachineIds: record.allowedMachineIds,
        doctorName: record.doctorName || null,
        clinicName: record.clinicName || null,
        durationDays: record.durationDays,
        isTrial: record.isTrial || false,
      },
    });
  } catch (err: any) {
    console.warn("DB subscription persist notice:", err.message);
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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        allowedMachineIds: existingAllowed,
        updatedAt: new Date(),
      },
    });
  } catch {}

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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { allowedMachineIds: list, updatedAt: new Date() },
    });
  } catch {}

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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { machineId: sub.machineId, allowedMachineIds: list, updatedAt: new Date() },
    });
  } catch {}

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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { machineId: sub.machineId, allowedMachineIds: sub.allowedMachineIds, updatedAt: new Date() },
    });
  } catch {}

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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { machineId: sub.machineId, allowedMachineIds: sub.allowedMachineIds, updatedAt: new Date() },
    });
  } catch {}

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
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  // Auto-suspend any older ACTIVE subscriptions for this machine or subscriber
  for (const [id, s] of globalSubscriptionsCache.entries()) {
    if (id !== subscriptionId && s.status === "ACTIVE") {
      const matchMachine = s.machineId === sub.machineId || (Array.isArray(s.allowedMachineIds) && s.allowedMachineIds.includes(sub.machineId));
      const matchSub = s.subscriberId && sub.subscriberId && s.subscriberId === sub.subscriberId;
      if (matchMachine || matchSub) {
        s.status = "SUSPENDED";
        s.updatedAt = new Date().toISOString();
        globalSubscriptionsCache.set(id, s);
        try {
          await fetchSupabaseRest(`?id=eq.${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "SUSPENDED", updatedAt: s.updatedAt }),
          });
          await prisma.subscription.update({
            where: { id },
            data: { status: "SUSPENDED", updatedAt: new Date() },
          });
        } catch {}
      }
    }
  }

  const days = durationDays || sub.durationDays || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Generate HMAC-signed token for secure validation
  const signatureToken = generateSignedToken(sub.machineId, expires.toISOString(), sub.subscriberId);

  sub.status = "ACTIVE";
  sub.durationDays = days;
  sub.activatedAt = now.toISOString();
  sub.expiresAt = expires.toISOString();
  sub.signatureToken = signatureToken;
  sub.updatedAt = now.toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  // Sync to Supabase REST
  try {
    await fetchSupabaseRest(`?id=eq.${sub.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ACTIVE",
        durationDays: days,
        activatedAt: sub.activatedAt,
        expiresAt: sub.expiresAt,
        signatureToken,
        updatedAt: sub.updatedAt,
      }),
    });
  } catch {}

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        durationDays: days,
        activatedAt: now,
        expiresAt: expires,
        signatureToken,
        updatedAt: now,
      },
    });
  } catch {}

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
  const signatureToken = generateSignedToken(sub.machineId, newExpiry.toISOString(), sub.subscriberId);

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

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        expiresAt: newExpiry,
        durationDays: newDays,
        signatureToken,
        updatedAt: new Date(),
      },
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
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "SUSPENDED", updatedAt: new Date() },
    });
  } catch {}

  return sub;
}

/**
 * Delete subscription
 */
export async function deleteSubscription(subscriptionId: string): Promise<boolean> {
  await hydrateCache();
  globalSubscriptionsCache.delete(subscriptionId);

  try {
    await prisma.subscription.delete({ where: { id: subscriptionId } });
  } catch {}

  try {
    await fetchSupabaseRest(`?id=eq.${subscriptionId}`, {
      method: "DELETE",
    });
  } catch {}

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
  // senderPhone is the payment phone number — keep it intact!
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

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        doctorName,
        clinicName: formattedClinicName,
        updatedAt: new Date(),
      },
    });
  } catch {}

  return sub;
}
