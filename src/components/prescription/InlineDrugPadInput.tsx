"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Pill,
  Sparkles,
  PenTool,
  X,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Zap,
  ArrowLeftRight,
  Loader2,
  Asterisk,
  SlidersHorizontal,
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
  "Vial (فيال وريدي/عضلي)",
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
  { label: "10 مل", value: "10 مل" },
  { label: "بختان", value: "بختان" },
  { label: "طبقة رقيقة", value: "طبقة رقيقة" },
  { label: "كيس", value: "كيس واحد" },
];

const QUICK_FREQ_CHIPS = [
  { label: "كل 12 ساعة (مرتان)", value: "كل 12 ساعة بعد الأكل (مرتان يومياً)" },
  { label: "كل 8 ساعات (3 مرات)", value: "كل 8 ساعات بعد الأكل (3 مرات يومياً)" },
  { label: "مرة يومياً صباحاً", value: "مرة واحدة يومياً صباحاً" },
  { label: "مرة مساءً قبل النوم", value: "مرة واحدة يومياً مساءً قبل النوم" },
  { label: "قبل الأكل بـ 30 ق", value: "قبل الأكل بنصف ساعة" },
  { label: "كل 6 ساعات", value: "كل 6 ساعات (4 مرات يومياً)" },
  { label: "عند اللزوم", value: "عند اللزوم فقط (PRN)" },
];

const QUICK_DURATION_CHIPS = [
  { label: "3 أيام", value: "لمدة 3 أيام" },
  { label: "5 أيام", value: "لمدة 5 أيام" },
  { label: "7 أيام (أسبوع)", value: "لمدة 7 أيام (أسبوع)" },
  { label: "10 أيام", value: "لمدة 10 أيام" },
  { label: "14 يوماً", value: "لمدة أسبوعين (14 يوماً)" },
  { label: "شهر كامل", value: "لمدة شهر كامل (30 يوماً)" },
  { label: "علاج مستمر", value: "علاج مستمر بانتظام" },
];

