"use client";

/**
 * GlobalToast – Lightweight global toast notification system.
 *
 * How to use from anywhere:
 *   import { showGlobalToast } from "@/components/common/GlobalToast";
 *   showGlobalToast("✅ تم الحفظ بنجاح!");
 *   showGlobalToast("⚠️ خطأ", "error");
 */

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

// ── Singleton event bus ────────────────────────────────────────────────────
let _counter = 0;
const _listeners: Set<(t: ToastEntry) => void> = new Set();

export function showGlobalToast(
  message: string,
  variant: ToastVariant = "success"
) {
  const entry: ToastEntry = { id: ++_counter, message, variant };
  _listeners.forEach((fn) => fn(entry));
}

// ── React component (mount once in layout) ────────────────────────────────
export function GlobalToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const handler = (t: ToastEntry) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4500);
    };
    _listeners.add(handler);
    return () => {
      _listeners.delete(handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const isSuccess = t.variant === "success";
        const isError = t.variant === "error";

        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto
              flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
              border text-sm font-bold text-white
              animate-in slide-in-from-bottom-4 fade-in duration-300
              ${
                isSuccess
                  ? "bg-emerald-600/95 border-emerald-400/50 shadow-emerald-950/60"
                  : isError
                  ? "bg-rose-600/95 border-rose-400/50 shadow-rose-950/60"
                  : "bg-slate-700/95 border-slate-500/50 shadow-slate-950/60"
              }
            `}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-200" />
            )}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
