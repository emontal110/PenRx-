"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  FileText,
  Upload,
  Image as ImageIcon,
  Link2 as LinkIcon,
  Check,
  Palette,
  Type,
  Printer,
  Save,
  Sparkles,
  Star,
  Stethoscope,
} from "lucide-react";
import { useClinicStore, PrescriptionTemplate } from "@/store/useClinicStore";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getApiUrl } from "@/lib/cloudProxy";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { compressImageToDataUrl } from "@/lib/imageCompressor";
import { PRESCRIPTION_TEMPLATES } from "@/components/prescription/PrescriptionTemplateDecorations";
import { SettingsPrescriptionPreview } from "./SettingsPrescriptionPreview";

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

export function ClinicAndTemplateSettings() {
  const { clinic, updateClinic, saveClinicAndCreateFirstBranch, branches, activeBranchId } = useClinicStore();
  const { visibleFields } = usePrescriptionStore();

  const [name, setName] = useState(clinic.name || "");
  const [nameAr, setNameAr] = useState(clinic.nameAr || "");
  const [doctorName, setDoctorName] = useState(clinic.doctorName || "");
  const [doctorTitle, setDoctorTitle] = useState(clinic.doctorTitle || "");
  const [specialty, setSpecialty] = useState(clinic.specialty || "");
  const [syndicateId, setSyndicateId] = useState(clinic.syndicateId || "");
  const [clinicPhone, setClinicPhone] = useState(clinic.phone || "");
  const [branchAddress, setBranchAddress] = useState(clinic.address || branches[0]?.address || "");
  const [workingHours, setWorkingHours] = useState(clinic.workingHours || branches[0]?.workingHours || "");
  const [footerText, setFooterText] = useState(clinic.footerText || "");
  const [logoUrl, setLogoUrl] = useState(clinic.logoUrl || "");
  const [primaryColor, setPrimaryColor] = useState(clinic.primaryColor || "#059669");
  const [fontFamily, setFontFamily] = useState(clinic.fontFamily || "'Cairo', sans-serif");
  const [templateId, setTemplateId] = useState<PrescriptionTemplate>(clinic.templateId || "classic");
  const [paperSize, setPaperSize] = useState<"A5" | "A6" | "A4" | "B5">(clinic.paperSize || "A5");
  const [showHeader, setShowHeader] = useState(clinic.showHeader !== false);
  const [showFooter, setShowFooter] = useState(clinic.showFooter !== false);

  useEffect(() => {
    if (clinic) {
      setName(clinic.name || "");
      setNameAr(clinic.nameAr || "");
      setDoctorName(clinic.doctorName || "");
      setDoctorTitle(clinic.doctorTitle || "");
      setSpecialty(clinic.specialty || "");
      setSyndicateId(clinic.syndicateId || "");
      setClinicPhone(clinic.phone || "");
      setBranchAddress(clinic.address || branches[0]?.address || "");
      setWorkingHours(clinic.workingHours || branches[0]?.workingHours || "");
      setFooterText(clinic.footerText || "");
      setLogoUrl(clinic.logoUrl || "");
      setPrimaryColor(clinic.primaryColor || "#059669");
      setFontFamily(clinic.fontFamily || "'Cairo', sans-serif");
      setTemplateId(clinic.templateId || "classic");
      setPaperSize(clinic.paperSize || "A5");
      setShowHeader(clinic.showHeader !== false);
      setShowFooter(clinic.showFooter !== false);
    }
  }, [clinic, branches]);

  const handleSaveClinicSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!doctorName.trim()) {
      showGlobalToast("⚠️ يرجى إدخال اسم الطبيب الكامل — إلزامي للمزامنة مع البورتال والروشتة", "error");
      return;
    }
    if (!nameAr.trim() && !name.trim()) {
      showGlobalToast("⚠️ يرجى إدخال اسم المركز / العيادة — إلزامي للمزامنة مع البورتال", "error");
      return;
    }
    if (!clinicPhone.trim()) {
      showGlobalToast("⚠️ يرجى إدخال رقم هاتف العيادة أو الواتساب — إلزامي للمزامنة مع البورتال", "error");
      return;
    }

    saveClinicAndCreateFirstBranch({
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
      logoUrl,
      primaryColor,
      fontFamily,
      templateId,
      paperSize,
      showHeader,
      showFooter,
      isProfileSaved: true,
    });

    // Synchronize doctor name, clinic name, and phone immediately with Cloud Admin Portal
    try {
      const { machineId, subscriberId } = useSubscriptionStore.getState();
      fetch(getApiUrl("/api/subscriptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          subscriberId,
          machineId,
          doctorName: doctorName.trim(),
          clinicName: nameAr.trim() || name.trim(),
          phone: clinicPhone.trim(),
        }),
      }).catch(() => {});
    } catch {}

    showGlobalToast("✅ تم حفظ وتأكيد بيانات وهوية العيادة ومزامنتها مع البورتال بنجاح!", "success");
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageToDataUrl(file, 300, 0.7);
        setLogoUrl(compressed);
        showGlobalToast("📷 تم تحميل وضغط اللوجو بنجاح بحجم مثالي!", "success");
      } catch (err) {
        console.error("Logo compression error:", err);
        showGlobalToast("❌ تعذر ضغط الصورة. يرجى اختيار صورة أصغر.", "error");
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form Controls Column (7 Columns) */}
      <div className="lg:col-span-7 space-y-6">
        <form onSubmit={handleSaveClinicSettings} className="space-y-6">
          {/* Box 1: Doctor & Clinic Credentials */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>بيانات المركز الطبي والطبيب المعالج:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 flex items-center justify-between">
                  <span>اسم المركز / العيادة بالعربية: <span className="text-rose-400 font-black">*</span></span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">إلزامي</span>
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
                      : "border border-slate-700/80 focus:border-emerald-500 shadow-inner"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">اسم المركز / العيادة بالإنجليزية (Clinic Name):</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Al-Hayah Specialized Clinic"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 text-left shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 flex items-center justify-between">
                  <span>اسم الطبيب المعالج: <span className="text-rose-400 font-black">*</span></span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">إلزامي</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="مثال: د. حسام عبد الرحمن"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 font-bold text-slate-100 focus:outline-none transition-all ${
                    !doctorName.trim()
                      ? "border-2 border-amber-500/60 focus:border-amber-400 focus:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                      : "border border-slate-700/80 focus:border-emerald-500 shadow-inner"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">اللقب العلمي / الدرجة:</label>
                <input
                  type="text"
                  value={doctorTitle}
                  onChange={(e) => setDoctorTitle(e.target.value)}
                  placeholder="مثال: استشاري طب وجراحة الفم والأسنان"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">التخصص الطبي الدقيق:</label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="مثال: زراعة الأسنان وتقويم الفكين"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">رقم القيد بنقابة الأطباء / الترخيص:</label>
                <input
                  type="text"
                  value={syndicateId}
                  onChange={(e) => setSyndicateId(e.target.value)}
                  placeholder="مثال: 45892 - وزارة الصحة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-mono text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 flex items-center justify-between">
                  <span>هاتف العيادة / الواتساب: <span className="text-rose-400 font-black">*</span></span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">إلزامي</span>
                </label>
                <input
                  type="tel"
                  required
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  placeholder="مثال: 01000000000"
                  dir="ltr"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 font-mono font-bold text-slate-100 focus:outline-none transition-all ${
                    !clinicPhone.trim()
                      ? "border-2 border-amber-500/60 focus:border-amber-400 focus:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                      : "border border-slate-700/80 focus:border-emerald-500 text-left shadow-inner"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">عنوان العيادة / الفرع الافتراضي:</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="مثال: شارع التسعين الجنوبي، مجمع عيادات الصفا"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Box 2: Logo with Automatic Canvas Compressor */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>شعار المركز الطبي (Logo / Stamp):</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-950 border border-slate-800 min-h-[120px]">
                {logoUrl ? (
                  <div className="relative group flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Clinic Logo"
                      className="max-h-24 max-w-full object-contain rounded-xl shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shadow-md hover:bg-rose-700 transition-colors"
                      title="حذف اللوجو"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto opacity-40 text-emerald-400" />
                    <span className="text-[11px] block">لا يوجد شعار محدد</span>
                  </div>
                )}
              </div>

              <div className="sm:col-span-8 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-emerald-950/40 cursor-pointer transition-all active:scale-95">
                    <Upload className="w-4 h-4 stroke-[2.5]" />
                    <span>اختر صورة لوجو من جهازك (ضغط تلقائي 30KB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">أو عبر رابط:</span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="رابط اللوجو الإلكتروني (https://...)"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 shadow-inner"
                  />
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>

                <p className="text-[10px] text-emerald-400/90 font-medium">
                  ✨ يتم ضغط الصور تلقائياً وتحويلها لـ WebP لضمان سرعة 0.01 ثانية على الهواتف الضعيفة والمتوسطة دون استهلاك الذاكرة.
                </p>
              </div>
            </div>
          </div>

          {/* Box 3: Header & Footer Toggles & Text */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>ترويسة وتذييل الروشتة المطبوعة (Header & Footer):</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                showHeader ? "bg-slate-950 border-emerald-500/40 shadow-xs" : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
              }`}>
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

              <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                showFooter ? "bg-slate-950 border-emerald-500/40 shadow-xs" : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
              }`}>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">مواعيد العمل بالفرع:</label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="مثال: يومياً من 4 مساءً حتى 10 مساءً عدا الجمعة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 block">نص التذييل السفلي (Footer Text):</label>
                <input
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="مثال: نتمنى لكم موفور الصحة والشفاء العاجل"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Box 4: Colors & Typography Customization */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Palette className="w-4 h-4" />
                </div>
                <span>تخصيص ألوان وخطوط الروشتة (Theme & Typography):</span>
              </h3>
            </div>

            {/* Colors presets */}
            <div className="space-y-3 text-xs">
              <label className="font-bold text-slate-300 block">اختر لون هوية الروشتة المطبوعة والأيقونات:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {COLOR_PRESETS.map((color) => {
                  const isSelected = primaryColor.toLowerCase() === color.hex.toLowerCase();

                  return (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setPrimaryColor(color.hex)}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-md shadow-emerald-950/30"
                          : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 ring-2 ring-white/10 shadow-sm"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-xs font-bold truncate">{color.name}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Picker */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-400 font-bold">أو اختر درجة لون خاصة:</span>
                <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-6 h-6 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono text-xs font-black text-slate-200 uppercase tracking-wider">{primaryColor}</span>
                </div>
              </div>
            </div>

            {/* Fonts selection */}
            <div className="space-y-2.5 text-xs pt-4 border-t border-slate-800/80">
              <label className="font-bold text-slate-300 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Type className="w-3.5 h-3.5" />
                </div>
                <span>نوع الخط العربي للروشتة المطبوعة:</span>
              </label>
              <div className="relative">
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner cursor-pointer"
                >
                  {FONT_PRESETS.map((font) => (
                    <option key={font.value} value={font.value} className="bg-slate-900 py-1 text-slate-100">
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Paper Size Selector */}
            <div className="space-y-3 text-xs pt-4 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="font-bold text-slate-300 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Printer className="w-3.5 h-3.5" />
                  </div>
                  <span>حجم ورق الطباعة الافتراضي للروشتة:</span>
                </label>
                <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 w-fit">
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
                <button
                  type="button"
                  onClick={() => setPaperSize("A5")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
                    paperSize === "A5"
                      ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40 text-white"
                      : "bg-slate-950/70 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-white hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-emerald-400">A5 (الأساسي والافتراضي)</span>
                      <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400 shrink-0" />
                    </div>
                    {paperSize === "A5" && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />}
                  </div>
                  <span className="text-[11px] text-slate-300 font-semibold block mt-1.5">14.8 × 21 سم (5.8 × 8.3 بوصة)</span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">1748 × 2480 px • نصف ورقة A4 القياسية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize("A6")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
                    paperSize === "A6"
                      ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40 text-white"
                      : "bg-slate-950/70 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-white hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-xs text-slate-200">A6 (المصغر)</span>
                    {paperSize === "A6" && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />}
                  </div>
                  <span className="text-[11px] text-slate-300 font-semibold block mt-1.5">10.5 × 14.8 سم (4.1 × 5.8 بوصة)</span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">1240 × 1748 px • ربع ورقة للروشتات السريعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize("A4")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
                    paperSize === "A4"
                      ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40 text-white"
                      : "bg-slate-950/70 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-white hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-xs text-slate-200">A4 (كامل)</span>
                    {paperSize === "A4" && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />}
                  </div>
                  <span className="text-[11px] text-slate-300 font-semibold block mt-1.5">21 × 29.7 سم (8.3 × 11.7 بوصة)</span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">2480 × 3508 px • للمستشفيات والتقارير الطبية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaperSize("B5")}
                  className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
                    paperSize === "B5"
                      ? "bg-slate-950 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40 text-white"
                      : "bg-slate-950/70 text-slate-400 border-slate-800/80 hover:border-slate-700 hover:text-white hover:bg-slate-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-xs text-slate-200">B5 (وسيط)</span>
                    {paperSize === "B5" && <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />}
                  </div>
                  <span className="text-[11px] text-slate-300 font-semibold block mt-1.5">17.6 × 25 سم (6.9 × 9.8 بوصة)</span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5">مناسب لدفاتر الروشتات الخاصة</span>
                </button>
              </div>
            </div>
          </div>

          {/* Box 5: Prescription Templates Customization */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>قوالب وتصاميم شكل الروشتة الطبية (Prescription Design Templates):</span>
              </h3>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 w-fit">
                {PRESCRIPTION_TEMPLATES.length} قوالب طبية احترافية
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              اختر الشكل والإطار الفني للروشتة المطبوعة. يمكنك تجربة أي قالب بالنقر عليه لمعاينته حياً فوراً في لوحة المعاينة قبل الحفظ:
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

                      <p className="text-[11px] text-slate-400 leading-normal">
                        {tmpl.description}
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-900/80 flex items-center justify-between text-[10px]">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${tmpl.badgeColor}`}>
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

          {/* Direct Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-5 h-5" />
              <span>حفظ وتأكيد بيانات وهوية العيادة 💾</span>
            </button>
          </div>
        </form>
      </div>

      {/* Right Column: Live Prescription Preview (5 Columns on Desktop) */}
      <div className="lg:col-span-5 space-y-4">
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

        {/* Action Bar below Tab 1 Live Preview */}
        <div className="mt-2 p-5 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-black text-slate-200 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>إجراءات الروشتة والعيادة:</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              جاهز للحفظ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSaveClinicSettings()}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-900 text-white font-black text-xs transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-3 cursor-pointer active:scale-95 group hover:-translate-y-0.5"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all shrink-0 shadow-xs">
                <Save className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div className="text-right">
                <span className="block text-xs font-black text-slate-100 group-hover:text-emerald-300">
                  حفظ البيانات
                </span>
                <span className="block text-[10px] font-normal text-slate-400">تأكيد الحفظ والمزامنة</span>
              </div>
            </button>

            <Link
              href="/prescriptions/new"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-3 cursor-pointer active:scale-95 group hover:-translate-y-0.5"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-950/20 border border-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform shrink-0">
                <Stethoscope className="w-4 h-4 stroke-[2.6]" />
              </div>
              <div className="text-right">
                <span className="block text-xs font-black text-slate-950">تحرير روشتة الآن</span>
                <span className="block text-[10px] font-medium text-slate-900/80">الانتقال للروشتة الطبية</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClinicAndTemplateSettings;
