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
  "Drops (قطرة)",
  "Cream (كريم)",
  "Ointment (مرهم)",
  "Effervescent (فوار)",
  "Inhaler (بخاخ)",
];

const FREQUENCY_PRESETS = [
  "كل 8 ساعات بعد الأكل (3 مرات)",
  "كل 12 ساعة بعد الأكل (مرتان)",
  "مرة واحدة يومياً صباحاً على الريق",
  "مرة واحدة يومياً مساءً قبل النوم",
  "كل 6 ساعات (4 مرات يومياً)",
  "عند اللزوم فقط (PRN)",
  "قبل الأكل بنصف ساعة",
];

const QUICK_FREQ_CHIPS = [
  { label: "كل 12 ساعة", value: "كل 12 ساعة بعد الأكل (مرتان)" },
  { label: "كل 8 ساعات", value: "كل 8 ساعات بعد الأكل (3 مرات)" },
  { label: "مرة يومياً", value: "مرة واحدة يومياً صباحاً" },
  { label: "قبل النوم", value: "مرة واحدة يومياً مساءً قبل النوم" },
  { label: "عند اللزوم", value: "عند اللزوم فقط (PRN)" },
];

const DURATION_PRESETS = [
  "لمدة 3 أيام",
  "لمدة 5 أيام",
  "لمدة أسبوع (7 أيام)",
  "لمدة 10 أيام",
  "لمدة أسبوعين (14 يوماً)",
  "لمدة شهر كامل",
  "عند الحاجة فقط",
];

