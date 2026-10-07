"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  Calendar,
  AlertTriangle,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
  Printer,
  MessageCircle,
  CheckCircle2,
  Share2,
  Stethoscope,
  Plus,
  Settings2,
  History,
} from "lucide-react";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { SuperDrugSearch } from "@/components/prescription/SuperDrugSearch";
import { AiPrescriptionInteractionAdvisor } from "@/components/prescription/AiPrescriptionInteractionAdvisor";
import { LivePrescriptionPreview } from "@/components/prescription/LivePrescriptionPreview";
import { PrintValidationModal } from "@/components/prescription/PrintValidationModal";
import { WhatsAppShareModal } from "@/components/prescription/WhatsAppShareModal";
import { NewPrescriptionPromptModal } from "@/components/prescription/NewPrescriptionPromptModal";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { formatEgyptPhoneNumber, calculateBmiInfo } from "@/lib/utils";
import {
  UnifiedPatientRecord,
  extractUnifiedPatients,
  searchPatientCatalog,
  normalizePatientName,
} from "@/lib/patientRegistry";

export default function NewPrescriptionPage() {
  const {
    prescriptionNo,
    patient,
    setPatient,
    diagnosis,
    setDiagnosis,
    notes,
    setNotes,
    items,
    addItem,
    updateItem,
    removeItem,
    clearItems,
    resetCurrentPrescription,
    savePrescription,
    selectedBranchId,
    setSelectedBranchId,
    savedPatients,
    savedPrescriptions,
    visibleFields,
    setVisibleFields,
    toggleVisibleField,
  } = usePrescriptionStore();

  const { branches, clinic } = useClinicStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Ensure visibleFields are synchronized from clinic settings if available
    try {
      const raw = localStorage.getItem("penrx_clinic_storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.clinic?.visibleFields) {
          setVisibleFields(parsed.state.clinic.visibleFields);
        }
      }
    } catch {}
  }, []);

  const bmiInfo = calculateBmiInfo(patient.height, patient.weight);

  const [toast, setToast] = useState<string | null>(null);
  const [patientSuggestions, setPatientSuggestions] = useState<UnifiedPatientRecord[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isPrintValidationOpen, setIsPrintValidationOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isNewRxPromptOpen, setIsNewRxPromptOpen] = useState(false);

  // AI interaction alert count — shared from AiPrescriptionInteractionAdvisor
  const [aiAlertCount, setAiAlertCount] = useState(0);

  // Input ref for focusing patient name on validation failure
  const patientNameInputRef = useRef<HTMLInputElement>(null);

  // Unified catalog of all patients across savedPatients and historical prescriptions
  const unifiedCatalog = React.useMemo(() => {
    return extractUnifiedPatients(savedPatients, savedPrescriptions);
  }, [savedPatients, savedPrescriptions]);

  // Check if current patient matches a record in the doctor's registry
  const matchedPatientRecord = React.useMemo(() => {
    if (!patient.name || !patient.name.trim()) return null;
    const norm = normalizePatientName(patient.name);
    return unifiedCatalog.find((p) => normalizePatientName(p.name) === norm) || null;
  }, [patient.name, unifiedCatalog]);

  // Click outside to dismiss suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        patientDropdownRef.current &&
        !patientDropdownRef.current.contains(e.target as Node) &&
        patientNameInputRef.current &&
        !patientNameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Detect whether current prescription has active unsaved data
  const hasPrescriptionData = Boolean(
    (patient.name && patient.name.trim().length > 0) ||
    items.length > 0 ||
    (diagnosis && diagnosis.trim().length > 0) ||
    (notes && notes.trim().length > 0) ||
    (patient.phone && patient.phone.trim().length > 0)
  );

  // Autocomplete existing patients with smart Arabic normalization & phone search
  const handleNameChange = (val: string) => {
    setPatient({ name: val });
    if (val.trim().length >= 1) {
      const matches = searchPatientCatalog(val, unifiedCatalog, 8);
      setPatientSuggestions(matches);
      setShowSuggestionsDropdown(matches.length > 0);
      setHighlightedSuggestionIndex(0);
    } else {
      setPatientSuggestions([]);
      setShowSuggestionsDropdown(false);
    }
  };

  const handleNameFocus = () => {
    if (patient.name && patient.name.trim().length >= 1) {
      const matches = searchPatientCatalog(patient.name, unifiedCatalog, 8);
      setPatientSuggestions(matches);
      setShowSuggestionsDropdown(matches.length > 0);
    }
  };

  const handleNameBlur = () => {
    // Slight delay to allow mouse click on suggestion item to register
    setTimeout(() => {
      setShowSuggestionsDropdown(false);
      // Auto-fill if exact match found and phone is still blank
      if (patient.name && (!patient.phone || !patient.phone.trim())) {
        const norm = normalizePatientName(patient.name);
        const exact = unifiedCatalog.find((p) => normalizePatientName(p.name) === norm);
        if (exact) {
          handleSelectPatient(exact);
        }
      }
    }, 200);
  };

  // Keyboard navigation inside the patient name input
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestionsDropdown || patientSuggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (matchedPatientRecord) {
          handleSelectPatient(matchedPatientRecord);
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSuggestionIndex((prev) =>
        prev < patientSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : patientSuggestions.length - 1
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (patientSuggestions[highlightedSuggestionIndex]) {
        e.preventDefault();
        handleSelectPatient(patientSuggestions[highlightedSuggestionIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestionsDropdown(false);
    }
  };

  // Select patient and auto-fill ALL patient records instantly
  const handleSelectPatient = (p: UnifiedPatientRecord) => {
    setPatient({
      id: p.id,
      name: p.name,
      phone: p.phone || "",
      age: p.age || "",
      gender: p.gender || "MALE",
      height: p.height || "",
      weight: p.weight || "",
      bloodType: p.bloodType || "",
      allergyNotes: p.allergyNotes || "",
      medicalHistory: p.medicalHistory || "",
    });

    // Auto-fill diagnosis if empty and patient has previous diagnosis
    if ((!diagnosis || !diagnosis.trim()) && p.lastDiagnosis) {
      setDiagnosis(p.lastDiagnosis);
    }

    // Automatically make populated fields visible so the doctor can review them
    const fieldsToReveal: Partial<typeof visibleFields> = {};
    if (p.age) fieldsToReveal.showAge = true;
    if (p.gender) fieldsToReveal.showGender = true;
    if (p.height) fieldsToReveal.showHeight = true;
    if (p.weight) fieldsToReveal.showWeight = true;
    if (p.bloodType) fieldsToReveal.showBloodType = true;
    if (p.allergyNotes) fieldsToReveal.showAllergies = true;
    if (p.medicalHistory) fieldsToReveal.showMedicalHistory = true;
    if (p.lastDiagnosis) fieldsToReveal.showDiagnosis = true;
    setVisibleFields(fieldsToReveal);

    setPatientSuggestions([]);
    setShowSuggestionsDropdown(false);

    if (p.allergyNotes) {
      showGlobalToast(
        `✅ تم استرجاع وتعبئة كامل بيانات ${p.name} بنجاح! ⚠️ تنبيه: المريض لديه حساسية مسجلة (${p.allergyNotes})`,
        "info"
      );
    } else {
      showGlobalToast(
        `✅ تم اختيار وتعبئة كامل بيانات المريض (${p.name}) من سجل العيادة تلقائياً!`,
        "success"
      );
    }
  };

  const handleSaveOnly = () => {
    if (!patient.name.trim()) {
      setIsPrintValidationOpen(true);
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    
    setPatientSuggestions([]);
    setShowSuggestionsDropdown(false);
    
    showGlobalToast("✅ تم حفظ الروشتة في سجل العيادة بنجاح!", "success");
    setToast("✅ تم حفظ الروشتة في سجل العيادة بنجاح! يمكنك مراجعتها أو الضغط على (روشتة جديدة +) للمريض التالي.");
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveAndPrint = () => {
    const hasName = Boolean(patient.name && patient.name.trim().length > 0);
    const hasItems = items.length > 0;
    if (!hasName || !hasItems) {
      setIsPrintValidationOpen(true);
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    showGlobalToast("✅ تم حفظ الروشتة بالسجل وجاري الطباعة...");
    window.print();

    // Keep prescription data on screen so doctor can review, print again, or share via WhatsApp
    showGlobalToast("🖨️ تمت الطباعة وحفظ الروشتة بالسجل بنجاح! يمكنك إرسالها بالواتساب أو النقر على (روشتة جديدة +) للمريض التالي.", "success");
  };

  const handleShareWhatsApp = () => {
    const hasName = Boolean(patient.name && patient.name.trim().length > 0);
    const hasItems = items.length > 0;
    if (!hasName || !hasItems) {
      setIsPrintValidationOpen(true);
      return;
    }
    setIsWhatsAppModalOpen(true);
  };

  // Triggered when doctor clicks "تفريغ الروشتة"
  const handleRequestNewPrescription = () => {
    if (hasPrescriptionData) {
      setIsNewRxPromptOpen(true);
    } else {
      setToast("ℹ️ الروشتة فارغة بالفعل ولا توجد أي بيانات لتفريغها.");
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Option 1 from Step 1 modal: Save current prescription then reset for a new one
  const handleSaveAndStartNew = () => {
    if (!patient.name.trim()) {
      setToast("⚠️ يرجى كتابة اسم المريض أولاً لحفظ الروشتة بالسجل");
      setTimeout(() => setToast(null), 3500);
      setIsPrintValidationOpen(true);
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    resetCurrentPrescription();
    showGlobalToast("✅ تم حفظ الروشتة السابقة وتجهيز روشتة جديدة ✨");
    setToast("✅ تم حفظ الروشتة السابقة بالسجل وتجهيز روشتة جديدة بنجاح ✨");
    setTimeout(() => setToast(null), 4000);
  };

  // Option 2 from Step 2 modal: Confirm permanent discard and start blank new prescription
  const handleConfirmDiscard = () => {
    resetCurrentPrescription();
    setToast("🗑️ تم تفريغ الروشتة الحالية نهائياً وبدء روشتة فارغة جديدة");
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-200 text-xs font-black shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-emerald-300 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              محرر وكتابة الروشتات الطبية
            </h1>
            <span
              suppressHydrationWarning
              className="font-mono text-xs font-black text-emerald-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800"
              dir="ltr"
            >
              {mounted ? prescriptionNo : "..."}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            أدخل بيانات المريض وابحث عن الأدوية بسرعة البرق مع الفحص الدوائي الذكي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRequestNewPrescription}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 font-bold text-xs border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="بدء روشتة جديدة"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>روشتة جديدة +</span>
          </button>

          <button
            type="button"
            onClick={handleSaveOnly}
            className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>حفظ بالسجل 💾</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndPrint}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة مباشرة 🖨️</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Grid: Right Column (Inputs) & Left Column (Prescription Preview on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Column: Inputs, Drug Search, AI Advisor, Notes */}
        <div className="lg:col-span-7 space-y-6">
          {/* Patient Information & Branch Selector Box */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-black text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <span>بيانات المريض والعيادة</span>
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Branch Select or Clean Badge */}
                {branches && branches.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>الفرع:</span>
                    </span>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="px-3 py-1.5 min-w-[130px] rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nameAr || b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : branches && branches.length === 1 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{branches[0].nameAr || branches[0].name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{clinic.nameAr || clinic.name || "العيادة الرئيسية"}</span>
                  </div>
                )}

                {/* Patient Settings Button */}
                <Link
                  href="/settings?tab=patientFields"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="تخصيص وإعدادات حقول بيانات المريض بالروشتة"
                >
                  <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إعدادات المريض</span>
                </Link>
              </div>
            </div>

            {/* Quick Field Visibility Toggle Bar */}
            <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-bold ml-1 flex items-center gap-1 text-[10px] shrink-0">
                <Settings2 className="w-3 h-3 text-emerald-400" />
                <span>حقول الروشتة المفعّلة:</span>
              </span>
              {[
                { key: "showAge", label: "السن", active: visibleFields.showAge },
                { key: "showGender", label: "النوع", active: visibleFields.showGender },
                { key: "showHeight", label: "الطول", active: visibleFields.showHeight },
                { key: "showWeight", label: "الوزن", active: visibleFields.showWeight },
                { key: "showBloodType", label: "الفصيلة", active: visibleFields.showBloodType },
                { key: "showDiagnosis", label: "التشخيص", active: visibleFields.showDiagnosis },
                { key: "showMedicalHistory", label: "الأمراض المزمنة", active: visibleFields.showMedicalHistory },
                { key: "showAllergies", label: "حساسية الدواء", active: visibleFields.showAllergies },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleVisibleField(f.key as any)}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer text-[10px] ${
                    f.active
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                      : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                  title={f.active ? `إخفاء حقل ${f.label} من الروشتة` : `إظهار حقل ${f.label} بالروشتة`}
                >
                  <span className="font-mono">{f.active ? "✓" : "+"}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Patient Fields: Spacious, Elegant 2-Column Responsive Layout */}
            <div className="space-y-4">
              {/* Primary Patient Row: Name (50%) & Phone (50%) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Patient Name with Autocomplete */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                      <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>اسم المريض: *</span>
                    </label>

                    {matchedPatientRecord && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>
                          مسجل بالسجل
                          {matchedPatientRecord.prescriptionCount > 0
                            ? ` (${matchedPatientRecord.prescriptionCount} ${
                                matchedPatientRecord.prescriptionCount === 1 ? "روشتة" : "روشتات"
                              })`
                            : ""}
                        </span>
                      </span>
                    )}

                    {patient.allergyNotes && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span className="truncate max-w-[150px]">حساسية: {patient.allergyNotes}</span>
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      ref={patientNameInputRef}
                      type="text"
                      value={patient.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onFocus={handleNameFocus}
                      onBlur={handleNameBlur}
                      onKeyDown={handleNameKeyDown}
                      placeholder="اكتب اسم المريض أو رقم الهاتف للترشيح الفوري من السجل..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-black text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      autoComplete="off"
                    />

                    {patient.name && (
                      <button
                        type="button"
                        onClick={() => {
                          setPatient({ name: "", phone: "", age: "", height: "", weight: "", bloodType: "", allergyNotes: "", medicalHistory: "" });
                          setPatientSuggestions([]);
                          setShowSuggestionsDropdown(false);
                          patientNameInputRef.current?.focus();
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 text-xs transition-colors"
                        title="مسح الاسم والبيانات"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSuggestionsDropdown && patientSuggestions.length > 0 && (
                    <div
                      ref={patientDropdownRef}
                      className="absolute z-50 top-full mt-2 w-full min-w-[320px] sm:min-w-[440px] bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-200"
                      dir="rtl"
                    >
                      {/* Header with count & keyboard hint */}
                      <div className="px-4 py-2.5 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 font-bold border-b border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>نتائج مطابقة من سجل المرضى ({patientSuggestions.length})</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          اضغط Enter أو اختر بالماوس
                        </span>
                      </div>

                      {/* Suggestions list */}
                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50">
                        {patientSuggestions.map((p, i) => {
                          const isSelected = i === highlightedSuggestionIndex;
                          return (
                            <button
                              key={p.id || i}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectPatient(p);
                              }}
                              onMouseEnter={() => setHighlightedSuggestionIndex(i)}
                              className={`w-full text-right p-3.5 transition-all flex flex-col gap-2 cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-500/10 border-r-4 border-r-emerald-400 pl-3"
                                  : "hover:bg-slate-800/60"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                                      p.gender === "FEMALE"
                                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                        : "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                                    }`}
                                  >
                                    {p.gender === "FEMALE" ? "👩" : "👨"}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-black text-sm text-slate-100 block truncate">
                                      {p.name}
                                    </span>
                                    {p.phone && (
                                      <span className="font-mono text-xs text-emerald-400 flex items-center gap-1 dir-ltr inline-block">
                                        {p.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1 shadow-sm">
                                    <span>تعبئة تلقائية</span>
                                    <CheckCircle2 className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>

                              {/* Badges / Clinical details */}
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                {p.age && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                                    السن: {p.age} سنة
                                  </span>
                                )}
                                {p.bloodType && (
                                  <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 font-bold font-mono">
                                    🩸 {p.bloodType}
                                  </span>
                                )}
                                {p.allergyNotes && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                    <span>حساسية: {p.allergyNotes}</span>
                                  </span>
                                )}
                                {p.medicalHistory && (
                                  <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                                    📋 {p.medicalHistory}
                                  </span>
                                )}
                                {p.prescriptionCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                                    🩺 {p.prescriptionCount}{" "}
                                    {p.prescriptionCount === 1 ? "روشتة سابقة" : "روشتات سابقة"}
                                  </span>
                                )}
                                {p.lastDiagnosis && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/80 max-w-[220px] truncate font-medium">
                                    آخر تشخيص: {p.lastDiagnosis}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Footer Hint */}
                      <div className="px-4 py-2 bg-slate-950/80 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>💡 بمجرد الاختيار يتم تعبئة كافة البيانات (الهاتف، السن، الحساسية، التاريخ الطبي) تلقائياً دون إدخال إضافي</span>
                        <span className="font-mono text-emerald-400 font-bold">سجل PenRX+</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient Phone */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>رقم الهاتف (واتساب):</span>
                  </label>
                  <div className="flex items-stretch rounded-xl overflow-hidden border border-slate-700/80 focus-within:border-emerald-500 bg-slate-950 transition-colors" dir="ltr">
                    <span className="flex items-center justify-center px-3.5 bg-slate-900 border-r border-slate-800 text-emerald-400 font-mono font-bold text-xs select-none shadow-inner">
                      +2
                    </span>
                    <input
                      type="text"
                      value={patient.phone || ""}
                      onChange={(e) => setPatient({ phone: e.target.value })}
                      placeholder="01012345678"
                      className="w-full px-3.5 py-2.5 bg-transparent font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none text-left text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Diagnosis: Generous, Full Width Field */}
              {visibleFields.showDiagnosis && (
                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>التشخيص الطبي (Diagnosis):</span>
                  </label>
                  <input
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="مثال: Acute Bronchitis, GERD, نزلة معوية، التهاب اللوزتين..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Optional Physical/Vitals Fields (Shown only if doctor enabled them in Settings) */}
              {(visibleFields.showAge ||
                visibleFields.showGender ||
                visibleFields.showHeight ||
                visibleFields.showWeight ||
                visibleFields.showBloodType) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
                    {visibleFields.showAge && (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-300">السن (بالسنوات):</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={patient.age || ""}
                          onChange={(e) => setPatient({ age: e.target.value.replace(/[^0-9]/g, "") })}
                          placeholder=""
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}

                    {visibleFields.showGender && (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-300">الجنس:</label>
                        <select
                          value={patient.gender || "MALE"}
                          onChange={(e) => setPatient({ gender: e.target.value as any })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="MALE">ذكر 👨</option>
                          <option value="FEMALE">أنثى 👩</option>
                        </select>
                      </div>
                    )}

                    {visibleFields.showHeight && (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-300">الطول (سم):</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={patient.height || ""}
                          onChange={(e) => setPatient({ height: e.target.value.replace(/[^0-9.]/g, "") })}
                          placeholder=""
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}

                    {visibleFields.showWeight && (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-300">الوزن (كجم):</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={patient.weight || ""}
                          onChange={(e) => setPatient({ weight: e.target.value.replace(/[^0-9.]/g, "") })}
                          placeholder=""
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    )}

                    {visibleFields.showBloodType && (
                      <div className="space-y-1">
                        <label className="font-bold text-slate-300">فصيلة الدم:</label>
                        <select
                          value={patient.bloodType || ""}
                          onChange={(e) => setPatient({ bloodType: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">غير محدد</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                    )}

                    {/* Smart Clinical BMI Gauge & Indicator with Distinctive Colors */}
                    {bmiInfo && (
                      <div className="col-span-2 sm:col-span-3 md:col-span-5 p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-2.5 shadow-lg animate-in fade-in duration-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl shrink-0 p-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
                              {bmiInfo.icon}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-100">
                                  مؤشر كتلة الجسم (BMI):
                                </span>
                                <span
                                  className="font-mono font-black text-sm px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80"
                                  style={{ color: bmiInfo.colorHex }}
                                  dir="ltr"
                                >
                                  {bmiInfo.bmiFormatted} kg/m²
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                الوزن المثالي المقترح لهذا الطول:{" "}
                                <strong className="text-emerald-400 font-mono">
                                  {bmiInfo.idealWeightMin} – {bmiInfo.idealWeightMax} كجم
                                </strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-black border tracking-wide transition-all ${bmiInfo.badgeClass}`}
                            >
                              {bmiInfo.label}
                            </span>
                          </div>
                        </div>

                        {/* Distinctive Visual BMI Spectrum Gauge */}
                        <div className="space-y-1 pt-1">
                          <div className="relative h-2 w-full rounded-full overflow-hidden flex bg-slate-950 border border-slate-800 shadow-inner">
                            {/* 1. Underweight (Sky) */}
                            <div className="h-full w-[20%] bg-gradient-to-r from-sky-500 to-blue-500" title="نقص وزن (< 18.5)" />
                            {/* 2. Normal (Emerald) */}
                            <div className="h-full w-[26%] bg-gradient-to-r from-emerald-500 to-teal-400" title="وزن مثالي (18.5 - 24.9)" />
                            {/* 3. Overweight (Amber) */}
                            <div className="h-full w-[20%] bg-gradient-to-r from-amber-400 to-orange-400" title="وزن زائد (25 - 29.9)" />
                            {/* 4. Obese 1 (Orange-Red) */}
                            <div className="h-full w-[20%] bg-gradient-to-r from-orange-500 to-rose-500" title="سمنة درجة أولى (30 - 34.9)" />
                            {/* 5. Severe (Rose-Crimson) */}
                            <div className="h-full w-[14%] bg-gradient-to-r from-rose-600 to-purple-600" title="سمنة مفرطة (>= 35)" />
                          </div>

                          {/* Gauge Labels */}
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 px-0.5">
                            <span className="text-sky-400 font-mono">&lt; 18.5 نحافة</span>
                            <span className="text-emerald-400 font-mono">18.5 - 25 مثالي</span>
                            <span className="text-amber-400 font-mono">25 - 30 زائد</span>
                            <span className="text-rose-400 font-mono">&gt; 30 سمنة</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Chronic Medical History & Allergies (If enabled in Settings) */}
              {(visibleFields.showMedicalHistory || visibleFields.showAllergies) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
                  {visibleFields.showMedicalHistory && (
                    <div className="space-y-1">
                      <label className="font-bold text-cyan-400">الأمراض المزمنة والتاريخ الطبي:</label>
                      <input
                        type="text"
                        value={patient.medicalHistory || ""}
                        onChange={(e) => setPatient({ medicalHistory: e.target.value })}
                        placeholder="مثال: سكري، ضغط، ربو شعبي..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/30 font-bold text-cyan-200 placeholder:text-cyan-500/40 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}

                  {visibleFields.showAllergies && (
                    <div className="space-y-1">
                      <label className="font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>تنبيه حساسية المريض (Allergies):</span>
                      </label>
                      <input
                        type="text"
                        value={patient.allergyNotes || ""}
                        onChange={(e) => setPatient({ allergyNotes: e.target.value })}
                        placeholder="مثال: حساسية بنسلين، حساسية سلفا، قرحة معدة..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/30 font-bold text-amber-300 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* The World-Class Super Drug Search Component */}
          <SuperDrugSearch
            onAddItem={addItem}
            items={items}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
            aiAlertCount={aiAlertCount}
          />

          {/* AI Prescription Interaction Safety Advisor */}
          <div id="ai-advisor-section">
            <AiPrescriptionInteractionAdvisor
              items={items}
              patient={patient}
              onAlertsChange={setAiAlertCount}
            />
          </div>

          {/* General Notes for Patient */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-2 shadow-lg text-xs">
            <label className="font-bold text-slate-300 block">
              تعليمات وإرشادات ختامية للمريض (تطبع أسفل الروشتة):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: الراحة التامة وتناول السوائل الدافئة، وإعادة الكشف بعد أسبوع للاطمئنان..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-medium text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Left Column: Live Interactive Prescription Preview Canvas (Sticky on Desktop) */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <LivePrescriptionPreview
            prescriptionNo={prescriptionNo}
            patient={patient}
            diagnosis={diagnosis}
            notes={notes}
            items={items}
            onRemoveItem={removeItem}
            onSaveAndPrint={handleSaveAndPrint}
            onShareWhatsApp={handleShareWhatsApp}
          />
        </div>
      </div>

      {/* Modern Print Validation Alert Modal */}
      <PrintValidationModal
        isOpen={isPrintValidationOpen}
        onClose={() => setIsPrintValidationOpen(false)}
        hasPatientName={Boolean(patient.name && patient.name.trim().length > 0)}
        hasItems={items.length > 0}
        onFocusPatientName={() => {
          patientNameInputRef.current?.focus();
        }}
      />

      {/* WhatsApp Share Options Modal (Direct to Patient Phone without App Chooser) */}
      <WhatsAppShareModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        patient={patient}
        clinic={clinic}
        prescriptionNo={prescriptionNo}
        diagnosis={diagnosis}
        notes={notes}
        items={items}
        onSaveBeforeShare={() => {
          const branchObj = branches.find((b) => b.id === selectedBranchId);
          savePrescription(branchObj?.nameAr);
        }}
      />

      {/* 2-Step Confirmation Modal for Starting a New Prescription when unsaved data exists */}
      <NewPrescriptionPromptModal
        isOpen={isNewRxPromptOpen}
        onClose={() => setIsNewRxPromptOpen(false)}
        patientName={patient.name}
        itemsCount={items.length}
        diagnosis={diagnosis}
        onSaveAndContinue={handleSaveAndStartNew}
        onConfirmDiscard={handleConfirmDiscard}
      />
    </div>
  );
}

