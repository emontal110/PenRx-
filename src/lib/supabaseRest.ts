/**
 * Server-only Supabase PostgREST client.
 *
 * Uses the service-role key from the environment; it must never be imported by
 * client components, and no key may ever be shipped in source.
 */

import { getSupabaseRestBase, getServiceRoleKey } from "@/lib/env";

export interface RestQueryInit {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: string;
  body?: unknown;
  prefer?: string;
  headers?: Record<string, string>;
}

export class SupabaseRestError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(table: string, status: number, detail: string) {
    super(`Supabase "${table}" responded ${status}: ${detail}`);
    this.name = "SupabaseRestError";
    this.status = status;
    this.detail = detail;
  }
}

function normalizeQuery(query?: string): string {
  const clean = (query || "").trim();
  if (!clean) return "";
  return clean.startsWith("?") ? clean : `?${clean}`;
}

/**
 * Runs a PostgREST request and returns parsed JSON (null for 204/empty bodies).
 * Throws SupabaseRestError on non-2xx so callers can fail loudly instead of
 * silently writing partial data.
 */
export async function supabaseRest<T = any>(
  table: string,
  init: RestQueryInit = {}
): Promise<T | null> {
  const key = getServiceRoleKey();
  const url = `${getSupabaseRestBase()}/${encodeURIComponent(table)}${normalizeQuery(init.query)}`;

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...(init.prefer ? { Prefer: init.prefer } : {}),
    ...(init.headers || {}),
  };

  const res = await fetch(url, {
    method: init.method || "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SupabaseRestError(table, res.status, detail.slice(0, 400));
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
