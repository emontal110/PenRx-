"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Settings,
  User,
  Fingerprint,
  Laptop,
  CheckCircle2,
  Copy,
  Save,
  Printer,
  ShieldCheck,
  Building,
  Sparkles,
  Phone,
} from "lucide-react";
import { useClinicStore } from "@/store/useClinicStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { isBiometricAvailable, authenticateWithBiometrics } from "@/lib/deviceSecurity";

export default function SettingsPage() {
  const { clinic, updateClinic } = useClinicStore();
  const { machineId, subscriberId } = useSubscriptionStore();

  const [doctorName, setDoctorName] = useState(clinic.doctorName);
  const [doctorTitle, setDoctorTitle] = useState(clinic.doctorTitle);
  const [specialty, setSpecialty] = useState(clinic.specialty);
  const [syndicateId, setSyndicateId] = useState(clinic.syndicateId);
  const [clinicPhone, setClinicPhone] = useState(clinic.phone);
  const [headerText, setHeaderText] = useState(clinic.headerText || "");
  const [footerText, setFooterText] = useState(clinic.footerText || "");
  const [paperSize, setPaperSize] = useState<"A4" | "A5">(clinic.paperSize || "A4");
  const [biometricsEnabled, setBiometricsEnabled] = useState(clinic.biometricsEnabled || false);

  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function checkHardware() {
      const avail = await isBiometricAvailable();
      setHasBiometricsHardware(avail);
    }
    checkHardware();
  }, []);

  const handleTestBiometrics = async () => {
    setBiometricFeedback("يرجى لمس مستشعر البصمة على جهازك للتحقق...");
    const success = await authenticateWithBiometrics(clinic.doctorName);
    if (success) {
      setBiometricFeedback("✅ تم التحقق من البصمة بنجاح! جهازك مهيأ للدخول البيومتري.");
      setBiometricsEnabled(true);
    } else {
      setBiometricFeedback("⚠️ لم يتم التحقق أو تم إلغاء البصمة من المستخدم.");
    }
    setTimeout(() => setBiometricFeedback(null), 6000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateClinic({
      doctorName,
      doctorTitle,
      specialty,
      syndicateId,
      phone: clinicPhone,
      headerText,
      footerText,
      paperSize,
      biometricsEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              الإعدادات العامة والملف الطبي
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تخصيص بيانات الطبيب، ترويسة الروشتة، أمان البصمة، ومعرّف الجهاز
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 animate-bounce">
            ✓ تم حفظ التعديلات بنجاح!
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Doctor Profile Information */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-slate-100">بيانات الطبيب المعالج</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">اسم الطبيب (كما يظهر بالروشتة):</label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">اللقب والدرجة العلمية:</label>
              <input
                type="text"
                required
                value={doctorTitle}
                onChange={(e) => setDoctorTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">التخصص الطبي الدقيق:</label>
              <input
                type="text"
                required
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">رقم ترخيص مزاولة المهنة / النقابة:</label>
              <input
                type="text"
                value={syndicateId}
                onChange={(e) => setSyndicateId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Biometrics & Device Security */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Fingerprint className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-black text-slate-100">الأمان البيومتري وربط الأجهزة</h2>
          </div>

          <div className="space-y-3">
            {/* Dual Identifiers Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Subscriber ID */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-1.5">
                <span className="text-xs font-bold text-purple-300 block">معرّف المشترك (Subscriber ID):</span>
                <span className="font-mono font-black text-purple-300 text-base tracking-wider block" dir="ltr">
                  {subscriberId}
                </span>
                <p className="text-[10px] text-slate-400">معرّف حسابك الطبي لربط أجهزة متعددة</p>
              </div>

              {/* Machine ID */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">معرّف هذا الجهاز (Machine ID):</span>
                  {copySuccess && (
                    <span className="text-[10px] font-black text-emerald-400">✓ تم النسخ!</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-emerald-400 text-xs tracking-wider truncate" dir="ltr">
                    {machineId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyMachineId}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    <span>نسخ</span>
                  </button>
                </div>
              </div>
            </div>


            {/* Biometrics Toggle & Test */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-100 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-purple-400" />
                    <span>تأمين التطبيق ببصمة الإصبع (Biometric Fingerprint):</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    قفل التطبيق وطلب البصمة عند الفتح لضمان خصوصية المرضى والبيانات الطبية
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestBiometrics}
                  className="px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>اختبار وتفعيل البصمة ⚡</span>
                </button>
              </div>

              {biometricFeedback && (
                <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs text-purple-200 font-bold">
                  {biometricFeedback}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prescription Printing Configuration */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-xs">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Printer className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-black text-slate-100">تخصيص طباعة الروشتة</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">نص الترويسة العلوية المطبوعة (Header):</label>
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="مثال: مركز الرعاية الطبية المتخصصة"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">نص التذييل السفلي (Footer):</label>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="مثال: نتمنى لكم الشفاء العاجل والدوام بالصحة والعافية • للحجز: 01094085228"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">مقاس ورق الطباعة الافتراضي:</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paperSize"
                    value="A4"
                    checked={paperSize === "A4"}
                    onChange={() => setPaperSize("A4")}
                    className="accent-emerald-500"
                  />
                  <span className="font-bold text-slate-200">ورق مقاس A4 (الحجم القياسي)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paperSize"
                    value="A5"
                    checked={paperSize === "A5"}
                    onChange={() => setPaperSize("A5")}
                    className="accent-emerald-500"
                  />
                  <span className="font-bold text-slate-200">ورق مقاس A5 (نصف صفحة)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ جميع الإعدادات 💾</span>
          </button>
        </div>
      </form>
    </div>
  );
}
