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

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

let _hasTriggeredCloudDataRecovery = false;

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

  const pending = valid.find((s) => s.status === "PENDING");
  if (pending) return pending;

  return valid[0];
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
            const mergedIds = Array.from(
              new Set([...(activeOrPendingSub.allowedMachineIds || []), activeOrPendingSub.machineId, ...allKnownMids].filter(Boolean))
            );
            fetch(`${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(activeOrPendingSub.id)}`, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                allowedMachineIds: mergedIds,
                updatedAt: new Date().toISOString(),
              }),
            }).catch(() => {});
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

        try {
          const directSupaRes = await fetch(`${SUPABASE_REST_URL}?on_conflict=id`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify(newRecord),
          });
          if (directSupaRes.ok) {
            console.log("[SubscriptionStore] Direct Supabase Cloud submission confirmed.");
          }
        } catch (supaErr) {
          console.warn("[SubscriptionStore] Direct Supabase Cloud notice:", supaErr);
        }

        try {
          let res: Response | null = null;
          try {
            res = await fetch(getApiUrl("/api/subscriptions"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newRecord),
            });
          } catch {}

          if (!res || !res.ok) {
            try {
              res = await fetch("https://pen-rx.vercel.app/api/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newRecord),
              });
            } catch {}
          }

          if (res && res.ok) {
            const data = await res.json();
            if (data?.serverTime) {
              recordServerTime(data.serverTime);
            }
            if (data && data.subscription) {
              autoRestoreClinicAndPatientData(data.subscription);
              set((state) => {
                if (state.currentSubscription?.status === "ACTIVE") {
                  return state;
                }
                const mergedSub: SubscriptionRecord = {
                  ...data.subscription,
                  allowedMachineIds: Array.from(
                    new Set([...(data.subscription.allowedMachineIds || []), ...allowedMachineIds])
                  ),
                };
                return {
                  subscriberId: mergedSub.subscriberId || subscriberId,
                  currentSubscription: mergedSub,
                  subscriptions: [
                    mergedSub,
                    ...state.subscriptions.filter((s) => s.id !== mergedSub.id),
                  ],
                };
              });
            }
          }
        } catch (err) {
          console.warn("Server subscription sync deferred:", err);
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
            await fetch(`${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(pending.id)}`, {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          } catch {}

          const cancelPayload = {
            action: "cancel_request",
            id: pending.id,
            subscriberId: pending.subscriberId,
            machineId,
          };

          try {
            let res: Response | null = null;
            try {
              res = await fetch(getApiUrl("/api/subscriptions"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cancelPayload),
              });
            } catch {}

            if (!res || !res.ok) {
              await fetch("https://pen-rx.vercel.app/api/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cancelPayload),
              });
            }
          } catch (err) {
            console.warn("Server subscription cancel deferred:", err);
          }
        }
      },

      linkDeviceToSubscriber: async (targetSubscriberId: string, verificationPhone?: string) => {
        const machineId = get().machineId || getOrCreateMachineId();
        const cleanSubId = targetSubscriberId.toUpperCase().trim();

        const linkPayload = {
          action: "link_device",
          subscriberId: cleanSubId,
          machineId,
          verificationPhone: verificationPhone?.trim(),
        };

        try {
          let res: Response | null = null;
          try {
            res = await fetch(getApiUrl("/api/subscriptions"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(linkPayload),
            });
          } catch {}

          if (!res || !res.ok) {
            res = await fetch("https://pen-rx.vercel.app/api/subscriptions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(linkPayload),
            });
          }

          const data = await res.json();
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

      activateSubscription: async (id, customDays) => {
        const target = get().subscriptions.find((s) => s.id === id);
        const duration = customDays || target?.durationDays || 30;
        const now = new Date();
        const expires = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "ACTIVE",
                  durationDays: duration,
                  activatedAt: now.toISOString(),
                  expiresAt: expires.toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        }));

        try {
          await fetch(getApiUrl("/api/system/verify"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "ACTIVATE", durationDays: duration }),
          });
        } catch {}
      },

      suspendSubscription: async (id) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === id ? { ...s, status: "SUSPENDED", updatedAt: new Date().toISOString() } : s
          ),
        }));

        try {
          await fetch(getApiUrl("/api/system/verify"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "SUSPEND" }),
          });
        } catch {}
      },

      deleteSubscription: async (id) => {
        set((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== id),
        }));

        try {
          await fetch(getApiUrl(`/api/system/verify?id=${encodeURIComponent(id)}`), {
            method: "DELETE",
          });
        } catch {}
      },

      adjustSubscriptionDays: async (id, daysDelta) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) => {
            if (s.id !== id) return s;
            const currentExpiry = s.expiresAt ? new Date(s.expiresAt).getTime() : Date.now();
            const newExpiry = new Date(currentExpiry + daysDelta * 24 * 60 * 60 * 1000);
            return {
              ...s,
              expiresAt: newExpiry.toISOString(),
              durationDays: Math.max(1, (s.durationDays || 30) + daysDelta),
              status: "ACTIVE",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));

        try {
          await fetch(getApiUrl("/api/system/verify"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "ADJUST_DAYS", daysDelta }),
          });
        } catch {}
      },

      addDeviceToSubscriber: async (subscriptionId, newMachineId) => {
        const cleanMachine = newMachineId.trim();
        if (!cleanMachine) return;

        set((state) => ({
          subscriptions: state.subscriptions.map((s) => {
            if (s.id !== subscriptionId) return s;
            const list = s.allowedMachineIds || [];
            if (!list.includes(cleanMachine)) {
              return { ...s, allowedMachineIds: [...list, cleanMachine] };
            }
            return s;
          }),
        }));

        try {
          await fetch(getApiUrl("/api/system/verify"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: subscriptionId, action: "ADD_DEVICE", machineId: cleanMachine }),
          });
        } catch {}
      },

      removeDeviceFromSubscriber: async (subscriptionId, targetMachineId) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((s) => {
            if (s.id !== subscriptionId) return s;
            return {
              ...s,
              allowedMachineIds: (s.allowedMachineIds || []).filter((m) => m !== targetMachineId),
            };
          }),
        }));

        try {
          await fetch(getApiUrl("/api/system/verify"), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: subscriptionId, action: "REMOVE_DEVICE", machineId: targetMachineId }),
          });
        } catch {}
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
          const offlineToken = get().signatureToken;

          const hasPendingSub =
            localSubs.some((s) => s.status === "PENDING") ||
            get().currentSubscription?.status === "PENDING" ||
            (typeof window !== "undefined" && localStorage.getItem("penrx_was_pending") === "true");

          let apiSubRecord: SubscriptionRecord | null = null;
          let verifySubRecord: SubscriptionRecord | null = null;
          let supaSubRecord: SubscriptionRecord | null = null;
          let newSignatureToken: string | null = null;

          let serverResponded = false;
          let serverReportedNoSub = false;
          let supaResponded = false;
          let supaReportedNoSub = false;

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
            // ── CHANNEL 1: Direct Supabase Cloud REST Verification ──
            (async () => {
              try {
                const orParts: string[] = [];
                for (const mid of allKnownMids) {
                  orParts.push(`machineId.ilike.${encodeURIComponent(mid)}`);
                }
                if (orParts.length === 0 && machineId) {
                  orParts.push(`machineId.ilike.${encodeURIComponent(machineId)}`);
                }
                if (effectiveSubId && effectiveSubId !== "SUB-0000") {
                  orParts.push(`subscriberId.ilike.${encodeURIComponent(effectiveSubId)}`);
                }
                if (effectiveOrderId) {
                  orParts.push(`id.eq.${encodeURIComponent(effectiveOrderId)}`);
                }
                if (
                  currentLocalSub?.id &&
                  currentLocalSub.id !== effectiveOrderId
                ) {
                  orParts.push(`id.eq.${encodeURIComponent(currentLocalSub.id)}`);
                }

                const supaUrl = `${SUPABASE_REST_URL}?or=(${orParts.join(",")})&order=updatedAt.desc&limit=10`;
                const supaRes = await fetch(supaUrl, {
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: "Bearer " + SUPABASE_ANON_KEY,
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                  },
                  cache: "no-store",
                  signal: safeTimeoutSignal(6000),
                });

                if (supaRes.ok) {
                  supaResponded = true;
                  const supaDateHdr = supaRes.headers.get("date");
                  if (supaDateHdr) {
                    const dt = new Date(supaDateHdr).getTime();
                    if (!isNaN(dt) && dt > 0) recordServerTime(dt);
                  }
                  const supaData = await supaRes.json();
                  if (Array.isArray(supaData) && supaData.length > 0) {
                    supaSubRecord = pickBestCandidate(supaData);
                    return;
                  } else if (Array.isArray(supaData) && supaData.length === 0) {
                    supaReportedNoSub = true;
                  }
                }

                if (effectiveOrderId && !supaSubRecord) {
                  const directIdRes = await fetch(
                    `${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(effectiveOrderId)}&limit=1`,
                    {
                      headers: {
                        apikey: SUPABASE_ANON_KEY,
                        Authorization: "Bearer " + SUPABASE_ANON_KEY,
                        "Pragma": "no-cache",
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                      },
                      cache: "no-store",
                      signal: safeTimeoutSignal(5000),
                    }
                  );
                  if (directIdRes.ok) {
                    supaResponded = true;
                    const rows = await directIdRes.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                      supaSubRecord = pickBestCandidate(rows);
                      supaReportedNoSub = false;
                    } else if (Array.isArray(rows) && rows.length === 0) {
                      supaReportedNoSub = true;
                    }
                  }
                }
              } catch {}
            })(),

            // ── CHANNEL 2: App Subscriptions API (/api/subscriptions) ──
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

            // ── CHANNEL 3: System License Verification API (/api/system/verify) ──
            (async () => {
              try {
                let verifyUrl = `/api/system/verify?${apiQueryStr}`;
                if (offlineToken) {
                  verifyUrl += `&offlineToken=${encodeURIComponent(offlineToken)}`;
                }
                const res = await fetch(getApiUrl(verifyUrl), {
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

          const confirmedSub = pickBestCandidate([supaSubRecord, verifySubRecord, apiSubRecord]);

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
          const anyChannelConfirmedNoSub =
            (supaResponded && supaReportedNoSub) ||
            (serverResponded && serverReportedNoSub);

          const atLeastOneChannelResponded = supaResponded || serverResponded;

          if (anyChannelConfirmedNoSub || (atLeastOneChannelResponded && !hasPendingSub)) {
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
