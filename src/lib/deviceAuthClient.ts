/**
 * Client-side helper for tenant-authenticated API calls.
 *
 * The device token is minted by `/api/system/verify` only after the server has
 * confirmed an ACTIVE subscription for this hardware id. Medical-data endpoints
 * require it, so the client never has to (and cannot) claim a subscriber id.
 */

import { useSubscriptionStore } from "@/store/useSubscriptionStore";

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return useSubscriptionStore.getState().signatureToken || null;
  } catch {
    return null;
  }
}

/** Headers for any request that reads or writes doctor-owned medical data. */
export function deviceAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getDeviceToken();
  return {
    ...(token ? { "X-Device-Token": token } : {}),
    ...extra,
  };
}
