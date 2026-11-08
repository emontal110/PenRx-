"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Pill,
  PenTool,
  X,
  AlertTriangle,
  Layers,
  Zap,
  ArrowLeftRight,
  Loader2,
  Asterisk,
  Clock,
  Calendar,
  FileText,
} from "lucide-react";
import { DrugRecord } from "@/types/drug";
import { recordDrugPrescribed } from "@/lib/drugTracker";
import { PrescriptionItem } from "@/store/usePrescriptionStore";
import { getSmartDrugDosage, getCleanEnglishDrugName } from "@/lib/smartDrugDosage";
import { checkInstantDrugConflict, InteractionConflict } from "@/lib/clinicalInteractionChecker";
import {
  cacheDrugsLocally,
  searchOfflineDrugs,
  loadOfflineCatalogAsync,
} from "@/lib/offlineDrugStorage";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { getApiUrl } from "@/lib/cloudProxy";

interface InlineDrugPadInputProps {
  onAddItem: (item: Omit<PrescriptionItem, "id">) => void;
  primaryColor?: string;
  currentItems?: Array<{ drugName: string; activeIngredient?: string }>;
}

const COMMON_DOSE_FORMS = [
  "Tablet (قرص)",
  "Capsule (كبسولة)",
  "Syrup (شراب)",
  "Suspension (معلق)",
  "Ampoule (حقنة)",
  "Vial (فيال)",
  "Drops (قطرة)",
  "Cream (كريم)",
  "Ointment (مرهم)",
  "Gel (جل)",
  "Effervescent (فوار)",
  "Suppository (لبوس)",
  "Inhaler (بخاخ صدر)",
  "Spray (بخاخ)",
  "Mouthwash (مضمضة)",
];

const QUICK_QTY_CHIPS = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "نصف", value: "نصف" },
  { label: "5 مل", value: "5 مل" },
];

const QUICK_FREQ_CHIPS = [
  { label: "كل 12 ساعة", value: "كل 12 ساعة بعد الأكل (مرتان يومياً)" },
  { label: "كل 8 ساعات", value: "كل 8 ساعات بعد الأكل (3 مرات يومياً)" },
  { label: "مرة يومياً", value: "مرة واحدة يومياً" },
  { label: "عند اللزوم", value: "عند اللزوم فقط" },
];

const QUICK_DURATION_CHIPS = [
  { label: "3 أيام", value: "لمدة 3 أيام" },
  { label: "5 أيام", value: "لمدة 5 أيام" },
  { label: "7 أيام", value: "لمدة 7 أيام" },
  { label: "شهر", value: "لمدة شهر" },
];

const QUICK_NOTES_CHIPS = [
  "بعد الأكل",
  "قبل الأكل بنصف ساعة",
  "قبل النوم",
];

