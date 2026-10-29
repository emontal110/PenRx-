"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Pill,
  Sparkles,
  PenTool,
  Check,
  X,
  Clock,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  Zap,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { DrugRecord } from "@/types/drug";
import { recordDrugPrescribed } from "@/lib/drugTracker";
import { PrescriptionItem } from "@/store/usePrescriptionStore";
import { getSmartDrugDosage, getCleanEnglishDrugName } from "@/lib/smartDrugDosage";
import { checkInstantDrugConflict, InteractionConflict } from "@/lib/clinicalInteractionChecker";
import { cacheDrugsLocally, searchOfflineDrugs } from "@/lib/offlineDrugStorage";
import { showGlobalToast } from "@/components/common/GlobalToast";

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

const DURATION_PRESETS = [
  "لمدة 3 أيام",
  "لمدة 5 أيام",
  "لمدة أسبوع (7 أيام)",
  "لمدة 10 أيام",
  "لمدة أسبوعين (14 يوماً)",
  "لمدة شهر كامل",
  "عند الحاجة فقط",
];

export function InlineDrugPadInput({
  onAddItem,
  primaryColor = "#059669",
  currentItems = [],
}: InlineDrugPadInputProps) {
  // Mode: Search database vs Manual free writing
  const [isManualMode, setIsManualMode] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Advanced Search Toggles
  const [searchByActiveIngredient, setSearchByActiveIngredient] = useState(false);
  const [searchByAi, setSearchByAi] = useState(true); // AI mode is ON by default
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
  const manualInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAddingRef = useRef(false);

  // Smoothly scrolls page so the search input appears directly beneath the sticky header
  const scrollToSearchBar = () => {
    if (typeof window === "undefined" || !containerRef.current) return;

    try {
      const stickyHeader =
        document.querySelector(".sticky.top-0") ||
        document.querySelector("header") ||
        document.querySelector("nav");

      const headerHeight = stickyHeader
        ? stickyHeader.getBoundingClientRect().height
        : 70;

      const rect = containerRef.current.getBoundingClientRect();
      const currentScrollY =
        window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

      const targetScrollY = Math.max(0, currentScrollY + rect.top - headerHeight - 6);

      window.scrollTo({
        top: targetScrollY,
        behavior: "smooth",
      });
    } catch {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSearchFocus = () => {
    if (query.trim()) {
      setIsDropdownOpen(true);
    }
    // Instantly scroll smoothly to position search engine below header
    scrollToSearchBar();

    // Accommodate mobile soft keyboard animation
    setTimeout(scrollToSearchBar, 120);
    setTimeout(scrollToSearchBar, 320);
  };

  // Debounced Drug Search with Multi-layer Cascading & Offline Fallback
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

    // Keep dropdown open so the doctor sees live status and results
    setIsDropdownOpen(true);
    setIsSearching(true);

    // Cancel previous in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/drugs/search?q=${encodeURIComponent(q)}&includeActiveIngredient=${searchByActiveIngredient}&useAi=${searchByAi}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const list: DrugRecord[] = (data.results || []).slice(0, 25);
        setResults(list);
        setHighlightedIndex(0);
        setIsOfflineMode(false);

        // Cache results locally for offline resilience
        if (list.length > 0) {
          cacheDrugsLocally(list);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return; // Ignore canceled request
        }
        console.warn("Server search unreachable, switching to offline local engine:", err);
        const offlineResults = searchOfflineDrugs(q, searchByActiveIngredient);
        setResults(offlineResults);
        setHighlightedIndex(0);
        setIsOfflineMode(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isManualMode, searchByActiveIngredient, searchByAi]);

  // Click outside to dismiss autocomplete dropdown
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

  // Update conflict warning whenever selected drug or current items change
  useEffect(() => {
    if (selectedDrug) {
      const conflict = checkInstantDrugConflict(selectedDrug, currentItems);
      setActiveConflict(conflict);
    } else {
      setActiveConflict(null);
    }
  }, [selectedDrug, currentItems]);

  const handleSelectDrug = (drug: DrugRecord) => {
    if (isAddingRef.current) return;
    isAddingRef.current = true;

    try {
      // 1. Strictly resolve clean English drug name for prescription
      const finalDrugName = getCleanEnglishDrugName(drug.name, drug.nameAr);

      // 2. Clinical Smart Auto-Fill for Dose Quantity, Form, Frequency, Duration, Instructions
      const smart = getSmartDrugDosage(drug);
      const finalQuantity = smart.doseQuantity || "1";
      const finalDoseForm = smart.doseForm || "Tablet (قرص)";

      let finalFrequency = smart.frequency || "كل 8 ساعات بعد الأكل (3 مرات)";
      let finalDuration = smart.duration || "لمدة 5 أيام";
      let finalInstructions = smart.instructions || "";

      if (drug.isAiGenerated && drug.recommendedDose) {
        finalFrequency = drug.recommendedDose;
        finalDuration = "طوال فترة العلاج";
        finalInstructions = "تم الضبط الذكي بواسطة Gemini 3.8 Flash";
      }

      // 3. Immediately add item to prescription!
      onAddItem({
        drugName: finalDrugName,
        activeIngredient: drug.activeIngredient?.trim() || undefined,
        doseQuantity: finalQuantity,
        doseForm: finalDoseForm,
        frequency: finalFrequency,
        duration: finalDuration,
        instructions: finalInstructions,
      });

      // 4. Record usage in local tracking for popularity analytics
      recordDrugPrescribed(drug.name);

      // 5. Toast feedback
      showGlobalToast("تمت الإضافة إلى الروشتة", "success");

      // 6. Complete clear of search engine & filters (query, results, dropdown, and filter modes)
      setQuery("");
      setResults([]);
      setSelectedDrug(null);
      setIsDropdownOpen(false);
      setShowEquivalents(false);
      setActiveConflict(null);
      setHighlightedIndex(0);
      setSearchByActiveIngredient(false);
      setSearchByAi(false);

      // Reset default form presets
      setDoseQuantity("1");
      setDoseForm("Tablet (قرص)");
      setFrequency("كل 8 ساعات بعد الأكل (3 مرات)");
      setDuration("لمدة 5 أيام");
      setInstructions("");

      // 7. Keep focus on search input for lightning-fast continuous prescribing
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } finally {
      setTimeout(() => {
        isAddingRef.current = false;
      }, 200);
    }
  };

  // Fetch Equivalents & Generics for selected drug
  const handleOpenEquivalents = async (drug: DrugRecord) => {
    setShowEquivalents(true);
    setLoadingEquivalents(true);
    try {
      const ingredient = drug.activeIngredient || drug.name;
      const res = await fetch(
        `/api/drugs/equivalents?ingredient=${encodeURIComponent(ingredient)}&currentDrug=${encodeURIComponent(drug.name)}`
      );
      const data = await res.json();
      setEquivalentsList(data.equivalents || []);
    } catch {
      setEquivalentsList([]);
    } finally {
      setLoadingEquivalents(false);
    }
  };

  const handleSelectEquivalent = (alt: DrugRecord) => {
    handleSelectDrug(alt);
    setShowEquivalents(false);
  };

  const handleCommitItem = () => {
    const rawName = isManualMode
      ? manualDrugName.trim()
      : selectedDrug
      ? selectedDrug.name.trim()
      : query.trim();

    if (!rawName) return;

    // Strictly ensure English drug name in prescription
    const finalDrugName = getCleanEnglishDrugName(rawName, selectedDrug?.nameAr);

    const finalActiveIngredient = isManualMode
      ? manualActiveIngredient.trim()
      : selectedDrug?.activeIngredient?.trim() || "";

    onAddItem({
      drugName: finalDrugName,
      activeIngredient: finalActiveIngredient || undefined,
      doseQuantity: doseQuantity.trim() || "1",
      doseForm: doseForm.trim() || "Tablet (قرص)",
      frequency: frequency.trim() || "كل 8 ساعات بعد الأكل (3 مرات)",
      duration: duration.trim() || "لمدة 5 أيام",
      instructions: instructions.trim() || "",
    });

    // Record usage in local tracking for popularity analytics
    if (selectedDrug) {
      recordDrugPrescribed(selectedDrug.name);
    }

    showGlobalToast("تمت الإضافة إلى الروشتة", "success");

    // Reset state for next entry
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
    setSearchByActiveIngredient(false);
    setSearchByAi(false);
    setDoseQuantity("1");
    setDoseForm("Tablet (قرص)");
    setFrequency("كل 8 ساعات بعد الأكل (3 مرات)");
    setDuration("لمدة 5 أيام");
    setInstructions("");

    // Re-focus search input cleanly so doctor can search next drug immediately
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
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
          handleSelectDrug(results[highlightedIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
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

  return (
    <div
      ref={containerRef}
      className="mt-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 hover:border-emerald-500/60 transition-all space-y-3 no-print relative scroll-mt-20 sm:scroll-mt-24"
      dir="rtl"
    >
      {/* Top Strip: Input Mode Toggle & Advanced Clinical Layers */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/90 pb-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>كتابة الدواء مباشرة بالروشتة:</span>
          {isOfflineMode && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black flex items-center gap-1 animate-pulse">
              <Zap className="w-3 h-3 text-amber-600" />
              وضع أوفلاين محلي
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mode switch */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-xs text-[11px]">
            <button
              type="button"
              onClick={() => {
                setIsManualMode(false);
                scrollToSearchBar();
                setTimeout(() => {
                  searchInputRef.current?.focus();
                  scrollToSearchBar();
                }, 50);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                !isManualMode
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search className="w-3 h-3" />
              <span>بحث الأدوية الذكي (43,000+ دواء)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsManualMode(true);
                setIsDropdownOpen(false);
                setShowEquivalents(false);
                scrollToSearchBar();
                setTimeout(() => {
                  manualInputRef.current?.focus();
                  scrollToSearchBar();
                }, 50);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${
                isManualMode
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PenTool className="w-3 h-3" />
              <span>كتابة مانيول حرة</span>
            </button>
          </div>

          {/* Active Ingredient Search Toggle */}
          {!isManualMode && (
            <button
              type="button"
              onClick={() => {
                setSearchByActiveIngredient(!searchByActiveIngredient);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              title="تفعيل البحث بالمواد الفعالة بالإضافة إلى الأسماء التجارية"
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 shadow-xs ${
                searchByActiveIngredient
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-md shadow-purple-950/30"
                  : "bg-white text-slate-700 hover:text-purple-700 border-slate-200 hover:border-purple-300"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${searchByActiveIngredient ? "text-purple-200" : "text-purple-500"}`} />
              <span>بحث بالمادة الفعالة</span>
              {searchByActiveIngredient && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping shrink-0" />
              )}
            </button>
          )}

          {/* Google Gemini AI Deep Suggestion Toggle */}
          {!isManualMode && (
            <button
              type="button"
              onClick={() => {
                setSearchByAi(!searchByAi);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              title="تفعيل بحث الذكاء الاصطناعي السريري العميق عبر Google Gemini 3.8 Flash"
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 shadow-xs ${
                searchByAi
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white border-violet-500 shadow-md shadow-violet-950/30"
                  : "bg-white text-slate-700 hover:text-violet-700 border-slate-200 hover:border-violet-300"
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${searchByAi ? "text-fuchsia-200 animate-spin" : "text-violet-600"}`} />
              <span>ذكاء اصطناعي (Gemini 3.8)</span>
              {searchByAi && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Input Line */}
      {!isManualMode ? (
        <div className="relative">
          <div className="relative flex items-center">
            {isSearching ? (
              <Loader2 className="w-4 h-4 absolute right-3 text-emerald-600 animate-spin pointer-events-none" />
            ) : (
              <Search className={`w-4 h-4 absolute right-3 pointer-events-none ${searchByAi ? "text-fuchsia-600" : searchByActiveIngredient ? "text-purple-600" : "text-emerald-600"}`} />
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
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                }
                setSelectedDrug(null);
                setShowEquivalents(false);
              }}
              onFocus={handleSearchFocus}
              onClick={scrollToSearchBar}
              onKeyDown={handleKeyDown}
              placeholder={
                searchByAi
                  ? "اسأل ذكاء Gemini الطبي عن دواء نادر أو عَرَض مرضي أو تركيبة..."
                  : searchByActiveIngredient
                  ? "ابحث باسم المادة الفعالة (مثال: Paracetamol, Amoxicillin, Omeprazole...)"
                  : "ابحث بالاسم التجاري، العلمي، أو العَرَض (مثال: خافض حرارة، حساسية، مغص، كحة)..."
              }
              className={`w-full pr-9 pl-8 py-2.5 rounded-xl bg-white border font-bold text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 shadow-inner transition-all ${
                searchByAi
                  ? "border-violet-400 focus:border-violet-600 focus:ring-violet-500/20"
                  : searchByActiveIngredient
                  ? "border-purple-300 focus:border-purple-500 focus:ring-purple-500/20"
                  : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20"
              }`}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                  setQuery("");
                  setResults([]);
                  setIsSearching(false);
                  setSelectedDrug(null);
                  setIsDropdownOpen(false);
                  setShowEquivalents(false);
                  setSearchByActiveIngredient(false);
                  setSearchByAi(false);
                  searchInputRef.current?.focus();
                  scrollToSearchBar();
                }}
                className="absolute left-2.5 p-1 text-slate-400 hover:text-slate-700 transition-colors text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && !isManualMode && query.trim().length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 top-full mt-1.5 w-full bg-white border border-slate-300 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto animate-in fade-in text-right"
              dir="rtl"
            >
              <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between border-b border-slate-200">
                <span>
                  {isSearching ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      جاري البحث الفوري...
                    </span>
                  ) : (
                    `نتائج البحث (${results.length})`
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  {isOfflineMode && (
                    <span className="text-amber-600 font-bold">⚡ أوفلاين</span>
                  )}
                  {results.length > 0 && <span>اضغط Enter للاختيار</span>}
                </span>
              </div>

              {results.length > 0 ? (
                results.slice(0, 25).map((drug, idx) => {
                  const isSelected = idx === highlightedIndex;
                  const conflict = checkInstantDrugConflict(drug, currentItems);

                  return (
                    <button
                      key={drug.id || idx}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectDrug(drug);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectDrug(drug);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full text-right p-3 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected ? "bg-emerald-50 text-emerald-950 font-bold" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Pill className={`w-3.5 h-3.5 shrink-0 ${drug.isAiGenerated ? "text-violet-600" : "text-emerald-600"}`} />
                          <span className="font-black text-xs text-slate-900 truncate">
                            {drug.name}
                          </span>

                          {drug.dosageForm && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {drug.dosageForm}
                            </span>
                          )}

                          {drug.isAiGenerated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 font-black flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-violet-600" />
                              ذكاء اصطناعي (Gemini)
                            </span>
                          )}

                          {drug.isIndicationMatch && drug.matchedIndication && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 font-bold">
                              🎯 {drug.matchedIndication}
                            </span>
                          )}

                          {conflict && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              تداخل مع: {conflict.conflictingWith}
                            </span>
                          )}
                        </div>

                        {drug.activeIngredient && (
                          <p className="text-[10px] text-slate-500 pr-5 truncate mt-0.5">
                            المادة الفعالة: {drug.activeIngredient}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {drug.price && Number(drug.price) > 0 && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {drug.price} ج.م
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : isSearching ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>جاري فحص بنك الأدوية (43,000+ دواء)...</span>
                </div>
              ) : (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs text-slate-600">
                    لم يتم العثور على أدوية مطابقة لـ <span className="font-bold text-slate-900">&quot;{query}&quot;</span> محلياً
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchByAi(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>بحث بواسطة ذكاء Gemini الطبي ✨</span>
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsManualMode(true);
                        setManualDrugName(query);
                        setIsDropdownOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-300"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>كتابة مانيول كدواء حر</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Manual Mode Inputs */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 block">
              اسم الدواء التجاري: *
            </label>
            <input
              ref={manualInputRef}
              type="text"
              value={manualDrugName}
              onChange={(e) => setManualDrugName(e.target.value)}
              onFocus={handleSearchFocus}
              onClick={scrollToSearchBar}
              onKeyDown={handleKeyDown}
              placeholder="اكتب اسم الدواء الحر..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-bold text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 block">
              المادة الفعالة (اختياري):
            </label>
            <input
              type="text"
              value={manualActiveIngredient}
              onChange={(e) => setManualActiveIngredient(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="المادة الفعالة إن وجدت..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Selected Drug Badge Indicator with Instant Equivalents & Conflict Alerts */}
      {selectedDrug && !isManualMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-black text-emerald-950 truncate">{selectedDrug.name}</span>
              {selectedDrug.activeIngredient && (
                <span className="text-[10px] text-emerald-700 truncate font-medium">
                  ({selectedDrug.activeIngredient})
                </span>
              )}
              {selectedDrug.price && Number(selectedDrug.price) > 0 && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                  {selectedDrug.price} ج.م
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Direct Generics & Alternatives Drawer Trigger */}
              <button
                type="button"
                onClick={() => handleOpenEquivalents(selectedDrug)}
                className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 hover:border-emerald-500 text-emerald-800 font-bold text-[11px] shadow-2xs hover:bg-emerald-100/60 transition-all flex items-center gap-1 cursor-pointer"
                title="عرض الأدوية البديلة بنفس المادة الفعالة والتركيز"
              >
                <ArrowLeftRight className="w-3 h-3 text-emerald-600" />
                <span>عرض البدائل والمثائل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDrug(null);
                  setShowEquivalents(false);
                }}
                className="text-[10px] text-slate-500 hover:text-rose-600 font-bold px-2 py-1"
              >
                تغيير
              </button>
            </div>
          </div>

          {/* Clinical Real-Time Conflict Alert (Pre-Add Warning) */}
          {activeConflict && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-black text-[11px] text-amber-900">
                  تنبيه تعارض دوائي مع: {activeConflict.conflictingWith} ({activeConflict.titleAr})
                </p>
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  {activeConflict.reasonAr}
                </p>
              </div>
            </div>
          )}

          {/* Inline Equivalents & Generics Drawer */}
          {showEquivalents && (
            <div className="p-3 rounded-2xl bg-white border border-emerald-300 shadow-md space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>البدائل والمثائل الصيدلانية المتاحة:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEquivalents(false)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold p-1"
                >
                  ✕ إغلاق
                </button>
              </div>

              {loadingEquivalents ? (
                <p className="text-center py-3 text-xs text-slate-500 animate-pulse">
                  جاري جلب البدائل الصيدلانية...
                </p>
              ) : equivalentsList.length === 0 ? (
                <p className="text-center py-3 text-xs text-slate-500">
                  لا توجد بدائل مسجلة بنفس المادة الفعالة حالياً.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {equivalentsList.map((alt) => (
                    <div
                      key={alt.id}
                      className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 transition-all flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 truncate">{alt.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {alt.company || "شركة أدوية"} • {alt.dosageForm || "قرص"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {alt.price && Number(alt.price) > 0 && (
                          <span className="font-mono font-bold text-emerald-700 text-[11px]">
                            {alt.price} ج.م
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectEquivalent(alt)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors cursor-pointer"
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
      )}

      {/* Dosage, Frequency & Duration Preset Helpers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1 border-t border-slate-200">
        {/* Quantity & Form */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-600 block">الكمية والشكل:</label>
          <div className="grid grid-cols-3 gap-1">
            <input
              type="text"
              value={doseQuantity}
              onChange={(e) => setDoseQuantity(e.target.value)}
              placeholder="1"
              className="px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 text-center text-xs focus:outline-none focus:border-emerald-500"
            />
            <select
              value={doseForm}
              onChange={(e) => setDoseForm(e.target.value)}
              className="col-span-2 px-2 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 text-[11px] focus:outline-none focus:border-emerald-500"
            >
              {COMMON_DOSE_FORMS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Frequency - Free Text + Quick Presets */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-700 block">مواعيد الجرعة (كتابة حرة):</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setFrequency(e.target.value);
              }}
              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none hover:bg-emerald-100"
              title="اختيار موعد جرعة جاهز"
            >
              <option value="">⚡ اختر جاهز...</option>
              {FREQUENCY_PRESETS.map((fq) => (
                <option key={fq} value={fq}>
                  {fq}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <input
              type="text"
              list="frequency-presets-list"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب مواعيد الجرعة بحرية..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
            <datalist id="frequency-presets-list">
              {FREQUENCY_PRESETS.map((fq) => (
                <option key={fq} value={fq} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Duration - Free Text + Quick Presets */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-700 block">مدة العلاج (كتابة حرة):</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setDuration(e.target.value);
              }}
              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none hover:bg-emerald-100"
              title="اختيار مدة علاج جاهزة"
            >
              <option value="">⚡ اختر جاهز...</option>
              {DURATION_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <input
              type="text"
              list="duration-presets-list"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب مدة العلاج بحرية..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
            <datalist id="duration-presets-list">
              {DURATION_PRESETS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Special Instructions & Add Button Row */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ملاحظات خاصة (مثال: بعد الأكل بنصف ساعة، قبل النوم مباشرة...)"
          className="w-full sm:flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
        />

        <button
          type="button"
          onClick={handleCommitItem}
          disabled={!isReadyToAdd}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/30 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>إضافة الدواء للروشتة ↵</span>
        </button>
      </div>
    </div>
  );
}
