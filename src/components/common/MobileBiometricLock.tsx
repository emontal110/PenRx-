"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Fingerprint,
  ShieldCheck,
  Lock,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Unlock,
  CheckCircle2,
  Loader2,
  X,
  PhoneCall,
} from "lucide-react";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  isNativeAndroidApk,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/deviceSecurity";
import { useClinicStore } from "@/store/useClinicStore";
import { showGlobalToast } from "./GlobalToast";

export function MobileBiometricLock() {
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isNativeAndroidApk()) return false;
    const stored = localStorage.getItem("penrx_biometric_enabled");
    // Strictly lock ONLY when explicitly enabled by doctor ("true")
    // Never lock on first install (stored === null) or when disabled ("false")
    return stored === "true";
  });

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const { clinic, branches, updateClinic } = useClinicStore();
  const checkingRef = useRef(false);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Strictly runs on Android APK (Capacitor Native Android)
    if (!isNativeAndroidApk()) {
      setIsLocked(false);
      return;
    }

    const stored = typeof window !== "undefined" ? localStorage.getItem("penrx_biometric_enabled") : null;

    // If biometric lock is NOT explicitly turned on, keep app open
    if (stored !== "true") {
      setIsLocked(false);
      return;
    }

    async function initBiometricsOnLaunch() {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500));
        const avail = await Promise.race([isBiometricAvailable(), timeoutPromise]);

        if (!avail) {
          // If phone has no biometric hardware or none enrolled, safely unlock & disable to avoid lock-out
          setBiometricLockEnabled(false);
          updateClinic({ biometricsEnabled: false });
          setIsLocked(false);
          return;
        }

        // Wait 400ms for Android native activity window to settle and gain focus
        setTimeout(() => {
          triggerUnlockPrompt();
        }, 400);
      } catch (err) {
        console.warn("[MobileBiometricLock] Init notice:", err);
        setIsLocked(false);
      }
    }

    initBiometricsOnLaunch();

    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  async function triggerUnlockPrompt() {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setErrorMsg(null);
    setPinError(null);

    // Watchdog: ensures isAuthenticating resets if native activity is dropped
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      setIsAuthenticating(false);
    }, 22000);

    try {
      const docName = clinic?.doctorName ? `د. ${clinic.doctorName}` : "طبيب العيادة";
      const res = await authenticateWithBiometrics(
        `مرحباً بك ${docName}، المس مستشعر البصمة لفتح منظومة PenRX+`
      );

      if (res.success) {
        setIsLocked(false);
        setErrorMsg(null);
        setFailCount(0);
        showGlobalToast("تم التحقق بنجاح والفتح 🌿", "success");
      } else {
        const msg = res.error || "لم يتم التعرف على البصمة. يرجى المحاولة مرة أخرى أو استخدام رمز العيادة.";
        setErrorMsg(msg);
        setFailCount((prev) => prev + 1);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "فشل التحقق من البصمة. يمكنك استخدام رمز الدخول البديل.");
      setFailCount((prev) => prev + 1);
    } finally {
      setIsAuthenticating(false);
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    }
  }

  const [pinFailCount, setPinFailCount] = useState(0);
  const [pinLockUntil, setPinLockUntil] = useState(0);

  // Fallback PIN / Passcode unlock
  function handlePinSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = enteredPin.trim();
    if (!clean) {
      setPinError("يرجى إدخال رمز المرور أو رقم هاتف العيادة");
      return;
    }

    if (pinLockUntil > Date.now()) {
      setPinError(`تم إيقاف المحاولة مؤقتاً بعد عدة محاولات فاشلة. أعد المحاولة بعد ${Math.ceil((pinLockUntil - Date.now()) / 60000)} دقيقة.`);
      return;
    }

    const clinicPhoneClean = (clinic?.phone || "").replace(/\D/g, "");
    const enteredClean = clean.replace(/\D/g, "");

    // Only secrets the doctor already owns: no built-in master code, because any
    // code shipped in the app is public to everyone who reads the UI text.
    const isMatch =
      (clinicPhoneClean.length >= 8 && enteredClean.endsWith(clinicPhoneClean.slice(-8))) ||
      (clinic?.syndicateId && clean === clinic.syndicateId.trim()) ||
      branches.some(
        (b) => b.phone && b.phone.replace(/\D/g, "").length >= 8 && enteredClean.endsWith(b.phone.replace(/\D/g, "").slice(-8))
      );

    if (isMatch) {
      setIsLocked(false);
      setShowPinModal(false);
      setErrorMsg(null);
      setPinError(null);
      setPinFailCount(0);
      setPinLockUntil(0);
      showGlobalToast("✅ تم فتح المنظومة برمز التحقق بنجاح", "success");
    } else {
      const fails = pinFailCount + 1;
      setPinFailCount(fails);
      if (fails >= 5) {
        setPinLockUntil(Date.now() + 5 * 60 * 1000);
        setPinFailCount(0);
        setPinError("تم إيقاف المحاولات لمدة 5 دقائق لحماية بيانات المرضى.");
      } else {
        setPinError("رمز التحقق غير صحيح. استخدم رقم هاتف العيادة المسجل أو رقم النقابة.");
      }
    }
  }

  // Emergency Disable & Unlock
  function handleEmergencyDisable() {
    setBiometricLockEnabled(false);
    updateClinic({ biometricsEnabled: false });
    setIsLocked(false);
    setShowPinModal(false);
    showGlobalToast("تم تعطيل قفل البصمة وفتح المنظومة بنجاح", "info");
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
          <ShieldCheck className="w-4 h-4" />
          <span>تطبيق PenRX+ محمي بالبصمة</span>
        </div>
        <h1 className="text-xl font-black text-white pt-2">{clinicDisplayName}</h1>
        <p className="text-xs text-slate-400 font-bold">{docDisplayName}</p>
      </div>

      {/* Center Biometric Prompt */}
      <div className="flex flex-col items-center space-y-5 text-center max-w-xs w-full">
        {/* Pulse Fingerprint Button */}
        <button
          type="button"
          onClick={triggerUnlockPrompt}
          disabled={isAuthenticating}
          className="relative w-28 h-28 rounded-full bg-slate-900 border-2 border-emerald-500/40 hover:border-emerald-400 text-emerald-400 flex items-center justify-center transition-all shadow-2xl shadow-emerald-950/60 active:scale-95 cursor-pointer group disabled:opacity-80"
          title="المس هنا للتحقق بالبصمة"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          {isAuthenticating ? (
            <Loader2 className="w-14 h-14 animate-spin text-emerald-400" />
          ) : (
            <Fingerprint className="w-14 h-14 transition-transform group-hover:scale-110" />
          )}
        </button>

        <div className="space-y-1.5">
          <h2 className="text-base font-black text-slate-100">
            {isAuthenticating ? "جاري انتظار لمس مستشعر البصمة..." : "المس مستشعر البصمة للفتح"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            تم قفل التطبيق لحماية خصوصية العيادة وسجلات المرضى.
          </p>
        </div>

        {/* Error Feedback Display */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-300 font-bold flex items-start gap-2 text-right w-full shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-1">
          {/* Main Fingerprint Button */}
          <button
            type="button"
            onClick={triggerUnlockPrompt}
            disabled={isAuthenticating}
            className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري قراءة البصمة...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>إعادة التحقق من البصمة الآن</span>
              </>
            )}
          </button>

          {/* Alternate Unlock: PIN or Clinic Phone */}
          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>الدخول برمز العيادة البديل (PIN)</span>
          </button>

          {/* Emergency Bypass Button: Appears if failed or error occurs */}
          {(failCount > 0 || errorMsg) && (
            <button
              type="button"
              onClick={handleEmergencyDisable}
              className="w-full py-2 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 text-[11px] font-bold border border-rose-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-rose-400" />
              <span>تعطيل قفل البصمة والدخول للعيادة فوراً</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className="w-full pb-4 text-center">
        <p className="text-[11px] text-slate-500 font-bold">
          يمكنك تعطيل أو تفعيل قفل البصمة في أي وقت من شاشة الإعدادات.
        </p>
      </div>

      {/* PIN Alternative Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-emerald-500/40 p-6 space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">الدخول برمز مرور العيادة</h3>
              <p className="text-xs text-slate-400">
                أدخل رقم هاتف العيادة المسجل أو رقم النقابة الخاص بك
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="أدخل رمز المرور أو رقم الهاتف..."
                value={enteredPin}
                onChange={(e) => {
                  setEnteredPin(e.target.value);
                  setPinError(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-950 border border-slate-700 text-center font-bold text-base text-white tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
              />

              {pinError && (
                <p className="text-xs text-rose-400 font-bold text-center leading-relaxed">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد والدخول للعيادة</span>
              </button>

              <button
                type="button"
                onClick={handleEmergencyDisable}
                className="w-full py-2 rounded-xl text-[11px] text-slate-400 hover:text-rose-300 font-bold text-center transition-colors block"
              >
                نسيت الرمز؟ اضغط هنا لإلغاء القفل فوراً
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
