/**
 * License change watcher for the installed app.
 *
 * A public Realtime socket on the whole `Subscription` table would broadcast every
 * doctor's activation events to anyone holding the anon key, so the app instead
 * polls its OWN license endpoint. `/api/system/verify` reads PostgreSQL with no
 * cache, so a portal activation is seen on the next tick and the app unlocks.
 */

import { useSubscriptionStore } from "@/store/useSubscriptionStore";

/** While a payment is waiting for approval the doctor is watching the screen. */
const PENDING_POLL_MS = 10_000;
/** Once licensed, a slower heartbeat is enough to catch suspension or expiry. */
const ACTIVE_POLL_MS = 60_000;

export function initSubscriptionRealtimeListener(): () => void {
  if (typeof window === "undefined") return () => {};

  let timer: any = null;

  const poll = () => {
    const state = useSubscriptionStore.getState();
    if (!navigator.onLine) return;

    // syncWithServer(true) bypasses the local throttle and re-reads the license.
    state.syncWithServer(true).catch(() => {});
  };

  const schedule = () => {
    clearInterval(timer);
    const status = useSubscriptionStore.getState().currentSubscription?.status;
    const interval = status === "PENDING" || !status ? PENDING_POLL_MS : ACTIVE_POLL_MS;
    timer = setInterval(poll, interval);
  };

  const handleOnline = () => {
    poll();
    schedule();
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      poll();
      schedule();
    }
  };

  const handleFocus = () => poll();

  // Reschedule whenever the license state changes so a pending queue polls faster.
  const unsubscribe = useSubscriptionStore.subscribe(schedule);

  schedule();
  poll();

  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    clearInterval(timer);
    unsubscribe();
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
