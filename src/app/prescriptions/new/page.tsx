"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Phone,
  AlertTriangle,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
  Printer,
  MessageCircle,
  CheckCircle2,
  Stethoscope,
  Settings2,
  Eye,
  ZoomIn,
  ZoomOut,
  Pill,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { LivePrescriptionPreview } from "@/components/prescription/LivePrescriptionPreview";
import { InlineDrugPadInput } from "@/components/prescription/InlineDrugPadInput";
import { AiInteractionModal, InteractionAlert } from "@/components/prescription/AiInteractionModal";
import { PrintValidationModal } from "@/components/prescription/PrintValidationModal";
import { WhatsAppShareModal } from "@/components/prescription/WhatsAppShareModal";
import { NewPrescriptionPromptModal } from "@/components/prescription/NewPrescriptionPromptModal";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { calculateBmiInfo } from "@/lib/utils";
import {
  UnifiedPatientRecord,
  extractUnifiedPatients,
  searchPatientCatalog,
  normalizePatientName,
} from "@/lib/patientRegistry";
import { getApiUrl } from "@/lib/cloudProxy";

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
  } = usePrescriptionStore();

  const { branches, clinic } = useClinicStore();

  const [mounted, setMounted] = useState(false);
  const [isPatientVitalsExpanded, setIsPatientVitalsExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("penrx_clinic_storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.state?.clinic?.visibleFields) {
          setVisibleFields(parsed.state.clinic.visibleFields);
        }
      }
    } catch {}
  }, [setVisibleFields]);

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
  const [isPrescriptionSaved, setIsPrescriptionSaved] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [mobilePreviewScale, setMobilePreviewScale] = useState(0.85);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateScale = () => {
        const w = window.innerWidth;
        if (w < 380) setMobilePreviewScale(0.68);
        else if (w < 480) setMobilePreviewScale(0.76);
        else if (w < 640) setMobilePreviewScale(0.85);
        else if (w < 1024) setMobilePreviewScale(0.92);
        else setMobilePreviewScale(1);
      };
      updateScale();
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
  }, []);

  const [aiAlerts, setAiAlerts] = useState<InteractionAlert[]>([]);
  const [selectedAiAlert, setSelectedAiAlert] = useState<InteractionAlert | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    if (!items || items.length === 0) {
      setAiAlerts([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(getApiUrl("/api/ai/analyze-prescription"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((it) => ({
              id: it.id,
              drugName: it.drugName,
              activeIngredient: it.activeIngredient,
              doseQuantity: it.doseQuantity,
              doseForm: it.doseForm,
              frequency: it.frequency,
              duration: it.duration,
              instructions: it.instructions,
            })),
            patientAllergies: patient.allergyNotes || "",
            patientHistory: patient.medicalHistory || "",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.interactions)) {
            setAiAlerts(data.interactions);
          }
        }
      } catch {}
    }, 550);

    return () => clearTimeout(timer);
  }, [items, patient.allergyNotes, patient.medicalHistory]);

  const handleRemoveConflictingDrug = (drugName: string) => {
    const target = items.find(
      (it) => it.drugName.toLowerCase() === drugName.toLowerCase()
    );
    if (target) {
      removeItem(target.id);
      showGlobalToast(`🗑️ تم حذف ${drugName} لتفادي التعارض الدوائي`, "info");
    }
    setIsAiModalOpen(false);
  };

  const patientNameInputRef = useRef<HTMLInputElement>(null);

  const unifiedCatalog = React.useMemo(() => {
    return extractUnifiedPatients(savedPatients, savedPrescriptions);
  }, [savedPatients, savedPrescriptions]);

  const matchedPatientRecord = React.useMemo(() => {
    if (!patient.name || !patient.name.trim()) return null;
    const norm = normalizePatientName(patient.name);
    return unifiedCatalog.find((p) => normalizePatientName(p.name) === norm) || null;
  }, [patient.name, unifiedCatalog]);

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

  const hasPrescriptionData = Boolean(
    (patient.name && patient.name.trim().length > 0) ||
    items.length > 0 ||
    (diagnosis && diagnosis.trim().length > 0) ||
    (notes && notes.trim().length > 0) ||
    (patient.phone && patient.phone.trim().length > 0)
  );

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
    setTimeout(() => {
      setShowSuggestionsDropdown(false);
      if (patient.name && (!patient.phone || !patient.phone.trim())) {
        const norm = normalizePatientName(patient.name);
        const exact = unifiedCatalog.find((p) => normalizePatientName(p.name) === norm);
        if (exact) handleSelectPatient(exact);
      }
    }, 200);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestionsDropdown || patientSuggestions.length === 0) {
      if (e.key === "Enter" && matchedPatientRecord) {
        e.preventDefault();
        handleSelectPatient(matchedPatientRecord);
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

    if ((!diagnosis || !diagnosis.trim()) && p.lastDiagnosis) {
      setDiagnosis(p.lastDiagnosis);
    }

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
        `✅ تم استرجاع بيانات ${p.name}! ⚠️ تنبيه: حساسية مسجلة (${p.allergyNotes})`,
        "info"
      );
    } else {
      showGlobalToast(
        `✅ تم اختيار وتعبئة بيانات المريض (${p.name}) تلقائياً!`,
        "success"
      );
    }
  };

  useEffect(() => {
    setIsPrescriptionSaved(false);
  }, [patient.name, patient.phone, items, diagnosis, notes]);

  const handleSaveOnly = () => {
    if (!patient.name.trim()) {
      setIsPrintValidationOpen(true);
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    setIsPrescriptionSaved(true);
    setPatientSuggestions([]);
    setShowSuggestionsDropdown(false);

    showGlobalToast("✅ تم حفظ الروشتة وأي أدوية جديدة في قاعدة البيانات بنجاح!", "success");
    setToast("✅ تم حفظ الروشتة في سجل العيادة بنجاح!");
    setTimeout(() => setToast(null), 3500);
  };

  const handlePrintOnly = () => {
    const hasName = Boolean(patient.name && patient.name.trim().length > 0);
    const hasItems = items.length > 0;
    if (!hasName || !hasItems) {
      setIsPrintValidationOpen(true);
      return;
    }
    if (!isPrescriptionSaved) {
      const branchObj = branches.find((b) => b.id === selectedBranchId);
      savePrescription(branchObj?.nameAr);
      setIsPrescriptionSaved(true);
    }
    showGlobalToast("🖨️ تم حفظ الروشتة وجارٍ تجهيز الطباعة...");
    window.print();
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

  const handleRequestNewPrescription = () => {
    if (hasPrescriptionData && !isPrescriptionSaved) {
      setIsNewRxPromptOpen(true);
    } else if (hasPrescriptionData && isPrescriptionSaved) {
      resetCurrentPrescription();
      setIsPrescriptionSaved(false);
      showGlobalToast("✨ تم تجهيز روشتة فارغة للمريض التالي!", "success");
    } else {
      setToast("ℹ️ الروشتة فارغة بالفعل.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const handleSaveAndStartNew = () => {
    if (!patient.name.trim()) {
      setIsPrintValidationOpen(true);
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    resetCurrentPrescription();
    setIsPrescriptionSaved(false);
    showGlobalToast("✅ تم حفظ الروشتة السابقة وتجهيز روشتة جديدة ✨", "success");
  };

  const handleConfirmDiscard = () => {
    resetCurrentPrescription();
    setIsPrescriptionSaved(false);
    setToast("🗑️ تم تفريغ الروشتة الحالية وبدء روشتة جديدة");
    setTimeout(() => setToast(null), 3000);
  };

  const hasExtraVitalsConfigured =
    visibleFields.showAge ||
    visibleFields.showGender ||
    visibleFields.showHeight ||
    visibleFields.showWeight ||
    visibleFields.showBloodType ||
    visibleFields.showMedicalHistory ||
    visibleFields.showAllergies;

  return (
    <div className="space-y-4 sm:space-y-6 pb-28 sm:pb-20">
      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-200 text-xs font-black shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-emerald-300 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-lg no-print print:!hidden">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-2xl font-black text-slate-100 tracking-tight">
              محرر وكتابة الروشتات الطبية
            </h1>
            <span
              suppressHydrationWarning
              className="font-mono text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800"
              dir="ltr"
            >
              {mounted ? prescriptionNo : "..."}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            ابحث أبجدياً أو بنظام Drug Eye (*) مع الفحص الدوائي الذكي والمشاركة المباشرة عبر واتساب
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {branches && branches.length > 1 ? (
            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                    {b.nameAr || b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-bold text-emerald-300">
              <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{branches?.[0]?.nameAr || clinic.nameAr || clinic.name || "العيادة الرئيسية"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print:!block print:!m-0 print:!p-0">
        {/* Column 1: Smart Prescription Workflow */}
        <div className="xl:col-span-5 space-y-4 sm:space-y-5 no-print print:!hidden">

          {/* 1. COMPACT & COLLAPSIBLE PATIENT INFO CARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <User className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-black text-slate-100">بيانات المريض</span>

                {/* Compact Summary Badges when collapsed */}
                {bmiInfo && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono"
                    dir="ltr"
                  >
                    BMI {bmiInfo.bmiFormatted} ({bmiInfo.label})
                  </span>
                )}
                {patient.allergyNotes && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    <span className="truncate max-w-[110px]">{patient.allergyNotes}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {hasExtraVitalsConfigured && (
                  <button
                    type="button"
                    onClick={() => setIsPatientVitalsExpanded(!isPatientVitalsExpanded)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <span>{isPatientVitalsExpanded ? "طي القياسات" : "القياسات والتاريخ"}</span>
                    {isPatientVitalsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                )}

                <Link
                  href="/settings?tab=patientFields"
                  className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 border border-slate-700 transition-all"
                  title="إعدادات حقول المريض"
                >
                  <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                </Link>
              </div>
            </div>

            {/* Primary Row: Patient Name & WhatsApp Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300 text-[11px]">اسم المريض: *</label>
                  {matchedPatientRecord && (
                    <span className="text-[10px] font-bold text-emerald-400">
                      ✓ مسجل ({matchedPatientRecord.prescriptionCount} روشتة)
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
                    placeholder="اسم المريض أو رقم الهاتف للترشيح..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/90 font-black text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    autoComplete="off"
                  />
                  {patient.name && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatient({
                          name: "",
                          phone: "",
                          age: "",
                          height: "",
                          weight: "",
                          bloodType: "",
                          allergyNotes: "",
                          medicalHistory: "",
                        });
                        setPatientSuggestions([]);
                        setShowSuggestionsDropdown(false);
                        patientNameInputRef.current?.focus();
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Patient Autocomplete Dropdown */}
                {showSuggestionsDropdown && patientSuggestions.length > 0 && (
                  <div
                    ref={patientDropdownRef}
                    className="absolute z-50 top-full mt-1.5 w-full min-w-[290px] sm:min-w-[400px] bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800/80"
                    dir="rtl"
                  >
                    <div className="px-3.5 py-2 bg-slate-950/90 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                      <span>سجل المرضى ({patientSuggestions.length})</span>
                      <span className="text-slate-400">اضغط للتعبئة التلقائية</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50">
                      {patientSuggestions.map((p, i) => (
                        <button
                          key={p.id || i}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPatient(p);
                          }}
                          className={`w-full text-right p-3 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            i === highlightedSuggestionIndex ? "bg-emerald-500/15" : "hover:bg-slate-800/60"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-black text-xs text-slate-100 block truncate">
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              {p.phone && <span className="font-mono text-emerald-400">{p.phone}</span>}
                              {p.age && <span>السن: {p.age}</span>}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                            اختيار
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Patient Phone */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px] flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>رقم الهاتف (واتساب):</span>
                </label>
                <div
                  className="flex items-stretch rounded-xl overflow-hidden border border-slate-700/90 focus-within:border-emerald-500 bg-slate-950"
                  dir="ltr"
                >
                  <span className="flex items-center justify-center px-3 bg-slate-900 border-r border-slate-800 text-emerald-400 font-mono font-bold text-xs select-none">
                    +2
                  </span>
                  <input
                    type="tel"
                    value={patient.phone || ""}
                    onChange={(e) => setPatient({ phone: e.target.value })}
                    placeholder="01012345678"
                    className="w-full px-3 py-2.5 bg-transparent font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none text-left text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Expandable Vitals, BMI & Allergy Fields (Hidden on mobile by default unless expanded, keeping search near top!) */}
            {hasExtraVitalsConfigured && isPatientVitalsExpanded && (
              <div className="pt-3 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  {visibleFields.showAge && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">السن:</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={patient.age || ""}
                        onChange={(e) => setPatient({ age: e.target.value.replace(/[^0-9]/g, "") })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                  {visibleFields.showGender && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">الجنس:</label>
                      <select
                        value={patient.gender || "MALE"}
                        onChange={(e) => setPatient({ gender: e.target.value as any })}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="MALE">ذكر 👨</option>
                        <option value="FEMALE">أنثى 👩</option>
                      </select>
                    </div>
                  )}
                  {visibleFields.showHeight && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">الطول (سم):</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={patient.height || ""}
                        onChange={(e) => setPatient({ height: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                  {visibleFields.showWeight && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">الوزن (كجم):</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={patient.weight || ""}
                        onChange={(e) => setPatient({ weight: e.target.value.replace(/[^0-9.]/g, "") })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                  {visibleFields.showBloodType && (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400 text-[11px]">فصيلة الدم:</label>
                      <select
                        value={patient.bloodType || ""}
                        onChange={(e) => setPatient({ bloodType: e.target.value })}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">غير محدد</option>
                        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
                          <option key={bt} value={bt}>{bt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {(visibleFields.showMedicalHistory || visibleFields.showAllergies) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {visibleFields.showMedicalHistory && (
                      <div className="space-y-1">
                        <label className="font-bold text-cyan-400 text-[11px]">الأمراض المزمنة والتاريخ الطبي:</label>
                        <input
                          type="text"
                          value={patient.medicalHistory || ""}
                          onChange={(e) => setPatient({ medicalHistory: e.target.value })}
                          placeholder="سكري، ضغط، ربو شعبي..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-cyan-500/30 font-bold text-cyan-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}
                    {visibleFields.showAllergies && (
                      <div className="space-y-1">
                        <label className="font-bold text-amber-400 text-[11px]">تنبيه حساسية المريض (Allergies):</label>
                        <input
                          type="text"
                          value={patient.allergyNotes || ""}
                          onChange={(e) => setPatient({ allergyNotes: e.target.value })}
                          placeholder="حساسية بنسلين، سلفا..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/30 font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. GIANT MULTI-SOURCE DRUG SEARCH & ADD PAD (Near Top of Page!) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-400" />
                <span>محرك بحث وإضافة الأدوية الذكي</span>
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {items.length} {items.length === 1 ? "دواء بالروشتة" : "أدوية بالروشتة"}
              </span>
            </div>

            <InlineDrugPadInput
              onAddItem={addItem}
              primaryColor={clinic.primaryColor || "#059669"}
              currentItems={items}
            />
          </div>

          {/* 3. PRESCRIBED DRUGS LIST (Placed IMMEDIATELY Below Search Pad so Doctor Sees Added Drugs Instantly!) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>قائمة الأدوية المضافة بالروشتة ({items.length})</span>
              </span>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearItems}
                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {/* AI Clinical Conflict Warnings Banner */}
            {aiAlerts.length > 0 && (
              <div className="space-y-1.5">
                {aiAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => {
                      setSelectedAiAlert(alert);
                      setIsAiModalOpen(true);
                    }}
                    className="w-full text-right p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2 hover:bg-rose-500/25 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                      <span className="font-bold truncate">{alert.titleAr}</span>
                    </div>
                    <span className="text-[10px] bg-rose-500/30 px-2 py-0.5 rounded font-bold shrink-0">
                      التفاصيل
                    </span>
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-5 border border-dashed border-slate-800 rounded-2xl">
                ابحث عن الدواء بالأعلى واضغط &quot;إدراج&quot; ليظهر هنا فوراً
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-emerald-500/30 flex items-center justify-between gap-3 text-xs transition-all"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-black text-slate-100 truncate" dir="ltr">
                          {it.drugName}
                        </h4>
                      </div>
                      <p className="text-[11px] text-emerald-300/90 truncate pr-7">
                        {it.doseQuantity} {it.doseForm} • {it.frequency}{" "}
                        {it.duration ? `• ${it.duration}` : ""}
                      </p>
                      {it.instructions && (
                        <p className="text-[10px] text-slate-400 truncate pr-7">
                          ملاحظة: {it.instructions}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      title="حذف هذا الدواء"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. DIAGNOSIS & CLOSING INSTRUCTIONS CARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-400" />
                <span>التشخيص الطبي والتعليمات الختامية</span>
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">
                  التشخيص الطبي (Diagnosis):
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="مثال: Acute Bronchitis, التهاب حاد بالحلق، نزلة معوية..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">
                  تعليمات وإرشادات المريض (تطبع بأسفل الروشتة):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: الراحة التامة وتناول السوائل الدافئة، وإعادة الكشف بعد أسبوع..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Unified Action Buttons Bar */}
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handlePrintOnly}
                className="py-3 px-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>حفظ وطباعة</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:brightness-110 text-white font-black text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب مباشر</span>
              </button>

              <button
                type="button"
                onClick={handleSaveOnly}
                className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs border border-slate-700 shadow flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-cyan-400" />
                <span>حفظ فقط</span>
              </button>

              <button
                type="button"
                onClick={handleRequestNewPrescription}
                className="py-3 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 shadow flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>جديدة</span>
              </button>
            </div>
          </div>

        </div>

        {/* Column 2: Live Prescription Sheet (Desktop Side-by-Side View & Print Target) */}
        <div className="hidden xl:block print:!block print:!w-full print:!m-0 print:!p-0 print:!static xl:col-span-7 sticky top-20">
          <LivePrescriptionPreview
            prescriptionNo={prescriptionNo}
            patient={patient}
            diagnosis={diagnosis}
            notes={notes}
            setNotes={setNotes}
            items={items}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onSaveAndPrint={handlePrintOnly}
            onShareWhatsApp={handleShareWhatsApp}
            onSaveOnly={handleSaveOnly}
            onRequestNewPrescription={handleRequestNewPrescription}
            aiAlerts={aiAlerts}
            onOpenAiAlert={(alert) => {
              setSelectedAiAlert(alert);
              setIsAiModalOpen(true);
            }}
          />
        </div>
      </div>

      {/* Mobile Floating Preview Pill */}
      <div className="xl:hidden fixed bottom-20 left-3 sm:left-4 z-40 select-none">
        <button
          type="button"
          onClick={() => setIsMobilePreviewOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/70 border border-emerald-300 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <Eye className="w-4 h-4 stroke-[2.5]" />
          <span>معاينة الروشتة</span>
          {items.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-slate-950 text-emerald-400 text-[10px] font-mono flex items-center justify-center font-bold">
              {items.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Live Prescription Sheet Modal */}
      {isMobilePreviewOpen && (
        <div className="xl:hidden fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black text-slate-100">معاينة طباعة الروشتة</h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {Math.round(mobilePreviewScale * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobilePreviewScale((s) => Math.max(0.5, s - 0.1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobilePreviewScale((s) => Math.min(1.2, s + 0.1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMobilePreviewOpen(false)}
                className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto p-4 flex justify-center items-start">
            <div
              style={{
                transform: `scale(${mobilePreviewScale})`,
                transformOrigin: "top center",
              }}
              className="transition-transform duration-150 w-full max-w-4xl"
            >
              <LivePrescriptionPreview
                prescriptionNo={prescriptionNo}
                patient={patient}
                diagnosis={diagnosis}
                notes={notes}
                items={items}
                onRemoveItem={removeItem}
                onSaveAndPrint={handlePrintOnly}
                onShareWhatsApp={handleShareWhatsApp}
                onSaveOnly={handleSaveOnly}
                aiAlerts={aiAlerts}
                onOpenAiAlert={(alert) => {
                  setSelectedAiAlert(alert);
                  setIsAiModalOpen(true);
                }}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}

      <PrintValidationModal
        isOpen={isPrintValidationOpen}
        onClose={() => setIsPrintValidationOpen(false)}
        hasPatientName={Boolean(patient.name && patient.name.trim().length > 0)}
        hasItems={items.length > 0}
        onFocusPatientName={() => {
          patientNameInputRef.current?.focus();
        }}
      />

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
          if (!isPrescriptionSaved) {
            const branchObj = branches.find((b) => b.id === selectedBranchId);
            savePrescription(branchObj?.nameAr);
            setIsPrescriptionSaved(true);
          }
        }}
      />

      <NewPrescriptionPromptModal
        isOpen={isNewRxPromptOpen}
        onClose={() => setIsNewRxPromptOpen(false)}
        patientName={patient.name}
        itemsCount={items.length}
        diagnosis={diagnosis}
        onSaveAndContinue={handleSaveAndStartNew}
        onConfirmDiscard={handleConfirmDiscard}
      />

      <AiInteractionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        alert={selectedAiAlert}
        onRemoveDrug={handleRemoveConflictingDrug}
      />
    </div>
  );
}
