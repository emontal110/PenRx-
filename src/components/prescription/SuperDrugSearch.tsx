"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Sparkles,
  Pill,
  Clock,
  Calendar,
  AlertCircle,
  Check,
  Building,
  DollarSign,
  Share2,
  Bot,
  Flame,
  CheckCircle2,
  Edit3,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  List,
  PenTool,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { DrugRecord, recordDrugPrescribed } from "@/lib/drugSearchEngine";
import { PrescriptionItem, usePrescriptionStore } from "@/store/usePrescriptionStore";
import { showGlobalToast } from "@/components/common/GlobalToast";

interface SuperDrugSearchProps {
  onAddItem: (item: Omit<PrescriptionItem, "id">) => void;
  items?: PrescriptionItem[];
  onRemoveItem?: (id: string) => void;
  onUpdateItem?: (id: string, updates: Partial<PrescriptionItem>) => void;
  /** Number of AI-detected drug interactions — drives the status indicator */
  aiAlertCount?: number;
}

const FREQUENCY_PRESETS = [
  "كل 8 ساعات بعد الأكل (3 مرات يومياً)",
  "كل 12 ساعة بعد الوجبات (مرتان يومياً)",
  "مرة واحدة يومياً صباحاً على الريق",
  "مرة واحدة يومياً مساءً قبل النوم",
  "كل 6 ساعات (4 مرات يومياً)",
  "عند اللزوم فقط (PRN)",
  "قبل الأكل بنصف ساعة",
  "وسط الوجبة",
];

const DURATION_PRESETS = [
  "لمدة 3 أيام",
  "لمدة 5 أيام",
  "لمدة 7 أيام (أسبوع)",
  "لمدة 10 أيام",
  "لمدة أسبوعين (14 يوماً)",
  "لمدة شهر كامل",
  "عند الحاجة فقط",
];

const COMMON_DOSE_FORMS = [
  "Tablet (قرص)",
  "Capsule (كبسولة)",
  "Syrup (شراب)",
  "Suspension (معلق)",
  "Cream (كريم)",
  "Ointment (مرهم)",
  "Drops (قطرة)",
  "Ampoule (أمبول/حقنة)",
  "Vial (حقنة وريدية)",
  "Effervescent (فوار)",
  "Mouthwash (مضمضة)",
];

