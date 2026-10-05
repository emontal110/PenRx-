"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Building2,
  User,
  Fingerprint,
  Phone,
  FileText,
  Upload,
  Image as ImageIcon,
  Link2 as LinkIcon,
  X,
  Check,
  Palette,
  Type,
  Plus,
  Trash2,
  Edit2,
  Pencil,
  MapPin,
  Clock,
  Save,
  CheckCircle2,
  Sparkles,
  Star,
  ShieldCheck,
  UserCheck,
  Eye,
  Laptop,
  Copy,
  Printer,
  HeartPulse,
  AlertTriangle,
  Download,
  HardDrive,
  Lock,
  Unlock,
  KeyRound,
  Database,
  FileArchive,
  ShieldAlert,
  Archive,
  FolderArchive,
  Cloud,
  CloudDownload,
  CloudUpload,
  RefreshCw,
} from "lucide-react";
import { useClinicStore, Branch, PrescriptionTemplate } from "@/store/useClinicStore";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { isBiometricAvailable, authenticateWithBiometrics } from "@/lib/deviceSecurity";
import { QRCodeSVG } from "qrcode.react";
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
  PrescriptionTemplateDecorations,
  getTemplateContainerStyles,
  PRESCRIPTION_TEMPLATES,
} from "@/components/prescription/PrescriptionTemplateDecorations";

const COLOR_PRESETS = [
  { name: "Emerald Medical", hex: "#059669", bg: "bg-emerald-600" },
  { name: "Teal Clinical", hex: "#0d9488", bg: "bg-teal-600" },
  { name: "Cyan Modern", hex: "#0891b2", bg: "bg-cyan-600" },
  { name: "Royal Blue", hex: "#2563eb", bg: "bg-blue-600" },
  { name: "Deep Indigo", hex: "#4f46e5", bg: "bg-indigo-600" },
  { name: "Rose Dermatology", hex: "#e11d48", bg: "bg-rose-600" },
];

const FONT_PRESETS = [
  { name: "خط كايرو (Cairo)", value: "'Cairo', sans-serif" },
  { name: "خط تجول (Tajawal)", value: "'Tajawal', sans-serif" },
  { name: "خط الإسكندرية (Alexandria)", value: "'Alexandria', sans-serif" },
  { name: "خط المراعي (Almarai)", value: "'Almarai', sans-serif" },
  { name: "خط أميري (Amiri)", value: "'Amiri', serif" },
  { name: "خط آي بي إم (IBM Plex)", value: "'IBM Plex Sans Arabic', sans-serif" },
  { name: "خط ريدكس برو (Readex Pro)", value: "'Readex Pro', sans-serif" },
];

interface SettingsPrescriptionPreviewProps {
  doctorName: string;
  doctorTitle: string;
  specialty: string;
  syndicateId: string;
  nameAr: string;
  name: string;
  workingHours?: string;
  footerText: string;
  clinicPhone: string;
  logoUrl: string;
  primaryColor: string;
  fontFamily: string;
  templateId?: PrescriptionTemplate;
  paperSize: "A5" | "A6" | "A4" | "B5";
  showHeader: boolean;
  showFooter: boolean;
  visibleFields: {
    showAge: boolean;
    showGender: boolean;
    showHeight: boolean;
    showWeight: boolean;
    showBloodType: boolean;
    showDiagnosis: boolean;
    showMedicalHistory: boolean;
    showAllergies: boolean;
  };
  branchAddress?: string;
  branches?: Branch[];
  activeBranchId?: string;
  title?: string;
}

