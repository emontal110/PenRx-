"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Crown, ArrowRight, ShieldAlert, Sparkles, Copy, Smartphone, Laptop } from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";

export function PaywallGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { subscriptions, machineId, subscriberId, syncWithServer } = useSubscriptionStore();
  const [mounted, setMounted] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    syncWithServer();
    const interval = setInterval(syncWithServer, 2500); // 2.5s fast polling for instant unlock
    return () => clearInterval(interval);
  }, [syncWithServer]);

  // Allow unrestricted access to subscriptions page or public api
  if (
    pathname?.startsWith("/subscriptions") ||
    pathname?.startsWith("/api")
  ) {
    return <>{children}</>;
  }

  const subDetails = getSubscriptionDetails(subscriptions, machineId);

  // If not mounted yet (SSR hydration), render children to prevent layout shifts
  if (!mounted) {
    return <>{children}</>;
  }

  // If subscription is ACTIVE and not expired, allow full access
  if (subDetails.isActive) {
    return <>{children}</>;
  }

  const handleCopyCodes = () => {
    const text = `معرّف المشترك: ${subDetails.subscriberId || subscriberId}\nمعرّف الجهاز الجديد: ${machineId}`;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Otherwise, display clean paywall protection screen
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900/95 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl text-center relative overflow-hidden">
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
            <span>{subDetails.isPending ? "الطلب قيد المراجعة الإدارية" : "مطلوب تفعيل الترخيص للبدء"}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
            مرحباً بك في منظومة PenRX+ الطبية
          </h2>

          <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            {subDetails.isPending
              ? "تم إرسال طلب اشتراكك بنجاح وجاري مراجعته وتفعيله من الإدارة. يرجى إرسال إيصال التحويل عبر الواتساب لتسريع التفعيل."
              : "للبدء في استخدام محرك كتابة الروشتات، يرجى اختيار باقة الاشتراك أو ربط هذا الجهاز بحساب اشتراكك الحالي."}
          </p>
        </div>

        {/* Dual ID Banner: Subscriber ID & Device Machine ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-right">
          {/* Subscriber ID */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-1">
            <span className="text-purple-300 font-bold block text-[11px]">معرّف المشترك (Subscriber ID):</span>
            <span className="font-mono font-black text-purple-400 text-sm tracking-wider block" dir="ltr">
              {subDetails.subscriberId || subscriberId}
            </span>
          </div>

          {/* Machine ID */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold block text-[11px]">معرّف هذا الجهاز (Machine ID):</span>
            <span className="font-mono font-black text-emerald-400 text-xs tracking-wider block truncate" dir="ltr">
              {machineId}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCopyCodes}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copySuccess ? "✓ تم نسخ الأكواد!" : "نسخ بيانات الاشتراك للجهاز"}</span>
          </button>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/subscriptions"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/50 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>عرض الباقات وتفعيل أو ربط الأجهزة 🚀</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
