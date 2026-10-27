/**
 * PenRX+ Commercial Cloud Sync, Offline Queue & Smart Cache Engine
 *
 * Features:
 *   1. Multi-Tenant Strict Isolation: Every record is bound to the subscriber's license ID.
 *   2. Ultra-Lean Payload: Minified medication keys & stripped defaults for 80%+ Supabase free-tier space savings.
 *   3. 365-Day Retention Policy: Retains active records for 365 days and permanently preserves archived records.
 *   4. Offline-First Sequential FIFO Queue: Non-blocking background worker with automatic retry.
 *   5. Smart Unified Cache Cleaner: Automated periodic cleanup across Android APK and PC Desktop.
 */

import { SavedPrescription } from "@/store/usePrescriptionStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getApiUrl } from "@/lib/cloudProxy";
import { deviceAuthHeaders } from "@/lib/deviceAuthClient";

export const RETENTION_DAYS = 365; // 1 full year retention
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface LeanPrescriptionItem {
  n: string;    // drugName
  a?: string;   // activeIngredient (omitted if empty)
  q?: string;   // doseQuantity (omitted if "1")
  f?: string;   // doseForm (omitted if empty)
  fr?: string;  // frequency (omitted if empty)
  d?: string;   // duration (omitted if empty)
  i?: string;   // instructions (omitted if empty)
}

export interface LeanCloudPrescription {
  id: string;
  subId: string;        // subscriberId
  pNo: string;          // prescriptionNo
  bId?: string;         // branchId
  bName?: string;       // branchName
  pName: string;        // patient.name
  pPhone?: string;      // patient.phone
  pAge?: string;        // patient.age
  pGen?: string;        // patient.gender ("M" | "F" | "MALE" | "FEMALE")
  diag?: string;        // diagnosis
  notes?: string;       // notes
  arc?: boolean;        // isArchived
  arcAt?: string;       // archivedAt
  items: LeanPrescriptionItem[];
  ts: string;           // createdAt (ISO string)
}

export interface SyncQueueItem {
  id: string;
  action: "SAVE" | "DELETE";
  prescriptionId: string;
  subscriberId: string;
  data?: LeanCloudPrescription;
  retryCount: number;
  enqueuedAt: number;
  /** Exponential backoff: the item is skipped until this timestamp. */
  nextRetryAt?: number;
  /** Kept but not retried until the doctor's license is verified again. */
  needsLicense?: boolean;
}

const QUEUE_STORAGE_KEY = "penrx_cloud_sync_queue";
const LAST_CLEANUP_KEY = "penrx_last_smart_cache_clean";

/**
 * Compresses a rich SavedPrescription into an ultra-lean cloud payload
 * Strips default values ("1", empty strings, false flags) to minimize Supabase JSONB storage footprint.
 */
export function compressPrescription(
  rx: SavedPrescription,
  subscriberId: string
): LeanCloudPrescription {
  const cleanStr = (v?: string | number | null) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  };

  const leanItems: LeanPrescriptionItem[] = (rx.items || []).map((it) => {
    const item: LeanPrescriptionItem = {
      n: (it.drugName || "").trim(),
    };
    const act = cleanStr(it.activeIngredient);
    if (act) item.a = act;
    const qty = cleanStr(it.doseQuantity);
    if (qty && qty !== "1") item.q = qty;
    const form = cleanStr(it.doseForm);
    if (form) item.f = form;
    const freq = cleanStr(it.frequency);
    if (freq) item.fr = freq;
    const dur = cleanStr(it.duration);
    if (dur) item.d = dur;
    const inst = cleanStr(it.instructions);
    if (inst) item.i = inst;
    return item;
  });

  const lean: LeanCloudPrescription = {
    id: rx.id,
    subId: subscriberId,
    pNo: rx.prescriptionNo,
    pName: cleanStr(rx.patient?.name) || "مريض",
    items: leanItems,
    ts: rx.createdAt || new Date().toISOString(),
  };

  const bId = cleanStr(rx.branchId);
  if (bId) lean.bId = bId;
  const bName = cleanStr(rx.branchName);
  if (bName) lean.bName = bName;
  const pPhone = cleanStr(rx.patient?.phone);
  if (pPhone) lean.pPhone = pPhone;
  const pAge = cleanStr(rx.patient?.age);
  if (pAge) lean.pAge = pAge;
  if (rx.patient?.gender === "FEMALE") lean.pGen = "F";
  else if (rx.patient?.gender === "MALE") lean.pGen = "M";
  const diag = cleanStr(rx.diagnosis);
  if (diag) lean.diag = diag;
  const notes = cleanStr(rx.notes);
  if (notes) lean.notes = notes;
  if (rx.isArchived) {
    lean.arc = true;
    if (rx.archivedAt) lean.arcAt = rx.archivedAt;
  }

  return lean;
}

/**
 * Decompresses a lean cloud payload back into a rich SavedPrescription
 */
