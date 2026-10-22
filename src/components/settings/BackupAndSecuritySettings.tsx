"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  Check,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Database,
  Cloud,
  CloudDownload,
  CloudUpload,
  Fingerprint,
  FileArchive,
  Archive,
  ShieldAlert,
} from "lucide-react";
import { useClinicStore } from "@/store/useClinicStore";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { showGlobalToast } from "@/components/common/GlobalToast";
import {
  exportEncryptedBackup,
  downloadBackupFile,
  importEncryptedBackup,
  fetchLatestCloudBackupInfo,
  restoreFromCloudBackup,
  uploadBackupToCloud,
} from "@/lib/backupService";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  isMobileDevice,
  isNativeAndroidApk,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
} from "@/lib/deviceSecurity";

export function BackupAndSecuritySettings() {
  const { clinic, updateClinic } = useClinicStore();
  const { savedPrescriptions, archivePrescriptionsForYear } = usePrescriptionStore();

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportStats, setExportStats] = useState<{
    uncompressedBytes: number;
    compressedBytes: number;
    savingsPercent: number;
    filename: string;
    itemCounts?: {
      prescriptions: number;
      activePrescriptions: number;
      archivedPrescriptions: number;
      patients: number;
    };
  } | null>(null);

  // Import source & mode
  const [importSource, setImportSource] = useState<"file" | "cloud">("file");
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);

  // Cloud backup state
  const [cloudBackupInfo, setCloudBackupInfo] = useState<{
    exists: boolean;
    backup?: {
      id: string;
      fileName: string;
      fileSizeKb: number;
      createdAt: string;
      metadata: any;
    };
    message?: string;
  } | null>(null);
  const [isLoadingCloudInfo, setIsLoadingCloudInfo] = useState(false);
  const [isManualCloudSaving, setIsManualCloudSaving] = useState(false);
  const [lastSilentBackupTime, setLastSilentBackupTime] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    restoredPrescriptionsCount?: number;
    restoredPatientsCount?: number;
  } | null>(null);

  // Biometrics states
  const [isMobile, setIsMobile] = useState(false);
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => {
    if (typeof window === "undefined") return clinic.biometricsEnabled || false;
    const stored = localStorage.getItem("penrx_biometric_enabled");
    if (stored !== null) return stored === "true";
    return clinic.biometricsEnabled || false;
  });

  // Archive state
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear() - 1);
  const [archiveSuccessMsg, setArchiveSuccessMsg] = useState<string | null>(null);

  // Load cloud backup info and check biometrics asynchronously only when this tab is mounted
  useEffect(() => {
    let isCancelled = false;

    if (typeof window !== "undefined") {
      const time = localStorage.getItem("penrx_last_backup_time");
      if (time) setLastSilentBackupTime(time);
      setIsMobile(isMobileDevice() || isNativeAndroidApk());
    }

    setIsLoadingCloudInfo(true);
    fetchLatestCloudBackupInfo()
      .then((res) => {
        if (!isCancelled) setCloudBackupInfo(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!isCancelled) setIsLoadingCloudInfo(false);
      });

    // Hardware biometric check with safe timeout
    async function checkHardware() {
      try {
        if (isMobileDevice() || isNativeAndroidApk()) {
          const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500));
          const avail = await Promise.race([isBiometricAvailable(), timeoutPromise]);
          if (!isCancelled) setHasBiometricsHardware(avail);
        } else {
          if (!isCancelled) setHasBiometricsHardware(false);
        }
      } catch {
        if (!isCancelled) setHasBiometricsHardware(false);
      }
    }
    const hwTimer = setTimeout(checkHardware, 100);

    return () => {
      isCancelled = true;
      clearTimeout(hwTimer);
    };
  }, []);

  const handleTestBiometrics = async () => {
    setBiometricFeedback("يرجى لمس مستشعر البصمة على جهازك للتحقق...");
    try {
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
        setTimeout(() => resolve({ success: false, error: "مهلة التحقق انتهت (Timeout)" }), 2500)
      );
      const res = await Promise.race([
        authenticateWithBiometrics(clinic.doctorName || "Doctor"),
        timeoutPromise,
      ]);

      if (res.success) {
        setBiometricFeedback("✅ تم التحقق من البصمة بنجاح! مستشعر البصمة يعمل بدقة.");
        setBiometricsEnabled(true);
        setBiometricLockEnabled(true);
        updateClinic({ biometricsEnabled: true });
        showGlobalToast("تم التحقق من البصمة وتأكيد تفعيل القفل بنجاح!", "success");
      } else {
        setBiometricFeedback(res.error ? `⚠️ ${res.error}` : "⚠️ لم يتم التحقق أو تم إلغاء البصمة.");
      }
    } catch (err: any) {
      setBiometricFeedback(`⚠️ خطأ في البصمة: ${err.message || err}`);
    }
    setTimeout(() => setBiometricFeedback(null), 6000);
  };

  const handleToggleBiometrics = async (enable: boolean) => {
    if (!enable) {
      setBiometricsEnabled(false);
      setBiometricLockEnabled(false);
      updateClinic({ biometricsEnabled: false });
      setBiometricFeedback("تم إلغاء تفعيل قفل البصمة. لن يطلب التطبيق البصمة عند الفتح.");
      showGlobalToast("تم تعطيل قفل البصمة", "info");
      setTimeout(() => setBiometricFeedback(null), 5000);
    } else {
      setBiometricFeedback("يرجى لمس مستشعر البصمة للتحقق والتفعيل...");
      try {
        const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: "مهلة التحقق انتهت (Timeout)" }), 2500)
        );
        const res = await Promise.race([
          authenticateWithBiometrics(clinic.doctorName || "Doctor"),
          timeoutPromise,
        ]);

        if (res.success) {
          setBiometricsEnabled(true);
          setBiometricLockEnabled(true);
          updateClinic({ biometricsEnabled: true });
          setBiometricFeedback("✅ تم تفعيل قفل البصمة بنجاح! سيتم قفل التطبيق عند كل فتح.");
          showGlobalToast("تم تفعيل قفل البصمة بنجاح!", "success");
        } else {
          setBiometricFeedback(res.error ? `⚠️ ${res.error}` : "⚠️ لم يتم التحقق من البصمة، لم يتم التفعيل.");
        }
      } catch (err: any) {
        setBiometricFeedback(`⚠️ خطأ: ${err.message || err}`);
      }
      setTimeout(() => setBiometricFeedback(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Silent Daily Backup & Cloud Status */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-teal-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-inner shrink-0 mt-0.5">
            <Database className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-100">
                النسخ الاحتياطي والأرشفة الذكية
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" />
                <span>حفظ تلقائي يومي مفعّل</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                أرشفة سنوية تلقائية
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              يقوم البرنامج <strong>تلقائياً وبشكل صامت يومياً</strong> بحفظ نسخة احتياطية مضغوطة ومشفرة على السحابة مع عزل كامل لكل عيادة، كما تتم <strong>أرشفة الروشتات السنوية القديمة تلقائياً كل عام</strong> دون أي تدخل يدوي منك.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-teal-400" />
                <span>آخر حفظ سحابي:</span>
                <strong className="text-slate-200 font-mono">
                  {lastSilentBackupTime
                    ? new Date(lastSilentBackupTime).toLocaleString("ar-EG")
                    : cloudBackupInfo?.backup?.createdAt
                    ? new Date(cloudBackupInfo.backup.createdAt).toLocaleString("ar-EG")
                    : "جاري المزامنة اليومية"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action: Instant Cloud Sync Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={async () => {
              setIsManualCloudSaving(true);
              try {
                const res = await exportEncryptedBackup();
                await uploadBackupToCloud(res.payloadBase64, res.fileName, res.compressedSizeKb, res.metadata);
                const nowIso = new Date().toISOString();
                if (typeof window !== "undefined") {
                  localStorage.setItem("penrx_last_backup_time", nowIso);
                }
                setLastSilentBackupTime(nowIso);
                setCloudBackupInfo({
                  exists: true,
                  backup: {
                    id: `cbk_${Date.now()}`,
                    fileName: res.fileName,
                    fileSizeKb: res.compressedSizeKb,
                    createdAt: nowIso,
                    metadata: res.metadata,
                  },
                });
                showGlobalToast("☁️ تم حفظ وتأمين النسخة الاحتياطية سحابياً بنجاح!", "success");
              } catch (err: any) {
                showGlobalToast(`❌ تعذر الحفظ السحابي: ${err.message || err}`, "error");
              } finally {
                setIsManualCloudSaving(false);
              }
            }}
            disabled={isManualCloudSaving}
            className="w-full md:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <CloudUpload className={`w-4 h-4 ${isManualCloudSaving ? "animate-bounce" : ""}`} />
            <span>{isManualCloudSaving ? "جاري الحفظ السحابي..." : "حفظ نسخة سحابية الآن"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Export Backup (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100">تصدير نسخة احتياطية (.penrx)</h3>
                  <p className="text-[11px] text-slate-400">حفظ فوري لجميع الروشتات والمرضى بملف مضغوط ومشفر</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                تشفير وضغط تلقائي 🔒
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>محتويات النسخة المحفوظة:</span>
              </div>
              <ul className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>الروشتات النشطة والمؤرشفة ({savedPrescriptions.length})</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>سجل بيانات المرضى</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إعدادات وهوية العيادة</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>قائمة الأدوية المخصصة</span>
                </li>
              </ul>
            </div>

            {/* 1-Click Export Button */}
            <button
              type="button"
              onClick={async () => {
                setIsExporting(true);
                try {
                  const res = await exportEncryptedBackup();
                  setExportStats({
                    uncompressedBytes: res.uncompressedBytes,
                    compressedBytes: res.compressedBytes,
                    savingsPercent: res.savingsPercent,
                    filename: res.fileName,
                    itemCounts: {
                      prescriptions: res.metadata.totalPrescriptions,
                      activePrescriptions: res.metadata.activePrescriptions,
                      archivedPrescriptions: res.metadata.archivedPrescriptions,
                      patients: res.metadata.totalPatients,
                    },
                  });
                  downloadBackupFile(res.blob, res.fileName);
                  showGlobalToast("✅ تم حفظ وتنزيل النسخة الاحتياطية بنجاح!", "success");
                } catch (err) {
                  console.error("Backup export error:", err);
                  showGlobalToast("❌ حدث خطأ أثناء تصدير النسخة الاحتياطية", "error");
                } finally {
                  setIsExporting(false);
                }
              }}
              disabled={isExporting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white font-black text-xs shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Download className={`w-4 h-4 ${isExporting ? "animate-pulse" : ""}`} />
              <span>{isExporting ? "جاري التصدير..." : "تصدير وحفظ النسخة الاحتياطية الآن (.penrx)"}</span>
            </button>

            {/* Export Results */}
            {exportStats && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>تم تجهيز وتنزيل ملف النسخة الاحتياطية بنجاح:</span>
                </div>
                <div className="font-mono text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block truncate">
                    {exportStats.filename}
                  </span>
                  <div className="flex items-center gap-3 text-slate-400 mt-1 text-[10px]">
                    <span>الحجم المضغوط: {Math.round(exportStats.compressedBytes / 1024)} KB</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">توفير مساحة: {exportStats.savingsPercent}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Annual Archival Manager */}
          <div className="p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
              <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">أرشفة الروشتات السنوية</h3>
                <p className="text-[11px] text-slate-400">عزل الروشتات القديمة لتسريع التطبيق وحفظها بأمان</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              تساعد الأرشفة على إبقاء قاعدة البيانات خفيفة وسريعة للغاية، حيث يمكنك أرشفة روشتات أي سنة ماضية بضغطة زر مع بقائها قابلة للبحث والاسترجاع في أي وقت.
            </p>

            <div className="flex items-center gap-3">
              <select
                value={archiveYear}
                onChange={(e) => setArchiveYear(parseInt(e.target.value))}
                className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-bold text-slate-100 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                {[2023, 2024, 2025, 2026].map((yr) => (
                  <option key={yr} value={yr}>
                    روشتات عام {yr}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  try {
                    archivePrescriptionsForYear(archiveYear);
                    setArchiveSuccessMsg(`تمت أرشفة روشتات عام ${archiveYear} بنجاح!`);
                    showGlobalToast(`📦 تمت أرشفة روشتات عام ${archiveYear} بنجاح`, "success");
                    setTimeout(() => setArchiveSuccessMsg(null), 5000);
                  } catch (err: any) {
                    showGlobalToast(`❌ تعذر الأرشفة: ${err.message || err}`, "error");
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Archive className="w-4 h-4 text-teal-400" />
                <span>أرشفة روشتات عام {archiveYear}</span>
              </button>
            </div>

            {archiveSuccessMsg && (
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{archiveSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Android Fingerprint Biometric Setup */}
          {(isMobile || isNativeAndroidApk()) && (
            <div className="p-6 rounded-3xl bg-slate-900/95 border border-emerald-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-100">
                      قفل التطبيق ببصمة الإصبع (Biometric Lock)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {biometricsEnabled
                        ? "القفل البيومتري نشط - يطلب البصمة لحماية بيانات العيادة عند فتح التطبيق"
                        : "القفل البيومتري معطل - يفتح التطبيق مباشرة دون طلب البصمة"}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleBiometrics(!biometricsEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    biometricsEnabled ? "bg-emerald-600" : "bg-slate-800"
                  }`}
                  role="switch"
                  aria-checked={biometricsEnabled}
                  title={biometricsEnabled ? "انقر للتعطيل" : "انقر للتفعيل"}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      biometricsEnabled ? "-translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[10px] text-slate-400">
                  محمي بمهلة أمان فائقة السرعة لمنع تجمد الواجهة على هواتف الأندرويد.
                </p>

                <button
                  type="button"
                  onClick={handleTestBiometrics}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-400" />
                  <span>تجربة مستشعر البصمة الآن</span>
                </button>
              </div>

              {biometricFeedback && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-300 animate-in fade-in duration-200">
                  {biometricFeedback}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Restore & Import (6 Cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100">استرجاع نسخة احتياطية</h3>
                  <p className="text-[11px] text-slate-400">استعادة بيانات العيادة والروشتات من ملف أو من السحابة</p>
                </div>
              </div>
            </div>

            {/* Source Selector: File vs Cloud */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setImportSource("file")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  importSource === "file"
                    ? "bg-slate-800 text-white shadow-md border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📁 استرجاع من ملف (.penrx)
              </button>
              <button
                type="button"
                onClick={() => setImportSource("cloud")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  importSource === "cloud"
                    ? "bg-teal-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ☁️ استرجاع من السحابة
              </button>
            </div>

            {/* If File Source */}
            {importSource === "file" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <label className="block text-xs font-bold text-slate-300">
                    اختر ملف النسخة الاحتياطية (.penrx):
                  </label>
                  <input
                    type="file"
                    accept=".penrx,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedBackupFile(file);
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-teal-600 file:text-white file:cursor-pointer hover:file:bg-teal-500 cursor-pointer"
                  />
                  {selectedBackupFile && (
                    <span className="block text-[11px] text-emerald-400 font-mono font-bold">
                      ✓ تم اختيار: {selectedBackupFile.name} ({Math.round(selectedBackupFile.size / 1024)} KB)
                    </span>
                  )}
                </div>

                {/* Restore Mode Selector */}
                <div className="grid grid-cols-2 gap-2 text-right">
                  <button
                    type="button"
                    onClick={() => setImportMode("MERGE")}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      importMode === "MERGE"
                        ? "bg-teal-500/15 border-teal-500 text-teal-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-400" />
                      <span>دمج ذكي (موصى به)</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">إضافة السجلات دون مسح الحالي</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode("REPLACE")}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      importMode === "REPLACE"
                        ? "bg-rose-500/15 border-rose-500 text-rose-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>استبدال كامل</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">تحديث السجل بالكامل بالملف</div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedBackupFile) {
                      showGlobalToast("⚠️ يرجى اختيار ملف نسخة احتياطية أولاً", "error");
                      return;
                    }
                    setIsImporting(true);
                    setImportResult(null);
                    try {
                      const res = await importEncryptedBackup(selectedBackupFile, undefined, importMode);
                      setImportResult(res);
                      if (res.success) {
                        showGlobalToast(`✅ ${res.message}`, "success");
                      } else {
                        showGlobalToast(`❌ ${res.message}`, "error");
                      }
                    } catch (err: any) {
                      setImportResult({
                        success: false,
                        message: err.message || "تعذر قراءة أو فك تشفير الملف.",
                      });
                      showGlobalToast(`❌ ${err.message || "تعذر الاسترجاع"}`, "error");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  disabled={isImporting || !selectedBackupFile}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-teal-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <Download className={`w-4 h-4 ${isImporting ? "animate-bounce" : ""}`} />
                  <span>{isImporting ? "جاري استرجاع النسخة..." : "استرجاع النسخة الاحتياطية من الملف"}</span>
                </button>
              </div>
            )}

            {/* If Cloud Source */}
            {importSource === "cloud" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">أحدث نسخة محفوظة بالسحابة:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLoadingCloudInfo(true);
                        fetchLatestCloudBackupInfo()
                          .then((res) => setCloudBackupInfo(res))
                          .catch(() => {})
                          .finally(() => setIsLoadingCloudInfo(false));
                      }}
                      className="text-[10px] text-teal-400 font-bold hover:underline"
                    >
                      تحديث البيانات ⟳
                    </button>
                  </div>

                  {isLoadingCloudInfo ? (
                    <div className="py-4 text-center text-xs text-slate-400">جاري فحص السحابة...</div>
                  ) : cloudBackupInfo?.exists && cloudBackupInfo.backup ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/30 text-xs space-y-1">
                      <div className="flex items-center justify-between text-teal-300 font-bold">
                        <span>{cloudBackupInfo.backup.fileName}</span>
                        <span className="font-mono text-[10px] text-slate-400">{cloudBackupInfo.backup.fileSizeKb} KB</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        تاريخ الرفع: {new Date(cloudBackupInfo.backup.createdAt).toLocaleString("ar-EG")}
                      </p>
                    </div>
                  ) : (
                    <div className="py-4 text-center space-y-1 text-slate-400">
                      <p className="text-xs">لم يتم رفع نسخة احتياطية سحابية بعد.</p>
                      <p className="text-[10px] text-slate-500">
                        يمكنك الضغط على زر &quot;حفظ نسخة سحابية الآن&quot; بالأعلى لرفع أول نسخة فوراً.
                      </p>
                    </div>
                  )}
                </div>

                {/* Restore Mode Selector */}
                <div className="grid grid-cols-2 gap-2 text-right">
                  <button
                    type="button"
                    onClick={() => setImportMode("MERGE")}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      importMode === "MERGE"
                        ? "bg-teal-500/15 border-teal-500 text-teal-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-400" />
                      <span>دمج ذكي (موصى به)</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">إضافة السجلات بدون تكرار</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode("REPLACE")}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                      importMode === "REPLACE"
                        ? "bg-rose-500/15 border-rose-500 text-rose-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>استبدال كامل</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">تحديث السجل بالكامل بالسحابة</div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setIsImporting(true);
                    setImportResult(null);
                    try {
                      const res = await restoreFromCloudBackup(importMode);
                      setImportResult(res);
                      if (res.success) {
                        showGlobalToast(`✅ ${res.message}`, "success");
                      } else {
                        showGlobalToast(`❌ ${res.message}`, "error");
                      }
                    } catch (err: any) {
                      setImportResult({
                        success: false,
                        message: err.message || "تعذر استرجاع النسخة السحابية.",
                      });
                      showGlobalToast(`❌ ${err.message || "تعذر استرجاع النسخة السحابية"}`, "error");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  disabled={isImporting || !cloudBackupInfo?.exists}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-teal-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <CloudDownload className={`w-4 h-4 ${isImporting ? "animate-bounce" : ""}`} />
                  <span>{isImporting ? "جاري استرجاع النسخة السحابية..." : "استرجاع النسخة السحابية الآن"}</span>
                </button>
              </div>
            )}

            {/* Import Result Alert */}
            {importResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in ${
                  importResult.success
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/40 text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {importResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{importResult.message}</span>
                </div>

                {importResult.success && (
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-center text-slate-300">
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                      <span className="font-bold text-emerald-400 text-sm">
                        {importResult.restoredPrescriptionsCount ?? 0}
                      </span>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">روشتة مستعادة</div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                      <span className="font-bold text-teal-400 text-sm">
                        {importResult.restoredPatientsCount ?? 0}
                      </span>
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">مريض مستعاد</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BackupAndSecuritySettings;
