"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Users,
  Clock,
  Crown,
  Plus,
  Search,
  Building2,
  Printer,
  MessageCircle,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Activity,
  HeartPulse,
  Pill,
  Calendar,
  RotateCcw,
  Filter,
  AlertTriangle,
  CreditCard,
  BarChart3,
  User,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { usePrescriptionStore, SavedPrescription } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { NewRxGuard } from "@/components/prescription/NewRxGuard";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { WhatsAppShareModal } from "@/components/prescription/WhatsAppShareModal";

export default function DashboardPage() {
  const { savedPrescriptions, savedPatients } = usePrescriptionStore();
  const { clinic, branches, activeBranchId } = useClinicStore();
  const { subscriptions, machineId } = useSubscriptionStore();
  const [mounted, setMounted] = useState(false);
  const [rxToShareWhatsApp, setRxToShareWhatsApp] = useState<SavedPrescription | null>(null);

  // Date filter state & refs for opening picker anywhere
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const isTrialAccount = Boolean(
    subDetails.record?.isTrial === true ||
    subDetails.record?.planId === "trial" ||
    subDetails.record?.planName?.includes("تجريب")
  );
  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  // Quick preset handlers
  const handlePresetSelect = (preset: "all" | "today" | "week" | "month") => {
    setActivePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "week") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  // Filtered prescriptions based on From and To dates
  const filteredPrescriptions = useMemo(() => {
    return savedPrescriptions.filter((rx) => {
      if (!rx.createdAt) return true;
      const rxDate = new Date(rx.createdAt);

      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        if (rxDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59.999");
        if (rxDate > end) return false;
      }
      return true;
    });
  }, [savedPrescriptions, startDate, endDate]);

  // Unique patient count in filtered range
  const filteredPatientCount = useMemo(() => {
    if (!startDate && !endDate) {
      return savedPatients.length;
    }
    const patientKeys = new Set(
      filteredPrescriptions.map((rx) => (rx.patient.phone || rx.patient.name).trim())
    );
    return patientKeys.size;
  }, [filteredPrescriptions, savedPatients, startDate, endDate]);

  // Current month stats for card pills
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const thisMonthPrescriptionsCount = savedPrescriptions.filter(
    (rx) => rx.createdAt && rx.createdAt.startsWith(thisMonthStr)
  ).length;

  const thisMonthPatientsCount = new Set(
    savedPrescriptions
      .filter((rx) => rx.createdAt && rx.createdAt.startsWith(thisMonthStr))
      .map((rx) => (rx.patient.phone || rx.patient.name).trim())
  ).size;

  // Most prescribed drug in filtered range
  const mostPrescribedInfo = useMemo(() => {
    const drugCountMap: Record<string, number> = {};
    filteredPrescriptions.forEach((rx) => {
      rx.items.forEach((item) => {
        const name = item.drugName.trim();
        if (name) {
          drugCountMap[name] = (drugCountMap[name] || 0) + 1;
        }
      });
    });

    let topDrugName = "";
    let maxCount = 0;
    Object.entries(drugCountMap).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topDrugName = name;
      }
    });

    return { topDrugName, maxCount };
  }, [filteredPrescriptions]);

  // 1. Weekly Prescription Velocity (Last 7 Days activity)
  const weeklyActivity = useMemo(() => {
    const days: { dateStr: string; dayName: string; count: number; isToday: boolean }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString("ar-EG", { weekday: "short" });
      const isToday = i === 0;

      const count = savedPrescriptions.filter((rx) => {
        if (!rx.createdAt) return false;
        return rx.createdAt.startsWith(dateStr);
      }).length;

      days.push({ dateStr, dayName, count, isToday });
    }

    const maxDayCount = Math.max(...days.map((d) => d.count), 1);
    const totalWeeklyCount = days.reduce((acc, d) => acc + d.count, 0);
    const peakDay = days.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), days[0]);
    const dailyAverage = (totalWeeklyCount / 7).toFixed(1);

    return { days, maxDayCount, totalWeeklyCount, peakDay, dailyAverage };
  }, [savedPrescriptions]);

  // 2. Top Prescribed Drugs Distribution (Top 4 Medications with percentage spectrum)
  const topMedicationsList = useMemo(() => {
    const drugMap: Record<string, { count: number; doseForm: string }> = {};
    filteredPrescriptions.forEach((rx) => {
      rx.items.forEach((item) => {
        const name = item.drugName?.trim();
        if (name) {
          if (!drugMap[name]) {
            drugMap[name] = { count: 0, doseForm: item.doseForm || "صنف" };
          }
          drugMap[name].count += 1;
        }
      });
    });

    const sorted = Object.entries(drugMap)
      .map(([drugName, data]) => ({ drugName, count: data.count, doseForm: data.doseForm }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const totalCount = sorted.reduce((acc, curr) => acc + curr.count, 0) || 1;

    return sorted.map((drug) => ({
      ...drug,
      percentage: Math.round((drug.count / totalCount) * 100),
    }));
  }, [filteredPrescriptions]);

  // 3. Clinical Efficiency Stats
  const clinicEfficiency = useMemo(() => {
    const totalRxs = filteredPrescriptions.length;
    if (totalRxs === 0) return { avgDrugsPerRx: "0.0", totalDrugsCount: 0, returningPatientsRate: "0%" };
    const totalDrugsCount = filteredPrescriptions.reduce((acc, rx) => acc + rx.items.length, 0);
    const avgDrugsPerRx = (totalDrugsCount / totalRxs).toFixed(1);

    const patientRxCount: Record<string, number> = {};
    filteredPrescriptions.forEach((rx) => {
      const key = (rx.patient.phone || rx.patient.name).trim();
      patientRxCount[key] = (patientRxCount[key] || 0) + 1;
    });
    const returningCount = Object.values(patientRxCount).filter((c) => c > 1).length;
    const totalUnique = Object.keys(patientRxCount).length || 1;
    const returningPatientsRate = Math.round((returningCount / totalUnique) * 100) + "%";

    return { avgDrugsPerRx, totalDrugsCount, returningPatientsRate };
  }, [filteredPrescriptions]);

  const displayPrescriptions = filteredPrescriptions.slice(0, 6);

  const handleShareWhatsApp = (rx: SavedPrescription) => {
    setRxToShareWhatsApp(rx);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-4">
      {/* Expiry Warning Banner (<= 7 days) */}
      {mounted && subDetails.isActive && subDetails.daysRemaining <= 7 && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300 ${
            subDetails.daysRemaining <= 3
              ? "bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border-rose-500/60 shadow-rose-950/40 ring-1 ring-rose-500/30"
              : "bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border-amber-500/60 shadow-amber-950/40 ring-1 ring-amber-500/30"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl border shrink-0 ${
                subDetails.daysRemaining <= 3
                  ? "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`text-sm sm:text-base font-black ${
                    subDetails.daysRemaining <= 3 ? "text-rose-100" : "text-amber-100"
                  }`}
                >
                  {subDetails.daysRemaining <= 3
                    ? `تنبيه عاجل: متبقي ${subDetails.daysRemaining} ${
                        subDetails.daysRemaining === 1 ? "يوم واحد فقط" : "أيام فقط"
                      } على انتهاء الاشتراك!`
                    : `تنبيه: متبقي ${subDetails.daysRemaining} أيام على انتهاء اشتراكك في PenRX+`}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                    subDetails.daysRemaining <= 3
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-ping"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {subDetails.daysRemaining <= 3 ? "تحذير انتهاء" : "تجديد مبكر"}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  subDetails.daysRemaining <= 3 ? "text-rose-300/90" : "text-amber-300/90"
                }`}
              >
                {subDetails.daysRemaining <= 3
                  ? "يرجى تجديد الاشتراك فوراً لضمان استمرار عمل منظومة الروشتات وبنك الأدوية دون توقف."
                  : "نوصي بتجديد الاشتراك الآن للحفاظ على استمرارية ترخيص العيادة والمزامنة السحابية."}
              </p>
            </div>
          </div>

          <Link
            href="/subscriptions"
            className={`px-5 py-3 rounded-2xl font-black text-xs shadow-xl transition-all flex items-center gap-2.5 cursor-pointer shrink-0 active:scale-95 hover:brightness-110 group ${
              subDetails.daysRemaining <= 3
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-amber-950/40"
            }`}
          >
            <CreditCard className="w-4 h-4 stroke-[2.2] group-hover:scale-110 transition-transform" />
            <span>تجديد الاشتراك الآن</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>منظومة PenRX+ الذكية</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-100">
              أهلاً بك، {clinic.doctorName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              {clinic.doctorTitle} • {activeBranch?.nameAr || "الفرع الرئيسي"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NewRxGuard>
              <Link
                href="/prescriptions/new"
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer group hover:-translate-y-0.5"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <span>كتابة روشتة جديدة</span>
              </Link>
            </NewRxGuard>

            <Link
              href="/history"
              className="px-5 py-3.5 rounded-2xl bg-slate-950 border-2 border-slate-700/80 hover:border-emerald-500/50 hover:bg-slate-900 text-slate-200 hover:text-white font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2.5 cursor-pointer group hover:-translate-y-0.5"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <Clock className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span>أرشيف الروشتات</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                <span>تصفية الإحصائيات حسب الفترة الزمنية</span>
                {(startDate || endDate) && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    فلتر مفعّل
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                اختر فترة محددة لتحديث أرقام الكروت وسجل الروشتات تلقائياً
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handlePresetSelect("all")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                activePreset === "all"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/40"
                  : "bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("today")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                activePreset === "today"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/40"
                  : "bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("week")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                activePreset === "week"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/40"
                  : "bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("month")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                activePreset === "month"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/40"
                  : "bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
              }`}
            >
              هذا الشهر
            </button>
          </div>
        </div>

        {/* Date Inputs: From & To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2.5 border-t border-slate-800/80 items-center">
          <div
            onClick={() => {
              try {
                startDateRef.current?.showPicker();
              } catch {}
            }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0">من تاريخ:</span>
            <div className="relative w-full">
              <input
                ref={startDateRef}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset("custom");
                }}
                onClick={(e) => {
                  try {
                    (e.currentTarget as any).showPicker?.();
                  } catch {}
                }}
                onFocus={(e) => {
                  try {
                    (e.currentTarget as any).showPicker?.();
                  } catch {}
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer text-center [text-align-last:center]"
              />
            </div>
          </div>

          <div
            onClick={() => {
              try {
                endDateRef.current?.showPicker();
              } catch {}
            }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition-colors shrink-0">إلى تاريخ:</span>
            <div className="relative w-full">
              <input
                ref={endDateRef}
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset("custom");
                }}
                onClick={(e) => {
                  try {
                    (e.currentTarget as any).showPicker?.();
                  } catch {}
                }}
                onFocus={(e) => {
                  try {
                    (e.currentTarget as any).showPicker?.();
                  } catch {}
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer text-center [text-align-last:center]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => handlePresetSelect("all")}
                className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة ضبط التصفية</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Stats Cards (Strictly 2 Cards per Row: 2x2 Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Card 1: إجمالي المرضى (Emerald Green) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/25 hover:border-emerald-500/50 shadow-xl transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
              +{thisMonthPatientsCount} هذا الشهر
            </span>
          </div>

          <div>
            <p className="text-4xl sm:text-5xl font-black text-slate-100 font-mono tracking-tight">
              {filteredPatientCount}
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-1">
              إجمالي المرضى
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <Link
              href="/history"
              className="text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors group"
            >
              <span>عرض الكل</span>
              <span className="text-base group-hover:-translate-x-0.5 transition-transform">‹</span>
            </Link>
          </div>
        </div>

        {/* Card 2: الروشتات المكتوبة (Purple) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-purple-500/25 hover:border-purple-500/50 shadow-xl transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 font-bold text-xs">
              {thisMonthPrescriptionsCount} هذا الشهر
            </span>
          </div>

          <div>
            <p className="text-4xl sm:text-5xl font-black text-slate-100 font-mono tracking-tight">
              {filteredPrescriptions.length}
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-1">
              الروشتات المكتوبة
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <Link
              href="/history"
              className="text-xs sm:text-sm font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors group"
            >
              <span>أرشيف الروشتات</span>
              <span className="text-base group-hover:-translate-x-0.5 transition-transform">‹</span>
            </Link>
          </div>
        </div>

        {/* Card 3: الأكثر كتابة (Amber / Gold) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-amber-500/25 hover:border-amber-500/50 shadow-xl transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
              <Pill className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 font-bold text-xs">
              +200k صنف
            </span>
          </div>

          <div>
            <p className="text-4xl sm:text-5xl font-black text-slate-100 font-mono tracking-tight">
              {mostPrescribedInfo.maxCount}
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-1 truncate" title={mostPrescribedInfo.topDrugName}>
              {mostPrescribedInfo.maxCount > 0 ? `الأكثر كتابة (${mostPrescribedInfo.topDrugName})` : "الأكثر كتابة"}
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <NewRxGuard>
              <Link
                href="/prescriptions/new"
                className="text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors group"
              >
                <span>كتابة روشتة</span>
                <span className="text-base group-hover:-translate-x-0.5 transition-transform">‹</span>
              </Link>
            </NewRxGuard>
          </div>
        </div>

        {/* Card 4: متبقي للاشتراك (Cyan / Blue) */}
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-cyan-500/25 hover:border-cyan-500/50 shadow-xl transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-inner">
              <Crown className="w-6 h-6" />
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold text-xs">
              {isTrialAccount ? "نشط (تجريبي) ✅" : subDetails.isActive ? "نشط (PRO) 👑" : "غير نشط ⚠️"}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl sm:text-5xl font-black text-slate-100 font-mono tracking-tight">
                {subDetails.daysRemaining}
              </p>
              <span className="text-sm font-bold text-slate-400">يوم</span>
            </div>
            <p className="text-sm sm:text-base font-bold text-slate-400 mt-1">
              متبقي للاشتراك
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <Link
              href="/subscriptions"
              className="text-xs sm:text-sm font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors group"
            >
              <span>إدارة الاشتراك</span>
              <span className="text-base group-hover:-translate-x-0.5 transition-transform">‹</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CLINICAL ANALYTICS & CHARTS SECTION (Aesthetic & Clutter-Free) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: نشاط كتابة الروشتات (آخر 7 أيام) */}
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  <span>نشاط كتابة الروشتات</span>
                  <span className="text-[10px] text-slate-400 font-normal">(آخر 7 أيام)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  معدل النشاط اليومي وتدفق المرضى بالعيادة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 shadow-xs">
                {weeklyActivity.totalWeeklyCount} روشتة هذا الأسبوع
              </span>
            </div>
          </div>

          {/* Vertical Bar Visual Spectrum */}
          <div className="pt-1">
            <div className="h-40 sm:h-44 flex items-end justify-between gap-2 sm:gap-4 px-2.5 sm:px-4 pt-6 pb-2.5 bg-slate-950/70 rounded-2xl border border-slate-800/90">
              {weeklyActivity.days.map((day, idx) => {
                const heightPercent = weeklyActivity.maxDayCount > 0
                  ? Math.max(Math.round((day.count / weeklyActivity.maxDayCount) * 100), 10)
                  : 10;
                const isPeak = day.count > 0 && day.count === weeklyActivity.peakDay.count;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-2 group relative">
                    {/* Count badge above bar */}
                    <span className={`text-[10px] font-mono font-bold transition-all ${
                      day.count > 0 ? "text-emerald-300 font-black" : "text-slate-600"
                    }`}>
                      {day.count}
                    </span>

                    {/* Bar Pillar */}
                    <div className="w-full max-w-[38px] bg-slate-900 rounded-xl p-0.5 flex flex-col justify-end h-full border border-slate-800/80">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-lg transition-all duration-500 ${
                          isPeak
                            ? "bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-400 shadow-md shadow-emerald-500/40"
                            : day.count > 0
                            ? "bg-gradient-to-t from-emerald-600/90 to-teal-500/90 group-hover:from-emerald-400 group-hover:to-cyan-400"
                            : "bg-slate-800/30"
                        }`}
                      />
                    </div>

                    {/* Day Label */}
                    <div className="text-center">
                      <span className={`text-[11px] block transition-colors ${
                        day.isToday
                          ? "text-cyan-400 font-black"
                          : "text-slate-400 font-bold"
                      }`}>
                        {day.dayName}
                      </span>
                      {day.isToday && (
                        <span className="inline-block w-1 h-1 rounded-full bg-cyan-400 mt-0.5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insights Micro-Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">المعدل اليومي:</span>
                <span className="font-mono font-black text-slate-200 text-xs">
                  {weeklyActivity.dailyAverage} روشتة/يوم
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">اليوم الأكثر نشاطاً:</span>
                <span className="font-bold text-emerald-400 text-xs truncate block">
                  {weeklyActivity.peakDay.count > 0 ? `${weeklyActivity.peakDay.dayName} (${weeklyActivity.peakDay.count})` : "لا يوجد بعد"}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">متوسط الأصناف:</span>
                <span className="font-mono font-black text-cyan-300 text-xs">
                  {clinicEfficiency.avgDrugsPerRx} دواء/روشتة
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: توزيع أكثر الأدوية تكراراً بالعيادة */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-100">الأدوية الأكثر تكراراً</h3>
                <p className="text-[11px] text-slate-400">التوزيع النسبي لأصناف روشتات العيادة</p>
              </div>
            </div>

            <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              أهم 4 أصناف
            </span>
          </div>

          {/* Drugs Spectrum Rows */}
          <div className="space-y-3.5 flex-1 justify-center flex flex-col">
            {topMedicationsList.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <Pill className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
                <p className="text-xs">لم يتم تسجيل أدوية بعد في الفترة المحددة</p>
                <p className="text-[10px] text-slate-600">بمجرد كتابة وحفظ الروشتات ستظهر إحصائيات الأدوية هنا تلقائياً</p>
              </div>
            ) : (
              topMedicationsList.map((item, idx) => {
                const rankGradients = [
                  "from-emerald-500 to-teal-400",
                  "from-cyan-500 to-blue-400",
                  "from-amber-500 to-orange-400",
                  "from-purple-500 to-indigo-400",
                ];
                const barColor = rankGradients[idx] || rankGradients[0];

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-200 truncate text-xs" title={item.drugName}>
                          {item.drugName}
                        </span>
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800/80 shrink-0 hidden sm:inline">
                          {item.doseForm}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                        <span className="font-bold text-slate-200">{item.count} مرة</span>
                        <span className="text-slate-500 font-sans">({item.percentage}%)</span>
                      </div>
                    </div>

                    {/* Spectrum Bar */}
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        style={{ width: `${item.percentage}%` }}
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Efficiency Badge */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>إجمالي الأصناف الموصوفة:</span>
            </span>
            <span className="font-mono font-black text-emerald-400">
              {clinicEfficiency.totalDrugsCount} صنف
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RECENT PRESCRIPTIONS (Responsive: Cards on Mobile, Table on Desktop) */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-black text-slate-100">
              {startDate || endDate ? "الروشتات في الفترة المحددة" : "أحدث الروشتات المحررة مؤخراً"}
            </h3>
            {(startDate || endDate) && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono">
                {filteredPrescriptions.length} روشتة
              </span>
            )}
          </div>
          <Link
            href="/history"
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>عرض كل السجل ({savedPrescriptions.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>

        {displayPrescriptions.length === 0 ? (
          <div className="py-12 px-6 text-center bg-slate-900/60 border border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-inner">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1.5">
              <p className="text-sm font-black text-slate-100">
                {startDate || endDate ? "لا توجد روشتات في هذه الفترة" : "لا توجد روشتات مسجلة بعد"}
              </p>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                {startDate || endDate
                  ? "لا توجد روشتات مسجلة مطابقة للفترة المحددة. جرب توسيع نطاق البحث أو تصفية الكل."
                  : "ابدأ بكتابة أول روشتة الآن بضغطة زر مع الحفظ التلقائي والطباعة الفورية."}
              </p>
            </div>
            <div className="pt-2">
              {!(startDate || endDate) ? (
                <NewRxGuard>
                  <Link
                    href="/prescriptions/new"
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>كتابة أول روشتة</span>
                  </Link>
                </NewRxGuard>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePresetSelect("all")}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950 border-2 border-slate-700/80 hover:border-emerald-500/50 hover:bg-slate-900 text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>عرض جميع الروشتات</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (Hidden on md and above - Eliminates any column squishing or overlap) */}
            <div className="space-y-3.5 md:hidden">
              {displayPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="p-4 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-3.5 hover:border-emerald-500/40 transition-all"
                >
                  {/* Top Row: Patient Name & Rx # Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-100 text-sm truncate">
                          {rx.patient.name}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span dir="ltr">{rx.patient.phone || "بدون هاتف"}</span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl shrink-0" dir="ltr">
                      #{rx.prescriptionNo}
                    </span>
                  </div>

                  {/* Middle Row: Meta details */}
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{new Date(rx.createdAt).toLocaleDateString("ar-EG")}</span>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-bold font-mono text-[11px] flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{rx.items.length} أصناف دوائية</span>
                    </span>
                  </div>

                  {/* Bottom Row: Mobile Ergonomic Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(rx)}
                      className="py-2.5 px-3 rounded-2xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                      <MessageCircle className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>واتساب</span>
                    </button>

                    <Link
                      href="/history"
                      className="py-2.5 px-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-center"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>عرض بالسجل</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop Table View (Only visible on md screens and above - Roomy and crisp) */}
            <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                    <tr>
                      <th className="p-4">رقم الروشتة</th>
                      <th className="p-4">المريض</th>
                      <th className="p-4">الهاتف</th>
                      <th className="p-4">عدد الأدوية</th>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4 text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {displayPrescriptions.map((rx) => (
                      <tr key={rx.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-400" dir="ltr">
                          #{rx.prescriptionNo}
                        </td>
                        <td className="p-4 font-black text-slate-100">{rx.patient.name}</td>
                        <td className="p-4 font-mono text-slate-300">{rx.patient.phone || "—"}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold font-mono">
                            {rx.items.length} صنف
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 font-mono">
                          {new Date(rx.createdAt).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleShareWhatsApp(rx)}
                              className="p-2.5 rounded-2xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer active:scale-95 shadow-sm"
                              title="إرسال عبر الواتساب"
                            >
                              <MessageCircle className="w-4 h-4 stroke-[2.2]" />
                            </button>
                            <Link
                              href="/history"
                              className="p-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all active:scale-95 shadow-sm"
                              title="عرض في السجل"
                            >
                              <Printer className="w-4 h-4 text-emerald-400" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
      {/* WhatsApp Image/PDF Share Modal */}
      {rxToShareWhatsApp && (
        <WhatsAppShareModal
          isOpen={Boolean(rxToShareWhatsApp)}
          onClose={() => setRxToShareWhatsApp(null)}
          patient={rxToShareWhatsApp.patient}
          clinic={clinic}
          prescriptionNo={rxToShareWhatsApp.prescriptionNo}
          diagnosis={rxToShareWhatsApp.diagnosis || ""}
          notes={rxToShareWhatsApp.notes || ""}
          items={rxToShareWhatsApp.items}
        />
      )}
    </div>
  );
}