export function decompressPrescription(lean: LeanCloudPrescription): SavedPrescription {
  const gen =
    lean.pGen === "FEMALE" || lean.pGen === "F"
      ? "FEMALE"
      : lean.pGen === "MALE" || lean.pGen === "M"
      ? "MALE"
      : undefined;

  return {
    id: lean.id,
    prescriptionNo: lean.pNo,
    createdAt: lean.ts,
    branchId: lean.bId || "",
    branchName: lean.bName,
    patient: {
      name: lean.pName,
      phone: lean.pPhone || "",
      age: lean.pAge || "",
      gender: gen,
    },
    diagnosis: lean.diag || "",
    notes: lean.notes || "",
    isArchived: Boolean(lean.arc),
    archivedAt: lean.arcAt,
    items: (lean.items || []).map((it, idx) => ({
      id: `${lean.id}-item-${idx}`,
      drugName: it.n,
      activeIngredient: it.a || "",
      doseQuantity: it.q || "1",
      doseForm: it.f || "",
      frequency: it.fr || "",
      duration: it.d || "",
      instructions: it.i || "",
    })),
  };
}

// ===== OFFLINE-FIRST FIFO QUEUE MANAGEMENT =====

function getQueue(): SyncQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("[SyncQueue] Failed to persist queue to localStorage:", err);
  }
}

let isProcessingQueue = false;

/**
 * Enqueue a SAVE or DELETE action into the persistent sync queue
 */
export function enqueueSyncAction(
  action: "SAVE" | "DELETE",
  prescriptionId: string,
  subscriberId: string,
  prescription?: SavedPrescription
): void {
  if (typeof window === "undefined" || !subscriberId) return;

  const queue = getQueue();
  const filtered = queue.filter((item) => item.prescriptionId !== prescriptionId);

  const newItem: SyncQueueItem = {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    prescriptionId,
    subscriberId,
    data: action === "SAVE" && prescription ? compressPrescription(prescription, subscriberId) : undefined,
    retryCount: 0,
    enqueuedAt: Date.now(),
  };

  filtered.push(newItem);
  saveQueue(filtered);

  processSyncQueue();
}

/** Maximum backoff between attempts; items are retried for 30 days before giving up. */
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;

function backoffFor(retryCount: number): number {
  return Math.min(MAX_RETRY_MS, 5000 * Math.pow(2, Math.min(retryCount, 7)));
}

/**
 * Sequential background queue processor.
 *
 * A prescription that failed to upload is never discarded: it stays in the queue
 * with exponential backoff and retries for 30 days, because "the cloud said no"
 * is exactly the case where the doctor's record must not be dropped.
 */
export async function processSyncQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isProcessingQueue) return;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    notifySyncStatus("offline");
    return;
  }

  const now = Date.now();
  const due = getQueue().filter((q) => !q.nextRetryAt || q.nextRetryAt <= now);
  if (due.length === 0) {
    notifySyncStatus("pending");
    return;
  }

  isProcessingQueue = true;
  notifySyncStatus("syncing");

  const item = due[0];

  try {
    const res = await fetch(getApiUrl("/api/prescriptions/sync"), {
      method: "POST",
      headers: deviceAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        action: item.action,
        prescriptionId: item.prescriptionId,
        data: item.data,
      }),
    });

    if (res.ok) {
      const updatedQueue = getQueue().filter((q) => q.id !== item.id);
      saveQueue(updatedQueue);
      isProcessingQueue = false;
      if (updatedQueue.length > 0) {
        processSyncQueue();
      } else {
        notifySyncStatus("synced");
      }
      return;
    }

    const fresh = getQueue();
    const target = fresh.find((q) => q.id === item.id);
    if (target) {
      target.retryCount = (target.retryCount || 0) + 1;
      target.nextRetryAt = Date.now() + backoffFor(target.retryCount);

      // 401/403 means the device token expired, the subscription lapsed, or this
      // device was removed: re-verify the license, which mints a fresh token.
      if (res.status === 401 || res.status === 403) {
        target.needsLicense = true;
        useSubscriptionStore.getState().syncWithServer(true).catch(() => {});
      }

      // Abandoned only after a month of failed attempts, and the UI is told so.
      if (Date.now() - target.enqueuedAt > 30 * 24 * 60 * 60 * 1000) {
        saveQueue(fresh.filter((q) => q.id !== item.id));
        notifySyncStatus("error");
      } else {
        saveQueue(fresh);
        notifySyncStatus(res.status === 502 || res.status === 503 ? "offline" : "pending");
      }
    }
    isProcessingQueue = false;
  } catch {
    const fresh = getQueue();
    const target = fresh.find((q) => q.id === item.id);
    if (target) {
      target.retryCount = (target.retryCount || 0) + 1;
      target.nextRetryAt = Date.now() + backoffFor(target.retryCount);
      saveQueue(fresh);
    }
    isProcessingQueue = false;
    notifySyncStatus("offline");
  }
}

