/**
 * Audit trail for administrative actions on paid subscriptions and medical data.
 * Writes are best-effort: an audit failure must never block the operator.
 */

import { supabaseRest } from "@/lib/supabaseRest";

export async function recordAdminAudit(entry: {
  action: string;
  subscriptionId?: string;
  subscriberId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await supabaseRest("AdminAuditLog", {
      method: "POST",
      body: {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action: String(entry.action || "").slice(0, 48),
        subscriptionId: String(entry.subscriptionId || "").slice(0, 64),
        subscriberId: String(entry.subscriberId || "").slice(0, 32),
        detail: entry.detail || {},
        ip: String(entry.ip || "").slice(0, 64),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.warn("[AdminAudit] notice:", err?.message || err);
  }
}