export function SuperDrugSearch({
  onAddItem,
  items = [],
  onRemoveItem,
  onUpdateItem,
  aiAlertCount = 0,
}: SuperDrugSearchProps) {
  const storeUpdateItem = usePrescriptionStore((state) => state.updateItem);
  const handleUpdate = onUpdateItem || storeUpdateItem;

  // Active Editing State for Drug in Current Prescription
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Mode: Search vs Manual Free-Text Entry
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualDrugName, setManualDrugName] = useState("");
  const [manualActiveIngredient, setManualActiveIngredient] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugRecord | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Form inputs (الكمية، الشكل الدوائي، التكرار، المدة، التعليمات)
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseForm, setDoseForm] = useState("Tablet (قرص)");
  const [isCustomDoseForm, setIsCustomDoseForm] = useState(false);
  const [frequency, setFrequency] = useState("كل 8 ساعات بعد الأكل (3 مرات يومياً)");
  const [isCustomFrequency, setIsCustomFrequency] = useState(false);
  const [duration, setDuration] = useState("لمدة 5 أيام");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [instructions, setInstructions] = useState("");

  // Select a drug from the list to load into the inputs below for immediate editing
  const selectItemForEditing = (item: PrescriptionItem) => {
    if (editingItemId === item.id) {
      clearEditingItem();
      return;
    }

    setEditingItemId(item.id);

    // 1. Populate Dose Quantity
    setDoseQuantity(item.doseQuantity || "1");

    // 2. Populate Dose Form
    const itemForm = item.doseForm || "Tablet (قرص)";
    setDoseForm(itemForm);
    setIsCustomDoseForm(!COMMON_DOSE_FORMS.includes(itemForm));

    // 3. Populate Frequency
    const itemFreq = item.frequency || "كل 8 ساعات بعد الأكل (3 مرات يومياً)";
    setFrequency(itemFreq);
    setIsCustomFrequency(!FREQUENCY_PRESETS.includes(itemFreq));

    // 4. Populate Duration
    const itemDur = item.duration || "لمدة 5 أيام";
    setDuration(itemDur);
    setIsCustomDuration(!DURATION_PRESETS.includes(itemDur));

    // 5. Populate Instructions
    setInstructions(item.instructions || "");

    // Close any active search dropdown so search engine remains undisturbed
    setIsDropdownOpen(false);

    showGlobalToast(`📋 تم سرد جرعات (${item.drugName}) في الحقول أدناه للتعديل المباشر`, "info");
  };

  const clearEditingItem = () => {
    setEditingItemId(null);
    setDoseQuantity("1");
    setDoseForm("Tablet (قرص)");
    setIsCustomDoseForm(false);
    setFrequency("كل 8 ساعات بعد الأكل (3 مرات يومياً)");
    setIsCustomFrequency(false);
    setDuration("لمدة 5 أيام");
    setIsCustomDuration(false);
    setInstructions("");
  };

  // Helper to instantly reflect changes into the active prescription item
  const updateActiveItemField = (field: keyof PrescriptionItem, value: any) => {
    if (editingItemId) {
      handleUpdate(editingItemId, { [field]: value });
    }
  };

  // AI & Custom Drug States
  const [searchByActiveIngredient, setSearchByActiveIngredient] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]); // auto-shown when no results
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customSavedToast, setCustomSavedToast] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExternalResult, setIsExternalResult] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time debounced search + auto-AI when no results
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setAiSuggestions([]);
      setIsDropdownOpen(false);
      setIsExternalResult(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setAiSuggestions([]); // clear old AI suggestions while searching
      try {
        const res = await fetch(
          `/api/drugs/search?q=${encodeURIComponent(query.trim())}&includeActiveIngredient=${searchByActiveIngredient}`
        );
        const data = await res.json();
        const resultList = data.results || [];
        setResults(resultList);
        setExecutionTime(data.executionTimeMs ?? 0);
        setIsExternalResult(!!data.hasExternalResults);
        setIsDropdownOpen(resultList.length > 0);

        // ── Auto-AI: when 0 results, trigger AI suggestions automatically ──
        if (resultList.length === 0 && query.trim().length >= 2) {
          setIsAiLoading(true);
          try {
            const aiRes = await fetch("/api/drugs/ai-suggest", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drugName: query.trim() }),
            });
            const aiData = await aiRes.json();
            if (aiData.suggestions?.length) {
              setAiSuggestions(aiData.suggestions);
            }
          } catch {
            // AI offline — fail silently
          } finally {
            setIsAiLoading(false);
          }
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200); // 200ms debounce — snappy real-time alphabetical filtering

    return () => clearTimeout(timer);
  }, [query, searchByActiveIngredient]);

  // Handle clicking outside dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global shortcut (Ctrl+K) to focus instant drug search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectDrug = (drug: DrugRecord) => {
    const finalForm = drug.dosageForm || doseForm || "Tablet (قرص)";
    onAddItem({
      drugId: drug.id,
      drugName: drug.name,
      activeIngredient: drug.activeIngredient,
      doseQuantity: doseQuantity || "1",
      doseForm: finalForm,
      frequency: frequency || "كل 8 ساعات بعد الأكل",
      duration: duration || "لمدة 5 أيام",
      instructions: instructions.trim() || undefined,
      isCustom: false,
    });
    recordDrugPrescribed(drug.name);
    setQuery("");
    setSelectedDrug(null);
    setAiSuggestions([]);
    setIsDropdownOpen(false);
    setInstructions("");
    setCustomSavedToast(`⚡ تم إدراج (${drug.name}) في الروشتة فوراً!`);
    setTimeout(() => setCustomSavedToast(null), 3000);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Auto-save AI suggestion to DB then add to prescription (self-learning)
  const handleSelectAiSuggestion = async (suggestion: any) => {
    // 1. Add to prescription immediately (doctor-first UX)
    onAddItem({
      drugName: suggestion.name,
      activeIngredient: suggestion.activeIngredient,
      doseQuantity: doseQuantity || "1",
      doseForm: suggestion.dosageForm || doseForm,
      frequency: suggestion.recommendedDose || frequency,
      duration: duration,
      instructions: undefined,
      isCustom: true,
    });
    recordDrugPrescribed(suggestion.name);
    setQuery("");
    setAiSuggestions([]);
    setInstructions("");
    setCustomSavedToast(`🤖 تم إدراج (${suggestion.name}) من ترشيحات الذكاء الاصطناعي!`);
    setTimeout(() => setCustomSavedToast(null), 3500);
    setTimeout(() => inputRef.current?.focus(), 50);

    // 2. Auto-save to Supabase DB so ALL doctors see it next time (self-learning)
    fetch("/api/drugs/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: suggestion.name,
        nameAr: suggestion.nameAr || suggestion.name,
        activeIngredient: suggestion.activeIngredient,
        activeIngredientAr: suggestion.activeIngredientAr,
        dosageForm: suggestion.dosageForm,
        category: suggestion.category,
        doctorContributor: "PenRX+ AI",
      }),
    }).catch(() => {}); // fire & forget
  };

  // Save new custom drug into public cloud repository
  const handleSaveToPublicBank = async () => {
    if (!query.trim()) return;
    setIsSavingCustom(true);

    try {
      const res = await fetch("/api/drugs/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: query.trim(),
          activeIngredient: aiSuggestions[0]?.activeIngredient || "تركيبة خاصة / Custom Formula",
          dosageForm: doseForm,
          category: aiSuggestions[0]?.category || "عام",
          doctorContributor: "طبيب ممارس",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomSavedToast("✅ تم حفظ الدواء بنجاح في بنك الأدوية العام وسيظهر لجميع الأطباء فوراً!");
        if (data.drug) {
          handleSelectDrug(data.drug);
        }
        setTimeout(() => setCustomSavedToast(null), 5000);
      }
    } catch (err) {
      console.error("Save custom drug error:", err);
    } finally {
      setIsSavingCustom(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItemId) {
      handleUpdate(editingItemId, {
        doseQuantity,
        doseForm,
        frequency,
        duration,
        instructions: instructions.trim() || undefined,
      });

      const activeDrug = items.find((it) => it.id === editingItemId);
      showGlobalToast(`✅ تم حفظ وتأكيد تعديل جرعات (${activeDrug?.drugName || "الدواء"}) بنجاح`, "success");
      setCustomSavedToast("✅ تم حفظ وتأكيد التعديل بنجاح!");
      setTimeout(() => setCustomSavedToast(null), 3000);
      clearEditingItem();
      return;
    }

    let finalDrugName = "";
    let finalActiveIngredient: string | undefined = undefined;
    let isCustomItem = false;

    if (isManualMode) {
      if (!manualDrugName.trim()) return;
      finalDrugName = manualDrugName.trim();
      finalActiveIngredient = manualActiveIngredient.trim() || undefined;
      isCustomItem = true;
    } else {
      finalDrugName = selectedDrug ? selectedDrug.name : query.trim();
      if (!finalDrugName) return;
      finalActiveIngredient = selectedDrug?.activeIngredient || aiSuggestions[0]?.activeIngredient;
      isCustomItem = !selectedDrug;
    }

    onAddItem({
      drugId: isManualMode ? undefined : selectedDrug?.id,
      drugName: finalDrugName,
      activeIngredient: finalActiveIngredient,
      doseQuantity,
      doseForm,
      frequency,
      duration,
      instructions: instructions.trim() || undefined,
      isCustom: isCustomItem,
    });

    recordDrugPrescribed(finalDrugName);

    // Auto-learn: If custom item or manual drug, auto-save to cloud repository so all doctors benefit
    if (isCustomItem && finalDrugName) {
      fetch("/api/drugs/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalDrugName,
          nameAr: finalDrugName,
          activeIngredient: finalActiveIngredient || "تركيبة طبية خاصة",
          dosageForm: doseForm,
          category: "مساهمة أطباء",
          doctorContributor: "طبيب ممارس",
        }),
      }).catch(() => {});
    }

    // Reset fields for next drug
    if (isManualMode) {
      setManualDrugName("");
      setManualActiveIngredient("");
      manualInputRef.current?.focus();
    } else {
      setQuery("");
      setSelectedDrug(null);
      setAiSuggestions([]);
      inputRef.current?.focus();
    }
    setInstructions("");
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative">
      {/* Toast Notification */}
      {customSavedToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{customSavedToast}</span>
        </div>
      )}

      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {isManualMode ? <PenTool className="w-4 h-4 text-amber-400" /> : <Sparkles className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2 flex-wrap">
              <span>{isManualMode ? "كتابة دواء يدوي (مانيول)" : "محرك البحث الدوائي"}</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                SuperEngine
              </span>

              {/* Small Manual Entry Toggle Button placed directly beside SuperEngine */}
              <button
                type="button"
                onClick={() => setIsManualMode(!isManualMode)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 ${
                  isManualMode
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 hover:brightness-110"
                    : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 hover:border-amber-400"
                }`}
                title={isManualMode ? "التبديل إلى محرك البحث الدوائي" : "التبديل إلى كتابة دواء يدوي مانيول"}
              >
                <Edit3 className="w-3 h-3" />
                <span>{isManualMode ? "بحث تلقائي 🔍" : "كتابة يدوي"}</span>
              </button>

              {/* Separator */}
              <span className="w-px h-4 bg-slate-700 rounded-full shrink-0" />

              {/* Active Ingredient Search Toggle Checkbox */}
              {!isManualMode && (
                <label
                  title="تفعيل البحث بالمواد الفعالة بالإضافة إلى الأسماء التجارية"
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black border transition-all cursor-pointer select-none active:scale-95 ${
                    searchByActiveIngredient
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={searchByActiveIngredient}
                    onChange={(e) => setSearchByActiveIngredient(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-purple-500 focus:ring-0 cursor-pointer accent-purple-500"
                  />
                  <span>بحث بالمادة الفعالة</span>
                </label>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {isManualMode
                ? "كتابة أي دواء أو تركيبة خاصة أو فيتامين يدوياً — يتم حفظها وتعميمها تلقائياً لبنك الأدوية السحابي"
                : "محرك فوري متعدد المصادر: أدوية مصرية، مستوردة (OpenFDA/RxNorm)، مستحضرات تجميل ومكملات غذائية"}
            </p>
          </div>
        </div>

        {/* Far Left: Drug Interaction Status Indicator (Red, Pulsing, ShieldAlert Icon) + Execution Time */}
        <div className="flex items-center gap-2 mr-auto">
          {/* ── Drug Interaction Status Indicator (Linked to AI Advisor: Red/Pulse when conflicts exist, Green 'آمن' when 0) ── */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("ai-advisor-section");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            title={
              aiAlertCount > 0
                ? `تحذير طبي: تم رصد ${aiAlertCount} تعارض ادويه — اضغط للانتقال لمساعد الذكاء الاصطناعي`
                : "فاحص تعارض ادويه التلقائي — الروشتة آمنة حالياً — اضغط للاطلاع"
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer active:scale-95 shadow-md ${
              aiAlertCount > 0
                ? "bg-rose-500/25 text-rose-100 border-rose-500 shadow-rose-950/60 ring-2 ring-rose-500/40 animate-pulse hover:bg-rose-500/35"
                : "bg-emerald-950/40 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/40 hover:border-emerald-500 shadow-emerald-950/30"
            }`}
          >
            {/* Beacon: Pulsing Red Ping if conflict exists, Green dot if safe */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {aiAlertCount > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-400" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 animate-pulse" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              )}
            </span>

            {/* Medical Drug Conflict Icon: Red ShieldAlert if conflicts, Green ShieldCheck if safe */}
            {aiAlertCount > 0 ? (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 animate-bounce" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            )}

            <span className="font-black text-[11px] sm:text-xs">
              {aiAlertCount > 0 ? `تحذير: ${aiAlertCount} تعارض ادويه ⚠️` : "تعارض ادويه: آمن ✓"}
            </span>
          </button>

          {/* Execution Time badge */}
          {!isManualMode && executionTime !== null && query ? (
            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
              ⚡ {executionTime}ms
            </span>
          ) : null}

          {/* Automatic Cloud Drug Updates & Pricing Badge */}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/20 text-[10px] sm:text-[11px] font-bold text-emerald-400/90 shadow-sm" title="قاعدة بيانات الأدوية والأسعار الرسمية متزامنة سحابياً وتُحدّث تلقائياً دون أي تدخل">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span>الأسعار والأصناف محدثة تلقائياً</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        {/* Drug Input: Manual Mode vs Search Combobox */}
        {isManualMode ? (
          <div className="space-y-3 p-4 sm:p-5 rounded-[22px] bg-gradient-to-br from-amber-950/30 via-slate-950 to-slate-950/90 border border-amber-500/35 shadow-[0_8px_25px_-6px_rgba(245,158,11,0.2)] animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>اسم الدواء / المستحضر مانيول: *</span>
                </label>
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualDrugName}
                  onChange={(e) => setManualDrugName(e.target.value)}
                  placeholder="اكتب اسم الدواء (مثال: شراب كحة بالزعتر، تركيبة مرهم خاصة، قطرة مرطبة...)"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-amber-500/40 text-sm font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 text-xs">
                  المادة الفعالة / تركيز الدواء (اختياري):
                </label>
                <input
                  type="text"
                  value={manualActiveIngredient}
                  onChange={(e) => setManualActiveIngredient(e.target.value)}
                  placeholder="مثال: Herbal Formula, 500mg, 10%..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 font-medium pt-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>التعلم الذاتي التلقائي: سيتم تسجيل هذا الصنف في بنك الأدوية السحابي ليظهر في نتائج البحث لجميع الأطباء فوراً.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Search Input Box with Luxury Glow */}
            <div className="relative group">
              {/* Ambient luxury backlight glow aura - strictly scoped to search box */}
              <div
                className={`pointer-events-none absolute -inset-[1.5px] rounded-[22px] transition-all duration-300 opacity-40 blur-[2px] group-hover:opacity-70 group-focus-within:opacity-100 group-focus-within:blur-[3px] ${
                  searchByActiveIngredient
                    ? "bg-gradient-to-r from-purple-500/40 via-fuchsia-500/20 to-purple-500/40"
                    : "bg-gradient-to-r from-emerald-500/40 via-teal-400/20 to-emerald-500/40"
                }`}
              />

              {/* Inner Luxury Container */}
              <div className="relative flex items-center">
                {/* Right Magnifier Icon with emerald jewel frosted frame */}
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-slate-900 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-focus-within:text-emerald-300 group-focus-within:border-emerald-400/50 group-focus-within:scale-105 group-focus-within:shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all duration-200 pointer-events-none shadow-inner">
                  <Search className="w-4 h-4" />
                </div>

                {/* The Input itself */}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedDrug(null);
                    setAiSuggestions([]);
                  }}
                  onFocus={() => {
                    if (results.length > 0) setIsDropdownOpen(true);
                  }}
                  placeholder={
                    searchByActiveIngredient
                      ? "ابحث بالمادة الفعالة أو الاسم التجاري (مثال: Paracetamol, Amoxicillin, أوميبرازول...)"
                      : "ابحث فورياً باسم الدواء (اكتب حرف أو حرفين مثل: Panadol, أوجمنتين, كونكور...)"
                  }
                  className={`w-full pr-14 pl-24 sm:pl-28 py-3.5 rounded-[20px] bg-slate-950/95 backdrop-blur-xl text-sm sm:text-base font-bold text-slate-100 placeholder:text-slate-500/90 focus:outline-none transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_8px_24px_-6px_rgba(0,0,0,0.5)] border ${
                    searchByActiveIngredient
                      ? "border-purple-500/50 focus:border-purple-400/90 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]"
                      : "border-slate-700/80 focus:border-emerald-400/90 focus:shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                  }`}
                />

                {/* Left End Controls: Clear Button, Loading Spinner, Badges */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isSearching && (
                    <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  )}

                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSelectedDrug(null);
                        setAiSuggestions([]);
                        setIsDropdownOpen(false);
                        inputRef.current?.focus();
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/70 hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer text-xs font-bold shadow-sm"
                      title="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {searchByActiveIngredient ? (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-[10px] font-black text-purple-300 shadow-sm">
                      مادة فعالة
                    </span>
                  ) : (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/60 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                      <span className="text-[10px] font-mono font-black text-emerald-400 tracking-tight">0.2ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Autocomplete Dropdown — anchored to the INPUT box ── */}
              {isDropdownOpen && results.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 top-[calc(100%+6px)] right-0 left-0 bg-slate-950 border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-950/40 overflow-hidden"
                  style={{ maxHeight: "360px", overflowY: "auto" }}
                >
                  {/* Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      {results.length} نتيجة مرتبة أبجدياً — اضغط على دواء لإضافته فوراً للروشتة
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(false)}
                      className="text-slate-500 hover:text-slate-200 transition-colors text-base leading-none"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Results */}
                  <div className="divide-y divide-slate-800/50">
                    {results.map((drug) => (
                      <button
                        key={drug.id}
                        type="button"
                        onClick={() => handleSelectDrug(drug)}
                        className="w-full text-right px-4 py-3 hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        {/* Drug Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-100 text-sm group-hover:text-emerald-300 transition-colors">
                              {drug.name}
                            </span>
                            {drug.nameAr && drug.nameAr !== drug.name && (
                              <span className="text-slate-400 text-xs font-bold">({drug.nameAr})</span>
                            )}
                            {drug.sourceOrigin === "International / Imported" && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                                🌍 مستورد / FDA
                              </span>
                            )}
                            {drug.sourceOrigin === "Cosmetics & Aesthetics" && (
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-black border border-pink-500/30">
                                💄 تجميل وعناية
                              </span>
                            )}
                            {drug.sourceOrigin === "Vitamins & Supplements" && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                                💊 مكملات وفيتامينات
                              </span>
                            )}
                            {(drug.isCrowdSourced || drug.sourceOrigin === "Doctor Community") && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                                ✨ مساهمة أطباء
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span className="text-emerald-400 font-semibold">{drug.activeIngredient}</span>
                            {drug.dosageForm && <span>• {drug.dosageForm}</span>}
                            {drug.category && <span className="text-slate-500">• {drug.category}</span>}
                            {drug.company && <span>• {drug.company}</span>}
                            {drug.price && drug.price > 0 && (
                              <span className="font-mono font-black text-emerald-400">{drug.price} ج.م</span>
                            )}
                          </div>
                        </div>

                        {/* Quick-Add Button */}
                        <div className="shrink-0">
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 transition-colors shadow-md shadow-emerald-950/40">
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            إضافة
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Footer hint */}
                  <div className="sticky bottom-0 px-4 py-2 bg-slate-950/95 border-t border-slate-800 text-[10px] text-slate-500 font-semibold text-center">
                    سيتم الإضافة بالجرعة المحددة: {doseQuantity} {doseForm} — {frequency}
                  </div>
                </div>
              )}
            </div>

            {/* ── Automatic AI Suggestions & Smart Fallback (No manual button needed) ── */}
            {query.trim().length >= 2 && !selectedDrug && results.length === 0 && !isSearching && (
              <div className="mt-2.5 space-y-2">
                {/* 1. Loading state */}
                {isAiLoading && (
                  <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center gap-3 text-xs">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <div>
                      <span className="font-bold text-purple-200 block">جاري الفحص الذكي في القواعد الدوائية العالمية (FDA / RxNorm / AI)...</span>
                      <span className="text-purple-400/80 text-[11px]">يتم توليد مقترحات ومطابقات دوائية بديلة فوراً</span>
                    </div>
                  </div>
                )}

                {/* 2. Candidate suggestions list */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-1 text-purple-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-purple-400" />
                        <span>ترشيحات الذكاء الاصطناعي والمراجع العالمية لـ &quot;{query}&quot; ({aiSuggestions.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">تُحفظ تلقائياً في بنك الأدوية العام للجميع</span>
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {aiSuggestions.map((sug: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-slate-950/90 border border-purple-500/40 hover:border-purple-400 transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-100">{sug.name}</span>
                              {sug.nameAr && sug.nameAr !== sug.name && (
                                <span className="text-slate-400 text-[11px]">({sug.nameAr})</span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                                ثقة: {sug.confidence || "High"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                              <span className="text-purple-300 font-semibold">{sug.activeIngredient}</span>
                              {sug.dosageForm && <span>• {sug.dosageForm}</span>}
                              {sug.category && <span>• {sug.category}</span>}
                              {sug.recommendedDose && (
                                <span className="text-emerald-400 font-mono">({sug.recommendedDose})</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectAiSuggestion(sug)}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black flex items-center gap-1 text-xs transition-all shadow-md shadow-purple-950/50 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            إضافة وحفظ 🌐
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. If no AI matches found either, 1-click fallback to custom drug addition */}
                {!isAiLoading && aiSuggestions.length === 0 && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-300 font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>لم يُعثر على مطابقة لـ &quot;{query}&quot;</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveToPublicBank}
                      disabled={isSavingCustom}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      {isSavingCustom ? "جاري الحفظ..." : "إضافة للروشتة وحفظ في البنك العام"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Added Drugs List (Directly below search engine in small font with delete capability) */}
            {items && items.length > 0 && (
              <div className="mt-3.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-emerald-400" />
                    <span>الأدوية المدرجة بالروشتة الحالية:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold font-mono">
                      {items.length} صنف
                    </span>
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const isSelectedForEdit = editingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        onClick={() => selectItemForEditing(item)}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl transition-all group text-xs cursor-pointer select-none border ${
                          isSelectedForEdit
                            ? "bg-emerald-950/50 border-emerald-500/80 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/50"
                            : "bg-slate-900 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850"
                        }`}
                        title="اضغط هنا لتحميل جرعات وبيانات هذا الصنف في الحقول بالأسفل لتعديلها ✏️"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-5 h-5 rounded-md font-mono text-[10px] font-black flex items-center justify-center shrink-0 border transition-colors ${
                              isSelectedForEdit
                                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-black text-xs truncate transition-colors ${
                                  isSelectedForEdit ? "text-emerald-300" : "text-slate-100 group-hover:text-emerald-300"
                                }`}
                              >
                                {item.drugName}
                              </span>
                              {item.activeIngredient && (
                                <span className="text-[10px] text-slate-400 truncate">
                                  ({item.activeIngredient})
                                </span>
                              )}
                              {isSelectedForEdit && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold animate-pulse">
                                  محدد بالأسفل للتعديل ✏️
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-emerald-400/90 font-medium truncate mt-0.5">
                              {item.doseQuantity} {item.doseForm} • {item.frequency} • {item.duration}
                              {item.instructions ? ` • ${item.instructions}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {onRemoveItem && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (editingItemId === item.id) {
                                  clearEditingItem();
                                }
                                onRemoveItem(item.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="حذف هذا الدواء من الروشتة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Item Editing Banner */}
        {editingItemId && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg shadow-emerald-950/40 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <div>
                <span className="font-bold text-emerald-300 block">
                  جاري تعديل جرعات:{" "}
                  <span className="font-black text-white text-sm">
                    {items.find((it) => it.id === editingItemId)?.drugName}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">
                  تم سرد الكمية والجرعات بالحقول أدناه؛ أي تعديل تقوم به يتم تحديثه بالروشتة فوراً.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={clearEditingItem}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-rose-500/20"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء التعديل ✕</span>
            </button>
          </div>
        )}

        {/* Selected Drug Badge Indicator */}
        {!isManualMode && selectedDrug && (
          <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="font-black text-emerald-300">{selectedDrug.name}</span>
              <span className="text-slate-400">({selectedDrug.activeIngredient})</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDrug(null)}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold"
            >
              إلغاء التحديد ✕
            </button>
          </div>
        )}

        {/* Prescription Item Controls: Spacious 2-Column Grid (Dose Quantity, Form, Frequency, Duration) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 text-xs">
          {/* Dose Quantity */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
              <Pill className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>الكمية / الجرعة:</span>
            </label>
            <input
              type="text"
              value={doseQuantity}
              onChange={(e) => {
                setDoseQuantity(e.target.value);
                updateActiveItemField("doseQuantity", e.target.value);
              }}
              placeholder="مثال: 1 ، 2 ، 5 مل ، ملعقة..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Dose Form */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pb-0.5">
              <label className="font-bold text-slate-200 text-xs">الشكل الدوائي:</label>
              <button
                type="button"
                onClick={() => setIsCustomDoseForm(!isCustomDoseForm)}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/25 px-2.5 py-0.5 rounded-lg border border-amber-500/30 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                title="التبديل بين القائمة الجاهزة والكتابة اليدوية"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span>{isCustomDoseForm ? "قائمة 📋" : "يدوي ✍️"}</span>
              </button>
            </div>
            {isCustomDoseForm ? (
              <input
                type="text"
                value={doseForm}
                onChange={(e) => {
                  setDoseForm(e.target.value);
                  updateActiveItemField("doseForm", e.target.value);
                }}
                placeholder="اكتب الشكل مانيول (مثال: سبراي، لوشن...)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            ) : (
              <select
                value={doseForm}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM_MANUAL") {
                    setIsCustomDoseForm(true);
                  } else {
                    setDoseForm(e.target.value);
                    updateActiveItemField("doseForm", e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {COMMON_DOSE_FORMS.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
                <option value="CUSTOM_MANUAL" className="text-amber-400 font-bold">
                  ✍️ + كتابة مانيول...
                </option>
              </select>
            )}
          </div>

          {/* Frequency & Timing Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pb-0.5">
              <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs truncate">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">التكرار والمواعيد:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomFrequency(!isCustomFrequency)}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/25 px-2.5 py-0.5 rounded-lg border border-amber-500/30 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                title="التبديل بين القوائم الجاهزة والكتابة اليدوية"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span>{isCustomFrequency ? "قائمة جاهزة 📋" : "يدوي ✍️"}</span>
              </button>
            </div>

            {isCustomFrequency ? (
              <input
                type="text"
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value);
                  updateActiveItemField("frequency", e.target.value);
                }}
                placeholder="اكتب المواعيد مانيول (مثال: قرص بعد الإفطار والعشاء)..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
              />
            ) : (
              <select
                value={frequency}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM_MANUAL") {
                    setIsCustomFrequency(true);
                  } else {
                    setFrequency(e.target.value);
                    updateActiveItemField("frequency", e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {FREQUENCY_PRESETS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
                <option value="CUSTOM_MANUAL" className="text-amber-400 font-bold">
                  ✍️ + كتابة مانيول (إدخال حر)...
                </option>
              </select>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pb-0.5">
              <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs truncate">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">المدة الزمنية:</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomDuration(!isCustomDuration)}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/25 px-2.5 py-0.5 rounded-lg border border-amber-500/30 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                title="التبديل بين المدد الجاهزة والكتابة اليدوية"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span>{isCustomDuration ? "مدد جاهزة 📋" : "يدوي ✍️"}</span>
              </button>
            </div>

            {isCustomDuration ? (
              <input
                type="text"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  updateActiveItemField("duration", e.target.value);
                }}
                placeholder="اكتب المدة مانيول (مثال: لمدة أسبوعين ونصف)..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
              />
            ) : (
              <select
                value={duration}
                onChange={(e) => {
                  if (e.target.value === "CUSTOM_MANUAL") {
                    setIsCustomDuration(true);
                  } else {
                    setDuration(e.target.value);
                    updateActiveItemField("duration", e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {DURATION_PRESETS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="CUSTOM_MANUAL" className="text-amber-400 font-bold">
                  ✍️ + كتابة مانيول...
                </option>
              </select>
            )}
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-1.5 text-xs pt-1">
          <label className="font-bold text-slate-200">تعليمات خاصة للمريض أو الصيدلي (اختياري):</label>
          <input
            type="text"
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              updateActiveItemField("instructions", e.target.value);
            }}
            placeholder="مثال: يرجى شرب كمية وفيرة من الماء، أو تجنب منتجات الألبان معه..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-medium text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={editingItemId ? false : isManualMode ? !manualDrugName.trim() : !query.trim()}
            className={`flex-1 py-3.5 rounded-2xl font-black text-sm shadow-xl hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
              editingItemId
                ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-emerald-950/50"
                : isManualMode
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 shadow-amber-950/50"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 shadow-emerald-950/50"
            }`}
          >
            {editingItemId ? (
              <>
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>حفظ وتأكيد تعديل الدواء بالروشتة ✓</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>
                  {isManualMode
                    ? "إضافة هذا الدواء (يدوي مانيول) إلى الروشتة ✍️"
                    : "إضافة هذا الدواء إلى الروشتة ✍️"}
                </span>
              </>
            )}
          </button>

          {editingItemId && (
            <button
              type="button"
              onClick={clearEditingItem}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border border-slate-700"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