export function InlineDrugPadInput({
  onAddItem,
  currentItems = [],
}: InlineDrugPadInputProps) {
  const [isManualMode, setIsManualMode] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Search mode toggles
  const [searchByActiveIngredient, setSearchByActiveIngredient] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Selected drug or manual fields
  const [selectedDrug, setSelectedDrug] = useState<DrugRecord | null>(null);
  const [manualDrugName, setManualDrugName] = useState("");
  const [manualActiveIngredient, setManualActiveIngredient] = useState("");
  const [activeConflict, setActiveConflict] = useState<InteractionConflict | null>(null);

  // Equivalents & Generics Drawer
  const [showEquivalents, setShowEquivalents] = useState(false);
  const [equivalentsList, setEquivalentsList] = useState<DrugRecord[]>([]);
  const [loadingEquivalents, setLoadingEquivalents] = useState(false);

  // Dosage Form & Presets
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseForm, setDoseForm] = useState("Tablet (قرص)");
  const [isCustomDoseForm, setIsCustomDoseForm] = useState(false);
  const [frequency, setFrequency] = useState("كل 12 ساعة بعد الأكل (مرتان يومياً)");
  const [duration, setDuration] = useState("لمدة 5 أيام");
  const [instructions, setInstructions] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadOfflineCatalogAsync().catch(() => {});
  }, []);

  const handleInsertWildcard = () => {
    const nextQ = query.endsWith("*") ? query : `${query}*`;
    setQuery(nextQ);
    setIsDropdownOpen(true);
    searchInputRef.current?.focus();
  };

  // Debounced Drug Search
  useEffect(() => {
    const q = query.trim();
    if (!q || isManualMode) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsSearching(false);
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    setIsDropdownOpen(true);
    setIsSearching(true);

    const instantOffline = searchOfflineDrugs(q, searchByActiveIngredient);
    if (instantOffline.length > 0 && results.length === 0) {
      setResults(instantOffline);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          getApiUrl(
            `/api/drugs/search?q=${encodeURIComponent(q)}&includeActiveIngredient=${searchByActiveIngredient}&useAi=true&limit=25`
          ),
          { signal: controller.signal }
        );
        const data = await res.json();
        const list: DrugRecord[] = (data.results || []).slice(0, 25);
        setResults(list);
        setHighlightedIndex(0);
        setIsOfflineMode(false);

        if (list.length > 0) {
          cacheDrugsLocally(list);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        const offlineResults = searchOfflineDrugs(q, searchByActiveIngredient);
        setResults(offlineResults);
        setHighlightedIndex(0);
        setIsOfflineMode(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 85);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isManualMode, searchByActiveIngredient]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check instant conflict when a drug is selected or manual drug name is typed
  useEffect(() => {
    if (selectedDrug) {
      const conflict = checkInstantDrugConflict(selectedDrug, currentItems);
      setActiveConflict(conflict);
    } else if (isManualMode && manualDrugName.trim().length >= 3) {
      const conflict = checkInstantDrugConflict(
        { name: manualDrugName, activeIngredient: manualActiveIngredient },
        currentItems
      );
      setActiveConflict(conflict);
    } else {
      setActiveConflict(null);
    }
  }, [selectedDrug, isManualMode, manualDrugName, manualActiveIngredient, currentItems]);

  const handleSelectDrugForConfiguration = (drug: DrugRecord) => {
    const smart = getSmartDrugDosage(drug);
    setSelectedDrug(drug);
    setDoseQuantity(smart.doseQuantity || "1");
    const smartForm = smart.doseForm || "Tablet (قرص)";
    setDoseForm(smartForm);
    setIsCustomDoseForm(!COMMON_DOSE_FORMS.includes(smartForm));
    setFrequency(
      drug.isAiGenerated && drug.recommendedDose
        ? drug.recommendedDose
        : smart.frequency || "كل 12 ساعة بعد الأكل (مرتان يومياً)"
    );
    setDuration(smart.duration || "لمدة 5 أيام");
    setInstructions(smart.instructions || "");
    setIsDropdownOpen(false);
    setShowEquivalents(false);
  };

  const handleOpenEquivalents = async (drug: DrugRecord) => {
    if (showEquivalents) {
      setShowEquivalents(false);
      return;
    }
    setShowEquivalents(true);
    setLoadingEquivalents(true);
    try {
      const ingredient = drug.activeIngredient || drug.name;
      const res = await fetch(
        getApiUrl(
          `/api/drugs/equivalents?ingredient=${encodeURIComponent(ingredient)}&currentDrug=${encodeURIComponent(drug.name)}`
        )
      );
      const data = await res.json();
      setEquivalentsList(data.equivalents || []);
    } catch {
      setEquivalentsList([]);
    } finally {
      setLoadingEquivalents(false);
    }
  };

  const handleCommitItem = () => {
    const rawName = isManualMode
      ? manualDrugName.trim()
      : selectedDrug
      ? selectedDrug.name.trim()
      : query.trim();

    if (!rawName) return;

    const finalDrugName = getCleanEnglishDrugName(rawName, selectedDrug?.nameAr);
    const finalActiveIngredient = isManualMode
      ? manualActiveIngredient.trim()
      : selectedDrug?.activeIngredient?.trim() || "";

    onAddItem({
      drugId: selectedDrug && !selectedDrug.isAiGenerated ? selectedDrug.id : undefined,
      drugName: finalDrugName,
      activeIngredient: finalActiveIngredient || undefined,
      doseQuantity: doseQuantity.trim() || "1",
      doseForm: doseForm.trim() || "Tablet (قرص)",
      frequency: frequency.trim() || "كل 12 ساعة بعد الأكل (مرتان يومياً)",
      duration: duration.trim() || "لمدة 5 أيام",
      instructions: instructions.trim() || "",
      isCustom: Boolean(isManualMode || !selectedDrug || selectedDrug.isAiGenerated),
    });

    if (selectedDrug) {
      recordDrugPrescribed(selectedDrug.name);
    }

    showGlobalToast(`تمت إضافة ${finalDrugName} للروشتة`, "success");

    setQuery("");
    setResults([]);
    setSelectedDrug(null);
    setManualDrugName("");
    setManualActiveIngredient("");
    setIsManualMode(false);
    setIsDropdownOpen(false);
    setShowEquivalents(false);
    setActiveConflict(null);
    setHighlightedIndex(0);
    setDoseQuantity("1");
    setDoseForm("Tablet (قرص)");
    setIsCustomDoseForm(false);
    setFrequency("كل 12 ساعة بعد الأكل (مرتان يومياً)");
    setDuration("لمدة 5 أيام");
    setInstructions("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDropdownOpen && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelectDrugForConfiguration(results[highlightedIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && (selectedDrug || isManualMode)) {
      e.preventDefault();
      handleCommitItem();
    }
  };

  const showConfigurationPanel = Boolean(selectedDrug || isManualMode);

  return (
    <div ref={containerRef} className="space-y-3.5 no-print relative" dir="rtl">
      {/* STEP 1: COMPACT SEARCH BAR (Shown when no drug is currently being configured) */}
      {!showConfigurationPanel && (
        <div className="space-y-3">
          {/* Clean 3-Option Segmented Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800/90">
            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                setSearchByActiveIngredient(false);
                searchInputRef.current?.focus();
              }}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isManualMode && !searchByActiveIngredient
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">الاسم التجاري</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                setSearchByActiveIngredient(true);
                searchInputRef.current?.focus();
              }}
              className={`py-2 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isManualMode && searchByActiveIngredient
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">المادة الفعالة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(true);
                setSelectedDrug(null);
                setIsDropdownOpen(false);
                setShowEquivalents(false);
                setTimeout(() => manualInputRef.current?.focus(), 40);
              }}
              className="py-2 px-2.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-cyan-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PenTool className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">إدخال يدوي</span>
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <div className="relative flex items-center">
              {isSearching ? (
                <Loader2 className="w-4 h-4 absolute right-3.5 text-emerald-400 animate-spin pointer-events-none" />
              ) : (
                <Search
                  className={`w-4 h-4 absolute right-3.5 pointer-events-none ${
                    searchByActiveIngredient ? "text-purple-400" : "text-emerald-400"
                  }`}
                />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuery(val);
                  if (!val.trim()) {
                    setIsSearching(false);
                    if (abortControllerRef.current) abortControllerRef.current.abort();
                  }
                }}
                onFocus={() => {
                  if (query.trim()) setIsDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchByActiveIngredient
                    ? "ابحث بالمادة الفعالة (مثال: Paracetamol)..."
                    : "ابحث باسم الدواء أو الحروف أو النجمة (*gm*n*600)..."
                }
                className="w-full pr-10 pl-20 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-emerald-500 font-bold text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors"
                autoComplete="off"
              />

              <div className="absolute left-2 flex items-center gap-1">
                {isOfflineMode && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-bold flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    أوفلاين
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleInsertWildcard}
                  className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono font-black text-xs transition-colors cursor-pointer flex items-center gap-0.5"
                  title="إدراج نجمة (*) للبحث بالحروف الناقصة"
                >
                  <Asterisk className="w-3 h-3" />
                </button>
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      if (abortControllerRef.current) abortControllerRef.current.abort();
                      setQuery("");
                      setResults([]);
                      setIsSearching(false);
                      setIsDropdownOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white transition-colors text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Unified Smooth In-Place Search Results Dropdown */}
            {isDropdownOpen && query.trim() && (
              <div
                ref={dropdownRef}
                className="mt-2 w-full bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto overscroll-contain divide-y divide-slate-800/70 text-right z-40"
                dir="rtl"
              >
                {results.length > 0 ? (
                  results.slice(0, 25).map((drug, idx) => {
                    const isSelected = idx === highlightedIndex;
                    const conflict = checkInstantDrugConflict(drug, currentItems);

                    return (
                      <div
                        key={drug.id || idx}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectDrugForConfiguration(drug)}
                        className={`w-full text-right px-3.5 py-2.5 transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/15 border-r-2 border-r-emerald-400"
                            : "hover:bg-slate-900"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Pill className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-black text-xs sm:text-sm text-slate-100 truncate" dir="ltr">
                              {drug.name}
                            </span>
                            {drug.dosageForm && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                {drug.dosageForm}
                              </span>
                            )}
                            {conflict && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                تعارض
                              </span>
                            )}
                          </div>
                          {drug.activeIngredient && (
                            <p className="text-[10px] text-slate-400 pr-5 truncate font-mono mt-0.5">
                              {drug.activeIngredient}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {drug.price && Number(drug.price) > 0 ? (
                            <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              {drug.price} ج.م
                            </span>
                          ) : null}
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                            اختيار
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>جاري البحث...</span>
                  </div>
                ) : (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      لا توجد نتائج مطابقة لـ <span className="font-bold text-slate-200">&quot;{query}&quot;</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setManualDrugName(query.trim());
                        setIsManualMode(true);
                        setIsDropdownOpen(false);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة &quot;{query}&quot; يدوياً</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: CLEAN, SPACIOUS DOSAGE & FREQUENCY CARD */}
      {showConfigurationPanel && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 shadow-xl space-y-4 animate-in fade-in duration-150">
          {/* Header: Selected Drug or Manual Drug Input */}
          {!isManualMode && selectedDrug ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <h4 className="font-black text-sm sm:text-base text-white truncate" dir="ltr">
                      {selectedDrug.name}
                    </h4>
                    {selectedDrug.price && Number(selectedDrug.price) > 0 && (
                      <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        {selectedDrug.price} ج.م
                      </span>
                    )}
                  </div>
                  {selectedDrug.activeIngredient && (
                    <p className="text-[11px] text-slate-400 font-mono truncate pr-4 mt-0.5">
                      {selectedDrug.activeIngredient}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEquivalents(selectedDrug)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-emerald-300 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
                    <span>البدائل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDrug(null);
                      setShowEquivalents(false);
                      setActiveConflict(null);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>تغيير</span>
                  </button>
                </div>
              </div>

              {/* Equivalents Drawer */}
              {showEquivalents && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300">البدائل بنفس المادة الفعالة:</span>
                    <button
                      type="button"
                      onClick={() => setShowEquivalents(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {loadingEquivalents ? (
                    <p className="text-center py-2 text-xs text-slate-400">جاري جلب البدائل...</p>
                  ) : equivalentsList.length === 0 ? (
                    <p className="text-center py-2 text-xs text-slate-400">لا توجد بدائل مسجلة حالياً.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {equivalentsList.map((alt) => (
                        <div
                          key={alt.id}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-bold text-slate-200 truncate" dir="ltr">
                            {alt.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectDrugForConfiguration(alt);
                              setShowEquivalents(false);
                            }}
                            className="px-2 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0 cursor-pointer"
                          >
                            اختيار
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-b border-slate-800/90 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-cyan-400" />
                  <span>إضافة دواء يدوياً</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsManualMode(false)}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  ✕ عودة للبحث
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualDrugName}
                  onChange={(e) => setManualDrugName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اسم الدواء أو التركيبة *"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 font-bold text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  value={manualActiveIngredient}
                  onChange={(e) => setManualActiveIngredient(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="المادة الفعالة (اختياري)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Conflict Warning Banner */}
          {activeConflict && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-black text-rose-300">
                  تعارض دوائي مع ({activeConflict.conflictingWith}): {activeConflict.titleAr}
                </p>
                <p className="text-[11px] text-rose-100/90">{activeConflict.reasonAr}</p>
              </div>
            </div>
          )}

          {/* Row 1: Quantity & Dosage Form (2 balanced columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Pill className="w-3 h-3 text-emerald-400" />
                  <span>الكمية:</span>
                </label>
                <div className="flex items-center gap-1">
                  {QUICK_QTY_CHIPS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setDoseQuantity(q.value)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                        doseQuantity === q.value
                          ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={doseQuantity}
                onChange={(e) => setDoseQuantity(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="مثال: 1، قرص، 5 مل..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/90 focus:border-emerald-500 font-bold text-slate-100 text-xs focus:outline-none"
              />
            </div>

            {/* Dosage Form */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300">الشكل الدوائي:</label>
                <button
                  type="button"
                  onClick={() => {
                    if (isCustomDoseForm) {
                      setIsCustomDoseForm(false);
                      setDoseForm("Tablet (قرص)");
                    } else {
                      setIsCustomDoseForm(true);
                      setDoseForm("");
                    }
                  }}
                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {isCustomDoseForm ? "قائمة جاهزة" : "كتابة يدوية"}
                </button>
              </div>

              {!isCustomDoseForm ? (
                <select
                  value={doseForm}
                  onChange={(e) => {
                    if (e.target.value === "__CUSTOM__") {
                      setIsCustomDoseForm(true);
                      setDoseForm("");
                    } else {
                      setDoseForm(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/90 focus:border-emerald-500 font-bold text-slate-100 text-xs focus:outline-none cursor-pointer"
                >
                  {COMMON_DOSE_FORMS.map((f) => (
                    <option key={f} value={f} className="bg-slate-900 text-slate-100">
                      {f}
                    </option>
                  ))}
                  <option value="__CUSTOM__" className="bg-slate-900 text-emerald-400 font-bold">
                    كتابة شكل آخر...
                  </option>
                </select>
              ) : (
                <input
                  type="text"
                  value={doseForm}
                  onChange={(e) => setDoseForm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="مثال: أمبول عضل، كيس فوار..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-cyan-500 font-bold text-slate-100 text-xs focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Row 2: Frequency */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>الجرعة والتكرار:</span>
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {QUICK_FREQ_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFrequency(chip.value)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      frequency === chip.value
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="مثال: كل 12 ساعة بعد الأكل..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/90 focus:border-emerald-500 font-bold text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          {/* Row 3: Duration & Notes (2 balanced columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Duration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  <span>مدة العلاج:</span>
                </label>
                <div className="flex items-center gap-1">
                  {QUICK_DURATION_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setDuration(chip.value)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                        duration === chip.value
                          ? "bg-cyan-500/25 text-cyan-300 border-cyan-500/50"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="مثال: لمدة 5 أيام..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/90 focus:border-cyan-500 font-bold text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-amber-400" />
                  <span>ملاحظات (اختياري):</span>
                </label>
                <div className="flex items-center gap-1">
                  {QUICK_NOTES_CHIPS.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setInstructions(note)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                        instructions === note
                          ? "bg-amber-500/25 text-amber-300 border-amber-500/50"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="مثال: يرج جيداً..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/90 focus:border-amber-500 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCommitItem}
              disabled={isManualMode && !manualDrugName.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>إضافة للروشتة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDrug(null);
                setIsManualMode(false);
                setShowEquivalents(false);
                setActiveConflict(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
