/**
 * Server-side configuration. Secrets come from the environment ONLY.
 *
 * The packaged desktop runtime intentionally ships without these values and
 * proxies privileged calls to the cloud deployment (see cloudProxy.ts), so
 * accessors must throw on demand rather than at import time.
 */

export class MissingSecretError extends Error {
  constructor(name: string) {
    super(
      `Missing required server secret "${name}". Set it in Vercel project environment variables (and in .env for local development).`
    );
    this.name = "MissingSecretError";
  }
}

function readRequired(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) throw new MissingSecretError(name);
  if (value.length < 32) {
    throw new Error(`Insecure "${name}": must be at least 32 characters of random data.`);
  }
  return value;
}

export function getSigningSecret(): string {
  return readRequired("PENRX_SECRET_KEY");
}

export function getAdminSecret(): string {
  return readRequired("PENRX_ADMIN_SECRET");
}

export function getServiceRoleKey(): string {
  return readRequired("SUPABASE_SERVICE_ROLE_KEY");
}

export function getSupabaseRestBase(): string {
  const explicit = (process.env.SUPABASE_REST_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  const projectUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (!projectUrl) throw new MissingSecretError("NEXT_PUBLIC_SUPABASE_URL");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(projectUrl)) {
    throw new Error("Invalid Supabase project URL: expected https://<ref>.supabase.co");
  }
  return `${projectUrl}/rest/v1`;
}

/** Canonical paid-plan catalogue. Prices are authoritative here, never from the client. */
export interface PlanDefinition {
  id: string;
  nameAr: string;
  durationDays: number;
  priceEGP: number;
  isTrial: boolean;
}

export const PLANS: readonly PlanDefinition[] = [
  { id: "trial", nameAr: "الفترة التجريبية المجانية", durationDays: 30, priceEGP: 0, isTrial: true },
  { id: "monthly", nameAr: "الاشتراك الشهري", durationDays: 30, priceEGP: 150, isTrial: false },
  { id: "quarterly", nameAr: "اشتراك 3 شهور", durationDays: 90, priceEGP: 400, isTrial: false },
  { id: "semi_annual", nameAr: "اشتراك 6 شهور", durationDays: 180, priceEGP: 800, isTrial: false },
  { id: "annual_vip", nameAr: "الاشتراك السنوي VIP", durationDays: 365, priceEGP: 1500, isTrial: false },
] as const;

/** Ids already shipped in installed builds resolve to the same plans. */
const PLAN_ALIASES: Record<string, string> = {
  semiannual: "semi_annual",
  annual: "annual_vip",
  yearly: "annual_vip",
};

export function resolvePlan(planId: string): PlanDefinition | null {
  const clean = (planId || "").trim().toLowerCase();
  const id = PLAN_ALIASES[clean] || clean;
  return PLANS.find((p) => p.id === id) || null;
}

export const MAX_DEVICES_PER_SUBSCRIPTION = 3;