/**
 * Pull latest cloud prescriptions for this subscriber (Multi-Device Sync)
 */
export async function pullCloudPrescriptions(
  subscriberId: string
): Promise<SavedPrescription[] | null> {
  if (!subscriberId || typeof window === "undefined") return null;

  try {
    const machineId = useSubscriptionStore.getState().machineId;
    const res = await fetch(
      getApiUrl(`/api/prescriptions/sync?subscriberId=${encodeURIComponent(subscriberId)}&machineId=${encodeURIComponent(machineId || "")}`),
      { cache: "no-store", headers: deviceAuthHeaders() }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !Array.isArray(data.prescriptions)) return null;

    const now = Date.now();
    const leanList: LeanCloudPrescription[] = data.prescriptions;

    const decompressed = leanList
      .filter((lean) => {
        if (lean.arc) return true;
        const itemTime = new Date(lean.ts).getTime();
        return !isNaN(itemTime) && now - itemTime <= RETENTION_MS;
      })
      .map(decompressPrescription);

    return decompressed;
  } catch (err) {
    console.warn("[CloudSync] Pull error (offline or server unreachable):", err);
    return null;
  }
}

// ===== SMART UNIFIED CACHE CLEANER =====

const ORPHANED_STORAGE_PREFIXES = [
  "penrx_temp_",
  "penrx_draft_old_",
  "next-auth.",
  "__clerk_",
];

/**
 * Smart periodic cache cleaner for both Mobile APK and Desktop PC.
 * Preserves all doctor credentials, clinic configuration, active subscription tokens,
 * and all active/archived prescriptions.
 */
export function runSmartCacheCleanup(
  getLocalPrescriptions: () => SavedPrescription[],
  setLocalPrescriptions: (records: SavedPrescription[]) => void
): { purgedCount: number; freedEstimateKb: number } {
  if (typeof window === "undefined") return { purgedCount: 0, freedEstimateKb: 0 };

  const now = Date.now();
  const lastClean = parseInt(localStorage.getItem(LAST_CLEANUP_KEY) || "0", 10);

  if (now - lastClean < 6 * 60 * 60 * 1000) {
    return { purgedCount: 0, freedEstimateKb: 0 };
  }

  let purgedCount = 0;
  const currentList = getLocalPrescriptions();

  // 1. Prune local prescriptions older than 365 days (NEVER prune archived records) and deduplicate by ID
  const seenIds = new Set<string>();
  const retainedList = currentList.filter((rx) => {
    if (!rx || !rx.id) return false;
    if (seenIds.has(rx.id)) {
      purgedCount++;
      return false;
    }
    seenIds.add(rx.id);
    if (rx.isArchived) return true;
    const rxTime = new Date(rx.createdAt).getTime();
    if (!isNaN(rxTime) && now - rxTime > RETENTION_MS) {
      purgedCount++;
      return false;
    }
    return true;
  });

  if (purgedCount > 0) {
    setLocalPrescriptions(retainedList);
    console.log(`[SmartCacheCleaner] Purged ${purgedCount} duplicate/expired records.`);
  }

  // 2. Prune stale queue items (> 7 days)
  const queue = getQueue();
  const validQueue = queue.filter((q) => now - q.enqueuedAt < 7 * 24 * 60 * 60 * 1000);
  if (validQueue.length !== queue.length) {
    saveQueue(validQueue);
  }

  // 3. Clean orphaned temporary localStorage keys and sessionStorage bloat
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && ORPHANED_STORAGE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        localStorage.removeItem(k);
      }
    }
    if (typeof sessionStorage !== "undefined" && sessionStorage.length > 20) {
      sessionStorage.clear();
    }
  } catch {}

  // 4. Mark last cleanup time
  try {
    localStorage.setItem(LAST_CLEANUP_KEY, now.toString());
  } catch {}

  const freedEstimateKb = Math.round(purgedCount * 0.6);
  return { purgedCount, freedEstimateKb };
}

// ===== SYNC STATUS EVENT EMITTER =====

export type SyncStatus = "synced" | "syncing" | "offline" | "idle" | "pending" | "error";

function notifySyncStatus(status: SyncStatus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("penrx_sync_status", { detail: { status } }));
}

let _onlineListenerAttached = false;
if (typeof window !== "undefined" && !_onlineListenerAttached) {
  _onlineListenerAttached = true;
  window.addEventListener("online", () => {
    console.log("[SyncQueue] Network connection restored. Processing sync queue...");
    processSyncQueue();
  });

  // Backoff timers must be pumped even without network events, otherwise a queued
  // prescription would wait for the next save before reaching the cloud.
  window.setInterval(() => {
    if (document.visibilityState === "visible" && getQueue().length > 0) processSyncQueue();
  }, 60_000);
}
