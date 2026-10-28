/**
 * PenRX+ subscription service (server-side only).
 *
 * Rules enforced here:
 *  - No secret is ever read from source: keys come from the environment through
 *    env.ts and throw when absent (the packaged desktop runtime proxies to the cloud).
 *  - Prices and durations come from the server plan catalogue, never from the client.
 *  - No process-wide subscription cache: every lookup hits PostgreSQL so a portal
 *    activation is visible on the very next request (instant unlock).
 *  - This module performs NO authorization. Route handlers must authenticate the
 *    caller (admin session cookie or device token) before calling anything below.
 */

import { randomBytes } from "crypto";
import { supabaseRest } from "@/lib/supabaseRest";
import { resolvePlan, MAX_DEVICES_PER_SUBSCRIPTION } from "@/lib/env";
import { issueDeviceToken } from "@/lib/deviceAuth";

export type SubscriptionStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED";

export interface SubscriptionRecord {
  id: string;
  subscriberId: string;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: "vodafone" | "instapay";
  senderPhone: string;
  transactionRef: string;
  status: SubscriptionStatus;
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

const TABLE = "Subscription";
const QUERY_LIMIT = 500;
const MACHINE_ID_PATTERN = /^[A-Z0-9_-]{6,64}$/;

function normId(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

/** Normalizes PostgREST rows: arrays may arrive as text, and expiry is recomputed server-side. */
function hydrate(row: any): SubscriptionRecord | null {
  if (!row || !row.id) return null;

  let allowed = row.allowedMachineIds;
  if (typeof allowed === "string") {
    try {
      allowed = JSON.parse(allowed);
    } catch {
      allowed = allowed ? [allowed] : [];
    }
  }
  if (!Array.isArray(allowed)) allowed = [];

  const expiresAt = row.expiresAt ? new Date(row.expiresAt).toISOString() : undefined;
  const status: SubscriptionStatus =
    row.status === "ACTIVE" && expiresAt && new Date(expiresAt).getTime() <= Date.now()
      ? "EXPIRED"
      : row.status;

  return {
    ...row,
    subscriberId: row.subscriberId || "",
    status,
    price: Number(row.price) || 0,
    durationDays: Number(row.durationDays) || 30,
    allowedMachineIds: allowed.map((m: unknown) => String(m || "").trim()).filter(Boolean),
    expiresAt,
    signatureToken: undefined,
  } as SubscriptionRecord;
}

async function queryRows(query: string): Promise<SubscriptionRecord[]> {
  const rows = await supabaseRest<any[]>(TABLE, { query });
  if (!Array.isArray(rows)) return [];
  return rows.map(hydrate).filter((r): r is SubscriptionRecord => Boolean(r));
}

export function machineOwnsSubscription(sub: SubscriptionRecord, machineId: string): boolean {
  const clean = normId(machineId);
  if (!sub || !clean) return false;
  return normId(sub.machineId) === clean || (sub.allowedMachineIds || []).some((m) => normId(m) === clean);
}

export function pickBestSubscription(records: SubscriptionRecord[]): SubscriptionRecord | null {
  if (!Array.isArray(records) || records.length === 0) return null;
  const now = Date.now();

  const live = records.find((s) => s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt).getTime() > now));
  if (live) return live;
  const active = records.find((s) => s.status === "ACTIVE");
  if (active) return active;

  // بلا اشتراك نشط تُرجع آخر قرار إداري على هذا الجهاز: الطلب المعلّق حديثاً أو
  // الإيقاف/الانتهاء الأحدث. ترتيب updatedAt يحسم أن الإيقاف الأخير لا يُخفيه طلب قديم.
  const newest = [...records].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  )[0];
  return newest || records[0];
}

/** Mints the short-lived access token that medical-data endpoints require. */
function withDeviceToken(sub: SubscriptionRecord, machineId: string): SubscriptionRecord {
  if (sub.status !== "ACTIVE") return sub;
  try {
    const { token } = issueDeviceToken({
      machineId: normId(machineId) || normId(sub.machineId),
      subscriberId: sub.subscriberId,
      subscriptionId: sub.id,
      expiresAt: sub.expiresAt || new Date(Date.now() + sub.durationDays * 86400000).toISOString(),
    });
    return { ...sub, signatureToken: token };
  } catch {
    return sub;
  }
}

