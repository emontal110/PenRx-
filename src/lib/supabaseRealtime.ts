/**
 * Supabase Realtime WebSocket Client for Instant Admin Portal Sync
 * Listens for real-time changes (INSERT, UPDATE, DELETE) on the "Subscription" table
 * and triggers immediate client synchronization within milliseconds.
 */

import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getKnownDeviceMachineIds } from "@/lib/deviceSecurity";

const SUPABASE_PROJECT_REF = "qspaigplwyvpqbmszpgc";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

let realtimeSocket: WebSocket | null = null;
let heartbeatTimer: any = null;
let reconnectTimer: any = null;
let isConnecting = false;

export function initSubscriptionRealtimeListener(): () => void {
  if (typeof window === "undefined") return () => {};

  function connect() {
    if (isConnecting || (realtimeSocket && realtimeSocket.readyState === WebSocket.OPEN)) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    isConnecting = true;
    try {
      const wsUrl = `wss://${SUPABASE_PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        isConnecting = false;
        realtimeSocket = socket;

        // 1. Join Realtime topic for public:Subscription
        const joinMsg = {
          topic: "realtime:public:Subscription",
          event: "phx_join",
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: "" },
              postgres_changes: [
                {
                  event: "*",
                  schema: "public",
                  table: "Subscription",
                },
              ],
            },
          },
          ref: "1",
        };
        socket.send(JSON.stringify(joinMsg));

        // 2. Keepalive heartbeat every 25 seconds
        clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: String(Date.now()),
              })
            );
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Check for Postgres change events on Subscription table
          if (data && data.event === "postgres_changes") {
            const payload = data.payload?.data;
            const eventType = payload?.type; // 'INSERT' | 'UPDATE' | 'DELETE'
            const record = payload?.record || payload?.old;

            const state = useSubscriptionStore.getState();
            const currentSub = state.currentSubscription;
            const currentSubId = (state.subscriberId || "").trim().toUpperCase();
            const knownMids = getKnownDeviceMachineIds(state.machineId);
            const pendingId = localStorage.getItem("penrx_pending_sub_id");
            const savedSubId = (localStorage.getItem("penrx_last_subscriber_id") || "").trim().toUpperCase();

            const recMid = (record?.machineId || "").trim().toUpperCase();
            const recSubId = (record?.subscriberId || "").trim().toUpperCase();
            const recAllowed = Array.isArray(record?.allowedMachineIds)
              ? record.allowedMachineIds.map((m: string) => (m || "").trim().toUpperCase())
              : [];

            // Check if this event affects current device/subscriber
            const matchesCurrent =
              !record ||
              record.id === currentSub?.id ||
              (pendingId && record.id === pendingId) ||
              (recSubId && (recSubId === currentSubId || recSubId === savedSubId)) ||
              (recMid && knownMids.includes(recMid)) ||
              recAllowed.some((m: string) => knownMids.includes(m));

            // Instant Realtime Revocation if current subscription was deleted from portal
            if (eventType === "DELETE") {
              const deletedId = (record?.id || payload?.old?.id || "").trim();
              if (deletedId && (deletedId === currentSub?.id || deletedId === pendingId)) {
                console.warn(`[SupabaseRealtime] Subscription ${deletedId} deleted in portal. Instant local revocation!`);
                useSubscriptionStore.getState().revokeLocallyAndClear("Deleted via Realtime WebSocket");
              }
            }

            if (matchesCurrent || eventType === "DELETE" || eventType === "UPDATE") {
              // Trigger immediate synchronization with authoritative cloud database
              useSubscriptionStore.getState().syncWithServer(true);
            }
          }
        } catch {}
      };

      socket.onerror = () => {
        isConnecting = false;
      };

      socket.onclose = () => {
        isConnecting = false;
        realtimeSocket = null;
        clearInterval(heartbeatTimer);
        // Attempt reconnect after 5 seconds if online
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (typeof window !== "undefined" && navigator.onLine) {
            connect();
          }
        }, 5000);
      };
    } catch {
      isConnecting = false;
    }
  }

  // Connect immediately if online
  if (navigator.onLine) {
    connect();
  }

  // Listen to network status & app foreground resume changes (critical on Android APK)
  const handleOnline = () => {
    connect();
    useSubscriptionStore.getState().syncWithServer(true);
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      if (!realtimeSocket || realtimeSocket.readyState !== WebSocket.OPEN) {
        connect();
      }
      useSubscriptionStore.getState().syncWithServer(true);
    }
  };

  const handleFocus = () => {
    useSubscriptionStore.getState().syncWithServer(true);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    clearInterval(heartbeatTimer);
    clearTimeout(reconnectTimer);
    if (realtimeSocket) {
      try {
        realtimeSocket.close();
      } catch {}
      realtimeSocket = null;
    }
  };
}
