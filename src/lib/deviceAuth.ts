/**
 * Device access tokens.
 *
 * A device token is minted by the server ONLY after it has confirmed an ACTIVE
 * subscription for that hardware ID. Requests to medical-data endpoints must
 * present the token, so tenant isolation no longer relies on client-claimed
 * `subscriberId` / `machineId` strings.
 *
 * Token format: <base64url payload>.<hmac-sha256 hex>
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSigningSecret } from "@/lib/env";

export interface DeviceTokenPayload {
  machineId: string;
  subscriberId: string;
  subscriptionId: string;
  expiresAt: string;
  issuedAt: number;
  jti: string;
}

/** Medical data access windows stay short so suspension takes effect quickly. */
export const DEVICE_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a.toLowerCase(), "hex");
  const bufB = Buffer.from(b.toLowerCase(), "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueDeviceToken(input: {
  machineId: string;
  subscriberId: string;
  subscriptionId: string;
  expiresAt: string;
}): DeviceTokenPayload & { token: string } {
  const payload: DeviceTokenPayload = {
    machineId: (input.machineId || "").trim(),
    subscriberId: (input.subscriberId || "").trim().toUpperCase(),
    subscriptionId: (input.subscriptionId || "").trim(),
    expiresAt: input.expiresAt,
    issuedAt: Date.now(),
    jti: randomBytes(9).toString("hex"),
  };

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  return { ...payload, token };
}

/**
 * Returns the payload when the signature is valid and the token has not passed
 * its own expiry. Callers MUST still re-check the live subscription status.
 */
export function verifyDeviceToken(token: string | null): DeviceTokenPayload | null {
  const raw = (token || "").trim();
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;

  const body = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  try {
    // Hex decoding ignores trailing garbage, so the signature must be canonical
    // before it is compared — otherwise any suffix would still verify.
    if (!/^[0-9a-f]{64}$/i.test(signature)) return null;
    if (!safeEqualHex(signature, sign(body))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DeviceTokenPayload;
    if (!payload?.machineId || !payload?.subscriberId) return null;
    if (typeof payload.issuedAt !== "number") return null;
    if (payload.issuedAt + DEVICE_TOKEN_TTL_MS < Date.now()) return null;
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function readDeviceToken(request: Request): DeviceTokenPayload | null {
  return verifyDeviceToken(request.headers.get("x-device-token"));
}
