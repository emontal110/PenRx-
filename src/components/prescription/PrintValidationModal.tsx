"use client";

import React from "react";
import { AlertCircle, FileX2, Plus, X, ArrowLeft, CheckCircle2 } from "lucide-react";

interface PrintValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasPatientName: boolean;
  hasItems: boolean;
  onFocusPatientName?: () => void;
}

export function PrintValidationModal({
  isOpen,
  onClose,
  hasPatientName,
  hasItems,
  onFocusPatientName,
}: PrintValidationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative overflow-hidden"
        dir="rtl"
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        {/* Header Icon & Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/40">
              <FileX2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-100">
                تنبيه: لا يمكن الطباعة بدون بيانات! ⚠️
              </h3>
              <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                ورقة الروشتة الحالية فارغة أو غير مكتملة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Elements Checklist */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5 text-xs">
          <p className="font-bold text-slate-300">بيانات مطلوبة لإصدار الروشتة الطبية:</p>

          <div className="space-y-2">
            <div
              className={`p-2.5 rounded-xl flex items-center justify-between border ${
                hasPatientName
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300 font-bold"
                  : "bg-rose-950/20 border-rose-500/40 text-rose-300 font-black"
              }`}
            >
              <span>{hasPatientName ? "✅ تم إدخال اسم المريض" : "❌ اسم المريض مفقود (يرجى كتابة الاسم)"}</span>
              {!hasPatientName && <span className="text-[10px] underline">مطلوب</span>}
            </div>

            <div
              className={`p-2.5 rounded-xl flex items-center justify-between border ${
                hasItems
                  ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300 font-bold"
                  : "bg-rose-950/20 border-rose-500/40 text-rose-300 font-black"
              }`}
            >
              <span>{hasItems ? "✅ تم إضافة أدوية للروشتة" : "❌ لم يتم إضافة أي دواء حتى الآن"}</span>
              {!hasItems && <span className="text-[10px] underline">مطلوب دواء واحد على الأقل</span>}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            💡 للحفاظ على الدقة الطبية، يشترط النظام وجود اسم المريض ودواء واحد على الأقل قبل فتح نافذة الطباعة الرسمية.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (!hasPatientName && onFocusPatientName) {
                onFocusPatientName();
              }
            }}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>استكمال البيانات أولاً ✍️</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
