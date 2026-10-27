/**
 * Shared API response helpers: locked-down CORS (allowlist), no-store caching and
 * consistent shapes for every PenRX+ endpoint.
 */

import { NextResponse } from "next/server";
import { corsHeaders, securityHeaders } from "@/lib/httpSecurity";

export function apiJson(
  request: Request,
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): NextResponse {
  return NextResponse.json(
    { ...(data as object), serverTime: Date.now() },
    {
      status: init.status || 200,
      headers: { ...securityHeaders(), ...corsHeaders(request), ...(init.headers || {}) },
    }
  );
}

export function apiError(
  request: Request,
  message: string,
  status = 400,
  init: { headers?: Record<string, string> } = {}
): NextResponse {
  return apiJson(request, { error: message, success: false }, { status, ...init });
}

export function preflight(request: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(request), ...securityHeaders() },
  });
}

/** Reads a JSON body defensively: rejects oversized and malformed payloads. */
export async function readJsonBody<T = Record<string, any>>(
  request: Request,
  maxBytes = 64 * 1024
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { ok: false, error: "payload_too_large" };

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return { ok: false, error: "unreadable_body" };
  }
  if (raw.length > maxBytes) return { ok: false, error: "payload_too_large" };
  if (!raw.trim()) return { ok: false, error: "empty_body" };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "invalid_body" };
    }
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

const MACHINE_ID = /^[A-Z0-9_-]{6,64}$/;

export function cleanMachineId(value: unknown): string | null {
  const clean = String(value || "").trim().toUpperCase();
  return MACHINE_ID.test(clean) ? clean : null;
}

export function cleanOrderId(value: unknown): string | null {
  const clean = String(value || "").trim();
  return /^(sub|trial)-[a-z0-9-]{6,40}$/i.test(clean) ? clean : null;
}

export function cleanSubscriberId(value: unknown): string | null {
  const clean = String(value || "").trim().toUpperCase();
  return /^SUB-[A-Z0-9]{4,12}$/.test(clean) ? clean : null;
}

export function cleanPhone(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
