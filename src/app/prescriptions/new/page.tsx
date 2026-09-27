"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Phone,
  Calendar,
  AlertTriangle,
  Building2,
  Save,
  RotateCcw,
  Sparkles,
  Printer,
  MessageCircle,
  CheckCircle2,
  Share2,
} from "lucide-react";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { SuperDrugSearch } from "@/components/prescription/SuperDrugSearch";
import { LivePrescriptionPreview } from "@/components/prescription/LivePrescriptionPreview";
import { formatEgyptPhoneNumber } from "@/lib/utils";

export default function NewPrescriptionPage() {
  const {
    prescriptionNo,
    patient,
    setPatient,
    diagnosis,
    setDiagnosis,
    notes,
    setNotes,
    items,
    addItem,
    removeItem,
    clearItems,
    resetCurrentPrescription,
    savePrescription,
    selectedBranchId,
    setSelectedBranchId,
    savedPatients,
  } = usePrescriptionStore();

  const { branches, clinic } = useClinicStore();

  const [toast, setToast] = useState<string | null>(null);
  const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);

  // Autocomplete existing patients by phone or name
  const handleNameChange = (val: string) => {
    setPatient({ name: val });
    if (val.trim().length >= 2) {
      const matches = savedPatients.filter((p) =>
        p.name.toLowerCase().includes(val.trim().toLowerCase())
      );
      setPatientSuggestions(matches.slice(0, 4));
    } else {
      setPatientSuggestions([]);
    }
  };

  const handleSelectPatient = (p: any) => {
    setPatient({
      name: p.name,
      phone: p.phone || "",
      age: p.age || "",
      gender: p.gender || "MALE",
      allergyNotes: p.allergyNotes || "",
    });
    setPatientSuggestions([]);
  };

  const handleSaveOnly = () => {
    if (!patient.name.trim()) {
      alert("يرجى كتابة اسم المريض أولاً لحفظ الروشتة.");
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    setToast("✅ تم حفظ الروشتة في سجل العيادة بنجاح!");
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveAndPrint = () => {
    if (!patient.name.trim()) {
      alert("يرجى كتابة اسم المريض أولاً للطباعة.");
      return;
    }
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!patient.name.trim()) {
      alert("يرجى كتابة اسم المريض وإدخال رقم الهاتف.");
      return;
    }
    const phone = patient.phone?.replace(/[^0-9]/g, "") || "";
    if (!phone) {
      alert("يرجى إدخال رقم هاتف المريض لإرسال الروشتة عبر الواتساب.");
      return;
    }

    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);

    const cleanPhone = phone.startsWith("20") ? phone : `20${phone.replace(/^0+/, "")}`;
    const itemsText = items
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.drugName}* (${it.doseQuantity} ${it.doseForm})\n   - الجرعة: ${it.frequency}\n   - المدة: ${it.duration}${
            it.instructions ? `\n   - تعليمات: ${it.instructions}` : ""
          }`
      )
      .join("\n\n");

    const message = `مرحباً أستاذ/ة *${patient.name}*،\n\nإليك تفاصيل الروشتة الطبية الخاصة بكم من عيادة *${clinic.doctorName}*:\n\n*رقم الروشتة:* ${prescriptionNo}\n*العيادة:* ${branchObj?.nameAr || clinic.nameAr}\n*التاريخ:* ${new Date().toLocaleDateString("ar-EG")}\n\n*الأدوية الموصوفة والجرعات:*\n${itemsText}\n\n${
      notes ? `*ملاحظات هامة:* ${notes}\n\n` : ""
    }نتمنى لكم موفور الصحة والشفاء العاجل 🌹`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-200 text-xs font-black shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-emerald-300 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              محرر وكتابة الروشتات الطبية
            </h1>
            <span className="font-mono text-xs font-black text-emerald-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800" dir="ltr">
              {prescriptionNo}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            أدخل بيانات المريض وابحث عن الأدوية بسرعة البرق مع الفحص الدوائي الذكي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={resetCurrentPrescription}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تفريغ الروشتة</span>
          </button>

          <button
            type="button"
            onClick={handleSaveOnly}
            className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ بالسجل 💾</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndPrint}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة مباشرة 🖨️</span>
          </button>
        </div>
      </div>

      {/* Patient Information & Branch Selector Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-black text-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span>بيانات المريض والعيادة</span>
          </span>

          {/* Branch Select */}
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Patient Name with Autocomplete */}
          <div className="lg:col-span-2 space-y-1 relative">
            <label className="font-bold text-slate-300">اسم المريض:</label>
            <input
              type="text"
              value={patient.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="الاسم ثلاثي أو ثنائي..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-black text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {patientSuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-slate-950 border border-slate-800 rounded-xl shadow-xl divide-y divide-slate-800 overflow-hidden">
                {patientSuggestions.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-right p-2.5 hover:bg-slate-900 text-xs font-bold text-slate-200 flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="font-mono text-slate-400">{p.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Patient Phone */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300">رقم الهاتف (واتساب):</label>
            <input
              type="text"
              value={patient.phone || ""}
              onChange={(e) => setPatient({ phone: e.target.value })}
              placeholder="010..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          {/* Age */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300">السن (بالسنوات):</label>
            <input
              type="number"
              value={patient.age || ""}
              onChange={(e) => setPatient({ age: e.target.value })}
              placeholder="مثال: 35"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Gender */}
          <div className="space-y-1">
            <label className="font-bold text-slate-300">الجنس:</label>
            <select
              value={patient.gender || "MALE"}
              onChange={(e) => setPatient({ gender: e.target.value as any })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="MALE">ذكر 👨</option>
              <option value="FEMALE">أنثى 👩</option>
            </select>
          </div>
        </div>

        {/* Diagnosis & Allergy warning */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div className="space-y-1">
            <label className="font-bold text-slate-300">التشخيص الطبي (Diagnosis):</label>
            <input
              type="text"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="مثال: Acute Bronchitis, GERD, التهاب اللوزتين..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تنبيه حساسية المريض (Allergies):</span>
            </label>
            <input
              type="text"
              value={patient.allergyNotes || ""}
              onChange={(e) => setPatient({ allergyNotes: e.target.value })}
              placeholder="مثال: حساسية بنسلين، حساسية سلفا، قرحة معدة..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-500/30 font-bold text-amber-300 placeholder:text-amber-500/40 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* The World-Class Super Drug Search Component */}
      <SuperDrugSearch onAddItem={addItem} />

      {/* General Notes for Patient */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-2 shadow-lg text-xs">
        <label className="font-bold text-slate-300 block">
          تعليمات وإرشادات ختامية للمريض (تطبع أسفل الروشتة):
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: الراحة التامة وتناول السوائل الدافئة، وإعادة الكشف بعد أسبوع للاطمئنان..."
          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-medium text-slate-100 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Live Interactive Prescription Preview Canvas */}
      <LivePrescriptionPreview
        prescriptionNo={prescriptionNo}
        patient={patient}
        diagnosis={diagnosis}
        notes={notes}
        items={items}
        onRemoveItem={removeItem}
        onSaveAndPrint={handleSaveAndPrint}
        onShareWhatsApp={handleShareWhatsApp}
      />
    </div>
  );
}
