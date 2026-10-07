"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  FileText,
  Clock,
  Building2,
  Settings,
  Crown,
  Home,
  Plus,
  Sparkles,
  RotateCw,
} from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { showGlobalToast } from "@/components/common/GlobalToast";
import packageInfo from "../../../package.json";

export function Navbar() {
  const pathname = usePathname();
  const { subscriptions, machineId, syncWithServer } = useSubscriptionStore();
  const { clinic } = useClinicStore();
  const [mounted, setMounted] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    setMounted(true);
    syncWithServer();
  }, [syncWithServer]);

  const handlePageReload = () => {
    setIsReloading(true);
    try {
      syncWithServer();
    } catch {}
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const isTrialAccount = Boolean(
    subDetails.record?.isTrial === true ||
    subDetails.record?.planId === "trial" ||
    subDetails.record?.planName?.includes("تجريب")
  );

  // Expiry notification when entering/logging in the app
  useEffect(() => {
    if (!mounted || !subDetails.isActive) return;

    try {
      const warned = sessionStorage.getItem("penrx_session_expiry_warned");
      if (warned) return;

      const days = subDetails.daysRemaining;
      if (days <= 3) {
        showGlobalToast(
          `🚨 تنبيه عاجل: متبقي فقط ${days} ${days === 1 ? "يوم واحد" : "أيام"} على انتهاء اشتراكك في PenRX+! يرجى التجديد لضمان استمرار الخدمة.`,
          "error"
        );
        sessionStorage.setItem("penrx_session_expiry_warned", "true");
      } else if (days <= 7) {
        showGlobalToast(
          `⏳ تنبيه: متبقي ${days} أيام على انتهاء صلاحية اشتراكك في PenRX+. نوصي بتجديد الاشتراك مبكراً.`,
          "info"
        );
        sessionStorage.setItem("penrx_session_expiry_warned", "true");
      }
    } catch {
      // ignore storage error if any
    }
  }, [mounted, subDetails.isActive, subDetails.daysRemaining]);

  // Desktop navigation items (الصفحة الرئيسية بجانب زر روشتة)
  const DESKTOP_LINKS = [
    { href: "/", label: "الصفحة الرئيسية", icon: Home },
    { href: "/prescriptions/new", label: "روشتة", icon: Plus, highlight: true },
    { href: "/history", label: "سجل الروشتات", icon: Clock },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  // Mobile bottom dock items for thumb ergonomics
  const MOBILE_DOCK = [
    { href: "/", label: "الرئيسية", icon: Home },
    { href: "/history", label: "السجل", icon: Clock },
    { href: "/prescriptions/new", label: "روشتة", icon: Plus, isAction: true },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <>
      {/* ===== TOP DESKTOP & MOBILE HEADER ===== */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-b border-slate-800/80 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Right: Brand & Clinic */}
            <div className="flex items-center gap-3 shrink-0">
              {/* 1. الشعار على اليمين */}
              <Link href="/" className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl overflow-hidden border border-emerald-500/40 shadow-md shadow-emerald-950/40 hover:border-emerald-400 hover:scale-105 transition-all shrink-0">
                <Image
                  src="/logo-penrx.jpg"
                  alt="PenRX+"
                  fill
                  priority
                  sizes="40px"
                  className="object-cover"
                />
              </Link>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  {/* 2. يليه مباشرة شارة PRO 👑 أو TRIAL 🎁 (رابط مباشر لصفحة الاشتراكات) */}
                  {mounted && subDetails.isActive && (
                    isTrialAccount ? (
                      <Link
                        href="/subscriptions"
                        className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-black border border-cyan-500/35 shadow-sm shadow-cyan-950/30 shrink-0 cursor-pointer transition-all hover:scale-105"
                        title="باقة تجريبية - اضغط لإدارة الاشتراك والباقات"
                      >
                        TRIAL 🎁
                      </Link>
                    ) : (
                      <Link
                        href="/subscriptions"
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border shadow-sm shrink-0 cursor-pointer transition-all hover:scale-105 ${
                          subDetails.daysRemaining <= 3
                            ? "bg-rose-500/25 hover:bg-rose-500/35 text-rose-300 border-rose-500/50 shadow-rose-950/30 animate-pulse"
                            : subDetails.daysRemaining <= 7
                            ? "bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border-amber-500/50 shadow-amber-950/30"
                            : "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border-orange-500/40 shadow-orange-950/30"
                        }`}
                        title={
                          subDetails.daysRemaining <= 7
                            ? `تنبيه: متبقي ${subDetails.daysRemaining} أيام - اضغط للتجديد`
                            : "باقة PRO نشطة - اضغط لإدارة الاشتراك"
                        }
                      >
                        {subDetails.daysRemaining <= 3
                          ? `PRO ⚠️ (${subDetails.daysRemaining}ي)`
                          : subDetails.daysRemaining <= 7
                          ? `PRO ⏳ (${subDetails.daysRemaining}ي)`
                          : "PRO 👑"}
                      </Link>
                    )
                  )}

                  {/* 3. اسم التطبيق PenRX مع + بعد حرف X */}
                  <Link href="/" className="group inline-flex items-center">
                    <span dir="ltr" className="text-lg sm:text-xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent tracking-tight inline-flex items-center">
                      PenRX<span className="text-emerald-400 font-black">+</span>
                    </span>
                  </Link>

                  {/* 4. الفيرجن مرتبط بملف الباكدج */}
                  <span dir="ltr" className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-slate-900 text-slate-400 text-[10px] font-mono font-bold border border-slate-800 shrink-0">
                    v{packageInfo.version}
                  </span>
                </div>
                <Link href="/" className="text-[11px] font-bold text-slate-400 -mt-0.5 truncate max-w-[140px] sm:max-w-[220px] hover:text-slate-200 transition-colors">
                  {mounted ? (clinic.nameAr || clinic.name || "العيادة") : ""}
                </Link>
              </div>
            </div>

            {/* Center: Desktop Navigation Pills (Clean & Elegant) */}
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
              {DESKTOP_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                if (link.highlight) {
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-950/40 hover:brightness-110 active:scale-95"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                      <span>{link.label}</span>
                    </Link>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      isActive
                        ? "bg-slate-800 text-emerald-300 border border-emerald-500/30 shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Left: Subscription Status Pill & Ultra-Modern Quick Reload Button */}
            <div className="flex items-center gap-2">
              <Link
                href="/subscriptions"
                suppressHydrationWarning
                className="px-3 sm:px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all hover:scale-105 shadow-md shadow-orange-950/50 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/15 border-orange-500/50 hover:border-orange-400 text-orange-300 hover:text-orange-100 cursor-pointer"
                title="إدارة الباقة والاشتراك والدفع"
              >
                <Crown className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                <span suppressHydrationWarning className="font-black">
                  {!mounted ? (
                    <span className="inline-block w-16 h-3 bg-orange-500/20 rounded animate-pulse" />
                  ) : subDetails.isActive ? (
                    `نشط (${subDetails.daysRemaining} يوم)`
                  ) : subDetails.isPending ? (
                    "قيد المراجعة ⏳"
                  ) : (
                    "اشترك الآن ⚡"
                  )}
                </span>
              </Link>

              {/* Ultra-Modern Quick Reload Button */}
              <button
                type="button"
                onClick={handlePageReload}
                disabled={isReloading}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-md active:scale-90 cursor-pointer flex items-center justify-center shrink-0 group"
                title="تحديث وإعادة تحميل الصفحة والبيانات"
              >
                <RotateCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:rotate-180 transition-transform duration-300 ${isReloading ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MOBILE BOTTOM DOCK (Clean, Ergonomic & Modern) ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-3 py-2 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {MOBILE_DOCK.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isAction) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="-mt-5 p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-xl shadow-emerald-950/60 border-2 border-slate-950 active:scale-95 transition-transform flex flex-col items-center justify-center"
                >
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
                  isActive
                    ? "text-emerald-400 font-black"
                    : "text-slate-400 hover:text-slate-200 font-semibold"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-400 stroke-[2.5]" : "text-slate-400"}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
