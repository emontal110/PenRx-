"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, ArrowUpRight, Sparkles, X, Bell, BellRing, ShieldCheck } from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";

export function SubscriptionExpiryBanner() {
  const pathname = usePathname();
  const { subscriptions, machineId } = useSubscriptionStore();
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if dismissed during this session
    try {
      const dismissed = sessionStorage.getItem("penrx_expiry_banner_dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {}
  }, []);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);

  // Trigger HTML5 Desktop Notification once per day when daysRemaining <= 7
  useEffect(() => {
    if (!mounted || !subDetails.isActive) return;

    const days = subDetails.daysRemaining;
    if (days > 7) return;

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastNotified = localStorage.getItem("penrx_last_expiry_notification_date");

      if (lastNotified !== todayStr && typeof window !== "undefined" && "Notification" in window) {
        const sendDesktopNotification = () => {
          const title = days <= 3 ? "🚨 تنبيه عاجل: اقتراب انتهاء اشتراك PenRX+" : "⏳ تذكير تجديد اشتراك PenRX+";
          const body =
            days <= 1
              ? "متبقي يوم واحد فقط على انتهاء اشتراكك في PenRX+! اضغط هنا لتجديد الاشتراك فوراً."
              : `متبقي ${days} أيام على انتهاء اشتراكك في PenRX+. نوصي بالتجديد المبكر لضمان استمرار الخدمة.`;

          const notif = new Notification(title, {
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "penrx-subscription-expiry",
          });

          notif.onclick = () => {
            window.focus();
            window.location.href = "/subscriptions";
          };

          localStorage.setItem("penrx_last_expiry_notification_date", todayStr);
        };

        if (Notification.permission === "granted") {
          sendDesktopNotification();
        } else if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              sendDesktopNotification();
            }
          });
        }
      }
    } catch (err) {
      console.warn("[SubscriptionExpiryBanner] Notification trigger error:", err);
    }
  }, [mounted, subDetails.isActive, subDetails.daysRemaining]);

  if (!mounted) return null;

  // Don't show banner if on the subscriptions page itself
  if (pathname === "/subscriptions") return null;

  // Only show when active and remaining days <= 7
  if (!subDetails.isActive || subDetails.daysRemaining > 7) {
    return null;
  }

  const days = subDetails.daysRemaining;
  const isUrgent = days <= 3;
  const expiresAt = subDetails.record?.expiresAt;
  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("penrx_expiry_banner_dismissed", "true");
    } catch {}
  };

  const handleReopen = () => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem("penrx_expiry_banner_dismissed");
    } catch {}
  };

  // If dismissed, show a non-intrusive floating beacon in bottom left
  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={handleReopen}
        className={`fixed bottom-4 left-4 z-40 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black border transition-all cursor-pointer animate-in fade-in zoom-in-95 active:scale-95 ${
          isUrgent
            ? "bg-rose-950/95 text-rose-200 border-rose-500/60 shadow-rose-950/60 ring-2 ring-rose-500/40 animate-pulse"
            : "bg-amber-950/95 text-amber-200 border-amber-500/50 shadow-amber-950/50"
        }`}
        title="اضغط لعرض إشعار تجديد الاشتراك"
      >
        <BellRing className={`w-3.5 h-3.5 ${isUrgent ? "text-rose-400 animate-bounce" : "text-amber-400"}`} />
        <span>تجديد الاشتراك (متبقي {days} {days === 1 ? "يوم" : "أيام"})</span>
      </button>
    );
  }

  return (
    <div
      dir="rtl"
      className={`relative z-30 mb-4 rounded-2xl border shadow-2xl overflow-hidden transition-all animate-in slide-in-from-top-3 duration-300 ${
        isUrgent
          ? "bg-gradient-to-r from-rose-950/95 via-slate-950 to-rose-950/95 border-rose-500/60 shadow-rose-950/50 ring-1 ring-rose-500/30"
          : "bg-gradient-to-r from-amber-950/90 via-slate-950 to-amber-950/90 border-amber-500/50 shadow-amber-950/40"
      }`}
    >
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Icon & Alert Message */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-md ${
              isUrgent
                ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
            }`}
          >
            {isUrgent ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-black text-sm sm:text-base ${
                  isUrgent ? "text-rose-100" : "text-amber-100"
                }`}
              >
                {isUrgent
                  ? `🚨 تنبيه عاجل: متبقي فقط ${days} ${days === 1 ? "يوم واحد" : "أيام"} على انتهاء اشتراك PenRX+!`
                  : `⏳ إشعار تجديد الاشتراك: متبقي ${days} أيام على انتهاء اشتراك العيادة`}
              </span>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                  isUrgent
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-ping"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}
              >
                {isUrgent ? "تحذير انتهاء حرج" : "تجديد مبكر"}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium">
              {isUrgent
                ? "يرجى تجديد الاشتراك فوراً لضمان استمرار عمل بنك الأدوية والروشتات السحابية والذكاء الاصطناعي دون انقطاع."
                : `ينتهي الاشتراك بتاريخ ${formattedExpiry}. نوصي بالتجديد المبكر لضمان استمرارية منظومة العيادة.`}
            </p>
          </div>
        </div>

        {/* Right: Action Button & Dismiss */}
        <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
          <Link
            href="/subscriptions"
            className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
              isUrgent
                ? "bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-rose-950/60 ring-2 ring-rose-400/40"
                : "bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-amber-950/50"
            }`}
          >
            <span>تجديد الاشتراك الآن 💳</span>
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer text-xs"
            title="إخفاء مؤقت للجلسة الحالية"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
