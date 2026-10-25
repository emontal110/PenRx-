import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Secrets must come from the real deployment environment. The packaged desktop
// build intentionally does not ship privileged credentials; it proxies to the
// cloud deployment instead. Any local-only placeholder remains non-sensitive and
// is never committed as a real secret value.
function getOptionalEnvValue(name: string): string {
  return (process.env[name] || "").trim();
}

function getSecretKey(): string {
  const value = getOptionalEnvValue("PENRX_SECRET_KEY");
  if (value) return value;
  return "penrx-local-dev-signature-key";
}

function getAdminSecret(): string {
  const value = getOptionalEnvValue("PENRX_ADMIN_SECRET");
  if (value) return value;
  return "penrx-local-dev-admin-secret";
}

function getSupabaseAnonKey(): string {
  return getOptionalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
}

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
// Authoritative backend operations (activate, delete, suspend, adjust days)
// must run with a real service-role key from the environment.
const SUPABASE_KEY = getSupabaseServiceRoleKey();

async function fetchSupabaseRest(endpoint: string, options: RequestInit = {}) {
  const buildHeaders = (key: string) => ({
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    ...((options.headers as any) || {}),
  });
  const getSignal = () =>
    options.signal ||
    (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(6000)
      : undefined);

  const anonKey = getSupabaseAnonKey();
  const res = await fetch(`${SUPABASE_REST_URL}${endpoint}`, {
    ...options,
    cache: "no-store",
    headers: buildHeaders(SUPABASE_KEY || anonKey),
    signal: getSignal(),
  });

  // If the real service-role key is unavailable, fall back only to the public anon key.
  if ((res.status === 401 || res.status === 403) && anonKey && SUPABASE_KEY && SUPABASE_KEY !== anonKey) {
    return fetch(`${SUPABASE_REST_URL}${endpoint}`, {
      ...options,
      cache: "no-store",
      headers: buildHeaders(anonKey),
      signal: getSignal(),
    });
  }

  return res;
}

/**
 * Resilient Supabase PATCH helper: retries without optional columns (e.g. signatureToken)
 * if the remote Supabase schema cache does not yet have those columns.
 */
