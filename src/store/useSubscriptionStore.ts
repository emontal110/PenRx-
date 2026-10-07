import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getOrCreateMachineId, initializeHardwareMachineId } from "@/lib/deviceSecurity";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MDU0MywiZXhwIjoyMTA1MTY2NTQzfQ.gJ9ArhmjkAf2tQmqZbvA88hJmDaz6EYgf2RdJfl6RCE";

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
  syncWithServer: () => Promise<void>;
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

export function getSubscriptionDetails(subscriptions: SubscriptionRecord[], currentMachineId: string) {
  // Find subscriptions matching current machine ID (either as primary or in allowedMachineIds)
  const matchingSubs = subscriptions.filter(
    (s) =>
      s.machineId === currentMachineId ||
      (Array.isArray(s.allowedMachineIds) && s.allowedMachineIds.includes(currentMachineId))
  );

  // Prioritize ACTIVE, then PENDING, then most recent record
  const activeSub = matchingSubs.find((s) => s.status === "ACTIVE") || subscriptions.find((s) => s.status === "ACTIVE");
  const pendingSub = matchingSubs.find((s) => s.status === "PENDING") || subscriptions.find((s) => s.status === "PENDING");
  const sub = activeSub || pendingSub || matchingSubs[0] || subscriptions[0] || null;

  if (!sub) {
    return {
      isActive: false,
      isPending: false,
      isExpired: false,
      isSuspended: false,
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
  // If subscription status is ACTIVE on database/portal, it is unlocked and active
  const isActive = sub.status === "ACTIVE" && (daysRemaining > 0 || (sub.durationDays && sub.durationDays > 0));
  const isPending = sub.status === "PENDING";
  const isSuspended = sub.status === "SUSPENDED";

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
  }

  return {
    isActive,
    isPending,
    isExpired,
    isSuspended,
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

      setMachineId: (id: string) => set({ machineId: id }),
      setSubscriberId: (id: string) => set({ subscriberId: id }),
      setSignatureToken: (token: string | null) => set({ signatureToken: token }),

      // Initialize real hardware machine ID from Electron (called once on app mount)
      initHardwareId: async () => {
        await initializeHardwareMachineId((newId) => {
          set({ machineId: newId });
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

        // 1. Direct Supabase Cloud sync (Instant appearance in portal.html!)
        try {
          await fetch(SUPABASE_REST_URL, {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(newRecord),
          });
        } catch (cloudErr) {
          console.warn("Direct Supabase cloud sync notice:", cloudErr);
        }

        // 2. Also send to local server API
        try {
          const res = await fetch("/api/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRecord),
          });
          const data = await res.json();
          if (data && data.subscription) {
            set((state) => ({
              subscriberId: data.subscription.subscriberId || subscriberId,
              subscriptions: [
                data.subscription,
                ...state.subscriptions.filter((s) => s.id !== data.subscription.id),
              ],
            }));
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

          // Direct Delete from Supabase Cloud
          try {
            await fetch(`${SUPABASE_REST_URL}?id=eq.${encodeURIComponent(pending.id)}`, {
              method: "DELETE",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: "Bearer " + SUPABASE_ANON_KEY,
              },
            });
          } catch {}

          // Also delete from local API
          try {
            await fetch(`/api/system/verify?id=${pending.id}`, { method: "DELETE" });
          } catch (err) {
            console.warn("Server subscription delete deferred:", err);
          }
        }
      },

      linkDeviceToSubscriber: async (targetSubscriberId: string, verificationPhone?: string) => {
        const machineId = get().machineId || getOrCreateMachineId();
        const cleanSubId = targetSubscriberId.toUpperCase().trim();

        try {
          const res = await fetch("/api/subscriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "link_device",
              subscriberId: cleanSubId,
              machineId,
              verificationPhone: verificationPhone?.trim(),
            }),
          });
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
          await fetch("/api/system/verify", {
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
          await fetch("/api/system/verify", {
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
          await fetch(`/api/system/verify?id=${encodeURIComponent(id)}`, {
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
          await fetch("/api/system/verify", {
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
          await fetch("/api/system/verify", {
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
          await fetch("/api/system/verify", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: subscriptionId, action: "REMOVE_DEVICE", machineId: targetMachineId }),
          });
        } catch {}
      },

      syncWithServer: async () => {
        const machineId = get().machineId || getOrCreateMachineId();
        const subId = get().subscriberId;
        const offlineToken = get().signatureToken;
        let foundActive = false;

        // 1. Fetch own subscription from local Next.js API (fast, isolated)
        try {
          let query = `machineId=${encodeURIComponent(machineId)}`;
          if (subId && subId !== "SUB-0000") {
            query += `&subscriberId=${encodeURIComponent(subId)}`;
          }
          const res = await fetch(`/api/subscriptions?${query}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.subscription) {
              const fresh = data.subscription;
              set((state) => ({
                subscriptions: [
                  fresh,
                  ...state.subscriptions.filter((s) => s.id !== fresh.id),
                ],
                currentSubscription: fresh,
                subscriberId: fresh.subscriberId || state.subscriberId,
                signatureToken: fresh.signatureToken || state.signatureToken,
                lastSyncedAt: Date.now(),
              }));
              if (fresh.status === "ACTIVE") {
                foundActive = true;
              }
            }
          }
        } catch {
          // Local server fetch skipped/error
        }

        // 2. Direct Cloud Query (Supabase Cloud Sync):
        // If not active yet or local server didn't find active status,
        // query Supabase Cloud directly (same DB the Admin Portal updates)
        if (!foundActive) {
          try {
            const encodedId = encodeURIComponent(machineId);
            let filter = `or=(machineId.eq.${encodedId},allowedMachineIds.cs.{${encodedId}})`;
            if (subId && subId !== "SUB-0000") {
              const encodedSubId = encodeURIComponent(subId);
              filter = `or=(machineId.eq.${encodedId},allowedMachineIds.cs.{${encodedId}},subscriberId.eq.${encodedSubId})`;
            }

            const cloudRes = await fetch(
              `${SUPABASE_REST_URL}?${filter}&select=*&order=createdAt.desc&limit=1`,
              {
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: "Bearer " + SUPABASE_ANON_KEY,
                },
                cache: "no-store",
              }
            );
            if (cloudRes.ok) {
              const rows = await cloudRes.json();
              if (Array.isArray(rows) && rows.length > 0) {
                const mySub = rows[0];
                set((state) => ({
                  subscriptions: [mySub, ...state.subscriptions.filter((s) => s.id !== mySub.id)],
                  currentSubscription: mySub,
                  subscriberId: mySub.subscriberId || state.subscriberId,
                  lastSyncedAt: Date.now(),
                }));
              }
            }
          } catch {}
        }

        // 2. Verify and obtain fresh cryptographic HMAC signature token from server
        try {
          let url = `/api/system/verify?machineId=${encodeURIComponent(machineId)}`;
          if (subId) {
            url += `&subscriberId=${encodeURIComponent(subId)}`;
          }
          if (offlineToken) {
            url += `&offlineToken=${encodeURIComponent(offlineToken)}`;
          }

          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.status === "active" && data.token) {
              set({ signatureToken: data.token, lastOnlineCheck: Date.now() });
            } else if (data.status && data.status !== "active") {
              // Server revoked or expired token
              set({ signatureToken: null });
            }
          }
        } catch {}
      },
    }),
    {
      name: "penrx_subscription_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
