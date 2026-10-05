"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";

/**
 * AppHydrationSplash – Modern Micro-Splash & Hydration Guard.
 *
 * Eliminates "rehydration flicker" (e.g. flashing default clinic name or "اشترك الآن")
 * by holding a beautiful, high-speed brand transition until Zustand finishes reading
 * localStorage.
 *
 * Zero performance loss: Unlocks the exact millisecond stores are hydrated (~80-150ms).
 * Never triggers on normal in-app client navigation, only on hard reload / first load.
 */
export function AppHydrationSplash({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [shouldRenderSplash, setShouldRenderSplash] = useState(true);

  useEffect(() => {
    // Fast path: check if stores are already hydrated
    const checkAllHydrated = () => {
      const subHydrated = useSubscriptionStore.persist?.hasHydrated?.() ?? true;
      const clinicHydrated = useClinicStore.persist?.hasHydrated?.() ?? true;
      const rxHydrated = usePrescriptionStore.persist?.hasHydrated?.() ?? true;
      return subHydrated && clinicHydrated && rxHydrated;
    };

    if (checkAllHydrated()) {
      setIsReady(true);
      // Fade out splash gracefully
      const fadeTimer = setTimeout(() => setShouldRenderSplash(false), 200);
      return () => clearTimeout(fadeTimer);
    }

    // Subscribe to hydration completion
    const markReadyIfDone = () => {
      if (checkAllHydrated()) {
        setIsReady(true);
        setTimeout(() => setShouldRenderSplash(false), 200);
      }
    };

    const unsubSub = useSubscriptionStore.persist?.onFinishHydration?.(markReadyIfDone);
    const unsubClinic = useClinicStore.persist?.onFinishHydration?.(markReadyIfDone);
    const unsubRx = usePrescriptionStore.persist?.onFinishHydration?.(markReadyIfDone);

    // Safety timeout: Maximum 220ms so user is never blocked even if an issue occurs
    const safetyTimer = setTimeout(() => {
      setIsReady(true);
      setTimeout(() => setShouldRenderSplash(false), 200);
    }, 220);

    return () => {
      unsubSub?.();
      unsubClinic?.();
      unsubRx?.();
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <>
      {/* Real app content (mounted in background ready to display) */}
      <div
        className={`transition-opacity duration-300 ease-out ${
          isReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>

      {/* Modern High-Speed Micro-Splash Screen */}
      {shouldRenderSplash && (
        <div
          dir="rtl"
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-slate-100 transition-all duration-300 ease-out ${
            isReady ? "opacity-0 pointer-events-none scale-105" : "opacity-100 pointer-events-auto scale-100"
          }`}
          style={{ willChange: "opacity, transform" }}
        >
          {/* Ambient Glowing Aura */}
          <div className="absolute w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none delay-300 animate-pulse" />

          {/* Logo & Brand Identity */}
          <div className="relative z-10 flex flex-col items-center space-y-4">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/60 p-0.5 bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500">
              <div className="relative w-full h-full rounded-[22px] overflow-hidden">
                <Image
                  src="/logo-penrx.jpg"
                  alt="PenRX+"
                  fill
                  priority
                  sizes="96px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1">
                <span
                  dir="ltr"
                  className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent tracking-tight inline-flex items-center"
                >
                  PenRX<span className="text-emerald-400 font-black">+</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  PRO
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400">
                منظومة إدارة الروشتات والعيادات الطبية الذكية
              </p>
            </div>

            {/* High-Tech Ultra-Fast Loading Indicator */}
            <div className="w-48 sm:w-56 space-y-2 pt-2">
              <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full w-2/3 animate-[shimmer_1.2s_infinite_linear]"
                  style={{
                    backgroundSize: "200% 100%",
                    animation: "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/80 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>جاري تحميل بيانات العيادة والترخيص...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
