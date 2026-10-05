"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  FileText,
  Save,
  Trash2,
  X,
  ArrowRight,
  RotateCcw,
  Sparkles,
  User,
  Pill,
} from "lucide-react";

interface NewPrescriptionPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  itemsCount: number;
  diagnosis?: string;
  onSaveAndContinue: () => void;
  onConfirmDiscard: () => void;
}

export function NewPrescriptionPromptModal({
  isOpen,
  onClose,
  patientName,
  itemsCount,
  diagnosis,
  onSaveAndContinue,
  onConfirmDiscard,
}: NewPrescriptionPromptModalProps) {
  // Step 1: Prompt whether to save or continue
  // Step 2: Critical warning that current prescription will be permanently deleted
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  const handleProceedToStep2 = () => {
    setStep(2);
  };

  const handleConfirmDiscard = () => {
    onConfirmDiscard();
    handleClose();
  };

  const handleSaveAndContinue = () => {
    onSaveAndContinue();
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative overflow-hidden transition-all"
        dir="rtl"
      >
        {/* Step 1: Open prescription exists, ask Save & Continue vs Continue anyway */}
        {step === 1 && (
          <>
            {/* Top Amber Accent Glow */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 animate-pulse" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/40">
                  <FileText className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                    <span>يوجد روشتة مفتوحة حالياً!</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      بيانات نشطة
                    </span>
                  </h3>
                  <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                    الروشتة الحالية تحتوي على بيانات تم إدخالها ولم يتم تفريغها بعد
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Open Prescription Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
              <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>ملخص محتوى الروشتة المفتوحة:</span>
                <span className="text-emerald-400 font-mono">PenRX+ Auto-Protect</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-400 block text-[10px]">المريض:</span>
                    <span className="font-black text-slate-200 truncate">
                      {patientName && patientName.trim() ? patientName : "اسم المريض غير مسجل"}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <Pill className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">الأدوية المضافة:</span>
                    <span className="font-black text-cyan-300 font-mono">
                      {itemsCount > 0 ? `${itemsCount} أصناف دوائية` : "لا يوجد أدوية"}
                    </span>
                  </div>
                </div>
              </div>

              {diagnosis && (
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px]">
                  <span className="text-slate-400 font-bold">التشخيص: </span>
                  <span className="text-slate-200">{diagnosis}</span>
                </div>
              )}
            </div>

            {/* The Question */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold leading-relaxed">
              💡 هل ترغب في الحفظ في سجل العيادة أولاً والاستمرار، أم المتابعة وتفريغ الروشتة على أية حال؟
            </div>

            {/* Action Buttons for Step 1 */}
            <div className="space-y-2 pt-1">
              {/* Option A: Save and Clear */}
              <button
                type="button"
                onClick={handleSaveAndContinue}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>الحفظ والاستمرار 💾</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Option B: Continue anyway (triggers Step 2 confirmation) */}
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-rose-950/40 hover:border-rose-500/40 hover:text-rose-300 text-slate-300 border border-slate-700 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>المتابعة على أية حال ⚠️</span>
                </button>

                {/* Option C: Cancel and keep working */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء ✕
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Critical Deletion Warning */}
        {step === 2 && (
          <>
            {/* Top Red Alert Glow */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 animate-pulse" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/40 animate-pulse">
                  <Trash2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-rose-200">
                    تحذير: سيتم حذف الروشتة الحالية نهائياً! ⚠️
                  </h3>
                  <p className="text-xs text-rose-300/80 font-medium mt-0.5">
                    تأكيد تفريغ الروشتة ومسح كافة البيانات
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Warning Details Box */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-2.5 text-xs text-rose-200">
              <p className="font-black text-sm text-rose-300">
                أنت على وشك تفريغ الروشتة دون حفظها:
              </p>
              <ul className="space-y-1.5 text-xs leading-relaxed pr-2 list-disc list-inside">
                <li>
                  سيتم مسح بيانات المريض:{" "}
                  <strong className="text-white">
                    {patientName && patientName.trim() ? patientName : "غير مسجل"}
                  </strong>
                </li>
                <li>
                  سيتم حذف{" "}
                  <strong className="text-white">
                    {itemsCount} أصناف دوائية
                  </strong>{" "}
                  المدرجة بالروشتة الحالية نهائياً.
                </li>
                <li className="text-rose-400 font-bold">
                  لن تتمكن من استرجاع هذه البيانات بعد التفريغ ما لم تكن محفوظة مسبقاً.
                </li>
              </ul>
            </div>

            {/* Final Confirmation Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {/* Confirm Discard Button */}
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:brightness-110 active:scale-[0.99] text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، تأكيد الحذف وتفريغ الروشتة 🗑️</span>
              </button>

              {/* Back to Step 1 or Cancel */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>تراجع</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
