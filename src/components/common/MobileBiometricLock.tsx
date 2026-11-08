"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Fingerprint,
  KeyRound,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import {
  authenticateWithBiometrics,
  isNativeAndroidApk,
  isMobileDevice,
  isBiometricLockEnabled,
  isBiometricUnlockedForSession,
  markBiometricUnlockedForSession,
} from "@/lib/deviceSecurity";
import { useClinicStore } from "@/store/useClinicStore";
import { showGlobalToast } from "./GlobalToast";

export function MobileBiometricLock() {
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isNativeAndroidApk() && !isMobileDevice()) return false;
    if (isBiometricUnlockedForSession()) return false;
    return isBiometricLockEnabled();
  });

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinFailCount, setPinFailCount] = useState(0);
  const [pinLockUntil, setPinLockUntil] = useState(0);

  const { clinic, branches } = useClinicStore();
  const hasTriggeredInitialRef = useRef(false);
  const authInFlightRef = useRef(false);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);

  const triggerUnlockPrompt = useCallback(async () => {
    if (authInFlightRef.current) return;
    authInFlightRef.current = true;
    setIsAuthenticating(true);
    setErrorMsg(null);

    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
    }, 30000);

    try {
      // Dismiss any native splash overlay immediately so the fingerprint prompt is visible right away
      if (typeof window !== "undefined" && (window as any).PenRxNative?.hideSplashScreen) {
        try {
          (window as any).PenRxNative.hideSplashScreen();
        } catch {}
      }

      const res = await authenticateWithBiometrics("المس مستشعر البصمة للدخول");

      if (res.success) {
        markBiometricUnlockedForSession();
        setIsLocked(false);
        setErrorMsg(null);
      } else if (res.error && res.error !== "تم إلغاء عملية البصمة") {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "تعذر قراءة البصمة");
    } finally {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!isNativeAndroidApk() && !isMobileDevice()) {
      setIsLocked(false);
      return;
    }

    if (!isBiometricLockEnabled()) {
      setIsLocked(false);
      return;
    }

    // Do NOT show biometric prompt on page refresh if already unlocked in this app session
    if (isBiometricUnlockedForSession()) {
      setIsLocked(false);
      return;
    }

    setIsLocked(true);

    if (!hasTriggeredInitialRef.current) {
      hasTriggeredInitialRef.current = true;
      // Trigger immediately with zero artificial delay
      triggerUnlockPrompt();
    }

    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [triggerUnlockPrompt]);

  function handlePinSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = enteredPin.trim();
    if (!clean) {
      setPinError("أدخل رقم هاتف العيادة أو رقم النقابة");
      return;
    }

    if (pinLockUntil > Date.now()) {
      setPinError(`يرجى الانتظار ${Math.ceil((pinLockUntil - Date.now()) / 60000)} دقيقة`);
      return;
    }

    const clinicPhoneClean = (clinic?.phone || "").replace(/\D/g, "");
    const enteredClean = clean.replace(/\D/g, "");

    const isMatch =
      (clinicPhoneClean.length >= 8 && enteredClean.endsWith(clinicPhoneClean.slice(-8))) ||
      (clinic?.syndicateId && clean === clinic.syndicateId.trim()) ||
      branches.some(
        (b) => b.phone && b.phone.replace(/\D/g, "").length >= 8 && enteredClean.endsWith(b.phone.replace(/\D/g, "").slice(-8))
      );

    if (isMatch) {
      markBiometricUnlockedForSession();
      setIsLocked(false);
      setShowPinModal(false);
      setErrorMsg(null);
      setPinError(null);
      setPinFailCount(0);
      setPinLockUntil(0);
      showGlobalToast("تم فتح المنظومة بنجاح", "success");
    } else {
      const fails = pinFailCount + 1;
      setPinFailCount(fails);
      if (fails >= 5) {
        setPinLockUntil(Date.now() + 5 * 60 * 1000);
        setPinFailCount(0);
        setPinError("تم إيقاف المحاولات لمدة 5 دقائق");
      } else {
        setPinError("الرمز غير صحيح");
      }
    }
  }

  if (!isLocked) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[10000] bg-[#0b1329]/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
        {/* Compact Brand Identity */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-xl bg-[#1C252A]">
            <Image
              src="/logo-penrx.jpg"
              alt="PenRX+"
              fill
              priority
              unoptimized
              sizes="64px"
              className="object-cover"
            />
          </div>
          <span dir="ltr" className="text-xl font-black text-emerald-400 tracking-tight">
            PenRX+
          </span>
        </div>

        {/* Sleek Modern Biometric Sensor Button */}
        <button
          type="button"
          onClick={triggerUnlockPrompt}
          disabled={isAuthenticating}
          className="relative w-24 h-24 rounded-full bg-slate-900/90 border-2 border-emerald-500/50 hover:border-emerald-400 text-emerald-400 flex items-center justify-center transition-all shadow-2xl shadow-emerald-950/60 active:scale-95 cursor-pointer group disabled:opacity-80"
          aria-label="الدخول بالبصمة"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping opacity-60" />
          {isAuthenticating ? (
            <Loader2 className="w-11 h-11 animate-spin text-emerald-400" />
          ) : (
            <Fingerprint className="w-12 h-12 transition-transform group-hover:scale-105" />
          )}
        </button>

        {/* Minimal Status Text */}
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-slate-200">
            {isAuthenticating ? "جاري التحقق..." : "المس البصمة للدخول"}
          </p>
          {errorMsg && (
            <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>
          )}
        </div>

        {/* Subtle PIN Alternative Link */}
        <button
          type="button"
          onClick={() => setShowPinModal(true)}
          className="px-4 py-2 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 text-slate-400 hover:text-slate-200 font-bold text-xs border border-slate-800/80 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
        >
          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
          <span>رمز العيادة</span>
        </button>
      </div>

      {/* Clean Minimal PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowPinModal(false)}
              className="absolute top-3.5 left-3.5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1 pt-1">
              <h3 className="text-sm font-black text-white">رمز العيادة</h3>
              <p className="text-[11px] text-slate-400">
                رقم هاتف العيادة أو رقم النقابة
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="••••••••"
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError(null);
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-center font-bold text-sm text-white tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
              />

              {pinError && (
                <p className="text-[11px] text-rose-400 font-bold text-center">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>دخول</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
