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
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100">
            إعدادات العيادة والروشتة
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            بيانات الطبيب، تصميم الروشتة، الفروع، والنسخ الاحتياطي
          </p>
        </div>

        {/* Mandatory Profile Setup Notice if not complete */}
        {!isProfileComplete && (
          <div className="w-full p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              يرجى إدخال <strong>اسم الطبيب</strong>، <strong>اسم العيادة</strong>، و<strong>رقم الهاتف</strong> ثم الضغط على حفظ لتفعيل كتابة الروشتات.
            </span>
          </div>
        )}

        {/* Tab Navigation Buttons */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "profile"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
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
            <span className="truncate text-[11px] sm:text-xs">هوية الروشتة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("patientFields")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "patientFields"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
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
            <span className="truncate text-[11px] sm:text-xs">الفروع والحقول</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("backup")}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer active:scale-95 group ${
              activeTab === "backup"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40 font-black"
                : "bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-slate-800/80"
            }`}
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
            <span className="truncate text-[11px] sm:text-xs">النسخ والأمان</span>
          </button>
        </div>
      </div>

      <div className="transition-all duration-200">
        {activeTab === "profile" && <ClinicAndTemplateSettings />}
        {activeTab === "patientFields" && <DrugsAndBranchesSettings />}
        {activeTab === "backup" && <BackupAndSecuritySettings />}
      </div>
    </div>
  );
}
