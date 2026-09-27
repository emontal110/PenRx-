import { prisma } from "@/lib/prisma";

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

function generateSubscriberId(): string {
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `SUB-${randNum}`;
}

/**
 * Hydrate in-memory cache from PostgreSQL DB if available
 */
async function hydrateCache(): Promise<void> {
  if (isCacheHydrated) return;
  try {
    const records = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    });

    for (const r of records) {
      const subId = (r as any).subscriberId || generateSubscriberId();
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
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : undefined,
        signatureToken: r.signatureToken || undefined,
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
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : undefined,
        signatureToken: r.signatureToken || undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  } catch {}

  return Array.from(globalSubscriptionsCache.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Find subscription by device Machine ID (either primary or in allowedMachineIds)
 */
export async function getSubscriptionByMachine(machineId: string): Promise<SubscriptionRecord | null> {
  const all = await getAllSubscriptions();
  return (
    all.find(
      (s) => s.machineId === machineId || (s.allowedMachineIds && s.allowedMachineIds.includes(machineId))
    ) || null
  );
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

  // Persist to DB
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
export async function linkDeviceToSubscriber(subscriberId: string, newMachineId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = await getSubscriptionBySubscriberId(subscriberId);
  if (!sub) return null;

  const cleanMachine = newMachineId.trim();
  const existingAllowed = sub.allowedMachineIds || [];
  if (!existingAllowed.includes(cleanMachine)) {
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

  return sub;
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

  return sub;
}

/**
 * Remove an allowed device from a subscription
 */
export async function removeAllowedDevice(subscriptionId: string, targetMachineId: string): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const list = (sub.allowedMachineIds || []).filter((m) => m !== targetMachineId.trim());
  sub.allowedMachineIds = list;
  sub.updatedAt = new Date().toISOString();
  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { allowedMachineIds: list, updatedAt: new Date() },
    });
  } catch {}

  return sub;
}

/**
 * Activate subscription with duration days
 */
export async function activateSubscription(subscriptionId: string, durationDays: number): Promise<SubscriptionRecord | null> {
  await hydrateCache();
  const sub = globalSubscriptionsCache.get(subscriptionId);
  if (!sub) return null;

  const days = durationDays || sub.durationDays || 30;
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  sub.status = "ACTIVE";
  sub.durationDays = days;
  sub.activatedAt = now.toISOString();
  sub.expiresAt = expires.toISOString();
  sub.updatedAt = now.toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        durationDays: days,
        activatedAt: now,
        expiresAt: expires,
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

  sub.status = "ACTIVE";
  sub.expiresAt = newExpiry.toISOString();
  sub.durationDays = newDays;
  sub.updatedAt = new Date().toISOString();

  globalSubscriptionsCache.set(sub.id, sub);

  try {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        expiresAt: newExpiry,
        durationDays: newDays,
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

  return true;
}
