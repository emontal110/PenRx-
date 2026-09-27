"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { usePrescriptionStore, SavedPrescription } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";

export default function DashboardPage() {
  const { savedPrescriptions, savedPatients } = usePrescriptionStore();
  const { clinic, branches, activeBranchId } = useClinicStore();
  const { subscriptions, machineId } = useSubscriptionStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  // Calculate today's prescriptions
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPrescriptions = savedPrescriptions.filter(
    (rx) => rx.createdAt && rx.createdAt.startsWith(todayStr)
  ).length;

  const recentPrescriptions = savedPrescriptions.slice(0, 6);

  const handleShareWhatsApp = (rx: SavedPrescription) => {
    const phone = rx.patient.phone?.replace(/[^0-9]/g, "") || "";
    const cleanPhone = phone.startsWith("20") ? phone : `20${phone.replace(/^0+/, "")}`;
    const itemsText = rx.items
      .map((it, idx) => `${idx + 1}. *${it.drugName}* (${it.doseQuantity} ${it.doseForm}) - ${it.frequency}`)
      .join("\n");

    const message = `مرحباً أستاذ/ة *${rx.patient.name}*،\n\nإليك تفاصيل الروشتة الطبية من عيادة *${clinic.doctorName}*:\n\n*رقم الروشتة:* ${rx.prescriptionNo}\n*التاريخ:* ${new Date(rx.createdAt).toLocaleDateString("ar-EG")}\n\n*الأدوية المقررة:*\n${itemsText}\n\n${rx.notes ? `*ملاحظات إضافية:* ${rx.notes}\n\n` : ""}نتمنى لكم دوام الصحة والعافية والشفاء العاجل 🌹`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>منظومة PenRX+ الذكية v1.0</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-100">
              أهلاً بك، {clinic.doctorName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              {clinic.doctorTitle} • {activeBranch?.nameAr || "الفرع الرئيسي"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/prescriptions/new"
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>كتابة روشتة جديدة ✍️</span>
            </Link>

            <Link
              href="/history"
              className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center gap-2"
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>سجل المرضى</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Prescriptions */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/30 transition-all space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">روشتات اليوم:</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
            {todayPrescriptions}
          </p>
          <span className="text-[11px] text-emerald-400 font-bold block">
            إجمالي الروشتات: {savedPrescriptions.length}
          </span>
        </div>

        {/* Card 2: Total Patients */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/30 transition-all space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">سجل المرضى:</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
            {savedPatients.length}
          </p>
          <span className="text-[11px] text-teal-400 font-bold block">
            ملفات المرضى المسجلة
          </span>
        </div>

        {/* Card 3: Active Branch */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/30 transition-all space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">العيادة الحالية:</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base font-black text-slate-100 truncate">
            {activeBranch?.nameAr || "الفرع الرئيسي"}
          </p>
          <Link href="/branches" className="text-[11px] text-cyan-400 font-bold hover:underline block">
            إدارة {branches.length} فروع عيادات ←
          </Link>
        </div>

        {/* Card 4: Subscription Status & Remaining Days */}
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/30 transition-all space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">ترخيص النظام:</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {subDetails.daysRemaining}
            </span>
            <span className="text-xs font-bold text-slate-400">يوماً متبقياً</span>
          </div>
          <Link
            href="/subscriptions"
            className="text-[11px] text-purple-300 font-bold hover:underline block"
          >
            باقة: {subDetails.planName} ←
          </Link>
        </div>
      </div>

      {/* Recent Prescriptions Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-black text-slate-100">أحدث الروشتات المحررة مؤخراً</h3>
          </div>
          <Link
            href="/history"
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>عرض كل السجل ({savedPrescriptions.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>

        {savedPrescriptions.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
            <HeartPulse className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">
              لا توجد روشتات مسجلة بعد. ابدأ بكتابة أول روشتة الآن بضغطة زر.
            </p>
            <Link
              href="/prescriptions/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>كتابة أول روشتة ✍️</span>
            </Link>
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
                  {recentPrescriptions.map((rx) => (
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
                      <td className="p-4 text-slate-400">
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
                            href="/prescriptions/new"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            title="عرض / طباعة"
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
