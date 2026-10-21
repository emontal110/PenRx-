"use client";

/**
 * GlobalToast – Ultra-clean single-instance global toast notification system.
 *
 * Guarantees:
 * 1. Single-toast display: Only ONE toast is visible on screen at any time (no stacking).
 * 2. Spam & deduplication protection: Clicking repeatedly within 1.5 seconds will NOT duplicate or stack toasts.
 * 3. Snappy auto-dismiss (3.2s) with manual dismiss button (X).
 */

import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

// ── Singleton event bus ────────────────────────────────────────────────────
let _counter = 0;
let _lastMessage = "";
let _lastTime = 0;
const _listeners: Set<(t: ToastEntry) => void> = new Set();
const _clearListeners: Set<() => void> = new Set();

export function showGlobalToast(
  message: string,
  variant: ToastVariant = "success"
) {
  const now = Date.now();
  // Prevent spamming the exact same message repeatedly within 1.5 seconds
  if (message === _lastMessage && now - _lastTime < 1500) {
    return;
  }
  _lastMessage = message;
  _lastTime = now;

  const entry: ToastEntry = { id: ++_counter, message, variant };
  _listeners.forEach((fn) => fn(entry));
}

export function dismissGlobalToast() {
  _lastMessage = "";
  _clearListeners.forEach((fn) => fn());
}

// ── React component (mount once in layout) ────────────────────────────────
export function GlobalToastContainer() {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (t: ToastEntry) => {
      // Clear any pending dismissal timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Display the single new toast (replaces any previous toast immediately)
      setToast(t);

      // Auto dismiss after 3.2 seconds
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, 3200);
    };

    const clearHandler = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setToast(null);
    };

    _listeners.add(handler);
    _clearListeners.add(clearHandler);

    return () => {
      _listeners.delete(handler);
      _clearListeners.delete(clearHandler);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast) return null;

  const isSuccess = toast.variant === "success";
  const isError = toast.variant === "error";

  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none select-none max-w-[92vw] md:max-w-md w-max"
    >
      <div
        key={toast.id}
        className={`
          pointer-events-auto
          flex items-center gap-3 px-4.5 py-3 rounded-2xl shadow-2xl
          border text-sm font-semibold text-white
          backdrop-blur-md transition-all duration-300
          animate-in slide-in-from-bottom-5 fade-in zoom-in-95
          ${
            isSuccess
              ? "bg-emerald-600/95 border-emerald-400/40 shadow-emerald-950/50"
              : isError
              ? "bg-rose-600/95 border-rose-400/40 shadow-rose-950/50"
              : "bg-slate-800/95 border-slate-600/40 shadow-slate-950/60"
          }
        `}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
        ) : isError ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-200" />
        ) : (
          <Info className="w-4 h-4 shrink-0 text-cyan-200" />
        )}
        <span className="leading-snug text-slate-100">{toast.message}</span>
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setToast(null);
          }}
          className="mr-1 p-1 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          title="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
