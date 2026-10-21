"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Lock, Crown, ArrowRight, ShieldAlert, Sparkles, Copy, Smartphone, Laptop, Building2, RefreshCw } from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { processSyncQueue } from "@/lib/prescriptionSync";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { runDailySilentBackupAndAutoArchival } from "@/lib/backupService";
import { initSubscriptionRealtimeListener } from "@/lib/supabaseRealtime";

export function PaywallGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { subscriptions, machineId, subscriberId, syncWithServer, initHardwareId, signatureToken, lastOnlineCheck } = useSubscriptionStore();
  const { clinic } = useClinicStore();
  const [mounted, setMounted] = useState(false);
  const [isCheckingOnline, setIsCheckingOnline] = useState(false);

  const subDetails = getSubscriptionDetails(subscriptions, machineId, subscriberId, lastOnlineCheck);
  const isHydrated = useSubscriptionStore.persist?.hasHydrated?.() ?? mounted;

  // Track subscription status via ref to avoid re-creating the interval on every render
  const isPendingRef = React.useRef(subDetails.isPending);
  const isActiveRef = React.useRef(subDetails.isActive);
  isPendingRef.current = subDetails.isPending;
  isActiveRef.current = subDetails.isActive;

  // Anti-loop redirect throttle: prevents rapid back-and-forth router.replace calls
  const lastRedirectRef = React.useRef<{ target: string; time: number }>({ target: "", time: 0 });
  const safeRedirect = React.useCallback((target: string) => {
    const now = Date.now();
    if (lastRedirectRef.current.target === target && now - lastRedirectRef.current.time < 3000) {
      return;
    }
    lastRedirectRef.current = { target, time: now };
    router.replace(target);
  }, [router]);

  useEffect(() => {
    setMounted(true);
    // Initialize hardware machine ID (Electron mode)
    initHardwareId().catch(() => {});
    syncWithServer();

    // Initialize Supabase Realtime WebSocket listener for instantaneous (<300ms) sync with admin portal
    const cleanupRealtime = initSubscriptionRealtimeListener();

    // Defer heavy maintenance (smart cache cleaner, sync queue, silent daily backup)
    // by 15 seconds after app startup so the initial screen loads and responds with zero CPU lag
    const deferredTasksTimer = setTimeout(() => {
      try {
        usePrescriptionStore.getState().cleanExpiredCache();
        processSyncQueue();
        runDailySilentBackupAndAutoArchival().catch(() => {});
      } catch {}
    }, 15000);

    // Adaptive background heartbeat sync:
    const interval = setInterval(() => {
      syncWithServer();
    }, 15000); // Check every 15 seconds

    return () => {
      cleanupRealtime();
      clearTimeout(deferredTasksTimer);
      clearInterval(interval);
    };
  }, [syncWithServer, initHardwareId]);

  // Check if mandatory clinic profile is saved (Doctor name, clinic name, phone)
  const isProfileComplete = Boolean(
    clinic.isProfileSaved &&
    clinic.doctorName?.trim() &&
    (clinic.name?.trim() || clinic.nameAr?.trim()) &&
    clinic.phone?.trim()
  );

  // Auto-redirect to /settings if active but profile is not completed yet
  useEffect(() => {
    if (mounted && isHydrated && subDetails.isActive && !isProfileComplete) {
      if (!pathname?.startsWith("/settings") && !pathname?.startsWith("/api")) {
        safeRedirect("/settings");
      }
    }
  }, [mounted, isHydrated, subDetails.isActive, isProfileComplete, pathname, safeRedirect]);

  // Auto-redirect new or unactivated/revoked users directly to /subscriptions (Protective Wall)
  useEffect(() => {
    if (mounted && isHydrated && !subDetails.isActive && !subDetails.isOfflineGraceExpired) {
      if (!pathname?.startsWith("/subscriptions") && !pathname?.startsWith("/api")) {
        safeRedirect("/subscriptions");
      }
    }
  }, [mounted, isHydrated, subDetails.isActive, subDetails.isOfflineGraceExpired, pathname, safeRedirect]);

  // Allow API routes freely
  if (pathname?.startsWith("/api")) {
    return <>{children}</>;
  }

  // If not mounted yet or store hasn't hydrated from localStorage, render children to prevent layout shifts/flicker
  if (!mounted || !isHydrated) {
    return <>{children}</>;
  }

  // 0. BLOCKING SCREEN: Clock Tampering Detected (Anti-Rollback Defense)
  if ((subDetails as any).isClockTampered) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900/95 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2.5">
            <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-black">
              أمان النظام • تحذير تلاعب بالساعة ⏳
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              توقيت الجهاز غير متطابق مع الخادم
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {(subDetails as any).tamperReason ||
                "تم رصد تراجع في تاريخ أو وقت جهازك مقارنة بآخر توقيت موثق لدى السيرفر. يرجى تفعيل (التوقيت التلقائي من الشبكة / Automatic Time) في إعدادات جهازك والمزامنة للتمكن من المتابعة."}
            </p>
          </div>

          <button
            onClick={async () => {
              setIsCheckingOnline(true);
              try {
                await syncWithServer();
              } finally {
                setIsCheckingOnline(false);
              }
            }}
            disabled={isCheckingOnline}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-rose-600 hover:brightness-110 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingOnline ? "animate-spin" : ""}`} />
            <span>{isCheckingOnline ? "جارٍ التحقق من السيرفر..." : "🔄 إعادة الفحص والمزامنة الآن"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 1. BLOCKING SCREEN: 3-Day Offline Grace Limit Exceeded (Strict Anti-Tamper & Security)
  if (subDetails.isOfflineGraceExpired) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2.5">
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-black">
              تنبيه الأمان والترخيص • حماية العيادة 🛡️
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              انتهت فترة السماح بالعمل دون إنترنت (3 أيام)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              يعمل نظام PenRX+ بمرونة تامة دون إنترنت لمدة تصل إلى 3 أيام متواصلة كحد أقصى لحماية بيانات عيادتك. لتأكيد استمرار ترخيصك ومزامنة الحساب، يرجى توصيل الجهاز بشبكة الإنترنت والضغط على زر التحقق أدناه.
            </p>
          </div>

          <button
            onClick={async () => {
              setIsCheckingOnline(true);
              try {
                await syncWithServer();
              } finally {
                setIsCheckingOnline(false);
              }
            }}
            disabled={isCheckingOnline}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:brightness-110 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingOnline ? "animate-spin" : ""}`} />
            <span>{isCheckingOnline ? "جارٍ التحقق من السيرفر..." : "🔄 فحص الاتصال وتحديث الترخيص الآن"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. If subscription is ACTIVE
  if (subDetails.isActive) {
    // MANDATORY PROFILE ENFORCEMENT: User CANNOT use any part of the app until doctorName, clinicName, and phone are saved!
    if (!isProfileComplete) {
      // If currently on /settings, allow them to view and complete the profile form
      if (pathname?.startsWith("/settings")) {
        return <>{children}</>;
      }

      // If on any other page, block and direct to /settings
      return (
        <div className="min-h-[75vh] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900/95 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Building2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-black">
                تم تفعيل الاشتراك بنجاح 👑 — خطوة أولى إلزامية
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                إكمال بيانات الطبيب والعيادة
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                مرحباً بك! لا يمكن الانتقال لباقي البرنامج أو كتابة الروشتات إلا بعد استكمال وحفظ بيانات الطبيب واسم العيادة ورقم الهاتف لمزامنتها مع البورتال واعتماد نسختك.
              </p>
            </div>

            <Link
              href="/settings"
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>الذهاب لضبط وتأكيد بيانات العيادة الآن 🏥</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  }

  // 3. Allow access to subscriptions page only when subscription is NOT active (so they can subscribe)
  if (pathname?.startsWith("/subscriptions")) {
    return <>{children}</>;
  }

  // When inactive and attempting to access any other page, return null while router.replace("/subscriptions") executes
  return null;
}
