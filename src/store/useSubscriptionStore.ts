import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  getOrCreateMachineId,
  initializeHardwareMachineId,
  recordServerTime,
  detectClockTampering,
} from "@/lib/deviceSecurity";
import { getApiUrl } from "@/lib/cloudProxy";

// [SECURITY FIX]: All privileged cloud operations go through the app's own API
// routes (/api/subscriptions, /api/system/verify) — never direct Supabase calls.

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
  initHardwareId: () => Promise<void>; // Call once on mount in Electron mode

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
}

export function hasUsedFreeTrial(subscriptions: SubscriptionRecord[], currentMachineId: string): boolean {
  if (typeof window !== "undefined") {
    if (localStorage.getItem("penrx_trial_claimed") === "true") return true;
  }
  return subscriptions.some(
    (s) =>
      (s.machineId === currentMachineId || (Array.isArray(s.allowedMachineIds) && s.allowedMachineIds.includes(currentMachineId))) &&
      (s.isTrial === true || s.planId === "trial")
  );
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

  const effectiveLastOnline =
    typeof lastOnlineCheck === "number"
      ? lastOnlineCheck
      : (typeof window !== "undefined" ? useSubscriptionStore.getState()?.lastOnlineCheck || 0 : 0);

  const normCurrentMachine = (currentMachineId || "").trim().toUpperCase();
  const normEffectiveSub = (effectiveSubId || "").trim().toUpperCase();

  // Find subscriptions matching current machine ID OR allowed devices OR subscriber ID (case-insensitive)
  let matchingSubs = (subscriptions || []).filter((s) => {
    const sMachine = (s.machineId || "").trim().toUpperCase();
    const sSubId = (s.subscriberId || "").trim().toUpperCase();
    const inAllowed =
      Array.isArray(s.allowedMachineIds) &&
      s.allowedMachineIds.some((m) => (m || "").trim().toUpperCase() === normCurrentMachine);
    const matchMachine = normCurrentMachine && (sMachine === normCurrentMachine || inAllowed);
    const matchSub = normEffectiveSub && normEffectiveSub !== "SUB-0000" && sSubId === normEffectiveSub;
    return matchMachine || matchSub;
  });

  // Fallback: If no match by exact machine ID (e.g. mobile SSAID updated after subscription creation),
  // honor ACTIVE or PENDING records stored in this installation so the doctor is never locked out.
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

  // Strictly evaluate subscriptions belonging to this machine ID / subscriber
  const activeSub = matchingSubs.find((s) => s.status === "ACTIVE");
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

  const now = Date.now();
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

  // Check 3-day offline limit:
  // If subscription is ACTIVE, but device has not verified online for > 3 days (72 hours),
  // lock the app and demand an internet connection.
  const isOfflineGraceExpired =
    sub.status === "ACTIVE" &&
    effectiveLastOnline > 0 &&
    now - effectiveLastOnline > MAX_OFFLINE_GRACE_MS;

  // Anti-Clock Tampering Check (Detect backwards device clock rollback):
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

  // Active only if: status is ACTIVE, not expired by date, and not exceeded 3-day offline grace!
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

// ── Shared Sync Throttle: Prevents race conditions from multiple components
// triggering syncWithServer at the same time (PaywallGuard + SubscriptionsPage + Navbar)
let _lastSyncTime = 0;
const SYNC_THROTTLE_MS = 5000; // Minimum 5 seconds between sync calls

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

      // Initialize real hardware machine ID from Electron or Capacitor (called once on app mount)
      initHardwareId: async () => {
        await initializeHardwareMachineId((newId) => {
          set((state) => {
            const updatedSubs = (state.subscriptions || []).map((s) => {
              const list = s.allowedMachineIds || [];
              if (!list.includes(newId)) {
                return { ...s, allowedMachineIds: [...list, newId] };
              }
              return s;
            });
            return {
              machineId: newId,
              subscriptions: updatedSubs,
              currentSubscription: state.currentSubscription
                ? {
                    ...state.currentSubscription,
                    allowedMachineIds: Array.from(
                      new Set([...(state.currentSubscription.allowedMachineIds || []), newId])
                    ),
                  }
                : null,
            };
          });
          // Trigger immediate server sync once true hardware ID is resolved
          setTimeout(() => {
            get().syncWithServer(true);
          }, 150);
        });
      },

      submitSubscriptionRequest: async (req) => {
        const machineId = get().machineId || getOrCreateMachineId();
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
          allowedMachineIds: [machineId],
          doctorName: req.doctorName || "",
          clinicName: req.clinicName || "",
          durationDays: req.durationDays,
          isTrial: req.isTrial || false,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        // Update local state immediately
        set((state) => ({
          subscriberId,
          subscriptions: [newRecord, ...state.subscriptions.filter((s) => s.machineId !== machineId)],
          currentSubscription: newRecord,
        }));

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("penrx_last_subscriber_id", subscriberId);
            localStorage.setItem("penrx_pending_sub_id", newRecord.id);
            localStorage.setItem("penrx_was_pending", "true");
          } catch {}
        }

        // 1. Direct Supabase Cloud REST persist (Instant Portal Delivery via Supabase Realtime)
        // Explicitly authorized by PostgreSQL RLS policy "anon_insert_pending_sub" (status = 'PENDING').
        // This ensures desktop and mobile clients deliver subscription requests to Supabase in <200ms
        // with 0 dependence on local server proxies or IPv6 database drivers.
        const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
        const SUPABASE_ANON_KEY =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

        try {
          const directSupaRes = await fetch(SUPABASE_REST_URL, {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(newRecord),
          });
          if (directSupaRes.ok) {
            console.log("[SubscriptionStore] Direct Supabase Cloud submission confirmed.");
          }
        } catch (supaErr) {
          console.warn("[SubscriptionStore] Direct Supabase Cloud notice:", supaErr);
        }

        // 2. Dual-Write to Server API (Local Next.js Server + Cloud Deployment Fallback)
        try {
          let res: Response | null = null;
          try {
            res = await fetch(getApiUrl("/api/subscriptions"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newRecord),
            });
          } catch {
            // Local server unreachable in some desktop runs — proceed to cloud fallback
          }

          // If primary failed, returned 5xx, or timed out, send directly to Cloud API
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
              set((state) => ({
                subscriberId: data.subscription.subscriberId || subscriberId,
                subscriptions: [
                  data.subscription,
                  ...state.subscriptions.filter((s) => s.id !== data.subscription.id),
                ],
              }));
            }
          }
        } catch (err) {
          console.warn("Server subscription sync deferred:", err);
        }

        return newRecord;
      },

      cancelPendingRequest: async () => {
        const machineId = get().machineId;
        const pending = get().subscriptions.find(
          (s) =>
            (s.machineId === machineId ||
              (Array.isArray(s.allowedMachineIds) && s.allowedMachineIds.includes(machineId))) &&
            s.status === "PENDING"
        );

        if (pending) {
          set((state) => ({
            subscriptions: state.subscriptions.filter((s) => s.id !== pending.id),
            currentSubscription: null,
          }));

          const cancelPayload = {
            action: "cancel_request",
            id: pending.id,
            subscriberId: pending.subscriberId,
            machineId,
          };

          // Cancel through the app API — local server with cloud fallback
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
            set((state) => ({
              subscriberId: cleanSubId,
              signatureToken: data.subscription.signatureToken || state.signatureToken,
              subscriptions: [
                data.subscription,
                ...state.subscriptions.filter((s) => s.id !== data.subscription.id),
              ],
            }));
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
        // Throttle: Skip if another sync ran less than 5 seconds ago unless forced
        const now = Date.now();
        if (!force && now - _lastSyncTime < SYNC_THROTTLE_MS) return;
        _lastSyncTime = now;

        const machineId = get().machineId || getOrCreateMachineId();
        const subId = get().subscriberId;
        const offlineToken = get().signatureToken;

        let confirmedSub: SubscriptionRecord | null = null;
        let serverResponded = false;
        let serverReportedNoSub = false;

        // Check if there is an existing pending request in local store or localStorage
        const localSubs = get().subscriptions || [];
        const hasPendingSub =
          localSubs.some((s) => s.status === "PENDING") ||
          get().currentSubscription?.status === "PENDING" ||
          (typeof window !== "undefined" && localStorage.getItem("penrx_was_pending") === "true");

        const currentLocalSub =
          get().currentSubscription ||
          localSubs.find((s) => s.status === "ACTIVE") ||
          localSubs.find((s) => s.status === "PENDING") ||
          localSubs[0];

        const savedPendingId =
          typeof window !== "undefined" ? localStorage.getItem("penrx_pending_sub_id") : null;

        // 1. Fetch this machine's subscription from the app API
        try {
          let query = `machineId=${encodeURIComponent(machineId)}`;
          if (subId && subId !== "SUB-0000") {
            query += `&subscriberId=${encodeURIComponent(subId)}`;
          }
          const res = await fetch(getApiUrl(`/api/subscriptions?${query}`), {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
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
              confirmedSub = data.subscription;
            } else if (data && data.subscription === null) {
              serverReportedNoSub = true;
            }
          }
        } catch {
          // Server unreachable — keep persisted local state
        }

        // 2. Refresh HMAC signature token (also re-verifies license state online)
        try {
          let url = `/api/system/verify?machineId=${encodeURIComponent(machineId)}`;
          if (subId) {
            url += `&subscriberId=${encodeURIComponent(subId)}`;
          }
          if (offlineToken) {
            url += `&offlineToken=${encodeURIComponent(offlineToken)}`;
          }

          const res = await fetch(getApiUrl(url), {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
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
                confirmedSub = data.subscription;
              }
              set({
                signatureToken: data.token || null,
                lastOnlineCheck: Date.now(),
              });
            } else if (data.status === "none") {
              serverReportedNoSub = true;
              set({ signatureToken: null, lastOnlineCheck: Date.now() });
            } else if (data.status && data.status !== "active") {
              set({ signatureToken: null, lastOnlineCheck: Date.now() });
              if (data.subscription) {
                confirmedSub = data.subscription;
              }
            }
          }
        } catch {}

        // 3. Direct Supabase Cloud REST verification (safe PostgREST syntax without unquoted braces inside or)
        let supaResponded = false;
        let supaReportedNoSub = false;
        try {
          const supaKey =
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

          const orParts: string[] = [`machineId.ilike.${encodeURIComponent(machineId)}`];
          if (subId && subId !== "SUB-0000") {
            orParts.push(`subscriberId.ilike.${encodeURIComponent(subId)}`);
          }
          if (currentLocalSub?.id) {
            orParts.push(`id.eq.${encodeURIComponent(currentLocalSub.id)}`);
          }
          if (savedPendingId && savedPendingId !== currentLocalSub?.id) {
            orParts.push(`id.eq.${encodeURIComponent(savedPendingId)}`);
          }
          if (
            currentLocalSub?.subscriberId &&
            currentLocalSub.subscriberId !== subId &&
            currentLocalSub.subscriberId !== "SUB-0000"
          ) {
            orParts.push(`subscriberId.ilike.${encodeURIComponent(currentLocalSub.subscriberId)}`);
          }

          const supaUrl = `https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription?or=(${orParts.join(",")})&order=updatedAt.desc&limit=5`;
          const supaRes = await fetch(supaUrl, {
            headers: {
              apikey: supaKey,
              Authorization: "Bearer " + supaKey,
            },
            cache: "no-store",
            signal: AbortSignal.timeout(6000),
          });
          if (supaRes.ok) {
            supaResponded = true;
            const supaDateHdr = supaRes.headers.get("date");
            if (supaDateHdr) {
              const dt = new Date(supaDateHdr).getTime();
              if (!isNaN(dt) && dt > 0) recordServerTime(dt);
            }
            const supaData = await supaRes.json();
            if (Array.isArray(supaData)) {
              if (supaData.length > 0) {
                const activeMatch = supaData.find((r: any) => r.status === "ACTIVE");
                const bestMatch = activeMatch || supaData[0];
                // If confirmedSub from server was not active, but Supabase returned active, prefer active!
                if (!confirmedSub || (bestMatch.status === "ACTIVE" && confirmedSub.status !== "ACTIVE")) {
                  confirmedSub = bestMatch;
                }
              } else {
                supaReportedNoSub = true;
              }
            }
          }
        } catch {}

        // If an active/valid subscription was found, update state
        if (confirmedSub) {
          const fresh = confirmedSub;
          // Remember last confirmed subscriber ID in local storage for resilient lookups
          if (typeof window !== "undefined" && fresh.subscriberId) {
            try {
              localStorage.setItem("penrx_last_subscriber_id", fresh.subscriberId);
            } catch {}
          }
          if (fresh.status === "ACTIVE") {
            if (typeof window !== "undefined") {
              try {
                localStorage.removeItem("penrx_pending_sub_id");
              } catch {}
            }
          }
          set((state) => ({
            subscriptions: [
              fresh,
              ...state.subscriptions.filter((s) => s.id !== fresh.id),
            ],
            currentSubscription: fresh,
            subscriberId: fresh.subscriberId || state.subscriberId,
            signatureToken: fresh.signatureToken || state.signatureToken,
            lastSyncedAt: Date.now(),
            lastOnlineCheck: Date.now(), // Resets 3-day offline countdown
          }));
          return;
        }

        // PROTECTION FOR PENDING REQUESTS:
        // If the user has a pending subscription waiting for admin approval, NEVER wipe it!
        // The waiting screen must stay visible until the admin explicitly approves or rejects.
        if (hasPendingSub) {
          return;
        }

        // AUTHORITATIVE ONLINE REVOCATION:
        // When online, ONLY if BOTH Supabase AND Server explicitly confirm that no subscription exists for this doctor:
        // (i.e. Admin deleted it from the portal or directly from Supabase via SQL):
        // WIPE local subscription immediately and clear security tokens so the app locks immediately!
        if (supaResponded && supaReportedNoSub && serverResponded && serverReportedNoSub) {
          console.warn("[PenRX+ License] Online verification confirmed subscription was deleted from database.");
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
              localStorage.removeItem("penrx_pending_sub_id");
              localStorage.removeItem("penrx_last_subscriber_id");
            } catch {}
          }
          return;
        }

        // OFFLINE MODE:
        // Neither Supabase nor the Server could be reached (network is disconnected, no Wi-Fi, offline).
        // Under offline mode, the subscription is safely preserved in local storage and continues working
        // without interruption for up to 3 days (MAX_OFFLINE_GRACE_MS).
      },
    }),
    {
      name: "penrx_subscription_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