const QUICK_DURATION_CHIPS = [
  { label: "3 أيام", value: "لمدة 3 أيام" },
  { label: "5 أيام", value: "لمدة 5 أيام" },
  { label: "7 أيام", value: "لمدة أسبوع (7 أيام)" },
  { label: "14 يوماً", value: "لمدة أسبوعين (14 يوماً)" },
  { label: "شهر", value: "لمدة شهر كامل" },
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

  // Mobile Rising Spotlight Search Mode (solves virtual keyboard collision 100%)
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

  // Dosage Form & Presets
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseForm, setDoseForm] = useState("Tablet (قرص)");
  const [frequency, setFrequency] = useState("كل 8 ساعات بعد الأكل (3 مرات)");
  const [duration, setDuration] = useState("لمدة 5 أيام");
  const [instructions, setInstructions] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const spotlightInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAddingRef = useRef(false);

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

  // Insert Drug Eye wildcard (*) at cursor or end of query
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

    // Instant client-side offline preview while server responds (0ms feel)
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
    }, 90);

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

  useEffect(() => {
    if (selectedDrug) {
      const conflict = checkInstantDrugConflict(selectedDrug, currentItems);
      setActiveConflict(conflict);
    } else {
      setActiveConflict(null);
    }
  }, [selectedDrug, currentItems]);

  // Stage drug into dosage builder OR add directly
  const handlePrepareDrug = (drug: DrugRecord) => {
    const smart = getSmartDrugDosage(drug);
    setSelectedDrug(drug);
    setDoseQuantity(smart.doseQuantity || "1");
    setDoseForm(smart.doseForm || "Tablet (قرص)");
    setFrequency(
      drug.isAiGenerated && drug.recommendedDose
        ? drug.recommendedDose
        : smart.frequency || "كل 8 ساعات بعد الأكل (3 مرات)"
    );
    setDuration(smart.duration || "لمدة 5 أيام");
    setInstructions(smart.instructions || "");
    setIsDropdownOpen(false);
  };

  const handleInstantAddDrug = (drug: DrugRecord) => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    try {
      const finalDrugName = getCleanEnglishDrugName(drug.name, drug.nameAr);
      const smart = getSmartDrugDosage(drug);
      const finalQuantity = smart.doseQuantity || doseQuantity || "1";
      const finalDoseForm = smart.doseForm || doseForm || "Tablet (قرص)";

      let finalFrequency = smart.frequency || frequency || "كل 8 ساعات بعد الأكل (3 مرات)";
      let finalDuration = smart.duration || duration || "لمدة 5 أيام";
      let finalInstructions = smart.instructions || instructions || "";

      if (drug.isAiGenerated && drug.recommendedDose) {
        finalFrequency = drug.recommendedDose;
      }

      onAddItem({
        drugId: drug.isAiGenerated ? undefined : drug.id,
        drugName: finalDrugName,
        activeIngredient: drug.activeIngredient?.trim() || undefined,
        doseQuantity: finalQuantity,
        doseForm: finalDoseForm,
        frequency: finalFrequency,
        duration: finalDuration,
        instructions: finalInstructions,
        isCustom: Boolean(drug.isAiGenerated || drug.isCrowdSourced),
      });

      recordDrugPrescribed(drug.name);
      showGlobalToast(`✅ تمت إضافة ${finalDrugName} للروشتة`, "success");

      setQuery("");
      setResults([]);
      setSelectedDrug(null);
      setIsDropdownOpen(false);
      setIsMobileSpotlight(false);
      setShowEquivalents(false);
      setActiveConflict(null);
      setHighlightedIndex(0);
    } finally {
      setTimeout(() => {
        isAddingRef.current = false;
      }, 180);
    }
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
      frequency: frequency.trim() || "كل 8 ساعات بعد الأكل (3 مرات)",
      duration: duration.trim() || "لمدة 5 أيام",
      instructions: instructions.trim() || "",
      isCustom: Boolean(isManualMode || !selectedDrug || selectedDrug.isAiGenerated),
    });

    if (selectedDrug) {
      recordDrugPrescribed(selectedDrug.name);
    }

    showGlobalToast(`✅ تمت إضافة ${finalDrugName} للروشتة`, "success");

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
    setFrequency("كل 8 ساعات بعد الأكل (3 مرات)");
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
          handleInstantAddDrug(results[highlightedIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        setIsMobileSpotlight(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommitItem();
    }
  };

  const isReadyToAdd = isManualMode
    ? Boolean(manualDrugName.trim())
    : Boolean(selectedDrug || query.trim());

  const renderSearchResultsList = (isSpotlightModal = false) => {
    if (!query.trim()) {
      return (
        <div className="p-4 text-center space-y-2.5 text-xs text-slate-400">
          <p className="font-bold text-slate-300">
            اكتب أول حرف للترتيب الأبجدي (مثل <span className="text-emerald-400">ب</span> ثم <span className="text-emerald-400">بن</span>) أو استخدم النجمة <span className="text-emerald-400 font-mono">*</span> مثل موقع Drug Eye:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {["*gm*n*600", "aug 1g", "concor 5", "بنادول", "مضاد حيوي", "باراسيتامول"].map((sample) => (
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
                جاري التصفية الفورية من القاعدة الموحدة...
              </span>
            ) : (
              <span className="text-emerald-400">
                النتائج المطابقة ({results.length}) — مرتبة أبجدياً
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {isOfflineMode && <span className="text-amber-400 font-bold">⚡ أوفلاين</span>}
            <span>اضغط للإدراج الفوري أو تخصيص الجرعة</span>
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
                className={`w-full text-right p-3 transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-emerald-500/15 border-r-4 border-r-emerald-400"
                    : "hover:bg-slate-900/90"
                }`}
              >
                <div
                  onClick={() => handleInstantAddDrug(drug)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
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

                    {drug.isAiGenerated && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 font-bold flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        اقتراح ذكي
                      </span>
                    )}

                    {conflict && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        تداخل: {conflict.conflictingWith}
                      </span>
                    )}
                  </div>

                  {drug.activeIngredient && (
                    <p className="text-[10px] text-slate-400 pr-5 truncate mt-0.5 font-mono">
                      المادة الفعالة: {drug.activeIngredient}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {drug.price && Number(drug.price) > 0 ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30">
                      {drug.price} ج.م
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      handlePrepareDrug(drug);
                      if (isSpotlightModal) setIsMobileSpotlight(false);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
                    title="ضبط الجرعة أو عرض البدائل قبل الإضافة"
                  >
                    جرعة/بدائل
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInstantAddDrug(drug)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] shadow-sm transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>إدراج</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : isSearching ? (
          <div className="p-5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>جاري البحث في القاعدة المحلية والسحابية...</span>
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
                  handleCommitItem();
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إدراج &quot;{query}&quot; بالروشتة وحفظه بقاعدة البيانات للجميع</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchByAi(true)}
                className="px-3 py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد بدائل قريبة بالذكاء الاصطناعي</span>
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
      {/* MOBILE RISING SPOTLIGHT SEARCH OVERLAY (Pushes Search to Top Above KB!)  */}
      {/* ========================================================================= */}
      {isMobileSpotlight && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/98 backdrop-blur-xl flex flex-col h-[100dvh] overflow-hidden animate-in fade-in duration-150"
          dir="rtl"
        >
          {/* Top Pinned Search Header */}
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
                    title="إدراج نجمة (*) للبحث بالحروف الناقصة مثل Drug Eye"
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

            {/* Compact Single-Row Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
              <button
                type="button"
                onClick={() => setSearchByActiveIngredient(false)}
                className={`px-2.5 py-1 rounded-lg font-bold border shrink-0 transition-all ${
                  !searchByActiveIngredient
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                🔍 الاسم التجاري + Drug Eye (*)
              </button>
              <button
                type="button"
                onClick={() => setSearchByActiveIngredient(!searchByActiveIngredient)}
                className={`px-2.5 py-1 rounded-lg font-bold border shrink-0 transition-all ${
                  searchByActiveIngredient
                    ? "bg-purple-500/25 text-purple-200 border-purple-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                🧪 المادة الفعالة (المثائل)
              </button>
              <button
                type="button"
                onClick={() => setSearchByAi(!searchByAi)}
                className={`px-2.5 py-1 rounded-lg font-bold border shrink-0 transition-all ${
                  searchByAi
                    ? "bg-violet-500/25 text-violet-200 border-violet-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                ✨ ذكاء اصطناعي
              </button>
            </div>
          </div>

          {/* Scrollable Results List in Upper Viewport (Above Mobile Keyboard!) */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-950">
            {renderSearchResultsList(true)}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIFIED DARK GLASS DRUG PAD (Seamless on Both Mobile & Desktop)           */}
      {/* ========================================================================= */}
      <div
        ref={containerRef}
        className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3.5 no-print relative shadow-xl"
        dir="rtl"
      >
        {/* Unified Single-Row Mode & Filter Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/90 pb-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                setSearchByActiveIngredient(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !isManualMode && !searchByActiveIngredient
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span>بحث الأدوية الذكي (Drug Eye *)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                setSearchByActiveIngredient(!searchByActiveIngredient);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !isManualMode && searchByActiveIngredient
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-purple-300 border-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>بحث بالمادة الفعالة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                setSearchByAi(!searchByAi);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                !isManualMode && searchByAi
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-violet-300 border-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>ذكاء Gemini الطبي</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(true);
                setIsDropdownOpen(false);
                setShowEquivalents(false);
                setTimeout(() => manualInputRef.current?.focus(), 50);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isManualMode
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-cyan-300 border-slate-800"
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-cyan-400" />
              <span>كتابة يدوية حرة</span>
            </button>
          </div>

          {isOfflineMode && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              وضع أوفلاين
            </span>
          )}
        </div>

        {/* Main Search Input or Manual Entry */}
        {!isManualMode ? (
          <div className="relative">
            <div className="relative flex items-center">
              {isSearching ? (
                <Loader2 className="w-4 h-4 absolute right-3.5 text-emerald-400 animate-spin pointer-events-none" />
              ) : (
                <Search
                  className={`w-4 h-4 absolute right-3.5 pointer-events-none ${
                    searchByActiveIngredient
                      ? "text-purple-400"
                      : searchByAi
                      ? "text-emerald-400"
                      : "text-emerald-400"
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
                  setSelectedDrug(null);
                  setShowEquivalents(false);
                }}
                onFocus={handleSearchFocus}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchByActiveIngredient
                    ? "ابحث بالمادة الفعالة (مثال: Paracetamol, Bisoprolol, باراسيتامول...)"
                    : "ابحث بالحروف الأبجدية (ب، بن...) أو بالنجمة (*gm*n*600) أو العَرَض..."
                }
                className="w-full pr-10 pl-20 py-3 rounded-xl bg-slate-900/95 border border-slate-700/90 focus:border-emerald-500 font-bold text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner transition-all"
                autoComplete="off"
              />

              <div className="absolute left-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleInsertWildcard}
                  className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono font-black text-xs transition-colors cursor-pointer flex items-center gap-0.5"
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
                      setSelectedDrug(null);
                      setIsDropdownOpen(false);
                      setShowEquivalents(false);
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-white transition-colors text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Desktop / Tablet Autocomplete Dropdown */}
            {isDropdownOpen && !isMobileSpotlight && !isManualMode && (
              <div
                ref={dropdownRef}
                className="absolute z-50 top-full mt-2 w-full bg-slate-950/98 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in text-right"
                dir="rtl"
              >
                {renderSearchResultsList(false)}
              </div>
            )}
          </div>
        ) : (
          /* Manual Mode Inputs */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 block">
                اسم الدواء التجاري (يُحفظ تلقائياً في قاعدة البيانات للجميع): *
              </label>
              <input
                ref={manualInputRef}
                type="text"
                value={manualDrugName}
                onChange={(e) => setManualDrugName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب اسم الدواء أو التركيبة..."
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
                placeholder="المادة الفعالة إن وجدت..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        )}

        {/* Selected Drug Banner with Equivalents & Conflict Warning */}
        {selectedDrug && !isManualMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-black text-emerald-200 truncate" dir="ltr">
                  {selectedDrug.name}
                </span>
                {selectedDrug.activeIngredient && (
                  <span className="text-[10px] text-emerald-400/90 truncate font-mono">
                    ({selectedDrug.activeIngredient})
                  </span>
                )}
                {selectedDrug.price && Number(selectedDrug.price) > 0 && (
                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {selectedDrug.price} ج.م
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEquivalents(selectedDrug)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3 h-3 text-emerald-400" />
                  <span>البدائل والمثائل</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDrug(null);
                    setShowEquivalents(false);
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-400 font-bold px-2 py-1"
                >
                  تغيير
                </button>
              </div>
            </div>

            {activeConflict && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <p className="font-black text-[11px] text-rose-300">
                    تنبيه تعارض دوائي مع: {activeConflict.conflictingWith} ({activeConflict.titleAr})
                  </p>
                  <p className="text-[10px] text-rose-200/90 leading-relaxed">
                    {activeConflict.reasonAr}
                  </p>
                </div>
              </div>
            )}

            {showEquivalents && (
              <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-lg space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>البدائل والمثائل الصيدلانية المتاحة بنفس المادة الفعالة:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEquivalents(false)}
                    className="text-xs text-slate-400 hover:text-white font-bold p-1"
                  >
                    ✕ إغلاق
                  </button>
                </div>

                {loadingEquivalents ? (
                  <p className="text-center py-3 text-xs text-slate-400 animate-pulse">
                    جاري جلب البدائل الصيدلانية...
                  </p>
                ) : equivalentsList.length === 0 ? (
                  <p className="text-center py-3 text-xs text-slate-400">
                    لا توجد بدائل مسجلة بنفس المادة الفعالة حالياً.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {equivalentsList.map((alt) => (
                      <div
                        key={alt.id}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-black text-slate-100 truncate" dir="ltr">{alt.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {alt.company || "شركة أدوية"} • {alt.dosageForm || "قرص"}
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
                              handleInstantAddDrug(alt);
                              setShowEquivalents(false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] transition-colors cursor-pointer"
                          >
                            + اختيار البديل
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick 1-Tap Dosage & Duration Chips + Editable Inputs */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80 text-xs">
          {/* 1-Tap Quick Chips Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 ml-1">جرعة سريعة:</span>
            {QUICK_FREQ_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setFrequency(chip.value)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  frequency === chip.value
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <span className="text-slate-700 mx-0.5">|</span>
            {QUICK_DURATION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setDuration(chip.value)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  duration === chip.value
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Quantity & Form */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 block">الكمية والشكل:</label>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  value={doseQuantity}
                  onChange={(e) => setDoseQuantity(e.target.value)}
                  placeholder="1"
                  className="px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-100 text-center text-xs focus:outline-none focus:border-emerald-500"
                />
                <select
                  value={doseForm}
                  onChange={(e) => setDoseForm(e.target.value)}
                  className="col-span-2 px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-200 text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  {COMMON_DOSE_FORMS.map((f) => (
                    <option key={f} value={f} className="bg-slate-900 text-slate-100">
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 block">مواعيد الجرعة:</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setFrequency(e.target.value);
                  }}
                  className="text-[10px] font-bold text-emerald-400 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                >
                  <option value="">⚡ قوالب جاهزة...</option>
                  {FREQUENCY_PRESETS.map((fq) => (
                    <option key={fq} value={fq}>
                      {fq}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب مواعيد الجرعة..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-100 text-[11px] placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 block">مدة العلاج:</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setDuration(e.target.value);
                  }}
                  className="text-[10px] font-bold text-cyan-400 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                >
                  <option value="">⚡ مدة جاهزة...</option>
                  {DURATION_PRESETS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب مدة العلاج..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-100 text-[11px] placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Special Instructions & Commit Button */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ملاحظات إضافية للدواء (مثال: يرج جيداً قبل الاستعمال، قبل الأكل بنصف ساعة...)"
              className="w-full sm:flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />

            <button
              type="button"
              onClick={handleCommitItem}
              disabled={!isReadyToAdd}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة الدواء للروشتة ↵</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
