"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check, Terminal } from "lucide-react";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log the error for debugging
    console.error("[PenRX+ Global Error Boundary]:", error);
  }, [error]);

  const handleCopy = () => {
    const errorDetails = `PenRX+ Error: ${error.name}: ${error.message}\nDigest: ${error.digest || "none"}\nStack:\n${error.stack || "no stack"}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleRestart = () => {
    if (typeof window !== "undefined") {
      const w = window as any;
      if (w?.penrxDesktop?.restartApp) {
        w.penrxDesktop.restartApp();
      } else {
        window.location.href = "/";
      }
    }
  };

  const isElectron =
    typeof window !== "undefined" && Boolean((window as any).penrxDesktop?.isElectron);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-rose-500/30 selection:text-rose-200"
    >
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95">
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 p-0.5 mx-auto shadow-xl shadow-rose-950/60 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider">
              واجهة النظام • استثناء غير متوقع
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 pt-1">
              حدث خطأ غير متوقع في واجهة PenRX+
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              تم حماية بياناتك وقاعدة البيانات المحلية بنجاح. يمكنك استئناف العمل فوراً عبر إعادة تحميل الواجهة أو إعادة تشغيل البرنامج.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة 🔄</span>
          </button>

          <button
            type="button"
            onClick={handleReload}
            className="w-full p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 font-bold text-xs sm:text-sm hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث الصفحة بالكامل</span>
          </button>
        </div>

        {isElectron && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleRestart}
              className="text-xs text-slate-400 hover:text-rose-300 transition-colors py-1 px-3 rounded-lg hover:bg-slate-900 font-bold cursor-pointer"
            >
              إعادة تشغيل تطبيق PenRX+ بالكامل ⚡
            </button>
          </div>
        )}

        {/* Technical Details Collapsible */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>{showDetails ? "إخفاء التفاصيل التقنية" : "عرض التفاصيل التقنية للخطأ"}</span>
            </button>

            {showDetails && (
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-emerald-400 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">تم النسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الخطأ</span>
                  </>
                )}
              </button>
            )}
          </div>

          {showDetails && (
            <div
              dir="ltr"
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-44 text-left leading-relaxed animate-in fade-in"
            >
              <p className="font-bold text-rose-400">{error.name || "Error"}: {error.message || "Unknown error"}</p>
              {error.digest && <p className="text-slate-500 text-[10px]">Digest: {error.digest}</p>}
              {error.stack && (
                <pre className="text-slate-400 text-[10px] whitespace-pre-wrap mt-2">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
