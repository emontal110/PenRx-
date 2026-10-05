"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  BrainCircuit,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Zap,
  FlaskConical,
  Lightbulb,
  X,
} from "lucide-react";
import { PrescriptionItem, PatientInfo } from "@/store/usePrescriptionStore";

interface AiAdvisorProps {
  items: PrescriptionItem[];
  patient: PatientInfo;
  onAlertsChange?: (count: number) => void;
}

interface InteractionAlert {
  id: string;
  ruleId?: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  titleEn?: string;
  mechanismAr: string;
  recommendationAr: string;
  involvedDrugs: string[];
}

export function AiPrescriptionInteractionAdvisor({ items, patient, onAlertsChange }: AiAdvisorProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [alerts, setAlerts] = useState<InteractionAlert[]>([]);
  const [lastScannedCount, setLastScannedCount] = useState<number>(0);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (items.length === 0) {
      setAlerts([]);
      setLastScannedCount(0);
      return;
    }

    setIsScanning(true);
    try {
      const res = await fetch("/api/ai/analyze-prescription", {
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
          })),
          patientAllergies: patient.allergyNotes || "",
          patientHistory: patient.medicalHistory || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        const newAlerts: InteractionAlert[] = data.interactions || [];
        setAlerts(newAlerts);
        setLastScannedCount(items.length);
        onAlertsChange?.(newAlerts.length);
      }
    } catch (err) {
      console.error("AI Prescription check error:", err);
    } finally {
      setIsScanning(false);
    }
  }, [items, patient.allergyNotes, patient.medicalHistory]);

  // Debounced auto-scan on item or patient allergy change
  useEffect(() => {
    const timer = setTimeout(() => {
      runAnalysis();
    }, 400);
    return () => clearTimeout(timer);
  }, [runAnalysis]);

  const hasCritical = alerts.some((a) => a.severity === "CRITICAL" || a.severity === "HIGH");
  const hasAlerts = alerts.length > 0;

  // ── Status config ────────────────────────────────────────────────────────
  const statusConfig = hasAlerts
    ? hasCritical
      ? {
          border: "border-rose-500/60",
          bg: "bg-rose-950/25",
          headerBg: "bg-rose-950/40",
          iconBg: "bg-rose-500/15 text-rose-400 border-rose-500/40",
          badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          pulse: true,
          label: "تعارض حرج مكتشف",
          labelColor: "text-rose-300",
        }
      : {
          border: "border-amber-500/50",
          bg: "bg-amber-950/20",
          headerBg: "bg-amber-950/30",
          iconBg: "bg-amber-500/15 text-amber-400 border-amber-500/40",
          badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          pulse: false,
          label: "تداخل متوسط",
          labelColor: "text-amber-300",
        }
    : items.length >= 2
    ? {
        border: "border-emerald-500/30",
        bg: "bg-emerald-950/15",
        headerBg: "bg-emerald-950/20",
        iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        pulse: false,
        label: "آمن دوائياً",
        labelColor: "text-emerald-300",
      }
    : {
        border: "border-slate-800",
        bg: "bg-slate-900/80",
        headerBg: "bg-slate-900/60",
        iconBg: "bg-slate-800 text-slate-400 border-slate-700",
        badgeBg: "bg-slate-800 text-slate-400 border-slate-700",
        pulse: false,
        label: "في انتظار البيانات",
        labelColor: "text-slate-400",
      };

  return (
    <div className={`rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden ${statusConfig.border} ${statusConfig.bg}`}>

      {/* ── Top accent line ───────────────────────────────────────────── */}
      {hasAlerts && (
        <div
          className={`h-1 ${hasCritical ? "bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 animate-pulse" : "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500"}`}
        />
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${statusConfig.headerBg} border-b border-slate-800/60`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl border transition-all shrink-0 ${statusConfig.iconBg} ${statusConfig.pulse ? "animate-pulse" : ""}`}>
            <BrainCircuit className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-100">
                مساعد الذكاء الاصطناعي — فحص تعارض ادويه
              </h3>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Google Gemini 3.8 Flash</span>
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Dynamic status badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${statusConfig.badgeBg}`}>
                {hasAlerts ? (
                  <><AlertTriangle className="w-3 h-3" /> {alerts.length} {alerts.length === 1 ? "تعارض" : "تعارضات"}</>
                ) : items.length >= 2 ? (
                  <><ShieldCheck className="w-3 h-3" /> آمن دوائياً ✅</>
                ) : (
                  <><Info className="w-3 h-3" /> أضف دواءين أو أكثر</>
                )}
              </span>

              {/* Scanned count */}
              {lastScannedCount > 0 && (
                <span className="text-[10px] text-slate-500 font-semibold">
                  فُحص {lastScannedCount} {lastScannedCount === 1 ? "دواء" : "أدوية"}
                </span>
              )}

              {/* Scanning indicator */}
              {isScanning && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold animate-pulse">
                  <Zap className="w-3 h-3" />
                  جاري الفحص...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={isScanning || items.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            title="إعادة فحص التداخلات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">{isScanning ? "جاري الفحص..." : "فحص الآن"}</span>
          </button>

          {hasAlerts && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-all cursor-pointer"
              title={isCollapsed ? "عرض التفاصيل" : "طي التفاصيل"}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-3">

          {/* State 1: Waiting for drugs */}
          {items.length < 2 && !hasAlerts && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-slate-300">كيف يعمل مساعد الذكاء الاصطناعي؟</p>
                <p className="leading-relaxed">
                  أضف <strong className="text-slate-200">دواءين أو أكثر</strong> إلى الروشتة، وسيقوم النظام تلقائياً بمطابقة المواد الفعالة وإشعارك فوراً بأي تعارض أو تداخل دوائي خطير. الفحص يشمل:
                </p>
                <ul className="space-y-0.5 mt-1 pr-2">
                  <li>• تعارض المواد الفعالة بين الأدوية</li>
                  <li>• الجرعات المضاعفة والازدواجية العلاجية</li>
                  <li>• التعارض مع حساسية المريض المسجلة</li>
                </ul>
              </div>
            </div>
          )}

          {/* State 2: Safe */}
          {items.length >= 2 && !hasAlerts && !isScanning && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/25 text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-black text-sm text-emerald-200">الروشتة آمنة دوائياً ✅</p>
                <p className="text-xs text-emerald-400/90 leading-relaxed">
                  لا توجد تعارضات أو تفاعلات دوائية خطيرة مسجلة بين{" "}
                  <strong className="text-emerald-200">{items.length} أدوية</strong>{" "}
                  الموصوفة. تم التحقق من سلامة الجرعات وعدم وجود ازدواجية علاجية.
                </p>
              </div>
            </div>
          )}

          {/* State 3: Alerts detected */}
          {hasAlerts && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-black text-slate-200 mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>تنبيهات السلامة الدوائية ({alerts.length}):</span>
              </div>

              {alerts.map((alert) => {
                const isCrit = alert.severity === "CRITICAL" || alert.severity === "HIGH";
                const isExpanded = expandedAlertId === alert.id;

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border overflow-hidden transition-all shadow-md ${
                      isCrit
                        ? "bg-rose-950/35 border-rose-500/50"
                        : "bg-amber-950/25 border-amber-500/40"
                    }`}
                  >
                    {/* Alert Header – always visible */}
                    <button
                      type="button"
                      className="w-full text-right px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                            isCrit ? "bg-rose-500 text-white" : "bg-amber-500 text-slate-950"
                          }`}
                        >
                          {isCrit ? "🚨 حرج" : "⚠️ متوسط"}
                        </span>
                        <span className={`font-black text-sm ${isCrit ? "text-rose-100" : "text-amber-100"}`}>
                          {alert.titleAr}
                        </span>
                        {/* Drug tags */}
                        {alert.involvedDrugs?.map((d, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-lg bg-slate-950/60 border border-slate-700 text-[10px] font-bold text-slate-300 shrink-0">
                            {d}
                          </span>
                        ))}
                      </div>
                      <span className="shrink-0 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2.5 text-xs border-t border-slate-800/50 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Mechanism */}
                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                          <span className="text-[11px] font-black text-slate-300 flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
                            الآلية الطبية لتأثير التداخل:
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed">{alert.mechanismAr}</p>
                        </div>

                        {/* Recommendation */}
                        <div className={`p-3 rounded-xl border space-y-1 ${isCrit ? "bg-rose-950/40 border-rose-500/25" : "bg-emerald-950/40 border-emerald-500/25"}`}>
                          <span className={`text-[11px] font-black flex items-center gap-1.5 ${isCrit ? "text-rose-300" : "text-emerald-300"}`}>
                            <Lightbulb className="w-3.5 h-3.5" />
                            التوجيه الطبي المقترح للطبيب:
                          </span>
                          <p className={`text-xs leading-relaxed font-semibold ${isCrit ? "text-rose-200" : "text-emerald-200"}`}>
                            {alert.recommendationAr}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
