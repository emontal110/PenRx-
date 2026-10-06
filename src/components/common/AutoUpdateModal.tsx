"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Loader2,
  Check,
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

  // Download & Progress State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "completed" | "error">("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Platform Detection
  const [platform, setPlatform] = useState<"desktop" | "mobile">("desktop");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsClient(true);

    // Detect device platform
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (/android|iphone|ipad|ipod|mobile/i.test(ua)) {
        setPlatform("mobile");
      } else {
        setPlatform("desktop");
      }
    }

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
      } catch {
        // Silent catch in offline mode
      }
    }

    // Check after 2.5 seconds on app startup
    const timer = setTimeout(checkForUpdates, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient || !isOpen || !updateInfo) {
    return null;
  }

  const handleDismiss = () => {
    if (isDownloading) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
    if (updateInfo?.latestVersion) {
      localStorage.setItem("penrx_dismissed_update_version", updateInfo.latestVersion);
    }
    setIsOpen(false);
  };

  const startAutoUpdate = async (selectedType?: "desktop" | "mobile") => {
    const targetType = selectedType || platform;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedMB(0);
    setTotalMB(0);
    setDownloadStatus("downloading");
    setDownloadError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/version/download?type=${targetType}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`تعذر بدء التحميل من السيرفر (${response.status})`);
      }

      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      if (totalBytes > 0) {
        setTotalMB(parseFloat((totalBytes / (1024 * 1024)).toFixed(1)));
      }

      if (!response.body) {
        throw new Error("استجابة السيرفر لا تحتوي على دفق بيانات");
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes > 0) {
          const percent = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99);
          setDownloadProgress(percent);
          setDownloadedMB(parseFloat((receivedBytes / (1024 * 1024)).toFixed(1)));
        } else {
          // Fake smooth progress when total size header isn't passed by upstream
          setDownloadedMB(parseFloat((receivedBytes / (1024 * 1024)).toFixed(1)));
          setDownloadProgress((prev) => Math.min(prev + 5, 95));
        }
      }

      // Finish download
      setDownloadProgress(100);
      setDownloadStatus("completed");

      const mimeType =
        targetType === "mobile"
          ? "application/vnd.android.package-archive"
          : "application/octet-stream";
      const blob = new Blob(chunks, { type: mimeType });
      const blobUrl = window.URL.createObjectURL(blob);

      const fileName = targetType === "mobile" ? "PenRX+.apk" : "PenRX+-Setup.exe";

      // Trigger automatic file download / open in browser / OS
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Clean up blob URL after 60s
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setDownloadStatus("idle");
        setIsDownloading(false);
        return;
      }
      console.error("Update download error:", err);
      setDownloadStatus("error");
      setDownloadError(err.message || "حدث خطأ أثناء تحميل التحديث");
    }
  };

  const directFallbackUrl =
    platform === "mobile"
      ? updateInfo.androidDownloadUrl || "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+.apk"
      : updateInfo.desktopDownloadUrl || "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95">
        {/* Glow ambient background effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        {!isDownloading && (
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-5 left-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title="تذكيري لاحقاً"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header with Pulsing Icon */}
        <div className="text-center space-y-3">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 mx-auto shadow-xl shadow-emerald-950/60 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              {downloadStatus === "completed" ? (
                <Check className="w-8 h-8 text-emerald-400 animate-bounce" />
              ) : downloadStatus === "downloading" ? (
                <Download className="w-8 h-8 text-emerald-400 animate-bounce" />
              ) : (
                <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
              {downloadStatus === "completed"
                ? "UPDATE READY TO INSTALL 🎉"
                : downloadStatus === "downloading"
                ? "DOWNLOADING UPDATE ⏳"
                : "NEW RELEASE AVAILABLE 🚀"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              {downloadStatus === "completed"
                ? "تم تحميل التحديث بنجاح!"
                : downloadStatus === "downloading"
                ? "جارٍ تحميل التحديث الجديد..."
                : "تحديث جديد متوفر لمنظومة PenRX+"}
            </h2>
            <p className="text-xs text-slate-400">
              {downloadStatus === "completed"
                ? "تم تنزيل الملف، قم بفتحه لاستكمال التثبيت بضغطة زر دون فقدان أي بيانات"
                : downloadStatus === "downloading"
                ? "يرجى الانتظار حتى اكتمال التنزيل التلقائي لملف التحديث"
                : "تم إطلاق إصدار جديد يتضمن تحسينات ومميزات دوائية وتقنية متقدمة"}
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

        {/* PROGRESS BAR SECTION (When downloading or completed) */}
        {isDownloading && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-400 flex items-center gap-2">
                {downloadStatus === "downloading" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  {downloadStatus === "completed"
                    ? "اكتمل التنزيل 100%"
                    : `جارٍ التنزيل... (${downloadProgress}%)`}
                </span>
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {downloadedMB > 0 && totalMB > 0
                  ? `${downloadedMB} MB / ${totalMB} MB`
                  : downloadedMB > 0
                  ? `${downloadedMB} MB`
                  : "جارٍ الاتصال..."}
              </span>
            </div>

            {/* Glowing Smooth Progress Bar */}
            <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-emerald-500/50 relative overflow-hidden"
                style={{ width: `${downloadProgress}%` }}
              >
                {/* Subtle shimmer animation overlay */}
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {downloadStatus === "completed" && (
              <p className="text-[11px] text-emerald-300 font-bold text-center pt-1 animate-in fade-in">
                ✨ تم حفظ ملف التحديث ({platform === "mobile" ? "PenRX+.apk" : "PenRX+-Setup.exe"}) وسيبدأ التثبيت تلقائياً!
              </p>
            )}
          </div>
        )}

        {/* Error notification if any */}
        {downloadStatus === "error" && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 text-xs text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{downloadError || "تعذر إكمال التنزيل التلقائي"}</span>
            </div>
            <p className="text-[11px] text-rose-300/80">
              يمكنك التنزيل مباشرة عبر الرابط السحابي المباشر أدناه:
            </p>
            <a
              href={directFallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-slate-950 font-black text-[11px] hover:bg-rose-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>تنزيل التحديث المباشر من GitHub</span>
            </a>
          </div>
        )}

        {/* Release Notes */}
        {!isDownloading && updateInfo.releaseNotes && (
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

        {/* ACTION BUTTONS */}
        <div className="space-y-3 pt-1">
          {downloadStatus === "completed" ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startAutoUpdate()}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>إعادة تنزيل ملف التحديث إذا لم يبدأ تلقائياً</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors py-2 font-bold cursor-pointer"
              >
                إغلاق هذه النافذة ✕
              </button>
            </div>
          ) : !isDownloading ? (
            <div className="space-y-2.5">
              {/* PRIMARY ONE-CLICK UPDATE BUTTON */}
              <button
                type="button"
                onClick={() => startAutoUpdate()}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                {platform === "mobile" ? (
                  <Smartphone className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <Laptop className="w-5 h-5 stroke-[2.5]" />
                )}
                <span>موافقة وتحديث البرنامج الآن تلقائياً 🚀</span>
              </button>

              {/* SECONDARY PLATFORM OPTION (Switch device type if needed) */}
              <div className="flex items-center justify-between px-1 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    startAutoUpdate(platform === "desktop" ? "mobile" : "desktop")
                  }
                  className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {platform === "desktop" ? (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تنزيل نسخة الهاتف (Android APK)</span>
                    </>
                  ) : (
                    <>
                      <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تنزيل نسخة الكمبيوتر (Windows .exe)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-200 transition-colors font-bold cursor-pointer"
                >
                  تذكيري لاحقاً ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors py-1 font-bold cursor-pointer"
              >
                إلغاء التحميل
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
