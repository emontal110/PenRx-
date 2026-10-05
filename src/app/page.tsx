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
} from "lucide-react";
import { usePrescriptionStore, SavedPrescription } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { NewRxGuard } from "@/components/prescription/NewRxGuard";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { normalizeWhatsAppNumber } from "@/components/prescription/WhatsAppShareModal";

export default function DashboardPage() {
  const { savedPrescriptions, savedPatients } = usePrescriptionStore();
  const { clinic, branches, activeBranchId } = useClinicStore();
  const { subscriptions, machineId } = useSubscriptionStore();
  const [mounted, setMounted] = useState(false);

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

  const displayPrescriptions = filteredPrescriptions.slice(0, 6);

  const handleShareWhatsApp = (rx: SavedPrescription) => {
    const cleanPhone = normalizeWhatsAppNumber(rx.patient.phone || "");
    if (!cleanPhone) {
      showGlobalToast("⚠️ لا يوجد رقم هاتف مسجل للمريض لإرسال الواتساب", "error");
      return;
    }
    const itemsText = rx.items
      .map((it, idx) => `${idx + 1}. *${it.drugName}* (${it.doseQuantity} ${it.doseForm}) - ${it.frequency}`)
      .join("\n");

    const message = `مرحباً أستاذ/ة *${rx.patient.name}*،\n\nإليك تفاصيل الروشتة الطبية من عيادة *${clinic.doctorName}*:\n\n*رقم الروشتة:* ${rx.prescriptionNo}\n*التاريخ:* ${new Date(rx.createdAt).toLocaleDateString("ar-EG")}\n\n*الأدوية المقررة:*\n${itemsText}\n\n${rx.notes ? `*ملاحظات إضافية:* ${rx.notes}\n\n` : ""}نتمنى لكم دوام الصحة والعافية والشفاء العاجل 🌹`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
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
            className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              subDetails.daysRemaining <= 3
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50"
                : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/40"
            }`}
          >
            <span>تجديد الاشتراك الآن 💳</span>
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
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>كتابة روشتة جديدة ✍️</span>
              </Link>
            </NewRxGuard>

            <Link
              href="/history"
              className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-emerald-400" />
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handlePresetSelect("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === "all"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("today")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === "today"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("week")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === "week"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              type="button"
              onClick={() => handlePresetSelect("month")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activePreset === "month"
                  ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
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
              +43k بالدليل
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

      {/* Recent Prescriptions Table (Filtered in Real Time) */}
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
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
            <HeartPulse className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">
              {startDate || endDate
                ? "لا توجد روشتات مسجلة مطابقة للفترة المحددة."
                : "لا توجد روشتات مسجلة بعد. ابدأ بكتابة أول روشتة الآن بضغطة زر."}
            </p>
            {!(startDate || endDate) ? (
              <NewRxGuard>
                <Link
                  href="/prescriptions/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>كتابة أول روشتة ✍️</span>
                </Link>
              </NewRxGuard>
            ) : (
              <button
                type="button"
                onClick={() => handlePresetSelect("all")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>عرض جميع الروشتات</span>
              </button>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
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
                        {rx.prescriptionNo}
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
                            className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all cursor-pointer"
                            title="إرسال عبر الواتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href="/history"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="عرض في السجل"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
