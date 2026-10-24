"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PenRX+ Fatal Layout Error]:", error);
  }, [error]);

  const handleRestart = () => {
    if (typeof window !== "undefined") {
      const w = window as any;
      if (w?.penrxDesktop?.restartApp) {
        w.penrxDesktop.restartApp();
      } else {
        window.location.reload();
      }
    }
  };

  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              واجهة PenRX+ بحاجة لإعادة تشغيل
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              حدث خطأ أثناء تحميل الهيكل الرئيسي للبرنامج. تم حفظ بياناتك بأمان.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة المحاولة 🔄</span>
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="w-full p-3 rounded-2xl bg-slate-800 text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة التشغيل</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
