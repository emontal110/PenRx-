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

function compareSemver(current: string, latest: string): boolean {
  try {
    const c = current.replace(/^v/, "").split(".").map(Number);
    const l = latest.replace(/^v/, "").split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      const cPart = c[i] || 0;
      const lPart = l[i] || 0;
      if (lPart > cPart) return true;
      if (lPart < cPart) return false;
    }
    return false;
  } catch {
    return false;
  }
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
        let currentAppVer = "";
        const w = typeof window !== "undefined" ? (window as any) : null;
        if (w?.penrxDesktop?.getAppVersion) {
          try {
            currentAppVer = await w.penrxDesktop.getAppVersion();
          } catch {}
        }

        const isNativeCapacitor = Boolean(
          w?.Capacitor?.isNativePlatform?.() ||
          (typeof window !== "undefined" && window.location.protocol === "capacitor:") ||
          (typeof window !== "undefined" && window.location.hostname === "localhost" && /android/i.test(navigator.userAgent))
        );

        let data: UpdateInfo | null = null;

        if (isNativeCapacitor) {
          // On mobile Android APK, there is no local Next.js server. Query GitHub Releases directly with strict timeout
          try {
            const ghRes = await fetch("https://api.github.com/repos/emontal110/PenRx-/releases/latest", {
              headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "PenRX-Mobile-App" },
              signal: AbortSignal.timeout(3500),
            });
            if (ghRes.ok) {
              const rel = await ghRes.json();
              const latestTag = (rel.tag_name || rel.name || "1.5").replace(/^v/, "").trim();
              const currentVer = "1.5"; // Mobile base package version
              const hasUpdate = compareSemver(currentVer, latestTag);
              let apkUrl = "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+.apk";
              if (Array.isArray(rel.assets)) {
                const apk = rel.assets.find((a: any) => a.name?.endsWith(".apk"));
                if (apk?.browser_download_url) apkUrl = apk.browser_download_url;
              }
              data = {
                hasUpdate,
                currentVersion: currentVer,
                latestVersion: latestTag,
                releaseDate: rel.published_at?.split("T")[0] || "",
                releaseNotes: rel.body || "",
                androidDownloadUrl: apkUrl,
              };
            }
          } catch {
            return;
          }
        } else {
          // Desktop / Web mode: fetch from local Next.js API with safety timeout
          const url = currentAppVer
            ? `/api/version/check?currentVersion=${encodeURIComponent(currentAppVer)}`
            : "/api/version/check";

          const res = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(3500),
          });
          if (!res.ok) return;
          data = await res.json();
        }

        if (!data) return;

        // Extra safeguard: If running in Electron and app version >= latestVersion, do not show update modal
        if (currentAppVer && !compareSemver(currentAppVer, data.latestVersion)) {
          return;
        }

        if (data.hasUpdate) {
          const dismissedVersion = localStorage.getItem("penrx_dismissed_update_version");
          if (dismissedVersion !== data.latestVersion) {
            setUpdateInfo(data);
            setIsOpen(true);
          }
        }
      } catch {
        // Silent catch in offline / timeout mode - never freeze the app
      }
    }

    // Check after 6 seconds on app startup to avoid initial load contention
    const timer = setTimeout(checkForUpdates, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient || !isOpen || !updateInfo) {
    return null;
  }

  const isElectron =
    typeof window !== "undefined" && Boolean((window as any).penrxDesktop?.isElectron);

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

  const directFallbackUrl =
    platform === "mobile"
      ? updateInfo.androidDownloadUrl || "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+.apk"
      : updateInfo.desktopDownloadUrl || "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";

  const handleManualDownload = (customUrl?: string) => {
    const targetUrl = customUrl || directFallbackUrl;
    const w = typeof window !== "undefined" ? (window as any) : null;
    if (w?.penrxDesktop?.openExternal) {
      w.penrxDesktop.openExternal(targetUrl);
    } else {
      window.open(targetUrl, "_blank");
    }
  };

  const startAutoUpdate = async (selectedType?: "desktop" | "mobile") => {
    const targetType = selectedType || platform;
    const w = typeof window !== "undefined" ? (window as any) : null;

    // 1. ELECTRON NATIVE UPDATER (For Desktop PC installed version)
    if (isElectron && targetType === "desktop") {
      setIsDownloading(true);
      setDownloadProgress(0);
      setDownloadedMB(0);
      setTotalMB(0);
      setDownloadStatus("downloading");
      setDownloadError(null);

      const targetUrl =
        updateInfo.desktopDownloadUrl ||
        "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";

      // Subscribe to live IPC progress from Electron main process
      let unsubscribe: (() => void) | undefined;
      if (typeof w?.penrxDesktop?.onUpdateProgress === "function") {
        unsubscribe = w.penrxDesktop.onUpdateProgress((progress: any) => {
          if (typeof progress?.percent === "number") {
            setDownloadProgress(progress.percent);
          }
          if (typeof progress?.downloadedMB === "number") {
            setDownloadedMB(progress.downloadedMB);
          }
          if (typeof progress?.totalMB === "number") {
            setTotalMB(progress.totalMB);
          }
          if (progress?.completed) {
            setDownloadProgress(100);
            setDownloadStatus("completed");
          }
        });
      }

      try {
        const res = await w.penrxDesktop.downloadAndInstallUpdate(targetUrl);
        if (!res || !res.success) {
          unsubscribe?.();
          setDownloadStatus("error");
          setDownloadError(res?.error || "تعذر إكمال التحديث التلقائي");
        }
      } catch (err: any) {
        unsubscribe?.();
        setDownloadStatus("error");
        setDownloadError(err?.message || "حدث خطأ غير متوقع أثناء التحديث");
      }
      return;
    }

    // 2. MOBILE (Android APK via Browser / System Downloader)
    if (targetType === "mobile") {
      const apkUrl =
        updateInfo.androidDownloadUrl ||
        "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+.apk";
      handleManualDownload(apkUrl);
      setDownloadStatus("completed");
      return;
    }

    // 3. WEB BROWSER FALLBACK
    const exeUrl =
      updateInfo.desktopDownloadUrl ||
      "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";
    handleManualDownload(exeUrl);
    setDownloadStatus("completed");
  };

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
                ? "UPDATE READY 🎉"
                : downloadStatus === "downloading"
                ? "DOWNLOADING UPDATE ⏳"
                : "NEW RELEASE AVAILABLE 🚀"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              {downloadStatus === "completed"
                ? isElectron
                  ? "اكتمل التنزيل بنجاح!"
                  : "تم بدء تنزيل التحديث!"
                : downloadStatus === "downloading"
                ? "جارٍ تحميل التحديث الجديد..."
                : "تحديث جديد متوفر لمنظومة PenRX+"}
            </h2>
            <p className="text-xs text-slate-400">
              {downloadStatus === "completed"
                ? isElectron
                  ? "جاري إغلاق التطبيق وبدء برنامج التثبيت تلقائياً لتطبيق التحديث..."
                  : "تم فتح رابط التنزيل المباشر، قم بتشغيل الملف بمجرد اكتماله."
                : downloadStatus === "downloading"
                ? "يرجى الانتظار حتى اكتمال تنزيل ملف التحديث الجديد"
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
                  : "جارٍ الاتصال بالسيرفر..."}
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
                {isElectron
                  ? "✨ تم حفظ التحديث وسيبدأ التثبيت التلقائي خلال لحظات..."
                  : "✨ اكتمل التنزيل، قم بفتح الملف لاستكمال التثبيت!"}
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
              يمكنك التنزيل مباشرة عبر متصفح جهازك باستخدام الزر أدناه:
            </p>
            <button
              type="button"
              onClick={() => handleManualDownload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 text-slate-950 font-black text-[11px] hover:bg-rose-400 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>تنزيل التحديث المباشر من GitHub في المتصفح</span>
            </button>
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
                onClick={() => handleManualDownload()}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>إعادة فتح ملف التحديث أو تنزيله يدوياً</span>
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
                  onClick={() => handleManualDownload()}
                  className="text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 font-bold cursor-pointer"
                  title="فتح الرابط في المتصفح الخارجي"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>تنزيل يدوي</span>
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
            <div className="space-y-2 text-center">
              <button
                type="button"
                onClick={() => handleManualDownload()}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline font-bold cursor-pointer"
              >
                هل يستغرق وقتاً طويلاً؟ اضغط هنا للتنزيل المباشر من المتصفح ↗
              </button>
              <div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors py-1 font-bold cursor-pointer"
                >
                  إلغاء التحميل
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