export async function getSubscriptionById(id: string): Promise<SubscriptionRecord | null> {
  const clean = String(id || "").trim();
  if (!clean) return null;
  const rows = await queryRows(`id=eq.${encodeURIComponent(clean)}&limit=1`);
  return rows[0] || null;
}



/**
 * Every subscription belonging to a physical device. allowedMachineIds is a
 * Postgres array, so containment is matched in SQL via the `cs.` operator.
 */
export async function getSubscriptionsByMachine(machineId: string): Promise<SubscriptionRecord[]> {
  const clean = normId(machineId);
  if (!clean) return [];

  const [byPrimary, byAllowed] = await Promise.all([
    queryRows(`machineId=ilike.${encodeURIComponent(clean)}&order=updatedAt.desc&limit=${QUERY_LIMIT}`),
    queryRows(`allowedMachineIds=cs.{${clean}}&order=updatedAt.desc&limit=${QUERY_LIMIT}`),
  ]);

  const merged = new Map<string, SubscriptionRecord>();
  for (const row of [...byPrimary, ...byAllowed]) merged.set(row.id, row);
  return Array.from(merged.values()).filter((s) => machineOwnsSubscription(s, clean));
}

export async function getSubscriptionByMachine(machineId: string): Promise<SubscriptionRecord | null> {
  return pickBestSubscription(await getSubscriptionsByMachine(machineId));
}

export async function getSubscriptionBySubscriberId(subscriberId: string): Promise<SubscriptionRecord | null> {
  const clean = normId(subscriberId);
  if (!clean || clean === "SUB-0000") return null;
  const rows = await queryRows(`subscriberId=ilike.${encodeURIComponent(clean)}&order=updatedAt.desc&limit=20`);
  return pickBestSubscription(rows);
}

/**
 * Single authoritative check used by desktop/mobile clients to unlock the app.
 * An order id or subscriber id hint only reveals records the device owns, so it
 * cannot be used to read someone else's subscription.
 */
export async function resolveDeviceSubscription(input: {
  machineId: string;
  altMachineId?: string;
  subscriberId?: string;
  orderId?: string;
}): Promise<SubscriptionRecord | null> {
  const machineId = normId(input.machineId);
  if (!machineId) return null;

  const [ownSubs, altSubs, bySubId, byOrder] = await Promise.all([
    getSubscriptionsByMachine(machineId),
    input.altMachineId && normId(input.altMachineId) !== machineId
      ? getSubscriptionsByMachine(input.altMachineId)
      : Promise.resolve([] as SubscriptionRecord[]),
    input.subscriberId ? getSubscriptionBySubscriberId(input.subscriberId) : Promise.resolve(null),
    input.orderId ? getSubscriptionById(input.orderId) : Promise.resolve(null),
  ]);

  const candidates: SubscriptionRecord[] = [...ownSubs, ...altSubs];
  if (bySubId) candidates.push(bySubId);
  if (byOrder) candidates.push(byOrder);

  const subscriberId = normId(input.subscriberId);
  const orderId = String(input.orderId || "").trim();

  // ملكية الجهاز هي وحدها ما يفتح الاشتراك: hints مثل subscriberId أو رقم الطلب
  // تُستخدم فقط لعرض الطلب المعلّق على الجهاز نفسه، ولا تُمنح مطلقاً لتوكن وصول.
  const directlyOwned: SubscriptionRecord[] = [];
  const pendingHints: SubscriptionRecord[] = [];

  for (const s of candidates) {
    const isOwnDevice =
      machineOwnsSubscription(s, machineId) ||
      (input.altMachineId ? machineOwnsSubscription(s, normId(input.altMachineId)) : false);

    if (isOwnDevice) {
      directlyOwned.push(s);
      continue;
    }

    const hinted =
      (subscriberId && normId(s.subscriberId) === subscriberId) || (orderId && s.id === orderId);
    if (hinted && s.status === "PENDING") pendingHints.push(s);
  }

  const best = pickBestSubscription(directlyOwned) || pickBestSubscription(pendingHints);
  return best ? withDeviceToken(best, machineId) : null;
}

export async function getAllSubscriptions(
  filters: { status?: string; search?: string } = {}
): Promise<SubscriptionRecord[]> {
  const parts = ["order=createdAt.desc", `limit=${QUERY_LIMIT}`];
  const status = normId(filters.status);
  if (["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED"].includes(status)) {
    parts.unshift(`status=eq.${status}`);
  }
  const rows = await queryRows(parts.join("&"));

  const search = String(filters.search || "").trim().toLowerCase();
  if (!search) return rows;

  return rows.filter((s) =>
    [s.subscriberId, s.doctorName, s.clinicName, s.machineId, s.senderPhone, s.transactionRef, s.id].some(
      (v) => String(v || "").toLowerCase().includes(search)
    )
  );
}

