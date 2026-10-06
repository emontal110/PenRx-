"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Lock, Crown, ArrowRight, ShieldAlert, Sparkles, Copy, Smartphone, Laptop, Building2 } from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { processSyncQueue } from "@/lib/prescriptionSync";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { runDailySilentBackupAndAutoArchival } from "@/lib/backupService";

export function PaywallGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { subscriptions, machineId, subscriberId, syncWithServer, initHardwareId, signatureToken, lastOnlineCheck } = useSubscriptionStore();
  const { clinic } = useClinicStore();
  const [mounted, setMounted] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize hardware machine ID (Electron mode)
    initHardwareId().catch(() => {});
    syncWithServer();

    // Auto-run smart cache cleaner, offline sync queue, and silent daily backup & auto-archiving
    try {
      usePrescriptionStore.getState().cleanExpiredCache();
      processSyncQueue();
      runDailySilentBackupAndAutoArchival().catch(() => {});
    } catch {}

    const interval = setInterval(syncWithServer, 2500); // 2.5s fast polling for instant unlock
    return () => clearInterval(interval);
  }, [syncWithServer, initHardwareId]);

  // Check if mandatory clinic profile is saved (Doctor name, clinic name, phone)
  const isProfileComplete = Boolean(
    clinic.isProfileSaved &&
    clinic.doctorName?.trim() &&
    (clinic.name?.trim() || clinic.nameAr?.trim()) &&
    clinic.phone?.trim()
  );

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const isHydrated = useSubscriptionStore.persist?.hasHydrated?.() ?? mounted;

  // Auto-redirect to /settings if active but profile is not completed yet
  useEffect(() => {
    if (mounted && isHydrated && subDetails.isActive && !isProfileComplete) {
      if (!pathname?.startsWith("/settings") && !pathname?.startsWith("/api")) {
        router.replace("/settings");
      }
    }
  }, [mounted, isHydrated, subDetails.isActive, isProfileComplete, pathname, router]);

  // Auto-redirect new unactivated users directly to /subscriptions (Protective Wall)
  useEffect(() => {
    if (mounted && isHydrated && !subDetails.isActive) {
      if (!pathname?.startsWith("/subscriptions") && !pathname?.startsWith("/api")) {
        router.replace("/subscriptions");
      }
    }
  }, [mounted, isHydrated, subDetails.isActive, pathname, router]);

  // --- ANTI-TAMPER: Detect and flag excessive offline usage (Classico-style 7-day limit) ---
  useEffect(() => {
    if (!mounted) return;
    if (lastOnlineCheck && signatureToken) {
      const diffMs = Date.now() - lastOnlineCheck;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        setOfflineMode(true);
      } else {
        setOfflineMode(false);
      }
    }
  }, [mounted, lastOnlineCheck, signatureToken]);

  // Allow API routes freely
  if (pathname?.startsWith("/api")) {
    return <>{children}</>;
  }

  // If not mounted yet or store hasn't hydrated from localStorage, render children to prevent layout shifts/flicker
  if (!mounted || !isHydrated) {
    return <>{children}</>;
  }

  // If subscription is ACTIVE
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

    // Also block if offline limit exceeded (7 days without internet check)
    if (offlineMode) {
      return (
        <>
          {children}
          <div className="fixed bottom-4 right-4 z-50 max-w-xs p-4 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-xs text-amber-300 font-bold shadow-2xl backdrop-blur-xl">
            <span>⚠️ تنبيه: مضى أكثر من 7 أيام دون اتصال بالإنترنت. يرجى الاتصال لتحديث حالة الاشتراك.</span>
          </div>
        </>
      );
    }

    return <>{children}</>;
  }

  // Allow access to subscriptions page only when subscription is NOT yet active (so they can subscribe)
  if (pathname?.startsWith("/subscriptions")) {
    return <>{children}</>;
  }

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Otherwise, display clean paywall protection screen
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900/95 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-0.5 mx-auto shadow-xl shadow-emerald-950/50 flex items-center justify-center">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
            <Lock className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{subDetails.isPending ? "طلبك قيد المراجعة الإدارية والتفعيل ⏳" : "مطلوب تفعيل الترخيص للبدء"}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-100">
            منظومة PenRX+ الطبية الذكية
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            {subDetails.isPending
              ? "تم استلام طلب اشتراكك بنجاح وجاري مراجعته وتفعيله من الإدارة. سيتم فتح البرنامج تلقائياً فور موافقة الإدارة."
              : "للبدء في كتابة الروشتات، يرجى تفعيل اشتراك جديد أو إرسال معرّف هذا الجهاز للإدارة لتفعيله على اشتراكك القائم."}
          </p>
        </div>

        {/* Machine ID Banner */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-right">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span>معرّف هذا الجهاز (Machine ID):</span>
            </span>
            {copySuccess && (
              <span className="text-[11px] font-black text-emerald-400">✓ تم النسخ!</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider truncate" dir="ltr">
              {machineId}
            </span>
            <button
              type="button"
              onClick={handleCopyMachineId}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>نسخ</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            أرسل هذا المعرّف للإدارة لتفعيل هذا الجهاز أو لربطه باشتراكك القائم.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/subscriptions"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/50 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>{subDetails.isPending ? "متابعة حالة انتظار التفعيل ⏳" : "عرض باقات الاشتراك وتفعيل الجهاز 🚀"}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
