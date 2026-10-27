import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  getOrCreateMachineId,
  getKnownDeviceMachineIds,
  initializeHardwareMachineId,
  recordServerTime,
  detectClockTampering,
} from "@/lib/deviceSecurity";
import { getApiUrl } from "@/lib/cloudProxy";
import { useClinicStore } from "@/store/useClinicStore";

export interface SubscriptionRecord {
  id: string;
  subscriberId: string; // Distinct from Hardware Machine ID (e.g. SUB-4821)
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

interface SubscriptionStoreState {
  machineId: string;
  subscriberId: string;
  subscriptions: SubscriptionRecord[];
  currentSubscription: SubscriptionRecord | null;
  lastSyncedAt: number;
  signatureToken: string | null;     // HMAC-signed offline token (mirrors Classico)
  lastOnlineCheck: number;           // Timestamp of last successful online verification
  lastKnownServerTime: number;       // Anti-tamper verified server timestamp

  setMachineId: (id: string) => void;
  setSubscriberId: (id: string) => void;
  setSignatureToken: (token: string | null) => void;
  initHardwareId: () => Promise<void>; // Call on mount in Electron / Capacitor APK mode

  submitSubscriptionRequest: (req: {
    planId: string;
    planName: string;
    price: number;
    paymentMethod: "vodafone" | "instapay";
    senderPhone: string;
    transactionRef: string;
    doctorName?: string;
    clinicName?: string;
    durationDays: number;
    isTrial?: boolean;
  }) => Promise<SubscriptionRecord>;

  cancelPendingRequest: () => Promise<void>;
  linkDeviceToSubscriber: (targetSubscriberId: string, verificationPhone?: string) => Promise<{ success: boolean; error?: string }>;
  activateSubscription: (id: string, days?: number) => Promise<void>;
  suspendSubscription: (id: string) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  adjustSubscriptionDays: (id: string, daysDelta: number) => Promise<void>;
  addDeviceToSubscriber: (subscriptionId: string, newMachineId: string) => Promise<void>;
  removeDeviceFromSubscriber: (subscriptionId: string, targetMachineId: string) => Promise<void>;
  syncWithServer: (force?: boolean) => Promise<void>;
  revokeLocallyAndClear: (reason?: string) => void;
}

/**
 * The browser never talks to the database. License state comes only from the
 * PenRX+ API, and the device token minted by /api/system/verify unlocks the
 * medical-data endpoints.
 */

let _hasTriggeredCloudDataRecovery = false;

/** CSRF marker the API requires on every admin mutation (see src/lib/adminAuth.ts). */
const ADMIN_CSRF_HEADER = "x-penrx-admin";

/**
 * Single gateway for all privileged calls: cookie session for admin actions, and
 * no optimistic local mutation is ever treated as a granted license.
 */
async function apiRequest(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(getApiUrl(path), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || "تعذر الاتصال بخدمة الاشتراكات. تحقق من الاتصال بالإنترنت.");
  }
  if (data?.serverTime) recordServerTime(data.serverTime);
  return data;
}

/** Administrative changes are only valid when made by a logged-in admin session. */
async function adminAction(
  id: string,
  body: Record<string, unknown>,
  method: "PATCH" | "DELETE" = "PATCH"
): Promise<any> {
  return apiRequest(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
    method,
    headers: { [ADMIN_CSRF_HEADER]: "1" },
    body: method === "PATCH" ? JSON.stringify(body) : undefined,
  });
}

/**
 * Automatically recovers the doctor's Clinic Profile, Patients, and Prescriptions
 * whenever an existing SubscriptionRecord is verified on a fresh install / reinstall!
 * Prevents forcing the doctor to re-enter their clinic credentials after reinstalling the app.
 */