function generateSubscriberId(): string {
  return `SUB-${randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8)
    .padEnd(8, "X")}`;
}

function sanitizeMachineIds(list: unknown, primary: string): string[] {
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const clean = normId(value);
    if (clean && MACHINE_ID_PATTERN.test(clean)) seen.add(clean);
  };
  push(primary);
  if (Array.isArray(list)) list.forEach(push);
  return Array.from(seen).slice(0, MAX_DEVICES_PER_SUBSCRIPTION);
}

/**
 * Creates a PENDING request for the portal queue. Plan, price and duration are
 * resolved from the server catalogue; a client cannot lower a price.
 */
export async function submitSubscription(data: {
  id?: string;
  planId: string;
  paymentMethod?: string;
  senderPhone: string;
  transactionRef: string;
  machineId: string;
  allowedMachineIds?: string[];
  doctorName?: string;
  clinicName?: string;
}): Promise<SubscriptionRecord> {
  const plan = resolvePlan(data.planId);
  if (!plan) throw new Error("خطة اشتراك غير معروفة.");

  const machineId = normId(data.machineId);
  if (!machineId || !MACHINE_ID_PATTERN.test(machineId)) throw new Error("معرّف جهاز غير صالح.");

  const senderPhone = String(data.senderPhone || "").replace(/\D/g, "").slice(0, 15);
  // A free trial has no transfer to prove, so only paid plans require the sender phone.
  if (!plan.isTrial && senderPhone.length < 10) {
    throw new Error("رقم الهاتف الذي حوّلت منه مطلوب.");
  }

  const requestedId = String(data.id || "").trim();
  const nowIso = new Date().toISOString();

  const record: SubscriptionRecord = {
    id: /^(sub|trial)-[a-z0-9-]{6,40}$/i.test(requestedId)
      ? requestedId
      : `sub-${Date.now()}-${randomBytes(3).toString("hex")}`,
    subscriberId: generateSubscriberId(),
    planId: plan.id,
    planName: plan.nameAr,
    price: plan.priceEGP,
    paymentMethod: data.paymentMethod === "instapay" ? "instapay" : "vodafone",
    senderPhone,
    transactionRef: String(data.transactionRef || "").trim().slice(0, 64),
    status: "PENDING",
    machineId,
    allowedMachineIds: sanitizeMachineIds(data.allowedMachineIds, machineId),
    doctorName: String(data.doctorName || "").trim().slice(0, 120),
    clinicName: String(data.clinicName || "").trim().slice(0, 160),
    durationDays: plan.durationDays,
    isTrial: plan.isTrial,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (plan.isTrial) {
    const prior = await getSubscriptionsByMachine(machineId);
    if (prior.some((s) => (s.isTrial || s.planId === "trial") && s.status !== "SUSPENDED")) {
      throw new Error("لقد تم الاستفادة من الفترة التجريبية المجانية مسبقاً على هذا الجهاز.");
    }
  }

  const created = await supabaseRest<any[]>(TABLE, {
    method: "POST",
    body: record,
    prefer: "return=representation",
  });

  const row = Array.isArray(created) ? hydrate(created[0]) : hydrate(created as any);
  return row || record;
}

async function patchSubscription(
  id: string,
  patch: Partial<SubscriptionRecord>
): Promise<SubscriptionRecord | null> {
  const updated = await supabaseRest<any[]>(TABLE, {
    method: "PATCH",
    query: `id=eq.${encodeURIComponent(id)}`,
    body: { ...patch, updatedAt: new Date().toISOString() },
    prefer: "return=representation",
  });
  const row = Array.isArray(updated) ? hydrate(updated[0]) : hydrate(updated as any);
  if (row) return row;
  return getSubscriptionById(id);
}

export async function activateSubscription(
  subscriptionId: string,
  durationDays?: number,
  machineIdHint?: string
): Promise<SubscriptionRecord | null> {
  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const plan = resolvePlan(existing.planId);
  const days = Math.min(3650, Math.max(1, Math.round(Number(durationDays) || plan?.durationDays || existing.durationDays || 30)));
  const now = new Date();
  const base =
    existing.status === "ACTIVE" && existing.expiresAt && new Date(existing.expiresAt) > now
      ? new Date(existing.expiresAt)
      : now;

  const next = await patchSubscription(subscriptionId, {
    status: "ACTIVE",
    durationDays: days,
    price: plan ? plan.priceEGP : existing.price,
    activatedAt: existing.activatedAt || now.toISOString(),
    expiresAt: new Date(base.getTime() + days * 86400000).toISOString(),
  } as Partial<SubscriptionRecord>);

  return next ? withDeviceToken(next, machineIdHint || next.machineId) : null;
}

export async function suspendSubscription(subscriptionId: string): Promise<SubscriptionRecord | null> {
  return patchSubscription(subscriptionId, { status: "SUSPENDED" } as Partial<SubscriptionRecord>);
}

export async function adjustSubscriptionDays(
  subscriptionId: string,
  daysDelta: number,
  machineIdHint?: string
): Promise<SubscriptionRecord | null> {
  const delta = Math.round(Number(daysDelta));
  if (!Number.isFinite(delta) || Math.abs(delta) > 3650) throw new Error("قيمة مدة غير صالحة.");

  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const now = Date.now();
  const currentExpiry =
    existing.expiresAt && new Date(existing.expiresAt).getTime() > now
      ? new Date(existing.expiresAt).getTime()
      : now;
  const newExpiry = new Date(currentExpiry + delta * 86400000);
  const remaining = Math.max(1, Math.ceil((newExpiry.getTime() - now) / 86400000));

  const next = await patchSubscription(subscriptionId, {
    status: "ACTIVE",
    expiresAt: newExpiry.toISOString(),
    durationDays: remaining,
    activatedAt: existing.activatedAt || new Date(now).toISOString(),
  } as Partial<SubscriptionRecord>);

  return next ? withDeviceToken(next, machineIdHint || next.machineId) : null;
}

async function replaceDevices(subscriptionId: string, devices: string[]): Promise<SubscriptionRecord | null> {
  return patchSubscription(subscriptionId, { allowedMachineIds: devices } as Partial<SubscriptionRecord>);
}

export async function addAllowedDevice(
  subscriptionId: string,
  newMachineId: string,
  actorMachineId?: string
): Promise<SubscriptionRecord | null> {
  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const clean = normId(newMachineId);
  if (!clean || !MACHINE_ID_PATTERN.test(clean)) throw new Error("معرّف جهاز غير صالح.");

  const devices = sanitizeMachineIds([...(existing.allowedMachineIds || []), clean], existing.machineId);
  if (!devices.includes(clean)) throw new Error(`اكتمل الحد المسموح (${MAX_DEVICES_PER_SUBSCRIPTION} أجهزة).`);

  const next = await replaceDevices(subscriptionId, devices);
  return next ? withDeviceToken(next, actorMachineId || clean) : null;
}

export async function removeAllowedDevice(
  subscriptionId: string,
  targetMachineId: string
): Promise<SubscriptionRecord | null> {
  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const clean = normId(targetMachineId);
  if (clean === normId(existing.machineId)) throw new Error("لا يمكن إزالة الجهاز الرئيسي.");
  return replaceDevices(subscriptionId, (existing.allowedMachineIds || []).filter((m) => normId(m) !== clean));
}

export async function setPrimaryDevice(
  subscriptionId: string,
  machineId: string
): Promise<SubscriptionRecord | null> {
  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const clean = normId(machineId);
  if (!clean || !MACHINE_ID_PATTERN.test(clean)) throw new Error("معرّف جهاز غير صالح.");

  const devices = sanitizeMachineIds(
    [...(existing.allowedMachineIds || []), existing.machineId],
    clean
  ).filter((m) => m !== clean);

  return patchSubscription(subscriptionId, {
    machineId: clean,
    allowedMachineIds: devices,
  } as Partial<SubscriptionRecord>);
}

/** Swaps a hardware id (reinstall / new PC) so the doctor keeps their records. */
export async function editAllowedDevice(
  subscriptionId: string,
  oldMachineId: string,
  newMachineId: string
): Promise<SubscriptionRecord | null> {
  const existing = await getSubscriptionById(subscriptionId);
  if (!existing) return null;

  const oldClean = normId(oldMachineId);
  const newClean = normId(newMachineId);
  if (!MACHINE_ID_PATTERN.test(oldClean) || !MACHINE_ID_PATTERN.test(newClean)) {
    throw new Error("معرّفي جهاز صالحان مطلوبان.");
  }

  const isPrimary = normId(existing.machineId) === oldClean;
  const devices = (existing.allowedMachineIds || []).map((m) => (normId(m) === oldClean ? newClean : m));

  if (isPrimary) {
    return patchSubscription(subscriptionId, {
      machineId: newClean,
      allowedMachineIds: devices,
    } as Partial<SubscriptionRecord>);
  }

  if (!devices.includes(newClean)) devices.push(newClean);
  return replaceDevices(subscriptionId, devices);
}

/**
 * Links an extra device to an existing subscription. Ownership is proven with the
 * registered sender phone; only ACTIVE subscriptions accept new devices.
 */
export async function linkDeviceToSubscriber(
  subscriberId: string,
  machineId: string,
  verificationPhone: string
): Promise<{ success: boolean; error?: string; subscription?: SubscriptionRecord }> {
  const sub = await getSubscriptionBySubscriberId(subscriberId);
  if (!sub) return { success: false, error: "لم يتم العثور على اشتراك مطابق." };
  if (sub.status !== "ACTIVE") return { success: false, error: "ربط الأجهزة متاح على الاشتراكات النشطة فقط." };

  const cleanPhone = String(verificationPhone || "").replace(/\D/g, "");
  const registeredPhone = String(sub.senderPhone || "").replace(/\D/g, "");
  if (cleanPhone.length < 8 || registeredPhone.length < 8 || cleanPhone.slice(-8) !== registeredPhone.slice(-8)) {
    return { success: false, error: "رقم الهاتف لا يطابق الرقم المسجل لهذا الاشتراك." };
  }

  const devices = sanitizeMachineIds([...(sub.allowedMachineIds || []), machineId], sub.machineId);
  if (!devices.includes(normId(machineId))) {
    return { success: false, error: `اكتمل الحد المسموح (${MAX_DEVICES_PER_SUBSCRIPTION} أجهزة).` };
  }

  const next = await replaceDevices(sub.id, devices);
  return { success: true, subscription: next ? withDeviceToken(next, machineId) : undefined };
}

export async function updateSubscriptionDoctorProfile(
  subscriberId: string,
  doctorName: string,
  clinicName: string,
  phone: string
): Promise<SubscriptionRecord | null> {
  const sub = await getSubscriptionBySubscriberId(subscriberId);
  if (!sub) return null;
  return patchSubscription(sub.id, {
    doctorName: String(doctorName || "").trim().slice(0, 120) || sub.doctorName,
    clinicName: String(clinicName || "").trim().slice(0, 160) || sub.clinicName,
    senderPhone: String(phone || "").replace(/\D/g, "").slice(0, 15) || sub.senderPhone,
  } as Partial<SubscriptionRecord>);
}

export async function cancelPendingSubscription(subscriptionId: string, machineId: string): Promise<boolean> {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return false;
  if (sub.status !== "PENDING") throw new Error("لا يمكن إلغاء طلب تمت مراجعته أو تفعيله مسبقاً.");
  if (!machineOwnsSubscription(sub, machineId)) throw new Error("هذا الجهاز غير مصرح له بإلغاء هذا الطلب.");
  return deleteSubscription(subscriptionId);
}

/** Admin-only removal of a doctor plus all of their cloud medical data. */
export async function deleteSubscription(subscriptionId: string): Promise<boolean> {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return false;

  const owner = normId(sub.subscriberId);
  if (owner) {
    await Promise.all([
      supabaseRest("CloudPrescription", {
        method: "DELETE",
        query: `subscriberId=eq.${encodeURIComponent(owner)}`,
      }).catch(() => null),
      supabaseRest("CloudBackup", {
        method: "DELETE",
        query: `subscriberId=eq.${encodeURIComponent(owner)}`,
      }).catch(() => null),
      supabaseRest(TABLE, {
        method: "DELETE",
        query: `subscriberId=eq.${encodeURIComponent(owner)}`,
      }).catch(() => null),
    ]);
  }

  await supabaseRest(TABLE, { method: "DELETE", query: `id=eq.${encodeURIComponent(subscriptionId)}` });
  return true;
}

/** Badge/queue helper for the portal. */
export async function countPendingSubscriptions(): Promise<number> {
  const rows = await supabaseRest<any[]>(TABLE, { query: "status=eq.PENDING&select=id&limit=500" });
  return Array.isArray(rows) ? rows.length : 0;
}
