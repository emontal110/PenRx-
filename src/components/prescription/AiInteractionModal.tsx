"use client";

import React from "react";
import {
  AlertTriangle,
  X,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  BrainCircuit,
  Info,
  Pill,
} from "lucide-react";

export interface InteractionAlert {
  id: string;
  ruleId?: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  titleEn?: string;
  mechanismAr: string;
  recommendationAr: string;
  involvedDrugs: string[];
}

interface AiInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: InteractionAlert | null;
  onRemoveDrug?: (drugName: string) => void;
}

export function AiInteractionModal({
  isOpen,
  onClose,
  alert,
  onRemoveDrug,
}: AiInteractionModalProps) {
  if (!isOpen || !alert) return null;

  const isCritical = alert.severity === "CRITICAL" || alert.severity === "HIGH";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative overflow-hidden"
        dir="rtl"
      >
        {/* Glow Header Stripe */}
        <div
          className={`absolute top-0 right-0 left-0 h-1.5 ${
            isCritical
              ? "bg-gradient-to-r from-rose-500 via-red-500 to-rose-600"
              : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"
          }`}
        />

        {/* Header Icon, Title & Severity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                isCritical
                  ? "bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-rose-950/50"
                  : "bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-amber-950/50"
              }`}
            >
              <BrainCircuit className="w-6 h-6 stroke-[2.2] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-100">
                  تنبيه تعارض دوائي ذكي
                </h3>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    isCritical
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {isCritical ? "خطر مرتفع ⚠️" : "تنبيه متوسط ⚡"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                مساعد الذكاء الاصطناعي لفحص وتنبيه تداخل الأدوية
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

        {/* Conflicting Drugs Badge Strip */}
        {alert.involvedDrugs && alert.involvedDrugs.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 block">
              الأدوية المتداخلة في هذا التنبيه:
            </span>
            <div className="flex flex-wrap gap-2">
              {alert.involvedDrugs.map((drug, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-black text-rose-300"
                >
                  <Pill className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{drug}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Issue Title & Clinical Mechanism */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-black text-slate-100">{alert.titleAr}</span>
          </div>
          <p className="text-slate-300 leading-relaxed pr-5 text-[11.5px]">
            {alert.mechanismAr}
          </p>
        </div>

        {/* Actionable Medical Recommendation */}
        {alert.recommendationAr && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>التوصية والبديل السريري الآمن:</span>
            </div>
            <p className="text-emerald-200/90 leading-relaxed pr-5 text-[11.5px] font-medium">
              {alert.recommendationAr}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 justify-end">
          {onRemoveDrug && alert.involvedDrugs && alert.involvedDrugs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Remove the first involved drug (or user choice)
                onRemoveDrug(alert.involvedDrugs[0]);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف ({alert.involvedDrugs[0]}) من الروشتة</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center cursor-pointer"
          >
            إغلاق والاحتفاظ بالدواء
          </button>
        </div>
      </div>
    </div>
  );
}
