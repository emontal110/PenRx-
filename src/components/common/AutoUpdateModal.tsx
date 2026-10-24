"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Download,
  Laptop,
  Smartphone,
  X,
  ArrowRight,
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
  const notifiedVersionRef = useRef<string>("");

  useEffect(() => {
    setIsClient(true);

    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (/android|iphone|ipad|ipod|mobile/i.test(ua)) {
        setPlatform("mobile");
      } else {
        setPlatform("desktop");
      }
    }

    const w = typeof window !== "undefined" ? (window as any) : null;
    const isElectronDesktop = Boolean(w?.penrxDesktop?.isElectron);

    // 1. Native Electron AutoUpdater Listener (Primary channel for Desktop EXE)
    let unsubAvailable: (() => void) | undefined;
    if (typeof w?.penrxDesktop?.onUpdateAvailable === "function") {
      unsubAvailable = w.penrxDesktop.onUpdateAvailable(async (info: any) => {
        if (info && info.version) {
          let currentAppVer = "";
          if (w?.penrxDesktop?.getAppVersion) {
            try {
              currentAppVer = await w.penrxDesktop.getAppVersion();
            } catch {}
          }
          if (currentAppVer && !compareSemver(currentAppVer, info.version)) {
            return;
          }
          const cleanVer = String(info.version).replace(/\.0$/, "");
          const dismissedVersion = localStorage.getItem("penrx_dismissed_update_version");
          if (dismissedVersion !== info.version && dismissedVersion !== cleanVer) {
            notifiedVersionRef.current = cleanVer;
            setUpdateInfo({
              hasUpdate: true,
              currentVersion: currentAppVer ? currentAppVer.replace(/\.0$/, "") : "v...",
              latestVersion: cleanVer,
              releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : "",
              releaseDate: info.releaseDate,
            });
            setIsOpen(true);
          }
        }
      });
    }

    async function checkForUpdates() {
      try {
        const isNativeCapacitor = Boolean(
          w?.Capacitor?.isNativePlatform?.() ||
            (typeof window !== "undefined" && window.location.protocol === "capacitor:") ||
            (typeof window !== "undefined" &&
              window.location.hostname === "localhost" &&
              /android/i.test(navigator.userAgent))
        );

        if (isNativeCapacitor) {
          // Mobile APK receives live updates automatically
          return;
        }

        let currentAppVer = "";
        if (w?.penrxDesktop?.getAppVersion) {
          try {
            currentAppVer = await w.penrxDesktop.getAppVersion();
          } catch {}
        }

        // If running in Electron and native update_available already notified us, skip duplicate API check
        if (isElectronDesktop && notifiedVersionRef.current) {
          return;
        }

        const url = currentAppVer
          ? `/api/version/check?currentVersion=${encodeURIComponent(currentAppVer)}`
          : "/api/version/check";

        const res = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const data: UpdateInfo = await res.json();

        if (!data || !data.latestVersion) return;

        if (currentAppVer && !compareSemver(currentAppVer, data.latestVersion)) {
          return;
        }

        const cleanLatest = String(data.latestVersion).replace(/\.0$/, "");
        if (notifiedVersionRef.current === cleanLatest) {
          return;
        }

        if (data.hasUpdate) {
          const dismissedVersion = localStorage.getItem("penrx_dismissed_update_version");
          if (dismissedVersion !== data.latestVersion && dismissedVersion !== cleanLatest) {
            notifiedVersionRef.current = cleanLatest;
            setUpdateInfo({
              ...data,
              currentVersion: (currentAppVer || data.currentVersion || "").replace(/\.0$/, ""),
              latestVersion: cleanLatest,
            });
            setIsOpen(true);
          }
        }
      } catch {
        // Silent catch in offline / timeout mode
      }
    }

    // Run fallback API check after 4.5s (giving Electron native checkForUpdates priority at 2.5s)
    const timer = setTimeout(checkForUpdates, isElectronDesktop ? 4500 : 1800);
    const interval = setInterval(checkForUpdates, 15 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      unsubAvailable?.();
    };
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

    // 1. ELECTRON NATIVE UPDATER (Single unified differential update pipeline with automatic silent install)
    if (isElectron && targetType === "desktop") {
      if (isDownloading) return;
      setIsDownloading(true);
      setDownloadProgress(1);
      setDownloadedMB(0);
      setTotalMB(0);
      setDownloadStatus("downloading");
      setDownloadError(null);

      let unsubscribe: (() => void) | undefined;
      let hasCompleted = false;

      if (typeof w?.penrxDesktop?.onUpdateProgress === "function") {
        unsubscribe = w.penrxDesktop.onUpdateProgress((progress: any) => {
          if (hasCompleted) return;

          if (typeof progress?.percent === "number") {
            setDownloadProgress(progress.percent);
          } else if (typeof progress?.progress === "number") {
            setDownloadProgress(progress.progress);
          }
          if (typeof progress?.downloadedMB === "number" || typeof progress?.downloadedMB === "string") {
            setDownloadedMB(Number(progress.downloadedMB));
          }
          if (typeof progress?.totalMB === "number" || typeof progress?.totalMB === "string") {
            setTotalMB(Number(progress.totalMB));
          }

          if (progress?.completed || progress?.status === "completed") {
            hasCompleted = true;
            setDownloadProgress(100);
            setDownloadStatus("completed");
            setIsDownloading(false);
            unsubscribe?.();
            // Note: electron/main.js automatically triggers performQuitAndInstall after 1.2s;
            // we also send a backup signal at 1.5s in case the window is still open.
            setTimeout(() => {
              if (typeof w?.penrxDesktop?.quitAndInstallUpdate === "function") {
                w.penrxDesktop.quitAndInstallUpdate();
              }
            }, 1500);
          } else if (progress?.status === "error") {
            setDownloadStatus("error");
            setIsDownloading(false);
            setDownloadError(progress.error || "فشل تنزيل ملف التحديث");
            unsubscribe?.();
          }
        });
      }

      // Use official differential delta updater exclusively when packaged.
      // Do NOT chain a second full download on top of electron-updater!
      if (typeof w?.penrxDesktop?.downloadDifferentialUpdate === "function") {
        try {
          const diffRes = await w.penrxDesktop.downloadDifferentialUpdate();
          if (diffRes?.success) {
            return;
          }
          // Only fall back to direct stream if AutoUpdater is not available (e.g. unpacked dev build)
          if (diffRes?.error && diffRes.error !== "AutoUpdater not available") {
            console.warn("[AutoUpdateModal] Differential updater reported error, using direct installer fallback:", diffRes.error);
          }
        } catch (e: any) {
          console.warn("[AutoUpdateModal] Differential update exception:", e?.message);
        }
      }

      if (hasCompleted) return;

      const targetUrl =
        updateInfo.desktopDownloadUrl ||
        "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";

      try {
        const res = await w.penrxDesktop.downloadAndInstallUpdate(targetUrl);
        if (!res || !res.success) {
          if (!hasCompleted) {
            unsubscribe?.();
            setIsDownloading(false);
            setDownloadStatus("error");
            setDownloadError(res?.error || "تعذر إكمال التحديث التلقائي");
          }
        }
      } catch (err: any) {
        if (!hasCompleted) {
          unsubscribe?.();
          setIsDownloading(false);
          setDownloadStatus("error");
          setDownloadError(err?.message || "حدث خطأ غير متوقع أثناء التحديث");
        }
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
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

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
                ? "DOWNLOADING DELTA UPDATE ⏳"
                : "NEW RELEASE AVAILABLE 🚀"}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              {downloadStatus === "completed"
                ? isElectron
                  ? "اكتمل تنزيل التحديث وجارٍ التثبيت التلقائي!"
                  : "تم بدء تنزيل التحديث!"
                : downloadStatus === "downloading"
                ? "جارٍ تنزيل فرق التحديث السريع..."
                : "تحديث جديد متوفر لمنظومة PenRX+"}
            </h2>
            <p className="text-xs text-slate-400">
              {downloadStatus === "completed"
                ? isElectron
                  ? "تم استلام فرق التحديث بنجاح! سيقوم البرنامج الآن بالتثبيت التلقائي وإعادة التشغيل فوراً..."
                  : "تم فتح رابط التنزيل المباشر، قم بتشغيل الملف بمجرد اكتماله."
                : downloadStatus === "downloading"
                ? isElectron
                  ? "يتم الآن تحميل التغييرات الجديدة فقط (Delta Update) ثم التثبيت التلقائي دون الحاجة لتدخل يدوي..."
                  : "يرجى الانتظار حتى اكتمال تنزيل ملف التحديث الجديد"
                : isElectron
                ? "تحديث ذكي وسريع: يتم تنزيل فرق التحديث فقط وتثبيته تلقائياً مع إعادة تشغيل البرنامج."
                : "تم إطلاق إصدار جديد يتضمن تحسينات ومميزات دوائية وتقنية متقدمة"}
            </p>
          </div>
        </div>

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

        {(isDownloading || downloadStatus === "completed") && (
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
                    ? "اكتمل التنزيل 100% — جارٍ التثبيت التلقائي..."
                    : `جارٍ تنزيل التحديث... (${downloadProgress}%)`}
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

            <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800 relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-emerald-500/50 relative overflow-hidden"
                style={{ width: `${downloadProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {downloadStatus === "completed" && (
              <p className="text-[11px] text-emerald-300 font-bold text-center pt-1 animate-in fade-in">
                {isElectron
                  ? "✨ تم تجهيز التحديث، جاري التثبيت التلقائي وإعادة تشغيل البرنامج الآن..."
                  : "✨ اكتمل التنزيل، قم بفتح الملف لاستكمال التثبيت!"}
              </p>
            )}
          </div>
        )}

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

        <div className="space-y-3 pt-1">
          {downloadStatus === "completed" ? (
            <div className="space-y-2">
              {isElectron ? (
                <button
                  type="button"
                  onClick={() => {
                    const w = typeof window !== "undefined" ? (window as any) : null;
                    w?.penrxDesktop?.quitAndInstallUpdate?.();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>تثبيت وإعادة تشغيل البرنامج الآن فوراً 🚀</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleManualDownload()}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>إعادة فتح ملف التحديث أو تنزيله يدوياً</span>
                </button>
              )}
            </div>
          ) : !isDownloading ? (
            <div className="space-y-2.5">
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