function SettingsPrescriptionPreview({
  doctorName,
  doctorTitle,
  specialty,
  syndicateId,
  nameAr,
  name,
  workingHours = "",
  footerText,
  clinicPhone,
  logoUrl,
  primaryColor,
  fontFamily,
  templateId = "classic",
  paperSize,
  showHeader,
  showFooter,
  visibleFields,
  branchAddress = "عنوان العيادة الرئيسي",
  branches = [],
  activeBranchId = "",
  title = "معاينة حية فورية للروشتة المطبوعة:",
}: SettingsPrescriptionPreviewProps) {
  const paperLabels = {
    A5: { label: "A5", name: "A5 قياسي (الافتراضي)", desc: "14.8 × 21 سم (1748 × 2480 px)", maxW: "max-w-[440px] mx-auto text-[11px]", minH: "min-h-[660px] sm:min-h-[700px]" },
    A6: { label: "A6", name: "A6 مصغر", desc: "10.5 × 14.8 سم (1240 × 1748 px)", maxW: "max-w-[360px] mx-auto text-[10px]", minH: "min-h-[560px] sm:min-h-[600px]" },
    A4: { label: "A4", name: "A4 كامل", desc: "21 × 29.7 سم", maxW: "max-w-full", minH: "min-h-[820px] sm:min-h-[880px]" },
    B5: { label: "B5", name: "B5 وسيط", desc: "17.6 × 25 سم", maxW: "max-w-[480px] mx-auto text-xs", minH: "min-h-[720px] sm:min-h-[760px]" },
  };

  const currentPaper = paperLabels[paperSize] || paperLabels.A5;
  const templateStyles = getTemplateContainerStyles(templateId, primaryColor);

  return (
    <div className="space-y-3 sticky top-4">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-emerald-400" />
          <span>{title}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            معاينة حية
          </span>
        </div>
      </div>

      {/* Prescription Preview Card */}
      <div
        style={{
          fontFamily,
          ...templateStyles.style,
        }}
        className={`text-slate-900 rounded-3xl p-5 sm:p-6 space-y-3.5 transition-all relative overflow-hidden flex flex-col justify-between ${templateStyles.className} ${currentPaper.maxW} ${currentPaper.minH}`}
        dir="rtl"
      >
        {/* Prescription Template Vector Decorations (Waves, Hexagons, Ornate Corners, etc.) */}
        <PrescriptionTemplateDecorations templateId={templateId} primaryColor={primaryColor} />

        {/* Center Watermark: Same Logo as Header with High Transparency */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          <div className="w-48 h-48 sm:w-60 sm:h-60 relative opacity-[0.045] flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Clinic Watermark"
                className="max-h-full max-w-full object-contain grayscale"
              />
            ) : (
              <span className="font-serif text-8xl font-black" style={{ color: primaryColor }}>
                ℞
              </span>
            )}
          </div>
        </div>

        {/* Clinic & Doctor Header */}
        {showHeader !== false ? (
          <div
            className="border-b-2 pb-2.5 space-y-1.5 relative z-10"
            style={{ borderColor: `${primaryColor}30` }}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Right: Logo + Doctor Details */}
              <div className="flex items-center gap-2.5">
                {logoUrl && (
                  <div
                    className="rounded-2xl overflow-hidden border border-slate-200 p-1 shrink-0 flex items-center justify-center bg-white shadow-sm"
                    style={{ width: "52px", height: "52px" }}
                  >
                    <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black leading-tight" style={{ color: primaryColor }}>
                    {doctorName || "د. الطبيب المعالج"}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-700">
                    {doctorTitle || "أخصائي واستشاري"}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-500">
                    {specialty || "التخصص الطبي"}
                  </p>
                  {syndicateId && (
                    <p className="text-[8px] text-slate-400 font-mono">ترخيص: {syndicateId}</p>
                  )}
                </div>
              </div>

              {/* Left: Clinic Details with distinctive, elegant typography for Clinic Name & Specialty */}
              <div className="text-left space-y-1">
                <h4
                  className="text-sm font-black leading-tight tracking-tight drop-shadow-xs"
                  style={{
                    fontFamily: "'El Messiri', 'Alexandria', 'Cairo', serif",
                    color: "#0f172a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {nameAr || "المركز الطبي"}
                </h4>
                {name && (
                  <p
                    className="text-[11px] font-bold"
                    style={{
                      fontFamily: "'Alexandria', 'Cairo', sans-serif",
                      color: primaryColor,
                    }}
                  >
                    {name}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 text-center text-[10px] font-bold text-slate-400 bg-slate-100 rounded-xl border border-dashed border-slate-300">
            (تم إخفاء الترويسة العلوية حسب رغبتك للطباعة على ورق مروّس جاهز)
          </div>
        )}

        {/* Patient Bar Preview (Reflects visibleFields) */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 relative z-10">
          <div>
            <span className="text-slate-400 font-medium text-[9px]">المريض: </span>
            <span className="font-bold text-slate-900 text-[10.5px]">محمد أحمد محمود</span>
          </div>

          {(visibleFields.showAge || visibleFields.showGender) && (
            <div className="text-slate-700 font-bold">
              <span className="text-slate-400 font-medium">السن/النوع: </span>
              <span>
                {visibleFields.showAge && "38 سنة"}
                {visibleFields.showAge && visibleFields.showGender && " / "}
                {visibleFields.showGender && "ذكر"}
              </span>
            </div>
          )}

          {(visibleFields.showHeight || visibleFields.showWeight) && (
            <div className="text-slate-700 font-bold">
              <span className="text-slate-400 font-medium">القياسات: </span>
              <span>
                {visibleFields.showHeight && "178 سم"}
                {visibleFields.showHeight && visibleFields.showWeight && " • "}
                {visibleFields.showWeight && "82 كجم"}
              </span>
            </div>
          )}

          {visibleFields.showBloodType && (
            <div>
              <span className="text-slate-400 font-medium">فصيلة: </span>
              <span className="font-black text-rose-600">A+</span>
            </div>
          )}

          <div>
            <span className="text-slate-400 font-medium">التاريخ: </span>
            <span className="font-bold text-slate-800">
              {new Date().toLocaleDateString("ar-EG")}
            </span>
          </div>
        </div>

        {/* Diagnosis Preview (Reflects visibleFields.showDiagnosis) */}
        {visibleFields.showDiagnosis && (
          <div
            className="p-2 rounded-xl text-[10px] border font-bold flex items-center gap-1.5"
            style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30`, color: primaryColor }}
          >
            <span className="font-black shrink-0">التشخيص الطبي:</span>
            <span className="text-slate-800 font-medium">التهاب اللوزتين الحاد (Acute Tonsillitis)</span>
          </div>
        )}

        {/* Medical History & Allergies (Reflects visibleFields) */}
        {(visibleFields.showMedicalHistory || visibleFields.showAllergies) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px]">
            {visibleFields.showMedicalHistory && (
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <span className="font-black block text-blue-800 mb-0.5">الأمراض المزمنة:</span>
                <span>ارتفاع ضغط الدم، حساسية صدرية</span>
              </div>
            )}
            {visibleFields.showAllergies && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-black block text-amber-800 mb-0.5">⚠️ حساسية الأدوية:</span>
                <span>البنسلين ومشتقات السلفا</span>
              </div>
            )}
          </div>
        )}

        {/* Rx Sample Items */}
        <div className="space-y-2 py-1 relative z-10">
          <div className="flex items-center gap-1.5" style={{ color: primaryColor }}>
            <span className="font-serif font-black text-2xl italic">℞</span>
            <span className="text-[10px] font-black text-slate-600">العلاج الدوائي والجرعات</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <span className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full text-white text-[10px] font-bold leading-none flex items-center justify-center font-mono shrink-0 shadow-xs" style={{ backgroundColor: primaryColor }}>
                1
              </span>
              <span>Augmentin 1gm Tablet</span>
            </div>
            <p className="text-[10px] pr-6" style={{ color: primaryColor }}>
              قرص واحد • كل 12 ساعة بعد الأكل • لمدة 7 أيام
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <span className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full text-white text-[10px] font-bold leading-none flex items-center justify-center font-mono shrink-0 shadow-xs" style={{ backgroundColor: primaryColor }}>
                2
              </span>
              <span>Panadol Extra Tablet</span>
            </div>
            <p className="text-[10px] pr-6" style={{ color: primaryColor }}>
              قرصين عند اللزوم للصداع وارتفاع الحرارة
            </p>
          </div>
        </div>

        {/* Comfortable natural breathing margin between medications and footer */}
        <div className="flex-1 min-h-[50px]" aria-hidden="true" />

        {/* Footer Preview */}
        {showFooter !== false ? (
          <div className="space-y-1 relative z-10 pt-1">
            {/* Branches & Clinic Phone Numbers & Working Hours (No Doctor Signature, No 'الفرع الرئيسي') */}
            <div className="border-t border-slate-200/80 pt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[9px] text-slate-600 font-semibold w-full">
              {(() => {
                // If branches exist, inject the live form values (branchAddress, clinicPhone, workingHours) into the primary/active branch
                const liveBranches = branches && branches.length > 0
                  ? branches.map((b, idx) => {
                      const isTarget = activeBranchId ? b.id === activeBranchId : idx === 0;
                      if (isTarget) {
                        return {
                          ...b,
                          address: branchAddress !== undefined ? branchAddress : b.address,
                          phone: clinicPhone !== undefined ? clinicPhone : b.phone,
                          workingHours: workingHours !== undefined ? workingHours : b.workingHours,
                        };
                      }
                      return b;
                    })
                  : [
                      {
                        id: "preview-default",
                        name: "Main",
                        nameAr: nameAr || "الفرع الرئيسي",
                        address: branchAddress || "",
                        phone: clinicPhone || "",
                        workingHours: workingHours || "",
                        isDefault: true,
                      },
                    ];

                return liveBranches.map((b, idx) => (
                  <div key={b.id || idx} className="flex items-center gap-2 flex-wrap justify-center">
                    {b.address && <span>📍 {b.address}</span>}
                    {b.phone && (
                      <span className="font-mono font-bold text-slate-700" dir="ltr">
                        📞 {b.phone}
                      </span>
                    )}
                    {b.workingHours && <span>🕒 {b.workingHours}</span>}
                  </div>
                ));
              })()}
            </div>

            {/* Sentence: نتمنى لكم الشفاء العاجل directly above the bottom border */}
            <p className="text-center font-bold text-slate-500 text-[9px] pt-0.5">
              {footerText || "نتمنى لكم الشفاء العاجل ودوام الصحة والعافية"}
            </p>
          </div>
        ) : (
          <div className="p-1.5 text-center text-[9px] font-bold text-slate-400 bg-slate-100 rounded-lg border border-dashed border-slate-300">
            (تم إخفاء التذييل السفلي حسب رغبتك)
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    clinic,
    updateClinic,
    saveClinicAndCreateFirstBranch,
    branches,
    addBranch,
    updateBranch,
    deleteBranch,
    activeBranchId,
    setActiveBranchId,
    setDefaultBranch,
  } = useClinicStore();
  const { visibleFields, toggleVisibleField, savedPrescriptions, archivePrescriptionsForYear } = usePrescriptionStore();
  const { machineId, subscriberId } = useSubscriptionStore();
  const [activeTab, setActiveTab] = useState<"profile" | "patientFields" | "backup">("profile");

  // Backup & Restore states (Simplified - Zero Password Clutter)
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

  // Import source selector: "file" (من الجهاز) or "cloud" (من السحابة)
  const [importSource, setImportSource] = useState<"file" | "cloud">("file");
  const [importMode, setImportMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);

  // Cloud backup state & indicators
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

  // Load cloud backup info and last backup timestamp on opening backup tab
  useEffect(() => {
    if (activeTab === "backup") {
      if (typeof window !== "undefined") {
        const time = localStorage.getItem("penrx_last_backup_time");
        if (time) setLastSilentBackupTime(time);
      }
      setIsLoadingCloudInfo(true);
      fetchLatestCloudBackupInfo()
        .then((res) => setCloudBackupInfo(res))
        .catch(() => {})
        .finally(() => setIsLoadingCloudInfo(false));
    }
  }, [activeTab]);

  // Mandatory Profile Check: Doctor Name, Clinic Name, and Phone are required for Portal sync
  const isProfileComplete = Boolean(
    clinic.isProfileSaved &&
    clinic.doctorName?.trim() &&
    (clinic.name?.trim() || clinic.nameAr?.trim()) &&
    clinic.phone?.trim()
  );

  // Read-only / Dimmed edit state: open immediately if profile is incomplete
  const [isEditing, setIsEditing] = useState<boolean>(!isProfileComplete);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(branches.length === 0);

  // Local form state for Clinic Profile
  const [name, setName] = useState(clinic.name || "");
  const [nameAr, setNameAr] = useState(clinic.nameAr || "");
  const [doctorName, setDoctorName] = useState(clinic.doctorName || "");
  const [doctorTitle, setDoctorTitle] = useState(clinic.doctorTitle || "");
  const [specialty, setSpecialty] = useState(clinic.specialty || "");
  const [syndicateId, setSyndicateId] = useState(clinic.syndicateId || "");
  const [clinicPhone, setClinicPhone] = useState(clinic.phone || "");
  const [branchAddress, setBranchAddress] = useState(clinic.address || branches[0]?.address || "");
  const [workingHours, setWorkingHours] = useState(clinic.workingHours || branches[0]?.workingHours || "يومياً من 4 مساءً حتى 10 مساءً");
  const [footerText, setFooterText] = useState(clinic.footerText || "");
  const [logoUrl, setLogoUrl] = useState(clinic.logoUrl || "");
  const [logoWidth, setLogoWidth] = useState(clinic.logoWidth || 80);
  const [primaryColor, setPrimaryColor] = useState(clinic.primaryColor || "#059669");
  const [fontFamily, setFontFamily] = useState(clinic.fontFamily || "'Cairo', sans-serif");
  const [templateId, setTemplateId] = useState<PrescriptionTemplate>(clinic.templateId || "classic");
  const [paperSize, setPaperSize] = useState<"A5" | "A6" | "A4" | "B5">(clinic.paperSize || "A5");
  const [showHeader, setShowHeader] = useState(clinic.showHeader !== false);
  const [showFooter, setShowFooter] = useState(clinic.showFooter !== false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(clinic.biometricsEnabled || false);

  // Biometrics & Save feedbacks
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  // Sync form fields from clinic data
  const syncFormFromClinic = (c: typeof clinic, bList = branches) => {
    if (!c) return;
    const activeB = bList.find((b) => b.id === activeBranchId) || bList[0];
    setName(activeB?.name || c.name || "");
    setNameAr(activeB?.nameAr || c.nameAr || "");
    setDoctorName(activeB?.doctorName || c.doctorName || "");
    setDoctorTitle(activeB?.doctorTitle || c.doctorTitle || "");
    setSpecialty(activeB?.specialty || c.specialty || "");
    setSyndicateId(activeB?.syndicateId || c.syndicateId || "");
    setClinicPhone(activeB?.phone || c.phone || "");
    setBranchAddress(activeB?.address || c.address || "");
    setWorkingHours(activeB?.workingHours || c.workingHours || "يومياً من 4 مساءً حتى 10 مساءً");
    setFooterText(c.footerText || "");
    setLogoUrl(c.logoUrl || "");
    setLogoWidth(c.logoWidth || 80);
    setPrimaryColor(c.primaryColor || "#059669");
    setFontFamily(c.fontFamily || "'Cairo', sans-serif");
    setTemplateId(c.templateId || "classic");
    setPaperSize(c.paperSize || "A5");
    setShowHeader(c.showHeader !== false);
    setShowFooter(c.showFooter !== false);
    setBiometricsEnabled(c.biometricsEnabled || false);
  };

  useEffect(() => {
    async function checkHardware() {
      const avail = await isBiometricAvailable();
      setHasBiometricsHardware(avail);
    }
    checkHardware();

    // Populate initial saved clinic data
    if (clinic.isProfileSaved || clinic.doctorName || clinic.nameAr || clinic.address || clinic.phone) {
      syncFormFromClinic(clinic);
    }

    // Subscribe to hydration completion so data is never lost on refresh
    const unsub = useClinicStore.persist?.onFinishHydration?.(() => {
      const state = useClinicStore.getState();
      syncFormFromClinic(state.clinic, state.branches);
    });

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "patientFields" || window.location.hash === "#patientFields") {
        setActiveTab("patientFields");
      } else if (tabParam === "backup" || window.location.hash === "#backup") {
        setActiveTab("backup");
      } else {
        setActiveTab("profile");
      }
    }

    return () => unsub?.();
  }, []);

  // When branches exist/change, manage initial edit mode
  useEffect(() => {
    if (branches.length === 0) {
      setIsEditing(true);
      setIsAddingNew(true);
    } else if (!activeBranchId && branches[0]?.id) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches.length, activeBranchId]);

  // When activeBranchId changes, sync the active branch data into the form
  useEffect(() => {
    if (activeBranchId && branches.length > 0) {
      const currentBranch = branches.find((b) => b.id === activeBranchId);
      if (currentBranch) {
        if (currentBranch.address !== undefined) setBranchAddress(currentBranch.address);
        if (currentBranch.phone !== undefined) setClinicPhone(currentBranch.phone);
        if (currentBranch.nameAr !== undefined) setNameAr(currentBranch.nameAr);
        if (currentBranch.name !== undefined) setName(currentBranch.name);
        if (currentBranch.doctorName !== undefined) setDoctorName(currentBranch.doctorName);
        if (currentBranch.doctorTitle !== undefined) setDoctorTitle(currentBranch.doctorTitle);
        if (currentBranch.specialty !== undefined) setSpecialty(currentBranch.specialty);
        if (currentBranch.syndicateId !== undefined) setSyndicateId(currentBranch.syndicateId);
        if (currentBranch.workingHours !== undefined) setWorkingHours(currentBranch.workingHours);
      }
      setIsEditing(false);
      setIsAddingNew(false);
    }
  }, [activeBranchId]);

  const handleTestBiometrics = async () => {
    setBiometricFeedback("يرجى لمس مستشعر البصمة على جهازك للتحقق...");
    const success = await authenticateWithBiometrics(doctorName || "Doctor");
    if (success) {
      setBiometricFeedback("✅ تم التحقق من البصمة بنجاح! جهازك مهيأ للدخول البيومتري.");
      setBiometricsEnabled(true);
      updateClinic({ biometricsEnabled: true });
    } else {
      setBiometricFeedback("⚠️ لم يتم التحقق أو تم إلغاء البصمة.");
    }
    setTimeout(() => setBiometricFeedback(null), 6000);
  };

  const handleSaveClinicSettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Mandatory Portal Sync Validation: Doctor name, clinic name, and phone must not be empty!
    if (!doctorName.trim()) {
      showGlobalToast("⚠️ يرجى إدخال اسم الطبيب الكامل — إلزامي للمزامنة مع البورتال والروشتة", "error");
      return;
    }
    if (!nameAr.trim() && !name.trim()) {
      showGlobalToast("⚠️ يرجى إدخال اسم المركز / العيادة — إلزامي للمزامنة مع البورتال", "error");
      return;
    }
    if (!clinicPhone.trim()) {
      showGlobalToast("⚠️ يرجى إدخال رقم هاتف العيادة / الحجز — إلزامي للمزامنة مع البورتال", "error");
      return;
    }

    const isFirstBranchEver = branches.length === 0;

    const updates = {
      name: name.trim(),
      nameAr: nameAr.trim(),
      doctorName: doctorName.trim(),
      doctorTitle: doctorTitle.trim(),
      specialty: specialty.trim(),
      syndicateId: syndicateId.trim(),
      phone: clinicPhone.trim(),
      address: branchAddress.trim(),
      workingHours: workingHours.trim(),
      footerText: footerText.trim(),
      logoUrl: logoUrl.trim(),
      logoWidth,
      primaryColor,
      fontFamily,
      templateId,
      paperSize,
      showHeader,
      showFooter,
      biometricsEnabled,
      isProfileSaved: true,
    };

    if (isAddingNew) {
      // Adding a new branch
      const newId = addBranch({
        name: name.trim(),
        nameAr: nameAr.trim(),
        address: branchAddress.trim(),
        phone: clinicPhone.trim(),
        workingHours: workingHours.trim(),
        isDefault: branches.length === 0,
        doctorName: doctorName.trim(),
        doctorTitle: doctorTitle.trim(),
        specialty: specialty.trim(),
        syndicateId: syndicateId.trim(),
      });
      updateClinic(updates);
      setActiveBranchId(newId);
      setIsAddingNew(false);
    } else if (branches.length === 0) {
      // First branch ever created
      saveClinicAndCreateFirstBranch(updates);
    } else {
      // Updating the active branch
      const targetId = activeBranchId || branches[0]?.id;
      if (targetId) {
        updateBranch(targetId, {
          nameAr: nameAr.trim(),
          name: name.trim(),
          address: branchAddress.trim(),
          phone: clinicPhone.trim(),
          workingHours: workingHours.trim(),
          doctorName: doctorName.trim(),
          doctorTitle: doctorTitle.trim(),
          specialty: specialty.trim(),
          syndicateId: syndicateId.trim(),
        });
      }
      updateClinic(updates);
    }

    // Mandatory Portal Sync: Always propagate updated doctorName, clinicName, and clinicPhone to Subscription in Supabase & Portal
    const baseClinicName = (nameAr || name || ("عيادة د. " + doctorName)).trim();
    const syncedClinicName = clinicPhone.trim()
      ? `${baseClinicName} • 📞 ${clinicPhone.trim()}`
      : baseClinicName;

    try {
      const subState = useSubscriptionStore.getState();
      const targetSubId = subState.subscriberId || subState.machineId || machineId;
      if (targetSubId) {
        fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_profile",
            subscriberId: subState.subscriberId,
            machineId: subState.machineId || machineId,
            doctorName: doctorName.trim(),
            clinicName: syncedClinicName,
            phone: clinicPhone.trim(),
          }),
        }).catch((err) => console.warn("Portal sync notice:", err));
      }
    } catch {}

    // Direct Supabase REST PATCH as secondary guarantee
    if (machineId) {
      const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1/Subscription";
      const SUPABASE_ANON_KEY =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

      fetch(`${SUPABASE_REST_URL}?machineId=eq.${encodeURIComponent(machineId)}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorName: doctorName.trim(),
          clinicName: syncedClinicName,
          updatedAt: new Date().toISOString(),
        }),
      }).catch((err) => console.warn("Supabase sub sync notice:", err));
    }

    // Re-lock the form into dimmed read-only mode
    setIsEditing(false);

    showGlobalToast("✅ تم حفظ وتأكيد بيانات العيادة ومزامنتها مع البورتال بنجاح! تم فتح كامل أقسام البرنامج.", "success");
    setSavedSuccessMsg("تم حفظ بيانات وهوية العيادة بنجاح ومزامنتها مع البورتال. تم فتح كامل أقسام البرنامج الآن.");
    setTimeout(() => setSavedSuccessMsg(null), 4500);
  };

  return (
    <div className="space-y-6 pb-20 font-sans" dir="rtl">
      {/* ── Fixed Floating Confirmation Toast on Save ────────────────────────── */}
      {savedSuccessMsg && (
        <div className="fixed top-6 sm:top-10 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto px-6 py-4 rounded-3xl bg-slate-900/95 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl flex items-center gap-4 text-white animate-in fade-in zoom-in-95 duration-300">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 animate-bounce" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
              <span>تأكيد الحفظ الفعلي والمزامنة</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Cloud Synced ✓
              </span>
            </h4>
            <p className="text-xs text-slate-200 font-medium leading-relaxed">
              {savedSuccessMsg}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSavedSuccessMsg(null)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mr-auto shrink-0 cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              إعدادات المركز وهوية الروشتة المطبوعة
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              Settings & Customization
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            خصص بيانات الطبيب، اللوجو، ألوان وخطوط الروشتة، وحقول بيانات المريض بكل سهولة واحترافية.
          </p>
        </div>

        {/* Mandatory Profile Setup Notice if not complete */}
        {!isProfileComplete && (
          <div className="w-full p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 shadow-xl space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span>خطوة أولى إلزامية: استكمال بيانات الطبيب والعيادة ورقم الهاتف 🏥</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/90 leading-relaxed font-medium">
              تم تفعيل اشتراكك بنجاح! لا يمكن الانتقال لأي قسم آخر أو كتابة الروشتات إلا بعد ملء الحقول الإلزامية المؤشر عليها بنجمة (<span className="text-rose-400 font-black">*</span>) بالأسفل: <strong>اسم الطبيب</strong>، <strong>اسم العيادة</strong>، و<strong>رقم الهاتف</strong>، ثم الضغط على زر <strong>&quot;حفظ بيانات وهوية العيادة&quot;</strong> بالأسفل لمزامنتها مع البورتال واعتماد نسختك.
            </p>
          </div>
        )}

        {/* Tab Navigation Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1 rounded-2xl bg-slate-800 border border-slate-700/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeTab === "profile"
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            هوية وتصميم المركز والفروع 🏥
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("patientFields")}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeTab === "patientFields"
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            حقول بيانات المريض بالروشتة 👤
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
              activeTab === "backup"
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            النسخ الاحتياطي والأرشفة 🔒💾
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CLINIC PROFILE, BRANCHES & PRESCRIPTION DESIGN */}
      {/* ============================================================ */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Controls Column (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">

            {/* ── Branch Control Bar (حاوية إدارة الفروع والعيادة بتصميم منظم واحترافي) ── */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
              {/* Header: Title + Branch count badge + Status Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black text-slate-100">
                        إدارة الفروع والعيادة
                      </h2>
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                        {branches.length} {branches.length === 1 ? "فرع مسجل" : "فروع مسجلة"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اختر الفرع للتحكم ببياناته وتصميمه، البيانات معتّمة ومحمية تلقائياً لمنع التعديل العرضي.
                    </p>
                  </div>
                </div>

                {/* Edit Mode indicator (only when editing) */}
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{isAddingNew ? "وضع إضافة فرع جديد 🏥" : "وضع التعديل مفتوح 🔓"}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* 1. السطر الأول: أزرار التحكم في سطر واحد */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {/* زر إضافة فرع جديد */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(true);
                    setIsEditing(true);
                    setBranchAddress("");
                    setClinicPhone("");
                    setWorkingHours("يومياً من 4 مساءً حتى 10 مساءً");
                    showGlobalToast("🏥 اكتب بيانات الفرع الجديد أدناه ثم انقر على حفظ لإضافته إلى قائمة فروعك.", "info");
                  }}
                  className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة فرع جديد 🏥</span>
                </button>

                {/* زر تعديل الفرع / إلغاء التعديل */}
                {branches.length > 0 && (
                  !isEditing ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setIsAddingNew(false);
                        showGlobalToast("🔓 تم فتح الحقول للتعديل! يمكنك تعديل بيانات وتصميم الفرع ثم الحفظ.", "info");
                      }}
                      className="h-11 px-5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>تعديل الفرع ✏️</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setIsAddingNew(false);
                        syncFormFromClinic(clinic, branches);
                      }}
                      className="h-11 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                    >
                      <X className="w-4 h-4" />
                      <span>إلغاء التعديل</span>
                    </button>
                  )
                )}

                {/* زر حذف الفرع */}
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const branchToDelete = branches.find((b) => b.id === activeBranchId) || branches[0];
                      if (!branchToDelete) return;
                      if (confirm(`هل أنت متأكد من حذف فرع "${branchToDelete.nameAr || branchToDelete.name}"؟`)) {
                        deleteBranch(branchToDelete.id);
                        showGlobalToast("🗑️ تم حذف الفرع بنجاح.", "info");
                        if (branches.length <= 1) {
                          setIsEditing(true);
                          setIsAddingNew(true);
                        } else {
                          setIsEditing(false);
                        }
                      }
                    }}
                    className="h-11 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-bold"
                    title="حذف هذا الفرع"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف الفرع</span>
                  </button>
                )}
              </div>

              {/* 2. السطر الثاني: يلي الأزرار مباشرة وفيه القائمة المنسدلة وبجانبها زر النجمة ⭐ */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <select
                    value={activeBranchId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setActiveBranchId(nextId);
                      setIsEditing(false);
                      setIsAddingNew(false);
                    }}
                    disabled={branches.length === 0}
                    className="w-full h-11 px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs sm:text-sm font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none pl-10 truncate"
                  >
                    {branches.length === 0 ? (
                      <option value="">(لا توجد فروع مسجلة - اكتب البيانات أدناه لحفظ أول فرع)</option>
                    ) : (
                      branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.isDefault ? "⭐ " : ""}{b.nameAr || b.name || "فرع بدون اسم"} {b.address ? `• 📍 ${b.address}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>

                {/* Single Star Button: زر النجمة فقط للتعيين الافتراضي */}
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeBranchId) {
                        setDefaultBranch(activeBranchId);
                        showGlobalToast("⭐ تم تعيين هذا الفرع كفرع افتراضي للروشتات بنجاح!", "success");
                      }
                    }}
                    className={`h-11 w-11 rounded-2xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                      activeBranch?.isDefault
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-md shadow-amber-950/30"
                        : "bg-slate-950 border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/10"
                    }`}
                    title={activeBranch?.isDefault ? "هذا هو الفرع الافتراضي حالياً للروشتات ⭐" : "اضغط هنا لتعيين هذا الفرع كفرع افتراضي ⭐"}
                  >
                    <Star className={`w-5 h-5 ${activeBranch?.isDefault ? "fill-amber-400 text-amber-400" : ""}`} />
                  </button>
                )}
              </div>

              {/* Status info bar when adding new branch */}
              {isAddingNew && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>أنت الآن في وضع <strong>إضافة فرع جديد</strong>. عدّل البيانات والتصميم أدناه ثم انقر على زر <strong>حفظ وإضافة الفرع 💾</strong></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setIsEditing(false);
                      syncFormFromClinic(clinic, branches);
                    }}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveClinicSettings} className="space-y-6">
              <div className={!isEditing ? "opacity-60 pointer-events-none select-none transition-all duration-300 relative space-y-6" : "transition-all duration-300 relative space-y-6"}>
                {/* Box 1: Doctor & Clinic Credentials */}
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
                  <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>بيانات المركز الطبي والطبيب المعالج:</span>
                  </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 flex items-center justify-between">
                      <span>اسم المركز / العيادة: <span className="text-rose-400 font-black">*</span></span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">إلزامي للبورتال</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: مجمع عيادات الحياة التخصصي"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 font-bold text-slate-100 focus:outline-none transition-all ${
                        !nameAr.trim() && !name.trim()
                          ? "border-2 border-amber-500/60 focus:border-amber-400 focus:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                          : "border border-slate-700 focus:border-emerald-500"
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">تخصص العيادة:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: جراحة العظام والمفاصل أو طب الأطفال أو أسنان"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 flex items-center justify-between">
                      <span>اسم الطبيب والمعالج الكامل: <span className="text-rose-400 font-black">*</span></span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">إلزامي للبورتال</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="مثال: د. أيمن الشريف"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 font-bold text-slate-100 focus:outline-none transition-all ${
                        !doctorName.trim()
                          ? "border-2 border-amber-500/60 focus:border-amber-400 focus:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                          : "border border-slate-700 focus:border-emerald-500"
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">الدرجة العلمية واللقب المهني:</label>
                    <input
                      type="text"
                      value={doctorTitle}
                      onChange={(e) => setDoctorTitle(e.target.value)}
                      placeholder="مثال: استشاري أول ورئيس قسم الباطنة"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">التخصص الطبي الدقيق:</label>
                    <input
                      type="text"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder="مثال: باطنة وجهاز هضمي وكبد"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">رقم قيد النقابة / ترخيص المزاولة:</label>
                    <input
                      type="text"
                      value={syndicateId}
                      onChange={(e) => setSyndicateId(e.target.value)}
                      placeholder="مثال: 124587 / نقابة الأطباء"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="font-bold text-slate-300 flex items-center justify-between">
                      <span>رقم هاتف العيادة / الحجز (مطبوع على الروشتة): <span className="text-rose-400 font-black">*</span></span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">إلزامي للبورتال</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clinicPhone}
                      onChange={(e) => setClinicPhone(e.target.value)}
                      placeholder="01094085228"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 font-mono font-bold text-slate-100 focus:outline-none transition-all ${
                        !clinicPhone.trim()
                          ? "border-2 border-amber-500/60 focus:border-amber-400 focus:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                          : "border border-slate-700 focus:border-emerald-500"
                      }`}
                      dir="ltr"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="font-bold text-slate-300 block">عنوان الفرع:</label>
                    <input
                      type="text"
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="مثال: شارع التسعين الجنوبي، مجمع عيادات الصفا، الدور الثالث"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Fingerprint & Biometrics Setup */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-emerald-400" />
                      <span>تسجيل الدخول ببصمة الأصبع / Touch ID / Face ID:</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        biometricsEnabled
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {biometricsEnabled ? "البصمة مفعّلة ✅" : "غير مفعّلة 🔒"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    سجل بصمة إصبعك أو وجهك للفتح السريع والآمن دون الحاجة لكتابة كلمات مرور كل مرة.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTestBiometrics}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span>{biometricsEnabled ? "إعادة فحص البصمة 🖐️" : "تفعيل وتسجيل البصمة الآن 🖐️"}</span>
                    </button>
                    {biometricsEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setBiometricsEnabled(false);
                          updateClinic({ biometricsEnabled: false });
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-300 text-xs font-bold transition-all border border-slate-700"
                      >
                        إلغاء التفعيل
                      </button>
                    )}
                  </div>

                  {biometricFeedback && (
                    <p className="text-xs font-black text-amber-300 pt-1">{biometricFeedback}</p>
                  )}
                </div>
              </div>

              {/* Box 2: Logo Customization */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>تخصيص لوجو العيادة المطبوع على الروشتة (Clinic Logo):</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Logo Preview Box with Fixed Sizing */}
                  <div className="sm:col-span-4 flex items-center justify-center p-3 rounded-2xl bg-slate-950 border border-slate-800 min-h-[100px] relative group">
                    {logoUrl ? (
                      <div className="relative w-full flex items-center justify-center">
                        <img
                          src={logoUrl}
                          alt="Clinic Logo Preview"
                          className="max-h-24 max-w-full object-contain rounded-xl shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-500 transition-colors cursor-pointer"
                          title="حذف اللوجو"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center space-y-1 text-slate-500">
                        <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
                        <span className="text-[11px] block font-semibold">بدون لوجو حالياً</span>
                      </div>
                    )}
                  </div>

                  {/* File Upload Button & Link Input */}
                  <div className="sm:col-span-8 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer transition-all">
                        <Upload className="w-4 h-4" />
                        <span>اختر صورة لوجو من جهازك (Upload File)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (reader.result) {
                                  setLogoUrl(reader.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400 font-semibold">أو عبر رابط صورة:</span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="رابط اللوجو الإلكتروني (https://...)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 pr-9"
                      />
                      <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    </div>

                    <p className="text-[10px] text-slate-400">
                      يتم ضبط أبعاد اللوجو تلقائياً لتناسب الترويسة العلوية بجودة طباعة فائقة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Box 3: Header & Footer Toggles & Text */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>ترويسة وتذييل الروشتة المطبوعة (Header & Footer):</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-all">
                    <div>
                      <span className="font-bold text-slate-200 block">إظهار ترويسة الروشتة (Header)</span>
                      <span className="text-[10px] text-slate-400">طباعة اسم المركز والشعار والبيانات العلوية</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showHeader}
                      onChange={(e) => setShowHeader(e.target.checked)}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/40 transition-all">
                    <div>
                      <span className="font-bold text-slate-200 block">إظهار تذييل الروشتة (Footer)</span>
                      <span className="text-[10px] text-slate-400">طباعة عنوان الفرع ورقم الهاتف والباركود أسفل الورقة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showFooter}
                      onChange={(e) => setShowFooter(e.target.checked)}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">مواعيد العمل بالفرع:</label>
                    <input
                      type="text"
                      value={workingHours}
                      onChange={(e) => setWorkingHours(e.target.value)}
                      placeholder="مثال: يومياً من 4 مساءً حتى 10 مساءً عدا الجمعة"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-300 block">نص التذييل السفلي (Footer Text):</label>
                    <input
                      type="text"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="مثال: نتمنى لكم موفور الصحة والشفاء العاجل"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Box 4: Colors & Typography Customization */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>تخصيص ألوان وخطوط الروشتة (Theme & Typography):</span>
                </h3>

                {/* Colors presets */}
                <div className="space-y-2 text-xs">
                  <label className="font-bold text-slate-300 block">اختر لون هوية الروشتة المطبوعة:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {COLOR_PRESETS.map((color) => {
                      const isSelected = primaryColor.toLowerCase() === color.hex.toLowerCase();

                      return (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setPrimaryColor(color.hex)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/20 text-white"
                              : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color.hex }} />
                            <span className="text-[11px] font-bold">{color.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Color Picker */}
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-bold">أو اختر لونك الخاص:</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs font-bold text-slate-300 uppercase">{primaryColor}</span>
                  </div>
                </div>

                {/* Fonts selection */}
                <div className="space-y-2 text-xs pt-3 border-t border-slate-800">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-emerald-400" />
                    <span>اختر نوع الخط العربي للروشتة:</span>
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {FONT_PRESETS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paper Size Selector (Accurate Dimensions & Live Reflection) */}
                <div className="space-y-2 text-xs pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-300 block">حجم ورق الطباعة الافتراضي للروشتة:</label>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {paperSize === "A5"
                        ? "A5: 14.8 × 21 سم (1748 × 2480 px)"
                        : paperSize === "A6"
                        ? "A6: 10.5 × 14.8 سم (1240 × 1748 px)"
                        : paperSize === "A4"
                        ? "A4: 21 × 29.7 سم (2480 × 3508 px)"
                        : "B5: 17.6 × 25 سم"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* A5 - Primary & Default */}
                    <button
                      type="button"
                      onClick={() => setPaperSize("A5")}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                        paperSize === "A5"
                          ? "bg-emerald-600/25 text-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-emerald-300">A5 (الأساسي والافتراضي) ★</span>
                        {paperSize === "A5" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium block mt-1">14.8 × 21 سم (5.8 × 8.3 بوصة)</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">1748 × 2480 px • نصف ورقة A4 القياسية</span>
                    </button>

                    {/* A6 - Compact */}
                    <button
                      type="button"
                      onClick={() => setPaperSize("A6")}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                        paperSize === "A6"
                          ? "bg-emerald-600/25 text-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">A6 (المصغر)</span>
                        {paperSize === "A6" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium block mt-1">10.5 × 14.8 سم (4.1 × 5.8 بوصة)</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">1240 × 1748 px • ربع ورقة A4 للروشتات السريعة</span>
                    </button>

                    {/* A4 - Full */}
                    <button
                      type="button"
                      onClick={() => setPaperSize("A4")}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                        paperSize === "A4"
                          ? "bg-emerald-600/25 text-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">A4 (كامل)</span>
                        {paperSize === "A4" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium block mt-1">21 × 29.7 سم (8.3 × 11.7 بوصة)</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">2480 × 3508 px • للمستشفيات والتقارير الطبية</span>
                    </button>

                    {/* B5 - Intermediate */}
                    <button
                      type="button"
                      onClick={() => setPaperSize("B5")}
                      className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                        paperSize === "B5"
                          ? "bg-emerald-600/25 text-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">B5 (وسيط)</span>
                        {paperSize === "B5" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium block mt-1">17.6 × 25 سم (6.9 × 9.8 بوصة)</span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">مناسب لدفاتر الروشتات الخاصة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Box 5: Prescription Templates Customization (قوالب أشكال الروشتة) */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>قوالب وتصاميم شكل الروشتة الطبية (Prescription Design Templates):</span>
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    6 قوالب طبية احترافية
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  اختر الشكل والإطار الفني للروشتة المطبوعة. يمكنك تجربة أي قالب بالنقر عليه لمعاينته حياً على اليسار فوراً قبل الحفظ:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                  {PRESCRIPTION_TEMPLATES.map((tmpl) => {
                    const isSelected = templateId === tmpl.id;

                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => setTemplateId(tmpl.id)}
                        className={`group relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40"
                            : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-black text-slate-100">{tmpl.name}</h4>
                                {tmpl.id === "classic" && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    الافتراضي
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {tmpl.subtitle}
                              </span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm"
                                  : "border-slate-700 bg-slate-900 text-transparent"
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          </div>

                          {/* Mini visual mockup of the template */}
                          <div
                            className="h-16 w-full rounded-xl border border-slate-800 bg-white relative overflow-hidden p-2 flex flex-col justify-between"
                            style={{
                              borderColor: isSelected ? `${primaryColor}60` : undefined,
                            }}
                          >
                            {/* Header mini strip */}
                            {tmpl.id === "modern_wave" ? (
                              <div
                                className="h-3 w-full rounded-t-sm flex items-center justify-between px-1"
                                style={{
                                  background: `linear-gradient(90deg, ${primaryColor}40, ${primaryColor}15)`,
                                }}
                              >
                                <span className="w-4 h-1 rounded bg-slate-800" />
                                <span className="w-6 h-1 rounded" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : tmpl.id === "tech_hex" ? (
                              <div
                                className="h-3 w-full rounded-t-sm flex items-center justify-between px-1"
                                style={{
                                  borderBottom: `1.5px solid ${primaryColor}`,
                                  backgroundColor: "#f8fafc",
                                }}
                              >
                                <span className="w-3 h-1 rounded bg-slate-700" />
                                <span className="w-5 h-1 rounded" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : tmpl.id === "luxury_gold" ? (
                              <div
                                className="h-3 w-full rounded-t-sm border-b-2 border-double flex items-center justify-between px-1"
                                style={{
                                  borderColor: primaryColor,
                                  backgroundColor: "#fffdfa",
                                }}
                              >
                                <span className="text-[7px] font-bold" style={{ color: primaryColor }}>❖</span>
                                <span className="w-6 h-1 rounded" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : tmpl.id === "clinical_sidebar" ? (
                              <div className="h-3 w-full flex items-center justify-between border-b border-slate-100">
                                <span className="w-4 h-1 rounded bg-slate-700" />
                                <span className="w-5 h-1 rounded" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : tmpl.id === "minimal_clean" ? (
                              <div
                                className="h-3.5 w-full flex items-center justify-between px-1 border-b"
                                style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}08` }}
                              >
                                <span className="text-[7px] font-mono font-black" style={{ color: primaryColor }}>-/\-</span>
                                <span className="text-[7px]">🧬</span>
                                <span className="w-5 h-1 rounded" style={{ backgroundColor: primaryColor }} />
                              </div>
                            ) : (
                              <div
                                className="h-1 w-full"
                                style={{ backgroundColor: primaryColor }}
                              />
                            )}

                            {/* Middle writeable area preview */}
                            <div className="flex items-center justify-between px-1 text-[8px] text-slate-400 font-serif">
                              <span className="font-bold" style={{ color: primaryColor }}>℞</span>
                              <div className="space-y-0.5 flex-1 mx-2">
                                <div className="h-0.5 w-3/4 bg-slate-200 rounded" />
                                <div className="h-0.5 w-1/2 bg-slate-100 rounded" />
                              </div>
                            </div>

                            {/* Footer mini strip */}
                            {tmpl.id === "modern_wave" ? (
                              <div
                                className="h-2.5 w-full rounded-b-sm flex items-center justify-center"
                                style={{
                                  background: `linear-gradient(90deg, ${primaryColor}15, ${primaryColor}40)`,
                                }}
                              >
                                <span className="w-10 h-0.5 rounded bg-slate-400" />
                              </div>
                            ) : tmpl.id === "tech_hex" ? (
                              <div
                                className="h-2.5 w-full flex items-center justify-between px-1 border-t"
                                style={{ borderColor: `${primaryColor}40` }}
                              >
                                <span className="text-[6px]" style={{ color: primaryColor }}>⬡⬡</span>
                                <span className="w-8 h-0.5 rounded bg-slate-400" />
                              </div>
                            ) : tmpl.id === "minimal_clean" ? (
                              <div
                                className="h-2.5 w-full flex items-center justify-between px-1 border-t"
                                style={{ borderColor: `${primaryColor}30` }}
                              >
                                <span className="w-8 h-0.5 rounded bg-slate-400" />
                                <span className="text-[6px] font-mono font-bold" style={{ color: primaryColor }}>-/\-</span>
                              </div>
                            ) : tmpl.id === "clinical_sidebar" ? (
                              <div className="h-2 w-full border-t border-slate-200" />
                            ) : (
                              <div
                                className="h-1 w-full"
                                style={{ backgroundColor: primaryColor }}
                              />
                            )}

                            {/* Sidebar accent indicator */}
                            {tmpl.id === "clinical_sidebar" && (
                              <div
                                className="absolute top-0 right-0 bottom-0 w-1.5"
                                style={{ backgroundColor: primaryColor }}
                              />
                            )}
                          </div>

                          <p className="text-[10px] text-slate-400 leading-normal">
                            {tmpl.description}
                          </p>
                        </div>

                        <div className="pt-2 mt-2 border-t border-slate-900/80 flex items-center justify-between text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tmpl.badgeColor}`}
                          >
                            {tmpl.badge}
                          </span>
                          <span
                            className={`font-bold transition-colors ${
                              isSelected ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                            }`}
                          >
                            {isSelected ? "مفعل حالياً ✓" : "تطبيق هذا القالب"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* End of dimmed fields wrapper */}
              </div>

              {/* Action / Submit Button */}
              <div className="pt-2">
                {isEditing ? (
                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isAddingNew ? "حفظ وإضافة الفرع الجديد إلى القائمة 💾" : "حفظ التعديلات وتأمين بيانات الفرع 💾"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setIsAddingNew(false);
                      showGlobalToast("🔓 تم فتح الحقول للتعديل! يمكنك تعديل بيانات الفرع وشكل الروشتة ثم الحفظ.", "info");
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm shadow-xl shadow-cyan-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-5 h-5" />
                    <span>انقر هنا لفتح وتعديل بيانات وتصميم الفرع والروشتة ✏️</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column: Live Prescription Preview (5 Columns on Desktop) */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            <SettingsPrescriptionPreview
              doctorName={doctorName}
              doctorTitle={doctorTitle}
              specialty={specialty}
              syndicateId={syndicateId}
              nameAr={nameAr}
              name={name}
              workingHours={workingHours}
              footerText={footerText}
              clinicPhone={clinicPhone}
              logoUrl={logoUrl}
              primaryColor={primaryColor}
              fontFamily={fontFamily}
              templateId={templateId}
              paperSize={paperSize}
              showHeader={showHeader}
              showFooter={showFooter}
              visibleFields={visibleFields}
              branchAddress={branchAddress}
              branches={branches}
              activeBranchId={activeBranchId}
              title="معاينة حية فورية للروشتة المطبوعة:"
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PATIENT FIELDS VISIBILITY CUSTOMIZATION */}
      {/* ============================================================ */}
      {activeTab === "patientFields" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column: Patient Fields Toggles (7 Cols on Desktop) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-100">
                    تخصيص حقول بيانات المريض في صفحة كتابة الروشتة
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    حدد الحقول التي ترغب في ظهورها أثناء تحرير الروشتة. انظر للمعاينة الحية على اليسار لرؤية تأثير كل خيار فوراً:
                  </p>
                </div>
              </div>

              {/* Category 1: Demographics & Physical Vitals */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 border-b border-slate-800/80 pb-2">
                  <span>👤 البيانات الشخصية والقياسات الحيوية للمريض:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 1. Age */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">السن (Age):</span>
                      <span className="text-[11px] text-slate-400">إظهار حقل عمر المريض بالسنوات في الروشتة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showAge}
                      onChange={() => toggleVisibleField("showAge")}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 2. Gender */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">الجنس (Gender):</span>
                      <span className="text-[11px] text-slate-400">إظهار خيار جنس المريض (ذكر / أنثى)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showGender}
                      onChange={() => toggleVisibleField("showGender")}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 3. Height */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">الطول (Height):</span>
                      <span className="text-[11px] text-slate-400">إظهار حقل طول المريض بالسنتيمتر (سم)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showHeight}
                      onChange={() => toggleVisibleField("showHeight")}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 4. Weight */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">الوزن (Weight):</span>
                      <span className="text-[11px] text-slate-400">إظهار حقل وزن المريض بالكيلوجرام (كجم)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showWeight}
                      onChange={() => toggleVisibleField("showWeight")}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 5. Blood Type */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all sm:col-span-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">فصيلة الدم (Blood Group):</span>
                      <span className="text-[11px] text-slate-400">إظهار قائمة فصائل الدم (A+, B+, O+, AB...)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showBloodType}
                      onChange={() => toggleVisibleField("showBloodType")}
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Category 2: Clinical Diagnostic Records */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 border-b border-slate-800/80 pb-2">
                  <span>🩺 التشخيص الطبي والسجل المرضي للمريض:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 6. Diagnosis */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50 transition-all sm:col-span-2">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">التشخيص الطبي (Diagnosis):</span>
                      <span className="text-[11px] text-slate-400">إظهار مربع كتابة التشخيص الطبي المباشر في الروشتة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showDiagnosis}
                      onChange={() => toggleVisibleField("showDiagnosis")}
                      className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 7. Chronic Diseases */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-slate-100 block">الأمراض المزمنة والتاريخ الطبي:</span>
                      <span className="text-[11px] text-slate-400">إظهار حقل السجل المرضي المزمن (ضغط، سكري، ربو...)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showMedicalHistory}
                      onChange={() => toggleVisibleField("showMedicalHistory")}
                      className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* 8. Drug Allergies */}
                  <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-amber-300 block">تنبيه حساسية الدواء (Drug Allergies):</span>
                      <span className="text-[11px] text-slate-400">إظهار مربع الحساسية الدوائية للتحذير أثناء وصف الدواء</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleFields.showAllergies}
                      onChange={() => toggleVisibleField("showAllergies")}
                      className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Left Column: Live Prescription Preview reflecting patient fields (5 Cols on Desktop) */}
          <div className="lg:col-span-5 space-y-3 sticky top-4">
            <SettingsPrescriptionPreview
              doctorName={doctorName}
              doctorTitle={doctorTitle}
              specialty={specialty}
              syndicateId={syndicateId}
              nameAr={nameAr}
              name={name}
              workingHours={workingHours}
              footerText={footerText}
              clinicPhone={clinicPhone}
              logoUrl={logoUrl}
              primaryColor={primaryColor}
              fontFamily={fontFamily}
              templateId={templateId}
              paperSize={paperSize}
              showHeader={showHeader}
              showFooter={showFooter}
              visibleFields={visibleFields}
              branchAddress={branchAddress}
              branches={branches}
              activeBranchId={activeBranchId}
              title="معاينة حية لانعكاس حقول المريض بالروشتة:"
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: BACKUP & DATA RETENTION / ARCHIVING (SIMPLIFIED & AUTOMATED) */}
      {/* ============================================================ */}
      {activeTab === "backup" && (
        <div className="space-y-6">
          {/* Top Banner: Silent Daily Backup & Automated Annual Archiving */}
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
                    localStorage.setItem("penrx_last_backup_time", nowIso);
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
                className="w-full md:w-auto px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <CloudUpload className={`w-4 h-4 ${isManualCloudSaving ? "animate-bounce" : ""}`} />
                <span>{isManualCloudSaving ? "جاري الحفظ السحابي..." : "حفظ نسخة سحابية الآن ☁️"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Column 1: Export Backup (Simple 1-Click - 6 Cols) */}
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
                        filename: res.filename,
                        itemCounts: {
                          prescriptions: res.metadata.totalPrescriptions,
                          activePrescriptions: res.metadata.activePrescriptions,
                          archivedPrescriptions: res.metadata.archivedPrescriptions,
                          patients: res.metadata.totalPatients,
                        },
                      });
                      downloadBackupFile(res.blob, res.filename);
                      showGlobalToast("📦 تم تصدير وتحميل النسخة الاحتياطية بنجاح!", "success");
                    } catch (err: any) {
                      console.error("Backup export error:", err);
                      showGlobalToast(`❌ فشل تصدير النسخة: ${err.message || err}`, "error");
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  disabled={isExporting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <Download className={`w-4 h-4 ${isExporting ? "animate-pulse" : ""}`} />
                  <span>{isExporting ? "جاري تجهيز وتحميل الملف..." : "تحميل النسخة الاحتياطية على جهازك (.penrx)"}</span>
                </button>

                {/* Export Results */}
                {exportStats && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-in fade-in text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تم إنشاء وتصدير الملف بنجاح!</span>
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400 bg-slate-950 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {exportStats.filename}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-sans">قبل الضغط</div>
                        <div className="font-bold text-slate-300">
                          {(exportStats.uncompressedBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-sans">حجم الملف النهائي</div>
                        <div className="font-bold text-emerald-400">
                          {(exportStats.compressedBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-[10px] text-slate-500 font-sans">نسبة التوفير</div>
                        <div className="font-bold text-teal-300">
                          {exportStats.savingsPercent}% 🚀
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Dual-Choice Import (Device vs Cloud - 6 Cols) */}
            <div className="lg:col-span-6 space-y-6">
              <div className="p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-100">استيراد واستعادة نسخة احتياطية</h3>
                      <p className="text-[11px] text-slate-400">اختر مصدر الاستعادة: من ملف الجهاز أو من السحابة</p>
                    </div>
                  </div>
                </div>

                {/* Dual-Choice Selector Buttons */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setImportSource("file");
                      setImportResult(null);
                    }}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      importSource === "file"
                        ? "bg-cyan-600 text-white shadow-md font-black"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>من هذا الجهاز 💻</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportSource("cloud");
                      setImportResult(null);
                      if (!cloudBackupInfo) {
                        setIsLoadingCloudInfo(true);
                        fetchLatestCloudBackupInfo()
                          .then((res) => setCloudBackupInfo(res))
                          .catch(() => {})
                          .finally(() => setIsLoadingCloudInfo(false));
                      }
                    }}
                    className={`py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      importSource === "cloud"
                        ? "bg-teal-600 text-white shadow-md font-black"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Cloud className="w-4 h-4" />
                    <span>من السحابة ☁️</span>
                  </button>
                </div>

                {/* Option A: Restore from Device File */}
                {importSource === "file" && (
                  <div className="space-y-4 animate-in fade-in">
                    <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/80 cursor-pointer transition-all group">
                      <FileArchive className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 transition-colors mb-2" />
                      {selectedBackupFile ? (
                        <div className="text-center space-y-1">
                          <div className="font-mono text-xs font-black text-cyan-300">
                            {selectedBackupFile.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            الحجم: {(selectedBackupFile.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <div className="text-xs font-bold text-slate-300">
                            اضغط لاختيار ملف النسخة (.penrx) من جهازك
                          </div>
                          <div className="text-[10px] text-slate-500">
                            يتم فك التشفير واستعادة البيانات تلقائياً
                          </div>
                        </div>
                      )}
                      <input
                        type="file"
                        accept=".penrx,.json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setSelectedBackupFile(file);
                        }}
                        className="hidden"
                      />
                    </label>

                    {/* Restore Mode Selector */}
                    <div className="grid grid-cols-2 gap-2 text-right">
                      <button
                        type="button"
                        onClick={() => setImportMode("MERGE")}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          importMode === "MERGE"
                            ? "bg-cyan-500/15 border-cyan-500 text-cyan-200"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div className="font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
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
                        <div className="text-[9px] text-slate-500 mt-0.5">تحديث السجل بالكامل بالملف</div>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedBackupFile) {
                          showGlobalToast("⚠️ يرجى اختيار ملف النسخة الاحتياطية أولاً", "error");
                          return;
                        }
                        setIsImporting(true);
                        setImportResult(null);
                        try {
                          const res = await importEncryptedBackup(selectedBackupFile, undefined, importMode);
                          setImportResult(res);
                          if (res.success) {
                            showGlobalToast(`✅ ${res.message}`, "success");
                            setSelectedBackupFile(null);
                          } else {
                            showGlobalToast(`❌ ${res.message}`, "error");
                          }
                        } catch (err: any) {
                          setImportResult({
                            success: false,
                            message: err.message || "فشلت عملية الاستعادة. تأكد من صحة الملف.",
                          });
                          showGlobalToast("❌ فشل استعادة النسخة الاحتياطية", "error");
                        } finally {
                          setIsImporting(false);
                        }
                      }}
                      disabled={isImporting || !selectedBackupFile}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <Unlock className={`w-4 h-4 ${isImporting ? "animate-spin" : ""}`} />
                      <span>{isImporting ? "جاري استعادة البيانات..." : "بدء استعادة النسخة من الملف"}</span>
                    </button>
                  </div>
                )}

                {/* Option B: Restore from Cloud */}
                {importSource === "cloud" && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Cloud className="w-4 h-4 text-teal-400" />
                          <span>النسخة الاحتياطية المحفوظة على السحابة:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLoadingCloudInfo(true);
                            fetchLatestCloudBackupInfo()
                              .then((res) => setCloudBackupInfo(res))
                              .catch(() => {})
                              .finally(() => setIsLoadingCloudInfo(false));
                          }}
                          className="p-1 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
                          title="تحديث البيانات السحابية"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloudInfo ? "animate-spin" : ""}`} />
                        </button>
                      </div>

                      {isLoadingCloudInfo ? (
                        <div className="py-4 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-400 mb-1" />
                          <span>جاري فحص السحابة...</span>
                        </div>
                      ) : cloudBackupInfo?.exists && cloudBackupInfo.backup ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">اسم الملف:</span>
                            <span className="font-mono text-teal-300 font-bold">{cloudBackupInfo.backup.fileName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">تاريخ الحفظ:</span>
                            <span className="font-mono text-slate-200">
                              {new Date(cloudBackupInfo.backup.createdAt).toLocaleString("ar-EG")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">حجم النسخة:</span>
                            <span className="font-mono text-slate-200">{cloudBackupInfo.backup.fileSizeKb} KB</span>
                          </div>
                          {cloudBackupInfo.backup.metadata?.totalPrescriptions !== undefined && (
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">عدد الروشتات:</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {cloudBackupInfo.backup.metadata.totalPrescriptions} روشتة
                              </span>
                            </div>
                          )}
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
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-xs shadow-lg shadow-teal-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      <CloudDownload className={`w-4 h-4 ${isImporting ? "animate-bounce" : ""}`} />
                      <span>{isImporting ? "جاري استرجاع النسخة السحابية..." : "استرجاع النسخة السحابية الآن ☁️"}</span>
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
      )}
    </div>
  );
}
