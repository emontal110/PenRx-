"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Download,
  Laptop,
  Smartphone,
  X,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  releaseNotes?: string;
  desktopDownloadUrl?: string;
  androidDownloadUrl?: string;
}

export function AutoUpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    async function checkForUpdates() {
      try {
        const res = await fetch("/api/version/check", { cache: "no-store" });
        if (!res.ok) return;
        const data: UpdateInfo = await res.json();

        if (data.hasUpdate) {
          const dismissedVersion = localStorage.getItem("penrx_dismissed_update_version");
          if (dismissedVersion !== data.latestVersion) {
            setUpdateInfo(data);
            setIsOpen(true);
          }
        }
      } catch (err) {
        // Silent catch in offline mode
      }
    }

    // Check after 2 seconds on app startup
    const timer = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient || !isOpen || !updateInfo) {
    return null;
  }

  const handleDismiss = () => {
    if (updateInfo?.latestVersion) {
      localStorage.setItem("penrx_dismissed_update_version", updateInfo.latestVersion);
    }
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
        {/* Glow ambient background effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-5 left-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="تذكيري لاحقاً"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Pulsing Icon */}
        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 mx-auto shadow-xl shadow-emerald-950/60 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
              NEW RELEASE AVAILABLE 🚀
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              تحديث جديد متوفر لمنظومة PenRX+
            </h2>
            <p className="text-xs text-slate-400">
              تم إطلاق إصدار جديد يتضمن تحسينات ومميزات دوائية وتقنية متقدمة
            </p>
          </div>
        </div>

        {/* Version Comparison Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <div className="space-y-0.5 text-right">
            <span className="text-[10px] text-slate-500 font-bold block">إصدارك الحالي:</span>
            <span className="font-mono font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block">
              v{updateInfo.currentVersion}
            </span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400 font-bold">
            <ArrowRight className="w-5 h-5 rotate-180 animate-pulse" />
          </div>

          <div className="space-y-0.5 text-left">
            <span className="text-[10px] text-emerald-400 font-bold block">الإصدار الأحدث:</span>
            <span className="font-mono font-black text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-lg border border-emerald-500/40 inline-block shadow-sm">
              v{updateInfo.latestVersion}
            </span>
          </div>
        </div>

        {/* Release Notes */}
        {updateInfo.releaseNotes && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>أبرز ما يقدمه هذا التحديث:</span>
            </span>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line text-[11px] font-medium">
              {updateInfo.releaseNotes}
            </p>
          </div>
        )}

        {/* Direct Download Buttons */}
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Windows Desktop Installer */}
            {updateInfo.desktopDownloadUrl && (
              <a
                href={updateInfo.desktopDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Laptop className="w-4 h-4" />
                <span>تحديث الكمبيوتر (Windows .exe) 💻</span>
              </a>
            )}

            {/* Android APK */}
            {updateInfo.androidDownloadUrl && (
              <a
                href={updateInfo.androidDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>تحديث الهاتف (Android APK) 📱</span>
              </a>
            )}
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 font-bold"
            >
              تذكيري لاحقاً ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