function autoRestoreClinicAndPatientData(sub: SubscriptionRecord) {
  if (typeof window === "undefined" || !sub) return;

  try {
    const clinicState = useClinicStore.getState();
    const currentClinic = clinicState.clinic;
    const isProfileCurrentlyComplete = Boolean(
      currentClinic.isProfileSaved &&
        currentClinic.doctorName?.trim() &&
        (currentClinic.name?.trim() || currentClinic.nameAr?.trim()) &&
        currentClinic.phone?.trim()
    );

    if (!isProfileCurrentlyComplete && (sub.doctorName?.trim() || sub.clinicName?.trim())) {
      const rawClinicStr = (sub.clinicName || "").trim();
      let parsedClinicName = rawClinicStr;
      let parsedPhone = (sub.senderPhone || "").trim();

      if (rawClinicStr.includes("• 📞")) {
        const parts = rawClinicStr.split("• 📞");
        parsedClinicName = (parts[0] || "").trim();
        if (parts[1] && parts[1].trim()) {
          parsedPhone = parts[1].trim();
        }
      }

      const finalDoctorName = (sub.doctorName || currentClinic.doctorName || "الطبيب المعالج").trim();
      const finalClinicName = (parsedClinicName || currentClinic.nameAr || currentClinic.name || `عيادة ${finalDoctorName}`).trim();
      const finalPhone = (parsedPhone || currentClinic.phone || "01000000000").trim();

      clinicState.saveClinicAndCreateFirstBranch({
        nameAr: finalClinicName,
        name: currentClinic.name || finalClinicName,
        doctorName: finalDoctorName,
        phone: finalPhone,
        isProfileSaved: true,
      });
    }

    // Trigger one-time automatic cloud prescription & patient recovery if local records are empty
    if (!_hasTriggeredCloudDataRecovery && (sub.status === "ACTIVE" || sub.isTrial)) {
      _hasTriggeredCloudDataRecovery = true;
      setTimeout(async () => {
        try {
          const { usePrescriptionStore } = await import("@/store/usePrescriptionStore");
          await usePrescriptionStore.getState().syncWithCloud();

          // If full clinic settings or additional archived records exist in CloudBackup, merge them silently
          const { restoreFromCloudBackup } = await import("@/lib/backupService");
          await restoreFromCloudBackup("MERGE").catch(() => {});
        } catch {}
      }, 300);
    }
  } catch (err) {
    console.warn("[SubscriptionStore] Auto clinic/patient restore notice:", err);
  }
}

export function hasUsedFreeTrial(subscriptions: SubscriptionRecord[], currentMachineId: string): boolean {
  if (typeof window !== "undefined") {
    if (localStorage.getItem("penrx_trial_claimed") === "true") return true;
  }
  const knownIds = getKnownDeviceMachineIds(currentMachineId);
  return (subscriptions || []).some((s) => {
    const sMachine = (s.machineId || "").trim().toUpperCase();
    const sAllowed = Array.isArray(s.allowedMachineIds)
      ? s.allowedMachineIds.map((m) => (m || "").trim().toUpperCase())
      : [];
    const matchesDevice =
      knownIds.includes(sMachine) || sAllowed.some((m) => knownIds.includes(m));
    return matchesDevice && (s.isTrial === true || s.planId === "trial");
  });
}

export const MAX_OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours max continuous offline)

