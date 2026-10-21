"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Palette,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useClinicStore } from "@/store/useClinicStore";

function SettingsSkeleton() {
  return (
    <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 animate-pulse space-y-6">
      <div className="h-8 bg-slate-800/80 rounded-2xl w-1/3" />
      <div className="h-4 bg-slate-800/60 rounded-xl w-2/3" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4">
        <div className="lg:col-span-7 h-96 bg-slate-800/40 rounded-3xl" />
        <div className="lg:col-span-5 h-96 bg-slate-800/30 rounded-3xl" />
      </div>
    </div>
  );
}

const ClinicAndTemplateSettings = dynamic(
  () => import("@/components/settings/ClinicAndTemplateSettings"),
  { ssr: false, loading: () => <SettingsSkeleton /> }
);

const DrugsAndBranchesSettings = dynamic(
  () => import("@/components/settings/DrugsAndBranchesSettings"),
  { ssr: false, loading: () => <SettingsSkeleton /> }
);

const BackupAndSecuritySettings = dynamic(
  () => import("@/components/settings/BackupAndSecuritySettings"),
  { ssr: false, loading: () => <SettingsSkeleton /> }
);

export default function SettingsPage() {
  const { clinic } = useClinicStore();
  const [activeTab, setActiveTab] = useState<"profile" | "patientFields" | "backup">("profile");

  // Mandatory Profile Check: Doctor Name, Clinic Name, and Phone are required for Portal sync
  const isProfileComplete = Boolean(
    clinic.isProfileSaved &&
    clinic.doctorName?.trim() &&
    (clinic.name?.trim() || clinic.nameAr?.trim()) &&
    clinic.phone?.trim()
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "patientFields" || window.location.hash === "#patientFields") {
        setActiveTab("patientFields");
      } else if (tabParam === "backup" || window.location.hash === "#backup") {
        setActiveTab("backup");
      } else {
        setActiveTab("profile");
      }
    }
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 md:pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              إعدادات المركز وهوية الروشتة المطبوعة
            </h1>
            <span
              dir="ltr"
              className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] sm:text-xs font-semibold border border-emerald-500/20 inline-flex items-center justify-center text-center self-start sm:self-auto shrink-0 leading-tight"
            >
              Settings & Customization
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            خصص بيانات الطبيب، اللوجو، ألوان وخطوط الروشتة، وحقول بيانات المريض بكل سهولة واحترافية وسرعة فائقة.
          </p>
        </div>

        {/* Mandatory Profile Setup Notice if not complete */}
        {!isProfileComplete && (
          <div className="w-full p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-200 shadow-xl space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span>خطوة أولى إلزامية: استكمال بيانات الطبيب والعيادة ورقم الهاتف 🏥</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/90 leading-relaxed font-medium">
              تم تفعيل اشتراكك بنجاح! لا يمكن كتابة الروشتات إلا بعد ملء الحقول الإلزامية المؤشر عليها بنجمة (<span className="text-rose-400 font-black">*</span>): <strong>اسم الطبيب</strong>، <strong>اسم العيادة</strong>، و<strong>رقم الهاتف</strong>، ثم الضغط على زر <strong>&quot;حفظ وتأكيد بيانات وهوية العيادة&quot;</strong> بالأسفل لمزامنتها مع البورتال واعتماد نسختك.
            </p>
          </div>
        )}

        {/* Tab Navigation Buttons (Ultra-Modern Segmented Control) */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner w-full sm:w-auto">
          {/* Tab 1: Clinic Profile & Prescription Design */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
            title="إعدادات هوية وتصميم المركز"
          >
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeTab === "profile"
                  ? "bg-white/20 text-white"
                  : "bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25"
              }`}
            >
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 min-w-0">
              <span className="truncate text-[11px] sm:text-xs">هوية وتصميم الروشتة</span>
            </div>
          </button>

          {/* Tab 2: Patient Fields, Branches & Custom Drugs */}
          <button
            type="button"
            onClick={() => setActiveTab("patientFields")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "patientFields"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
            title="تخصيص الفروع، حقول بيانات المريض، والأدوية"
          >
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeTab === "patientFields"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500/25"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 min-w-0">
              <span className="truncate text-[11px] sm:text-xs">الفروع والأدوية</span>
              <span className="hidden sm:inline text-xs">وحقول المريض</span>
            </div>
          </button>

          {/* Tab 3: Backup & Archive */}
          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "backup"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
            title="النسخ الاحتياطي السحابي والمحلي والأرشفة والبصمة"
          >
            <div
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                activeTab === "backup"
                  ? "bg-white/20 text-white"
                  : "bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1 min-w-0">
              <span className="truncate text-[11px] sm:text-xs">النسخ الاحتياطي</span>
              <span className="hidden sm:inline text-xs">والأمان</span>
            </div>
          </button>
        </div>
      </div>

      {/* Render Only The Active Tab Component (Zero Memory Choke on Android APK) */}
      <div className="transition-all duration-200">
        {activeTab === "profile" && <ClinicAndTemplateSettings />}
        {activeTab === "patientFields" && <DrugsAndBranchesSettings />}
        {activeTab === "backup" && <BackupAndSecuritySettings />}
      </div>
    </div>
  );
}
