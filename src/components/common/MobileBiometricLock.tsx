"use client";

import React, { useState, useEffect, useRef } from "react";
import { Fingerprint, ShieldCheck, Lock, AlertCircle, RefreshCw, KeyRound, Sparkles } from "lucide-react";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  isNativeAndroidApk,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/deviceSecurity";
import { useClinicStore } from "@/store/useClinicStore";

export function MobileBiometricLock() {
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isNativeAndroidApk()) return false;
    const stored = localStorage.getItem("penrx_biometric_enabled");
    // On Android APK: First launch (stored === null) or explicitly enabled ("true") starts locked
    return stored === "true" || stored === null;
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasPrompted, setHasPrompted] = useState(false);
  const { clinic } = useClinicStore();
  const checkingRef = useRef(false);

  useEffect(() => {
    // Strictly runs on Android APK (Capacitor Native Android)
    if (!isNativeAndroidApk()) {
      setIsLocked(false);
      return;
    }

    async function initBiometricsOnLaunch() {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const stored = typeof window !== "undefined" ? localStorage.getItem("penrx_biometric_enabled") : null;
        const avail = await isBiometricAvailable();

        // 1. First Run: Auto-enable if device supports biometrics
        if (stored === null) {
          if (avail) {
            setBiometricLockEnabled(true);
            useClinicStore.getState().updateClinic({ biometricsEnabled: true });
            setIsLocked(true);
            triggerUnlockPrompt();
          } else {
            setBiometricLockEnabled(false);
            useClinicStore.getState().updateClinic({ biometricsEnabled: false });
            setIsLocked(false);
          }
          return;
        }

        // 2. Subsequent runs: Check if doctor kept it enabled
        if (stored === "true" && avail) {
          setIsLocked(true);
          triggerUnlockPrompt();
        } else {
          setIsLocked(false);
        }
      } catch (err) {
        console.warn("[MobileBiometricLock] Init notice:", err);
        setIsLocked(false);
      }
    }

    initBiometricsOnLaunch();
  }, []);

  async function triggerUnlockPrompt() {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setErrorMsg(null);

    try {
      const docName = clinic?.doctorName ? `د. ${clinic.doctorName}` : "طبيب العيادة";
      const res = await authenticateWithBiometrics(
        `مرحباً بك ${docName}، المس مستشعر البصمة لفتح منظومة PenRX+`
      );

      if (res.success) {
        setIsLocked(false);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.error || "لم يتم التعرف على البصمة. يرجى المحاولة مرة أخرى.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "فشل التحقق من البصمة");
    } finally {
      setIsAuthenticating(false);
      setHasPrompted(true);
    }
  }

  if (!isLocked) {
    return null;
  }

  const docDisplayName = clinic?.doctorName ? `د. ${clinic.doctorName}` : "مرحباً بك يا دكتور";
  const clinicDisplayName = clinic?.name || clinic?.nameAr || "عيادة PenRX+ الطبية";

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="w-full pt-8 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>تطبيق PenRX+ محمي بالبصمة</span>
        </div>
        <h1 className="text-xl font-black text-white pt-2">{clinicDisplayName}</h1>
        <p className="text-xs text-slate-400 font-bold">{docDisplayName}</p>
      </div>

      {/* Center Biometric Prompt */}
      <div className="flex flex-col items-center space-y-6 text-center max-w-xs">
        <button
          type="button"
          onClick={triggerUnlockPrompt}
          disabled={isAuthenticating}
          className="relative w-28 h-28 rounded-full bg-slate-900 border-2 border-emerald-500/40 hover:border-emerald-400 text-emerald-400 flex items-center justify-center transition-all shadow-2xl shadow-emerald-950/60 active:scale-95 cursor-pointer group"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <Fingerprint className="w-14 h-14 transition-transform group-hover:scale-110" />
        </button>

        <div className="space-y-1.5">
          <h2 className="text-base font-black text-slate-100">
            {isAuthenticating ? "جاري انتظار لمس البصمة..." : "المس مستشعر البصمة للفتح"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            تم قفل التطبيق لحماية خصوصية العيادة وسجلات المرضى.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 font-bold flex items-center gap-2 text-right">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={triggerUnlockPrompt}
          className="w-full py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة التحقق من البصمة الآن</span>
        </button>
      </div>

      {/* Bottom Footer Note */}
      <div className="w-full pb-4 text-center">
        <p className="text-[11px] text-slate-500 font-bold">
          يمكنك تعطيل أو تفعيل قفل البصمة في أي وقت من شاشة الإعدادات.
        </p>
      </div>
    </div>
  );
}
