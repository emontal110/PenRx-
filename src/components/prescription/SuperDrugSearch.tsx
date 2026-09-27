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
} from "lucide-react";
import { DrugRecord } from "@/lib/drugSearchEngine";
import { PrescriptionItem } from "@/store/usePrescriptionStore";

interface SuperDrugSearchProps {
  onAddItem: (item: Omit<PrescriptionItem, "id">) => void;
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

export function SuperDrugSearch({ onAddItem }: SuperDrugSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugRecord | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Form inputs
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseForm, setDoseForm] = useState("Tablet (قرص)");
  const [frequency, setFrequency] = useState("كل 8 ساعات بعد الأكل (3 مرات يومياً)");
  const [duration, setDuration] = useState("لمدة 5 أيام");
  const [instructions, setInstructions] = useState("");

  // AI & Custom Drug States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [customSavedToast, setCustomSavedToast] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Real-time debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.results || []);
        setExecutionTime(data.executionTimeMs ?? 0);
        setIsDropdownOpen(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 40); // 40ms debounce for lightning feel

    return () => clearTimeout(timer);
  }, [query]);

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

  const handleSelectDrug = (drug: DrugRecord) => {
    setSelectedDrug(drug);
    setQuery(drug.name);
    setDoseForm(drug.dosageForm || "Tablet (قرص)");
    setIsDropdownOpen(false);
  };

  // AI drug inference trigger
  const handleAiInfer = async () => {
    if (!query.trim()) return;
    setIsAiLoading(true);
    setAiSuggestion(null);

    try {
      const res = await fetch("/api/drugs/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugName: query.trim() }),
      });
      const data = await res.json();
      setAiSuggestion(data);

      if (data.recommendedDose) {
        setFrequency(data.recommendedDose);
      }
      if (data.suggestedForms && data.suggestedForms.length > 0) {
        setDoseForm(data.suggestedForms[0]);
      }
    } catch (err) {
      console.error("AI suggest error:", err);
    } finally {
      setIsAiLoading(false);
    }
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
          activeIngredient: aiSuggestion?.activeIngredient || "تركيبة خاصة / Custom Formula",
          dosageForm: doseForm,
          category: aiSuggestion?.category || "عام",
          doctorContributor: "طبيب ممارس",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomSavedToast("✅ تم حفظ الدواء بنجاح في بنك الأدوية العام وسيظهر لجميع الأطباء فوراً!");
        setSelectedDrug(data.drug);
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
    const finalDrugName = selectedDrug ? selectedDrug.name : query.trim();
    if (!finalDrugName) return;

    onAddItem({
      drugId: selectedDrug?.id,
      drugName: finalDrugName,
      activeIngredient: selectedDrug?.activeIngredient || aiSuggestion?.activeIngredient,
      doseQuantity,
      doseForm,
      frequency,
      duration,
      instructions: instructions.trim() || undefined,
      isCustom: !selectedDrug,
    });

    // Reset fields for next drug
    setQuery("");
    setSelectedDrug(null);
    setAiSuggestion(null);
    setInstructions("");
    inputRef.current?.focus();
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <span>محرك البحث الدوائي الفوري</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                0.2ms SuperEngine
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              ابحث بالاسم التجاري أو المادة الفعالة (عربي / إنجليزي) عبر 43,000+ دواء
            </p>
          </div>
        </div>

        {executionTime !== null && query && (
          <span className="text-[11px] font-mono text-emerald-400 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            ⚡ استجابة: {executionTime}ms
          </span>
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        {/* Drug Input Combobox */}
        <div className="relative">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedDrug(null);
                setAiSuggestion(null);
              }}
              onFocus={() => {
                if (results.length > 0) setIsDropdownOpen(true);
              }}
              placeholder="اكتب اسم الدواء أو المادة الفعالة (مثال: Panadol, Augmentin, أوميبرازول...)"
              className="w-full pr-12 pl-12 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-sm font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
            />
            {isSearching && (
              <div className="absolute left-4 top-3.5">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && results.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 top-full mt-2 w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-800/60"
            >
              {results.map((drug) => (
                <button
                  key={drug.id}
                  type="button"
                  onClick={() => handleSelectDrug(drug)}
                  className="w-full text-right p-3.5 hover:bg-slate-900 transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-100 text-sm">{drug.name}</span>
                      {drug.nameAr && drug.nameAr !== drug.name && (
                        <span className="text-slate-400 font-bold">({drug.nameAr})</span>
                      )}
                      {drug.isCrowdSourced && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">
                          ✨ مساهمة طبيب
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-400 text-xs font-semibold">
                      المادة الفعالة: {drug.activeIngredient}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {drug.dosageForm && <span>الشكل: {drug.dosageForm}</span>}
                      {drug.company && <span>الشركة: {drug.company}</span>}
                    </div>
                  </div>

                  {drug.price && drug.price > 0 && (
                    <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                      {drug.price} ج.م
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Fallback & AI synthesis pill when drug not found or custom */}
          {query.trim().length >= 3 && !selectedDrug && results.length === 0 && !isSearching && (
            <div className="mt-2.5 p-3 rounded-2xl bg-slate-950 border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Bot className="w-4 h-4 text-purple-400" />
                <span>دواء غير مسجل في البنك الافتراضي ({query})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAiInfer}
                  disabled={isAiLoading}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAiLoading ? "جاري التحليل..." : "تحليل بالذكاء الاصطناعي 🧠"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToPublicBank}
                  disabled={isSavingCustom}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSavingCustom ? "جاري الحفظ..." : "حفظ في البنك العام للجميع 🌐"}</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Suggestion Card preview */}
          {aiSuggestion && (
            <div className="mt-2 p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-xs space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-black text-purple-300 flex items-center gap-1.5">
                  <Bot className="w-4 h-4" />
                  <span>اقتراح وتحليل الذكاء الاصطناعي لـ: {aiSuggestion.suggestedName}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold">
                  ثقة: {aiSuggestion.confidence}
                </span>
              </div>
              <p className="text-slate-200">
                المادة الفعالة المقترحة: <strong className="text-purple-300">{aiSuggestion.activeIngredient}</strong> ({aiSuggestion.activeIngredientAr})
              </p>
              <p className="text-slate-300">
                التصنيف الدوائي: <strong className="text-slate-100">{aiSuggestion.category}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Selected Drug Badge Indicator */}
        {selectedDrug && (
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

        {/* Prescription Item Controls: Dose Quantity, Form, Frequency, Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Dose Quantity */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-emerald-400" />
              <span>الكمية / الجرعة:</span>
            </label>
            <input
              type="text"
              value={doseQuantity}
              onChange={(e) => setDoseQuantity(e.target.value)}
              placeholder="مثال: 1, 2, ملعقة..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Dose Form */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300">الشكل الدوائي:</label>
            <select
              value={doseForm}
              onChange={(e) => setDoseForm(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {COMMON_DOSE_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>التكرار والمواعيد:</span>
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 truncate"
            >
              {FREQUENCY_PRESETS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>المدة الزمنية:</span>
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {DURATION_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="space-y-1 text-xs">
          <label className="font-bold text-slate-300">تعليمات خاصة للمريض أو الصيدلي (اختياري):</label>
          <input
            type="text"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="مثال: يرجى شرب كمية وفيرة من الماء، أو تجنب منتجات الألبان معه..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-medium text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!query.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة هذا الدواء إلى الروشتة ✍️</span>
          </button>
        </div>
      </form>
    </div>
  );
}