const QUICK_NOTES_CHIPS = [
  "بعد الأكل مباشرة",
  "قبل الإفطار بنصف ساعة على الريق",
  "يرج جيداً قبل كل استخدام",
  "مع شرب كوب ماء وفير",
  "عدم التوقف دون استشارة الطبيب",
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

  // Mobile Rising Spotlight Search Mode
  const [isMobileSpotlight, setIsMobileSpotlight] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  // Advanced Search Toggles
  const [searchByActiveIngredient, setSearchByActiveIngredient] = useState(false);
  const [searchByAi, setSearchByAi] = useState(true);
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

  // Dosage Form & Presets (with full manual typing support)
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseForm, setDoseForm] = useState("Tablet (قرص)");
  const [isCustomDoseForm, setIsCustomDoseForm] = useState(false);
  const [frequency, setFrequency] = useState("كل 12 ساعة بعد الأكل (مرتان يومياً)");
  const [duration, setDuration] = useState("لمدة 5 أيام");
  const [instructions, setInstructions] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dosageCardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadOfflineCatalogAsync().catch(() => {});
    if (typeof window !== "undefined") {
      const checkViewport = () => {
        setIsMobileViewport(window.innerWidth < 768);
      };
      checkViewport();
      window.addEventListener("resize", checkViewport);
      return () => window.removeEventListener("resize", checkViewport);
    }
  }, []);

  const openMobileSpotlightIfNeeded = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && !isManualMode) {
      setIsMobileSpotlight(true);
      setIsDropdownOpen(true);
      setTimeout(() => {
        spotlightInputRef.current?.focus();
      }, 40);
    }
  };

  const handleSearchFocus = () => {
    if (isMobileViewport && !isManualMode) {
      openMobileSpotlightIfNeeded();
      return;
    }
    if (query.trim()) {
      setIsDropdownOpen(true);
    }
  };

  const handleInsertWildcard = () => {
    const nextQ = query.endsWith("*") ? query : `${query}*`;
    setQuery(nextQ);
    setIsDropdownOpen(true);
    if (isMobileSpotlight) {
      spotlightInputRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
    }
  };

  // Debounced Multi-Layer Drug Search (Progressive Alphabetical + Drug Eye * + AI + Offline Fallback)
  useEffect(() => {
    const q = query.trim();
    if (!q || isManualMode) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsSearching(false);
      setResults([]);
      if (!isMobileSpotlight) setIsDropdownOpen(false);
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
            `/api/drugs/search?q=${encodeURIComponent(q)}&includeActiveIngredient=${searchByActiveIngredient}&useAi=${searchByAi}&limit=30`
          ),
          { signal: controller.signal }
        );
        const data = await res.json();
        const list: DrugRecord[] = (data.results || []).slice(0, 30);
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
  }, [query, isManualMode, searchByActiveIngredient, searchByAi]);

  // Click outside to dismiss desktop dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobileSpotlight) return;
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
  }, [isMobileSpotlight]);

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

  // Step 1: Select drug from search -> open the Dosage, Quantity & Notes Configuration Panel!
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
    setIsMobileSpotlight(false);
    setShowEquivalents(false);

    setTimeout(() => {
      dosageCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  };

  const handleOpenEquivalents = async (drug: DrugRecord) => {
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

  // Step 2: Confirm and add the configured drug to the prescription
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

    showGlobalToast(`✅ تمت إضافة ${finalDrugName} بالجرعة المحددة إلى الروشتة`, "success");

    setQuery("");
    setResults([]);
    setSelectedDrug(null);
    setManualDrugName("");
    setManualActiveIngredient("");
    setIsManualMode(false);
    setIsDropdownOpen(false);
    setIsMobileSpotlight(false);
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
        setIsMobileSpotlight(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && (selectedDrug || isManualMode)) {
      e.preventDefault();
      handleCommitItem();
    }
  };

  const showConfigurationPanel = Boolean(selectedDrug || isManualMode);

  const renderSearchResultsList = () => {
    if (!query.trim()) {
      return (
        <div className="p-4 text-center space-y-2.5 text-xs text-slate-400">
          <p className="font-bold text-slate-300">
            اكتب أول حرف للترتيب الأبجدي (مثل <span className="text-emerald-400">ب</span> ثم <span className="text-emerald-400">بن</span>) أو استخدم النجمة <span className="text-emerald-400 font-mono">*</span> مثل موقع Drug Eye:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {["*gm*n*600", "aug 1g", "concor 5", "بنادول", "كتافلام", "مضاد حيوي"].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setQuery(sample);
                  setIsDropdownOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/40 font-mono text-[11px] transition-all cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-800/80">
        <div className="px-3.5 py-2 bg-slate-950/95 text-[10px] font-bold text-slate-400 flex items-center justify-between sticky top-0 z-10 border-b border-slate-800">
          <span>
            {isSearching ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Loader2 className="w-3 h-3 animate-spin" />
                جاري البحث في قاعدة الأدوية المصرية والعالمية...
              </span>
            ) : (
              <span className="text-emerald-400">
                النتائج المطابقة ({results.length}) — اختر الدواء لتحديد الجرعة والكمية
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {isOfflineMode && <span className="text-amber-400 font-bold">⚡ أوفلاين</span>}
            <span className="text-slate-400">اضغط على الدواء لاختياره</span>
          </span>
        </div>

        {results.length > 0 ? (
          results.slice(0, 30).map((drug, idx) => {
            const isSelected = idx === highlightedIndex;
            const conflict = checkInstantDrugConflict(drug, currentItems);

            return (
              <div
                key={drug.id || idx}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelectDrugForConfiguration(drug)}
                className={`w-full text-right p-3 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-500/15 border-r-4 border-r-emerald-400"
                    : "hover:bg-slate-900/90"
                }`}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Pill
                      className={`w-3.5 h-3.5 shrink-0 ${
                        drug.isAiGenerated ? "text-violet-400" : "text-emerald-400"
                      }`}
                    />
                    <span className="font-black text-xs sm:text-sm text-slate-100 truncate" dir="ltr">
                      {drug.name}
                    </span>

                    {drug.nameAr && drug.nameAr !== drug.name && (
                      <span className="text-[11px] text-cyan-300 font-bold truncate">
                        ({drug.nameAr})
                      </span>
                    )}

                    {drug.dosageForm && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {drug.dosageForm}
                      </span>
                    )}

                    {conflict && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        تعارض مع: {conflict.conflictingWith}
                      </span>
                    )}
                  </div>

                  {drug.activeIngredient && (
                    <p className="text-[10px] text-slate-400 pr-5 truncate font-mono">
                      المادة الفعالة: {drug.activeIngredient}
                      {drug.company ? ` • ${drug.company}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {drug.price && Number(drug.price) > 0 ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      {drug.price} ج.م
                    </span>
                  ) : null}

                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] shadow-sm transition-all flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>تحديد الجرعة</span>
                  </span>
                </div>
              </div>
            );
          })
        ) : isSearching ? (
          <div className="p-5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>جاري البحث في قاعدة الأدوية المصرية والعالمية...</span>
          </div>
        ) : (
          <div className="p-4 text-center space-y-2.5">
            <p className="text-xs text-slate-300">
              لم يُعثر على دواء مطابق تماماً لـ <span className="font-bold text-emerald-400">&quot;{query}&quot;</span>
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setManualDrugName(query.trim());
                  setIsManualMode(true);
                  setIsDropdownOpen(false);
                  setIsMobileSpotlight(false);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تخصيص جرعة &quot;{query}&quot; وإضافته يدوياً</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE RISING SPOTLIGHT SEARCH OVERLAY                                    */}
      {/* ========================================================================= */}
      {isMobileSpotlight && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-xl flex flex-col h-[100dvh] overflow-hidden animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="p-3 bg-slate-900 border-b border-emerald-500/30 space-y-2.5 shrink-0 shadow-lg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileSpotlight(false)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center shrink-0 font-bold"
                title="إغلاق نافذة البحث"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative flex-1 flex items-center">
                {isSearching ? (
                  <Loader2 className="w-4 h-4 absolute right-3 text-emerald-400 animate-spin pointer-events-none" />
                ) : (
                  <Search className="w-4 h-4 absolute right-3 text-emerald-400 pointer-events-none" />
                )}
                <input
                  ref={spotlightInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ابحث أبجدياً (ب، بن...) أو بالنجمة (*gm*n*600)..."
                  className="w-full pr-9 pl-16 py-2.5 rounded-xl bg-slate-950 border-2 border-emerald-500 font-bold text-xs text-white placeholder:text-slate-400 focus:outline-none"
                  autoComplete="off"
                />
                <div className="absolute left-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleInsertWildcard}
                    className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-black text-xs"
                  >
                    *
                  </button>
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        spotlightInputRef.current?.focus();
                      }}
                      className="p-1 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSearchByActiveIngredient(false)}
                className={`py-1.5 px-2 rounded-lg font-bold border text-center truncate transition-all ${
                  !searchByActiveIngredient
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                🔍 الاسم التجاري (*)
              </button>
              <button
                type="button"
                onClick={() => setSearchByActiveIngredient(!searchByActiveIngredient)}
                className={`py-1.5 px-2 rounded-lg font-bold border text-center truncate transition-all ${
                  searchByActiveIngredient
                    ? "bg-purple-500/25 text-purple-200 border-purple-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                🧪 المادة الفعالة
              </button>
              <button
                type="button"
                onClick={() => setSearchByAi(!searchByAi)}
                className={`py-1.5 px-2 rounded-lg font-bold border text-center truncate transition-all ${
                  searchByAi
                    ? "bg-violet-500/25 text-violet-200 border-violet-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                ✨ ذكاء اصطناعي
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-950">
            {renderSearchResultsList()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMMERCIAL DRUG SEARCH & STEP-BY-STEP DOSAGE CONFIGURATOR                 */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="space-y-4 no-print relative"
        dir="rtl"
      >
        {/* Clean 4-Tab Grid (Zero Horizontal Scrollbar!) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => {
              setIsManualMode(false);
              setSearchByActiveIngredient(false);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !isManualMode && !searchByActiveIngredient
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
            }`}
          >
            <Search className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">بحث Drug Eye (*)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsManualMode(false);
              setSearchByActiveIngredient(!searchByActiveIngredient);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !isManualMode && searchByActiveIngredient
                ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-purple-300 border-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate">بالمادة الفعالة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsManualMode(false);
              setSearchByAi(!searchByAi);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !isManualMode && searchByAi
                ? "bg-violet-500/20 text-violet-300 border-violet-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-violet-300 border-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">ذكاء Gemini الطبي</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsManualMode(true);
              setSelectedDrug(null);
              setIsDropdownOpen(false);
              setShowEquivalents(false);
              setTimeout(() => manualInputRef.current?.focus(), 50);
            }}
            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isManualMode
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 hover:text-cyan-300 border-slate-800"
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">كتابة دواء يدوياً</span>
          </button>
        </div>

        {/* Main Search Input Bar */}
        {!isManualMode && (
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
                onFocus={handleSearchFocus}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchByActiveIngredient
                    ? "ابحث بالمادة الفعالة (مثال: Paracetamol, Bisoprolol, باراسيتامول...)"
                    : "ابحث بالحروف الأبجدية (ب، بن...) أو بالنجمة (*gm*n*600) أو اسم الدواء..."
                }
                className="w-full pr-10 pl-24 py-3.5 rounded-2xl bg-slate-950 border-2 border-slate-800 focus:border-emerald-500 font-bold text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner transition-all"
                autoComplete="off"
              />

              <div className="absolute left-2.5 flex items-center gap-1.5">
                {isOfflineMode && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    أوفلاين
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleInsertWildcard}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono font-black text-xs transition-colors cursor-pointer flex items-center gap-1"
                  title="إدراج نجمة (*) للبحث بالحروف الناقصة مثل موقع Drug Eye"
                >
                  <Asterisk className="w-3 h-3" />
                  <span className="text-[10px]">نجمة</span>
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

            {/* Desktop Autocomplete Dropdown */}
            {isDropdownOpen && !isMobileSpotlight && !isManualMode && (
              <div
                ref={dropdownRef}
                className="absolute z-50 top-full mt-2 w-full bg-slate-950/98 backdrop-blur-2xl border-2 border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in text-right"
                dir="rtl"
              >
                {renderSearchResultsList()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: APPEARS ONLY WHEN A DRUG IS SELECTED OR IN MANUAL ENTRY MODE      */}
        {/* ========================================================================= */}
        {showConfigurationPanel && (
          <div
            ref={dosageCardRef}
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 border-2 border-emerald-500/50 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header: Selected Drug Info OR Manual Drug Name Inputs */}
            {!isManualMode && selectedDrug ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black">
                        الدواء المختار ✓
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white truncate" dir="ltr">
                        {selectedDrug.name}
                      </h4>
                      {selectedDrug.price && Number(selectedDrug.price) > 0 && (
                        <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                          {selectedDrug.price} ج.م
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {selectedDrug.nameAr && <span className="text-cyan-300 font-bold ml-2">{selectedDrug.nameAr}</span>}
                      {selectedDrug.activeIngredient && (
                        <span className="font-mono text-slate-400">({selectedDrug.activeIngredient})</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEquivalents(selectedDrug)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                      <span>البدائل والمثائل</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDrug(null);
                        setShowEquivalents(false);
                        setActiveConflict(null);
                      }}
                      className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 transition-colors cursor-pointer"
                      title="إلغاء واختيار دواء آخر"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Equivalents Drawer */}
                {showEquivalents && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>المثائل والبدائل المتاحة بنفس المادة الفعالة:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowEquivalents(false)}
                        className="text-xs text-slate-400 hover:text-white font-bold"
                      >
                        ✕ إغلاق
                      </button>
                    </div>

                    {loadingEquivalents ? (
                      <p className="text-center py-3 text-xs text-slate-400 animate-pulse">
                        جاري جلب المثائل الصيدلانية...
                      </p>
                    ) : equivalentsList.length === 0 ? (
                      <p className="text-center py-3 text-xs text-slate-400">
                        لا توجد مثائل أخرى مسجلة لهذه المادة الفعالة حالياً.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {equivalentsList.map((alt) => (
                          <div
                            key={alt.id}
                            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-black text-slate-100 truncate" dir="ltr">
                                {alt.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {alt.nameAr || alt.company || "شركة أدوية"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {alt.price && Number(alt.price) > 0 && (
                                <span className="font-mono font-bold text-emerald-400 text-[11px]">
                                  {alt.price} ج.م
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectDrugForConfiguration(alt);
                                  setShowEquivalents(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] cursor-pointer"
                              >
                                اختيار البديل
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Manual Mode Drug Name & Active Ingredient Inputs */
              <div className="space-y-3 border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-cyan-400" />
                    <span>إضافة دواء أو تركيبة يدوية مخصصة</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualMode(false)}
                    className="text-xs text-slate-400 hover:text-white font-bold"
                  >
                    ✕ العودة للبحث
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      اسم الدواء التجاري أو التركيبة: *
                    </label>
                    <input
                      ref={manualInputRef}
                      type="text"
                      value={manualDrugName}
                      onChange={(e) => setManualDrugName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب اسم الدواء..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 font-bold text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      المادة الفعالة (اختياري):
                    </label>
                    <input
                      type="text"
                      value={manualActiveIngredient}
                      onChange={(e) => setManualActiveIngredient(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="مثال: Paracetamol 500mg..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Instant Real-time Interaction Warning Banner inside Configuration Card */}
            {activeConflict && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1 min-w-0">
                  <p className="font-black text-rose-300">
                    ⚠️ تحذير تعارض دوائي مع ({activeConflict.conflictingWith}): {activeConflict.titleAr}
                  </p>
                  <p className="text-[11px] text-rose-100/90 leading-relaxed">
                    {activeConflict.reasonAr}
                  </p>
                  {activeConflict.recommendationAr && (
                    <p className="text-[11px] text-emerald-300 font-bold">
                      💡 التوصية: {activeConflict.recommendationAr}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 1. QUANTITY & DOSAGE FORM (Quick Presets + Full Manual Input) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-[11px] font-black text-slate-200 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. الكمية والشكل الدوائي (اختر سريعاً أو اكتب يدوياً):</span>
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_QTY_CHIPS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setDoseQuantity(q.value)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
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

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={doseQuantity}
                    onChange={(e) => setDoseQuantity(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب الكمية يدوياً (مثال: 1، قرص ونصف، 5 مل...)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 font-bold text-slate-100 text-xs focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-7 flex items-center gap-2">
                  {!isCustomDoseForm ? (
                    <>
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
                        className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 font-bold text-slate-100 text-xs focus:outline-none cursor-pointer"
                      >
                        {COMMON_DOSE_FORMS.map((f) => (
                          <option key={f} value={f} className="bg-slate-900 text-slate-100">
                            {f}
                          </option>
                        ))}
                        <option value="__CUSTOM__" className="bg-slate-900 text-emerald-400 font-bold">
                          ✏️ كتابة شكل دوائي آخر يدوياً...
                        </option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsCustomDoseForm(true)}
                        className="px-2.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-700 text-[11px] font-bold shrink-0 cursor-pointer"
                        title="كتابة الشكل الدوائي يدوياً"
                      >
                        ✏️ يدوي
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={doseForm}
                        onChange={(e) => setDoseForm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="اكتب الشكل الدوائي يدوياً (مثال: أمبول عضل، كيس فوار...)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-500 font-bold text-slate-100 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomDoseForm(false);
                          setDoseForm("Tablet (قرص)");
                        }}
                        className="px-2.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        قائمة جاهزة
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. FREQUENCY / DOSAGE SCHEDULE (Quick Chips + Manual Input) */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>2. الجرعة ومواعيد التكرار (اختر قالب جاهز أو اكتب الجرعة يدوياً):</span>
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_FREQ_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setFrequency(chip.value)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      frequency === chip.value
                        ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-xs"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب أو عدّل الجرعة يدوياً بحرية (مثال: قرص كل 12 ساعة بعد الأكل...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 font-bold text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            {/* 3. DURATION & 4. NOTES (Quick Chips + Manual Input) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Duration */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. مدة العلاج (اختيار أو كتابة يدوية):</span>
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_DURATION_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setDuration(chip.value)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        duration === chip.value
                          ? "bg-cyan-500/25 text-cyan-300 border-cyan-500/50"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب مدة العلاج يدوياً..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-500 font-bold text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {/* Special Notes */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>4. ملاحظات وتعليمات الدواء (اختياري):</span>
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_NOTES_CHIPS.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setInstructions(note)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        instructions === note
                          ? "bg-amber-500/25 text-amber-300 border-amber-500/50"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                      }`}
                    >
                      {note}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ملاحظات إضافية للدواء (مثال: يرج جيداً، قبل الأكل...)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-amber-500 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Commit Drug to Prescription Button */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCommitItem}
                disabled={isManualMode && !manualDrugName.trim()}
                className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-emerald-950/60 active:scale-98"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>تأكيد وإضافة الدواء للروشتة الآن ↵</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDrug(null);
                  setIsManualMode(false);
                  setShowEquivalents(false);
                  setActiveConflict(null);
                }}
                className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