export function getSubscriptionDetails(
  subscriptions: SubscriptionRecord[],
  currentMachineId: string,
  currentSubscriberId?: string | null,
  lastOnlineCheck?: number
) {
  const effectiveSubId =
    currentSubscriberId ||
    (typeof window !== "undefined"
      ? localStorage.getItem("penrx_last_subscriber_id") || useSubscriptionStore.getState()?.subscriberId
      : null);

  const effectivePendingId =
    typeof window !== "undefined" ? localStorage.getItem("penrx_pending_sub_id") : null;

  const effectiveLastOnline =
    typeof lastOnlineCheck === "number"
      ? lastOnlineCheck
      : (typeof window !== "undefined" ? useSubscriptionStore.getState()?.lastOnlineCheck || 0 : 0);

  const knownMachineIds = getKnownDeviceMachineIds(currentMachineId);
  const normEffectiveSub = (effectiveSubId || "").trim().toUpperCase();
  const normPendingId = (effectivePendingId || "").trim();

  let matchingSubs = (subscriptions || []).filter((s) => {
    if (!s) return false;
    const sMachine = (s.machineId || "").trim().toUpperCase();
    const sSubId = (s.subscriberId || "").trim().toUpperCase();
    const inAllowed =
      Array.isArray(s.allowedMachineIds) &&
      s.allowedMachineIds.some((m) => knownMachineIds.includes((m || "").trim().toUpperCase()));
    const matchMachine = knownMachineIds.length > 0 && (knownMachineIds.includes(sMachine) || inAllowed);
    const matchSub = normEffectiveSub && normEffectiveSub !== "SUB-0000" && sSubId === normEffectiveSub;
    const matchId = normPendingId && s.id === normPendingId;
    return matchMachine || matchSub || matchId;
  });

  if (matchingSubs.length === 0 && subscriptions && subscriptions.length > 0) {
    const activeCandidate = subscriptions.find(
      (s) =>
        s.status === "ACTIVE" &&
        (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now())
    );
    const pendingCandidate = subscriptions.find((s) => s.status === "PENDING");
    if (activeCandidate) {
      matchingSubs = [activeCandidate];
    } else if (pendingCandidate) {
      matchingSubs = [pendingCandidate];
    }
  }

  const now = Date.now();
  const activeSub =
    matchingSubs.find(
      (s) => s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
    ) || matchingSubs.find((s) => s.status === "ACTIVE");
  const pendingSub = matchingSubs.find((s) => s.status === "PENDING");
  const sub = activeSub || pendingSub || matchingSubs[0] || null;

  if (!sub) {
    return {
      isActive: false,
      isPending: false,
      isExpired: false,
      isSuspended: false,
      isOfflineGraceExpired: false,
      daysRemaining: 0,
      planName: "غير مسجل",
      subscriberId: "لم ينشأ بعد",
      allowedDevicesCount: 0,
      statusLabel: "لا يوجد ترخيص فعال 🔒",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      record: null,
    };
  }

  let daysRemaining = sub.durationDays || 30;
  if (sub.expiresAt) {
    const expireTime = new Date(sub.expiresAt).getTime();
    daysRemaining = Math.max(0, Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24)));
  } else if (sub.activatedAt && sub.durationDays) {
    const expireTime = new Date(sub.activatedAt).getTime() + sub.durationDays * 24 * 60 * 60 * 1000;
    daysRemaining = Math.max(0, Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24)));
  }

  const isExpired = sub.status === "ACTIVE" && daysRemaining <= 0;
  const isSuspended = sub.status === "SUSPENDED";
  const isPending = sub.status === "PENDING";

  const isOfflineGraceExpired =
    sub.status === "ACTIVE" &&
    effectiveLastOnline > 0 &&
    now - effectiveLastOnline > MAX_OFFLINE_GRACE_MS;

  const clockCheck = detectClockTampering();
  const isClockTampered = clockCheck.tampered;

  if (isClockTampered) {
    return {
      isActive: false,
      isPending: false,
      isExpired: false,
      isSuspended: false,
      isOfflineGraceExpired: false,
      isClockTampered: true,
      tamperReason: clockCheck.reason,
      daysRemaining: 0,
      planName: sub ? sub.planName : "غير مسجل",
      subscriberId: sub?.subscriberId || "SUB-0000",
      allowedDevicesCount: sub?.allowedMachineIds?.length || 1,
      statusLabel: "تم رصد تلاعب بتوقيت وساعة الجهاز ⚠️",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
      record: sub,
    };
  }

  const isActive = sub.status === "ACTIVE" && !isExpired && !isOfflineGraceExpired;

  let statusLabel = "مفعل وجاهز للعمل ✅";
  let badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  if (isPending) {
    statusLabel = "قيد المراجعة والتفعيل ⏳";
    badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse";
  } else if (isSuspended) {
    statusLabel = "الاشتراك موقوف مؤقتاً ⛔";
    badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  } else if (isExpired) {
    statusLabel = "انتهت فترة الصلاحية ⚠️";
    badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
  } else if (isOfflineGraceExpired) {
    statusLabel = "انتهت مهلة العمل بدون إنترنت (3 أيام) — يرجى الاتصال بالإنترنت للتحقق 🌐";
    badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
  }

  return {
    isActive,
    isPending,
    isExpired,
    isSuspended,
    isOfflineGraceExpired,
    isClockTampered: false,
    daysRemaining,
    planName: sub.planName,
    subscriberId: sub.subscriberId || "SUB-0000",
    allowedDevicesCount: sub.allowedMachineIds?.length || 1,
    statusLabel,
    badgeColor,
    record: sub,
  };
}