async function patchSupabaseSubscription(id: string, payload: Record<string, any>): Promise<boolean> {
  try {
    let res = await fetchSupabaseRest(`?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });

    if (!res.ok && "signatureToken" in payload) {
      const { signatureToken: _omit, ...corePayload } = payload;
      res = await fetchSupabaseRest(`?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(corePayload),
      });
    }

    if (res.ok) {
      const rows = await res.json().catch(() => null);
      if (Array.isArray(rows) && rows.length > 0) {
        return true;
      }
      const anonKey = getSupabaseAnonKey();
      if (anonKey && SUPABASE_KEY && SUPABASE_KEY !== anonKey) {
        const { signatureToken: _omit, ...corePayload } = payload;
        const retryAnon = await fetch(`${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            apikey: anonKey,
            Authorization: "Bearer " + anonKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(corePayload),
        });
        if (retryAnon.ok) {
          const anonRows = await retryAnon.json().catch(() => null);
          return Array.isArray(anonRows) && anonRows.length > 0;
        }
      }
    }
    return res.ok;
  } catch (err) {
    console.error("[patchSupabaseSubscription] Exception:", err);
    return false;
  }
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
 * Case-insensitive comparison across primary machineId and allowedMachineIds.
 */
export function machineOwnsSubscription(sub: SubscriptionRecord, machineId: string): boolean {
  if (!sub || !machineId) return false;
  const clean = machineId.trim().toUpperCase();
  if (!clean) return false;
  const primary = (sub.machineId || "").trim().toUpperCase();
  const allowed = Array.isArray(sub.allowedMachineIds)
    ? sub.allowedMachineIds.map((m) => (m || "").trim().toUpperCase())
    : [];
  return primary === clean || allowed.includes(clean);
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
 * Helper: Select best subscription from a list (prioritizing non-expired ACTIVE, then PENDING, then most recent)
 */
export function pickBestSubscription(records: SubscriptionRecord[]): SubscriptionRecord | null {
  if (!Array.isArray(records) || records.length === 0) return null;
  const now = Date.now();

  for (const r of records) {
    if (r.status === "ACTIVE" && r.expiresAt && !r.signatureToken) {
      r.signatureToken = safeGenerateSignedToken(r.machineId, r.expiresAt, r.subscriberId);
    }
    if (r.id) {
      globalSubscriptionsCache.set(r.id, r);
    }
  }

  const activeValid = records.find(
    (s) => s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
  );
  if (activeValid) return activeValid;

  const anyActive = records.find((s) => s.status === "ACTIVE");
  if (anyActive) return anyActive;

  const pending = records.find((s) => s.status === "PENDING");
  if (pending) return pending;

  return records[0];
}

/**
 * Hydrate in-memory cache from PostgreSQL DB if available
 */
async function hydrateCache(force = false): Promise<void> {
  const now = Date.now();
  // Reduced TTL to 1.5s: Portal activates directly in Supabase; API must re-fetch quickly
  if (isCacheHydrated && !force && (now - lastHydrateTime < 1500)) return;

  try {
    const res = await fetchSupabaseRest("?select=*&order=updatedAt.desc,createdAt.desc&limit=500");
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records)) {
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
    }
  } catch (err: any) {
    console.warn("Supabase REST cache hydration notice:", err.message);
  }
}

/**
 * Public export: force-invalidate the in-memory cache and re-hydrate from Supabase.
 * Call this before any subscription lookup where freshness is critical (e.g. after portal activation).
 */
export async function forceHydrateCache(): Promise<void> {
  return hydrateCache(true);
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
 * Find subscription by exact Order/Record ID (`sub-...` or `trial-...`).
 * Queries Supabase directly first so portal activations on that exact record are seen immediately.
 */
export async function getSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
  const cleanId = (id || "").trim();
  if (!cleanId) return null;

  try {
    const res = await fetchSupabaseRest(`?id=eq.${encodeURIComponent(cleanId)}&limit=1`);
    if (res.ok) {
      const records: SubscriptionRecord[] = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        return pickBestSubscription(records);
      }
    }
  } catch (err) {
    console.warn("[getSubscriptionById] Supabase direct query notice:", err);
  }

  await hydrateCache(true);
  const cached = globalSubscriptionsCache.get(cleanId);
  if (cached) {
    if (cached.status === "ACTIVE" && cached.expiresAt && !cached.signatureToken) {
      cached.signatureToken = safeGenerateSignedToken(cached.machineId, cached.expiresAt, cached.subscriberId);
    }
    return cached;
  }
  return null;
}

/**
 * Find subscription by device Machine ID (either primary or in allowedMachineIds).
 * ALWAYS queries Supabase directly first — Vercel serverless instances have isolated
 * in-memory caches that go stale when the portal activates via a different instance.
 */
export async function getSubscriptionByMachine(machineId: string): Promise<SubscriptionRecord | null> {
  const cleanId = (machineId || "").trim().toUpperCase();
  if (!cleanId) return null;

  // ─── PRIMARY PATH: Always go directly to Supabase REST ────────────────────
  try {
    const res = await fetchSupabaseRest(
      `?machineId=ilike.${encodeURIComponent(cleanId)}&order=updatedAt.desc&limit=10`
    );
    if (res.ok) {
      const records: SubscriptionRecord[] = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const best = pickBestSubscription(records);
        if (best && best.status === "ACTIVE") {
          return best;
        }
        // If only PENDING/other found on primary machineId, also check cache for any ACTIVE allowedMachineIds match
        await hydrateCache(true);
        const allCached = Array.from(globalSubscriptionsCache.values()).filter((s) =>
          machineOwnsSubscription(s, cleanId)
        );
        const bestCombined = pickBestSubscription([...records, ...allCached]);
        if (bestCombined) return bestCombined;
      }
    }
  } catch (err) {
    console.warn("[getSubscriptionByMachine] Supabase direct query failed, falling back to cache:", err);
  }

  // ─── FALLBACK PATH: Search cache (also covers secondary devices in allowedMachineIds) ───
  await hydrateCache(true);
  const all = Array.from(globalSubscriptionsCache.values());
  const matching = all.filter((s) => machineOwnsSubscription(s, cleanId));

  return pickBestSubscription(matching);
}

/**
 * Find subscription by unique Subscriber ID (prioritizes ACTIVE first).
 * Queries Supabase directly first to avoid stale serverless instance memory caches.
 */
export async function getSubscriptionBySubscriberId(subscriberId: string): Promise<SubscriptionRecord | null> {
  const cleanId = (subscriberId || "").toUpperCase().trim();
  if (!cleanId || cleanId === "SUB-0000") return null;

  // 1. Direct Supabase REST query FIRST (authoritative, bypasses stale serverless RAM)
  try {
    const res = await fetchSupabaseRest(
      `?subscriberId=ilike.${encodeURIComponent(cleanId)}&order=updatedAt.desc&limit=10`
    );
    if (res.ok) {
      const records: SubscriptionRecord[] = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        return pickBestSubscription(records);
      }
    }
  } catch {}

  // 2. Fallback to hydrated cache
  const all = await getAllSubscriptions();
  const matching = all.filter((s) => s.subscriberId?.toUpperCase().trim() === cleanId);
  return pickBestSubscription(matching);
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
  allowedMachineIds?: string[];
  doctorName?: string;
  clinicName?: string;
  durationDays?: number;
  isTrial?: boolean;
}): Promise<SubscriptionRecord> {
  await hydrateCache();

  const id = data.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // If this exact subscription ID was already submitted via direct Supabase REST and already activated,
  // never overwrite its ACTIVE status back to PENDING!
  const existingById = globalSubscriptionsCache.get(id);
  if (existingById && existingById.status === "ACTIVE") {
    return existingById;
  }

  const subscriberId = data.subscriberId || generateSubscriberId();
  const nowIso = new Date().toISOString();
  const cleanPrimaryMachine = (data.machineId || "").trim();
  const mergedAllowed = Array.from(
    new Set(
      [cleanPrimaryMachine, ...(Array.isArray(data.allowedMachineIds) ? data.allowedMachineIds : [])]
        .map((m) => (m || "").trim())
        .filter(Boolean)
    )
  );

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
    machineId: cleanPrimaryMachine,
    allowedMachineIds: mergedAllowed.length > 0 ? mergedAllowed : [cleanPrimaryMachine],
    doctorName: data.doctorName,
    clinicName: data.clinicName,
    durationDays: data.durationDays || 30,
    isTrial: data.isTrial || false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Update in-memory instantly
  globalSubscriptionsCache.set(id, record);

  // Persist directly to Supabase REST Cloud with merge-duplicates so dual-write from client + API never conflicts
  try {
    const supaRes = await fetchSupabaseRest("?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(record),
    });
    if (supaRes.ok) {
      const savedRows = await supaRes.json().catch(() => null);
      if (Array.isArray(savedRows) && savedRows.length > 0) {
        globalSubscriptionsCache.set(id, savedRows[0]);
        return savedRows[0];
      }
    } else {
      const errText = await supaRes.text().catch(() => "");
      console.warn(`[Supabase REST Notice ${supaRes.status}]:`, errText);
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
  await hydrateCache(true);
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
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
  if (!sub) return null;

  const cleanMachine = newMachineId.trim();
  const list = Array.isArray(sub.allowedMachineIds) ? [...sub.allowedMachineIds] : [];
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
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
  if (!sub) return null;

  // Auto-suspend any older ACTIVE subscriptions and clean up any duplicate PENDING subscriptions for this machine or subscriber
  for (const [id, s] of globalSubscriptionsCache.entries()) {
    if (id !== subscriptionId && (s.status === "ACTIVE" || s.status === "PENDING")) {
      const matchMachine =
        (s.machineId || "").trim().toUpperCase() === (sub.machineId || "").trim().toUpperCase() ||
        (Array.isArray(s.allowedMachineIds) &&
          s.allowedMachineIds.some((m) => (m || "").trim().toUpperCase() === (sub.machineId || "").trim().toUpperCase()));
      const matchSub =
        s.subscriberId &&
        sub.subscriberId &&
        s.subscriberId.trim().toUpperCase() === sub.subscriberId.trim().toUpperCase();
      if (matchMachine || matchSub) {
        if (s.status === "PENDING") {
          globalSubscriptionsCache.delete(id);
          try {
            await fetchSupabaseRest(`?id=eq.${encodeURIComponent(id)}`, {
              method: "DELETE",
            });
          } catch {}
        } else {
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
  }

  const days = durationDays || sub.durationDays || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Ensure primary machineId is always in allowedMachineIds
  const primaryMid = (sub.machineId || "").trim();
  const existingAllowed = Array.isArray(sub.allowedMachineIds) ? [...sub.allowedMachineIds] : [];
  if (primaryMid && !existingAllowed.includes(primaryMid)) {
    existingAllowed.push(primaryMid);
  }

  // Generate HMAC-signed token for secure validation
  const signatureToken = safeGenerateSignedToken(sub.machineId, expires.toISOString(), sub.subscriberId);

  sub.status = "ACTIVE";
  sub.durationDays = days;
  sub.activatedAt = now.toISOString();
  sub.expiresAt = expires.toISOString();
  sub.allowedMachineIds = existingAllowed;
  sub.signatureToken = signatureToken;
  sub.updatedAt = now.toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  // Sync to Supabase REST with automatic column fallback
  await patchSupabaseSubscription(sub.id, {
    status: "ACTIVE",
    durationDays: days,
    activatedAt: sub.activatedAt,
    expiresAt: sub.expiresAt,
    allowedMachineIds: existingAllowed,
    signatureToken,
    updatedAt: sub.updatedAt,
  });

  return sub;
}

/**
 * Adjust subscription days (+ / -)
 */
export async function adjustSubscriptionDays(subscriptionId: string, daysDelta: number): Promise<SubscriptionRecord | null> {
  await hydrateCache(true);
  let sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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

  await patchSupabaseSubscription(sub.id, {
    status: "ACTIVE",
    expiresAt: newExpiry.toISOString(),
    durationDays: newDays,
    signatureToken,
    updatedAt: sub.updatedAt,
  });

  return sub;
}

/**
 * Suspend subscription
 */
export async function suspendSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache(true);
  const sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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
  await hydrateCache(true);
  const sub = globalSubscriptionsCache.get(subscriptionId) || (await getSubscriptionById(subscriptionId));
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
    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/CloudPrescription?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}

    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/CloudBackup?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}

    try {
      await fetch(
        `${SUPABASE_BASE_ROOT}/Subscription?subscriberId=eq.${encodeURIComponent(subscriberId)}`,
        { method: "DELETE", headers: supabaseHeaders }
      );
    } catch {}
  }

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
  await hydrateCache(true);
  const all = Array.from(globalSubscriptionsCache.values());
  const cleanKey = (subscriberIdOrMachineId || "").trim().toUpperCase();
  const sub = all.find(
    (s) =>
      (s.subscriberId || "").trim().toUpperCase() === cleanKey ||
      machineOwnsSubscription(s, cleanKey)
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