function generateLocalSubscriberId(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SUB-${rand}`;
}

let _lastSyncTime = 0;
let _syncInFlight: Promise<void> | null = null;
const SYNC_THROTTLE_MS = 4000;

function safeTimeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
      return (AbortSignal as any).timeout(ms);
    }
  } catch {}
  return undefined;
}

function pickBestCandidate(candidates: (SubscriptionRecord | null | undefined)[]): SubscriptionRecord | null {
  const valid = candidates.filter((c): c is SubscriptionRecord => Boolean(c && c.id && c.status));
  if (valid.length === 0) return null;

  const now = Date.now();
  const activeUnexpired = valid.find(
    (s) => s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
  );
  if (activeUnexpired) return activeUnexpired;

  const anyActive = valid.find((s) => s.status === "ACTIVE");
  if (anyActive) return anyActive;

  // بلا ACTIVE: آخر قرار إداري هو الذي يُعرض، حتى لا يُخفي إيقاف حديث طلباً معلّقاً قديماً
  return [...valid].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  )[0];
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set, get) => ({
      machineId: typeof window !== "undefined" ? getOrCreateMachineId() : "PRX-INIT-0000",
      subscriberId: generateLocalSubscriberId(),
      subscriptions: [],
      currentSubscription: null,
      lastSyncedAt: 0,
      signatureToken: null,
      lastOnlineCheck: 0,
      lastKnownServerTime: 0,

      setMachineId: (id: string) => set({ machineId: id }),
      setSubscriberId: (id: string) => set({ subscriberId: id }),
      setSignatureToken: (token: string | null) => set({ signatureToken: token }),

      revokeLocallyAndClear: (reason?: string) => {
        console.warn(`[PenRX+ License] Revoking subscription locally: ${reason || "No active license"}`);
        set({
          subscriptions: [],
          currentSubscription: null,
          signatureToken: null,
          lastSyncedAt: Date.now(),
          lastOnlineCheck: Date.now(),
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("penrx_last_sub");
            localStorage.removeItem("penrx_was_pending");
            localStorage.removeItem("penrx_just_activated");
            localStorage.removeItem("penrx_pending_sub_id");
            localStorage.removeItem("penrx_last_subscriber_id");
            const raw = localStorage.getItem("penrx_subscription_storage");
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.state) {
                  parsed.state.subscriptions = [];
                  parsed.state.currentSubscription = null;
                  parsed.state.signatureToken = null;
                  localStorage.setItem("penrx_subscription_storage", JSON.stringify(parsed));
                }
              } catch {}
            }
          } catch {}
        }
      },

      initHardwareId: async () => {
        await initializeHardwareMachineId((newId) => {
          const allKnownMids = getKnownDeviceMachineIds(newId);
          const currentState = get();
          const prevMid = currentState.machineId;

          set((state) => {
            const updatedSubs = (state.subscriptions || []).map((s) => {
              const mergedAllowed = Array.from(
                new Set([...(s.allowedMachineIds || []), s.machineId, ...allKnownMids].filter(Boolean))
              );
              return { ...s, allowedMachineIds: mergedAllowed };
            });
            return {
              machineId: newId,
              subscriptions: updatedSubs,
              currentSubscription: state.currentSubscription
                ? {
                    ...state.currentSubscription,
                    allowedMachineIds: Array.from(
                      new Set([
                        ...(state.currentSubscription.allowedMachineIds || []),
                        state.currentSubscription.machineId,
                        ...allKnownMids,
                      ].filter(Boolean))
                    ),
                  }
                : null,
            };
          });

          const activeOrPendingSub =
            get().currentSubscription ||
            (get().subscriptions || []).find((s) => s.status === "ACTIVE" || s.status === "PENDING");

          if (activeOrPendingSub && activeOrPendingSub.id && prevMid && prevMid !== newId) {
            // The server owns the device list: the new hardware id is verified and
            // linked there, never written from the client.
            get()
              .syncWithServer(true)
              .catch(() => {});
          }

          if (prevMid !== newId) {
            setTimeout(() => {
              get().syncWithServer(true);
            }, 100);
          }
        });
      },

      submitSubscriptionRequest: async (req) => {
        try {
          await Promise.race([
            get().initHardwareId(),
            new Promise((resolve) => setTimeout(resolve, 800)),
          ]);
        } catch {}

        const machineId = get().machineId || getOrCreateMachineId();
        const allKnownMids = getKnownDeviceMachineIds(machineId);
        const allowedMachineIds = allKnownMids.length > 0 ? allKnownMids : [machineId];
        const subscriberId = get().subscriberId || generateLocalSubscriberId();
        const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const nowIso = new Date().toISOString();

        const newRecord: SubscriptionRecord = {
          id,
          subscriberId,
          planId: req.planId,
          planName: req.planName,
          price: req.price,
          paymentMethod: req.paymentMethod,
          senderPhone: req.senderPhone,
          transactionRef: req.transactionRef,
          status: "PENDING",
          machineId,
          allowedMachineIds,
          doctorName: req.doctorName || "",
          clinicName: req.clinicName || "",
          durationDays: req.durationDays,
          isTrial: req.isTrial || false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        // Pre-populate clinic profile immediately when doctor submits subscription form so they never have to type it twice!
        if (req.doctorName?.trim() && req.clinicName?.trim() && req.senderPhone?.trim()) {
          autoRestoreClinicAndPatientData(newRecord);
        }

        set((state) => ({
          subscriberId,
          subscriptions: [newRecord, ...state.subscriptions.filter((s) => s.id !== newRecord.id && s.status !== "PENDING")],
          currentSubscription: newRecord,
        }));

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("penrx_last_subscriber_id", subscriberId);
            localStorage.setItem("penrx_pending_sub_id", newRecord.id);
            localStorage.setItem("penrx_was_pending", "true");
            localStorage.setItem("penrx_last_sub", JSON.stringify(newRecord));
          } catch {}
        }

        // The request is persisted by the API only. If it fails, the pending record
        // is rolled back so the doctor is never told a payment was received when it
        // was not — an undelivered request is the one failure mode a paid product
        // cannot afford to hide.
        try {
          const data = await apiRequest("/api/subscriptions", {
            method: "POST",
            body: JSON.stringify({
              id,
              planId: req.planId,
              paymentMethod: req.paymentMethod,
              senderPhone: req.senderPhone,
              transactionRef: req.transactionRef,
              doctorName: req.doctorName || "",
              clinicName: req.clinicName || "",
              machineId,
              allowedMachineIds,
            }),
          });

          if (data?.subscription) {
            const mergedSub: SubscriptionRecord = {
              ...data.subscription,
              allowedMachineIds: Array.from(
                new Set([...(data.subscription.allowedMachineIds || []), ...allowedMachineIds])
              ),
            };

            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("penrx_pending_sub_id", mergedSub.id);
                localStorage.setItem("penrx_last_sub", JSON.stringify(mergedSub));
              } catch {}
            }

            set((state) => ({
              subscriberId: mergedSub.subscriberId || subscriberId,
              currentSubscription: mergedSub,
              subscriptions: [mergedSub, ...state.subscriptions.filter((s) => s.id !== mergedSub.id)],
            }));

            return mergedSub;
          }
        } catch (err: any) {
          set((state) => ({
            subscriptions: state.subscriptions.filter((s) => s.id !== id),
            currentSubscription: state.currentSubscription?.id === id ? null : state.currentSubscription,
          }));
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem("penrx_pending_sub_id");
              localStorage.removeItem("penrx_was_pending");
            } catch {}
          }
          throw err;
        }

        return newRecord;
      },

      cancelPendingRequest: async () => {
        const machineId = get().machineId || getOrCreateMachineId();
        const knownIds = getKnownDeviceMachineIds(machineId);
        const pending = get().subscriptions.find(
          (s) =>
            s.status === "PENDING" &&
            (knownIds.includes((s.machineId || "").trim().toUpperCase()) ||
              (Array.isArray(s.allowedMachineIds) &&
                s.allowedMachineIds.some((m) => knownIds.includes((m || "").trim().toUpperCase()))) ||
              s.id === (typeof window !== "undefined" ? localStorage.getItem("penrx_pending_sub_id") : null))
        );

        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("penrx_pending_sub_id");
            localStorage.removeItem("penrx_was_pending");
            localStorage.removeItem("penrx_last_sub");
          } catch {}
        }

        if (pending) {
          set((state) => ({
            subscriptions: state.subscriptions.filter((s) => s.id !== pending.id),
            currentSubscription: null,
          }));

          try {
            await apiRequest("/api/subscriptions", {
              method: "POST",
              body: JSON.stringify({
                action: "cancel_request",
                id: pending.id,
                subscriberId: pending.subscriberId,
                machineId,
              }),
            });
          } catch (err) {
            console.warn("Server subscription cancel deferred:", err);
          }
        }
      },

      linkDeviceToSubscriber: async (targetSubscriberId: string, verificationPhone?: string) => {
        const machineId = get().machineId || getOrCreateMachineId();
        const cleanSubId = targetSubscriberId.toUpperCase().trim();

        try {
          const data = await apiRequest("/api/subscriptions", {
            method: "POST",
            body: JSON.stringify({
              action: "link_device",
              subscriberId: cleanSubId,
              machineId,
              verificationPhone: verificationPhone?.trim(),
            }),
          });

          if (data.success && data.subscription) {
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("penrx_last_subscriber_id", cleanSubId);
                localStorage.setItem("penrx_last_sub", JSON.stringify(data.subscription));
              } catch {}
            }
            set((state) => ({
              subscriberId: cleanSubId,
              currentSubscription: data.subscription,
              signatureToken: data.subscription.signatureToken || state.signatureToken,
              subscriptions: [
                data.subscription,
                ...state.subscriptions.filter((s) => s.id !== data.subscription.id),
              ],
            }));
            // Automatically restore doctor's clinic profile & cloud prescriptions/patients upon linking!
            _hasTriggeredCloudDataRecovery = false;
            autoRestoreClinicAndPatientData(data.subscription);
            return { success: true };
          }
          return { success: false, error: data.error || "فشل ربط الجهاز بهذا الاشتراك" };
        } catch (err: any) {
          return { success: false, error: err.message || "تعذر الاتصال بالخادم" };
        }
      },

      /**
       * Admin-only operations. They never mutate the local license optimistically:
       * a doctor-side code path must not be able to flip PENDING to ACTIVE, so the
       * state is re-read from the server after the admin session performs the change.
       */
      activateSubscription: async (id, customDays) => {
        await adminAction(id, { action: "ACTIVATE", durationDays: customDays });
        await get().syncWithServer(true);
      },

      suspendSubscription: async (id) => {
        await adminAction(id, { action: "SUSPEND" });
        await get().syncWithServer(true);
      },

      deleteSubscription: async (id) => {
        await adminAction(id, {}, "DELETE");
        get().revokeLocallyAndClear("deleted-by-admin");
      },

      adjustSubscriptionDays: async (id, daysDelta) => {
        await adminAction(id, { action: "ADJUST_DAYS", daysDelta });
        await get().syncWithServer(true);
      },

      addDeviceToSubscriber: async (subscriptionId, newMachineId) => {
        const cleanMachine = (newMachineId || "").trim().toUpperCase();
        if (!cleanMachine) return;
        await adminAction(subscriptionId, { action: "ADD_DEVICE", machineId: cleanMachine });
        await get().syncWithServer(true);
      },

      removeDeviceFromSubscriber: async (subscriptionId, targetMachineId) => {
        await adminAction(subscriptionId, {
          action: "REMOVE_DEVICE",
          machineId: (targetMachineId || "").trim().toUpperCase(),
        });
        await get().syncWithServer(true);
      },

      syncWithServer: async (force?: boolean) => {
        const now = Date.now();
        if (!force && now - _lastSyncTime < SYNC_THROTTLE_MS) return;
        if (_syncInFlight && !force) return _syncInFlight;

        _lastSyncTime = now;

        const runSync = async () => {
          const machineId = get().machineId || getOrCreateMachineId();
          const allKnownMids = getKnownDeviceMachineIds(machineId);
          const altMachineId = allKnownMids.find((m) => m !== machineId.trim().toUpperCase()) || "";

          const localSubs = get().subscriptions || [];
          const currentLocalSub =
            get().currentSubscription ||
            localSubs.find((s) => s.status === "ACTIVE") ||
            localSubs.find((s) => s.status === "PENDING") ||
            localSubs[0] ||
            null;

          const savedPendingId =
            typeof window !== "undefined" ? localStorage.getItem("penrx_pending_sub_id") : null;
          const savedSubId =
            typeof window !== "undefined" ? localStorage.getItem("penrx_last_subscriber_id") : null;

          const effectiveSubId =
            (currentLocalSub?.subscriberId && currentLocalSub.subscriberId !== "SUB-0000"
              ? currentLocalSub.subscriberId
              : null) ||
            (savedSubId && savedSubId !== "SUB-0000" ? savedSubId : null) ||
            (get().subscriberId && get().subscriberId !== "SUB-0000" ? get().subscriberId : "");

          const effectiveOrderId = savedPendingId || currentLocalSub?.id || "";

          const hasPendingSub =
            localSubs.some((s) => s.status === "PENDING") ||
            get().currentSubscription?.status === "PENDING" ||
            (typeof window !== "undefined" && localStorage.getItem("penrx_was_pending") === "true");

          let apiSubRecord: SubscriptionRecord | null = null;
          let verifySubRecord: SubscriptionRecord | null = null;
          let newSignatureToken: string | null = null;

          let serverResponded = false;
          let serverReportedNoSub = false;

          const buildApiQuery = () => {
            const params = new URLSearchParams();
            params.set("machineId", machineId);
            if (altMachineId) params.set("altMachineId", altMachineId);
            if (effectiveSubId) params.set("subscriberId", effectiveSubId);
            if (effectiveOrderId) params.set("id", effectiveOrderId);
            params.set("_t", String(Date.now()));
            return params.toString();
          };

          const apiQueryStr = buildApiQuery();

          await Promise.allSettled([
            // ── CHANNEL 1: Doctor-facing subscriptions API (ownership-scoped) ──
            (async () => {
              try {
                const res = await fetch(getApiUrl(`/api/subscriptions?${apiQueryStr}`), {
                  cache: "no-store",
                  headers: {
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                  },
                  signal: safeTimeoutSignal(7000),
                });
                if (res.ok) {
                  serverResponded = true;
                  const dateHdr = res.headers.get("date");
                  if (dateHdr) {
                    const dt = new Date(dateHdr).getTime();
                    if (!isNaN(dt) && dt > 0) recordServerTime(dt);
                  }
                  const data = await res.json();
                  if (data?.serverTime) {
                    recordServerTime(data.serverTime);
                    set({ lastKnownServerTime: Math.max(get().lastKnownServerTime || 0, data.serverTime) });
                  }
                  if (data && data.subscription) {
                    apiSubRecord = data.subscription;
                  } else if (data && (data.subscription === null || data.subscription === undefined)) {
                    serverReportedNoSub = true;
                  }
                }
              } catch {}
            })(),

            // ── CHANNEL 2: License verification (/api/system/verify) — mints the device token ──
            (async () => {
              try {
                const res = await fetch(getApiUrl(`/api/system/verify?${apiQueryStr}`), {
                  cache: "no-store",
                  headers: {
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                  },
                  signal: safeTimeoutSignal(7000),
                });
                if (res.ok) {
                  serverResponded = true;
                  const dateHdr = res.headers.get("date");
                  if (dateHdr) {
                    const dt = new Date(dateHdr).getTime();
                    if (!isNaN(dt) && dt > 0) recordServerTime(dt);
                  }
                  const data = await res.json();
                  if (data?.serverTime) {
                    recordServerTime(data.serverTime);
                    set({ lastKnownServerTime: Math.max(get().lastKnownServerTime || 0, data.serverTime) });
                  }
                  if (data.success && data.status === "active") {
                    if (data.subscription) {
                      verifySubRecord = data.subscription;
                    }
                    if (data.token) {
                      newSignatureToken = data.token;
                    }
                  } else if (data.status === "none" || (!data.success && data.status === "none")) {
                    serverReportedNoSub = true;
                  } else if (data.subscription) {
                    verifySubRecord = data.subscription;
                  }
                }
              } catch {}
            })(),
          ]);

          const confirmedSub = pickBestCandidate([verifySubRecord, apiSubRecord]);

          if (confirmedSub) {
            const mergedAllowed = Array.from(
              new Set([
                ...(Array.isArray(confirmedSub.allowedMachineIds) ? confirmedSub.allowedMachineIds : []),
                confirmedSub.machineId,
                ...allKnownMids,
              ].filter(Boolean))
            );

            const fresh: SubscriptionRecord = {
              ...confirmedSub,
              allowedMachineIds: mergedAllowed,
              signatureToken: newSignatureToken || confirmedSub.signatureToken || get().signatureToken || undefined,
            };

            if (typeof window !== "undefined") {
              try {
                if (fresh.subscriberId) {
                  localStorage.setItem("penrx_last_subscriber_id", fresh.subscriberId);
                }
                localStorage.setItem("penrx_last_sub", JSON.stringify(fresh));
              } catch {}
            }

            if (fresh.status === "ACTIVE") {
              if (typeof window !== "undefined") {
                try {
                  localStorage.removeItem("penrx_pending_sub_id");
                  if (hasPendingSub || localStorage.getItem("penrx_was_pending") === "true") {
                    localStorage.setItem("penrx_just_activated", "true");
                  }
                } catch {}
              }
            }

            set((state) => {
              const otherSubs = (state.subscriptions || []).filter((s) => {
                if (s.id === fresh.id) return false;
                if (fresh.status === "ACTIVE" && s.status === "PENDING") {
                  return false;
                }
                return true;
              });

              return {
                subscriptions: [fresh, ...otherSubs],
                currentSubscription: fresh,
                subscriberId: fresh.subscriberId || state.subscriberId,
                signatureToken: fresh.signatureToken || state.signatureToken,
                lastSyncedAt: Date.now(),
                lastOnlineCheck: Date.now(),
              };
            });

            // Automatically restore Clinic Profile, Patients, and Prescriptions if app was reinstalled!
            autoRestoreClinicAndPatientData(fresh);
            return;
          }

          // Authoritative deletion / revocation sync:
          // If at least one channel verified zero subscriptions, OR any responding channel confirms no active sub:
          const serverConfirmedNoSub = serverResponded && serverReportedNoSub;

          if (serverConfirmedNoSub || (serverResponded && !hasPendingSub)) {
            console.warn("[PenRX+ License] Online verification confirmed subscription was deleted or does not exist.");
            get().revokeLocallyAndClear("Authoritative server verified zero active subscriptions");
            return;
          }
        };

        _syncInFlight = runSync().finally(() => {
          _syncInFlight = null;
        });

        return _syncInFlight;
      },
    }),
    {
      name: "penrx_subscription_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
