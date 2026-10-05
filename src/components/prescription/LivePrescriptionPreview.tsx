"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import {
  Printer,
  Share2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Calendar,
  MessageCircle,
  HeartPulse,
  Activity,
  AlertTriangle,
  Droplet,
  FileSpreadsheet,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useClinicStore } from "@/store/useClinicStore";
import { PrescriptionItem, PatientInfo, usePrescriptionStore } from "@/store/usePrescriptionStore";
import {
  PrescriptionTemplateDecorations,
  getTemplateContainerStyles,
} from "./PrescriptionTemplateDecorations";

interface LivePrescriptionPreviewProps {
  prescriptionNo: string;
  patient: PatientInfo;
  diagnosis: string;
  notes: string;
  items: PrescriptionItem[];
  onRemoveItem: (id: string) => void;
  onSaveAndPrint: () => void;
  onShareWhatsApp: () => void;
}

export function LivePrescriptionPreview({
  prescriptionNo,
  patient,
  diagnosis,
  notes,
  items,
  onRemoveItem,
  onSaveAndPrint,
  onShareWhatsApp,
}: LivePrescriptionPreviewProps) {
  const { clinic, branches, activeBranchId } = useClinicStore();
  const { visibleFields, updateItem } = usePrescriptionStore();
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PrescriptionItem>>({});

  const startEdit = (item: PrescriptionItem) => {
    setEditingId(item.id);
    setEditForm({
      drugName: item.drugName,
      activeIngredient: item.activeIngredient || "",
      doseQuantity: item.doseQuantity,
      doseForm: item.doseForm,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: string) => {
    if (!editForm.drugName || !editForm.drugName.trim()) return;
    updateItem(id, {
      drugName: editForm.drugName.trim(),
      activeIngredient: editForm.activeIngredient?.trim() || undefined,
      doseQuantity: editForm.doseQuantity?.trim() || "1",
      doseForm: editForm.doseForm?.trim() || "Tablet (قرص)",
      frequency: editForm.frequency?.trim() || "كل 12 ساعة بعد الأكل",
      duration: editForm.duration?.trim() || "لمدة 5 أيام",
      instructions: editForm.instructions?.trim() || "",
    });
    setEditingId(null);
    setEditForm({});
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const currentDate = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const primaryColor = clinic.primaryColor || "#059669";
  const fontFamily = clinic.fontFamily || "'Cairo', sans-serif";
  const paperSize = clinic.paperSize || "A5";
  const templateId = clinic.templateId || "classic";
  const templateStyles = getTemplateContainerStyles(templateId, primaryColor);

  const paperConfig =
    paperSize === "A6"
      ? {
          label: "A6",
          name: "A6 مصغر",
          widthMm: 105,
          heightMm: 148,
          desc: "10.5 × 14.8 سم (1240 × 1748 px)",
          maxW: "max-w-[400px]",
          minH: "min-h-[580px] sm:min-h-[620px]",
          cssPage: "105mm 148mm",
        }
      : paperSize === "A4"
      ? {
          label: "A4",
          name: "A4 كامل",
          widthMm: 210,
          heightMm: 297,
          desc: "21.0 × 29.7 سم (2480 × 3508 px)",
          maxW: "max-w-[620px]",
          minH: "min-h-[900px] sm:min-h-[960px]",
          cssPage: "210mm 297mm",
        }
      : paperSize === "B5"
      ? {
          label: "B5",
          name: "B5 وسيط",
          widthMm: 176,
          heightMm: 250,
          desc: "17.6 × 25.0 سم",
          maxW: "max-w-[500px]",
          minH: "min-h-[760px] sm:min-h-[800px]",
          cssPage: "176mm 250mm",
        }
      : {
          label: "A5",
          name: "A5 قياسي (الافتراضي)",
          widthMm: 148,
          heightMm: 210,
          desc: "14.8 × 21.0 سم (1748 × 2480 px)",
          maxW: "max-w-[480px]",
          minH: "min-h-[700px] sm:min-h-[750px]",
          cssPage: "148mm 210mm",
        };

  // Check if any demographic / vitals are visible
  const hasVisibleDemographics =
    visibleFields.showAge ||
    visibleFields.showGender ||
    visibleFields.showHeight ||
    visibleFields.showWeight ||
    visibleFields.showBloodType;

  return (
    <div className="space-y-4">
      {/* Dynamic Print Styles for Exact Paper Size */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${paperConfig.cssPage} portrait !important;
                margin: 0 !important;
              }
            }
          `,
        }}
      />

      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-lg no-print">
        <div className="flex items-center gap-2.5">
          <div
            className="p-2 rounded-xl text-white shadow-sm shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-100">المعاينة الحية للروشتة</h4>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {paperConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">(رقم الروشتة)</span>
              <span suppressHydrationWarning className="text-[11px] font-mono text-emerald-400 font-bold">
                {mounted ? prescriptionNo : "..."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>إرسال واتساب 💬</span>
          </button>

          <button
            type="button"
            onClick={onSaveAndPrint}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>طباعة الروشتة 🖨️</span>
          </button>
        </div>
      </div>

      {/* The Printable Prescription Sheet */}
      <div
        ref={printAreaRef}
        id="prescription-print-sheet"
        style={{
          fontFamily,
          ...templateStyles.style,
        }}
        className={`text-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col justify-between relative overflow-hidden mx-auto transition-all ${templateStyles.className} ${paperConfig.maxW} ${paperConfig.minH}`}
        dir="rtl"
      >
        {/* Prescription Template Vector Decorations (Waves, Hexagons, Ornate Corners, etc.) */}
        <PrescriptionTemplateDecorations templateId={templateId} primaryColor={primaryColor} />

        {/* Center Watermark: Same Logo as Header with High Transparency */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          <div className="w-64 h-64 sm:w-80 sm:h-80 relative opacity-[0.045] flex items-center justify-center">
            {clinic.logoUrl ? (
              <img
                src={clinic.logoUrl}
                alt="Clinic Watermark"
                className="max-h-full max-w-full object-contain grayscale"
              />
            ) : (
              <span className="font-serif text-8xl font-black" style={{ color: primaryColor }}>
                ℞
              </span>
            )}
          </div>
        </div>

        {/* Clinic & Doctor Header (Respects showHeader) */}
        {clinic.showHeader !== false && (
          <div
            className="border-b pb-2.5 mb-2 space-y-1.5 relative z-10"
            style={{ borderColor: `${primaryColor}25` }}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Right: Logo + Doctor Identity */}
              <div className="flex items-center gap-3">
                {clinic.logoUrl && (
                  <div
                    className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm shrink-0 flex items-center justify-center p-1 bg-white"
                    style={{
                      width: "58px",
                      height: "58px",
                    }}
                  >
                    {clinic.logoUrl.startsWith("data:") || clinic.logoUrl.startsWith("http") ? (
                      <img
                        src={clinic.logoUrl}
                        alt="Clinic Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <Image
                        src={clinic.logoUrl}
                        alt="Clinic Logo"
                        fill
                        sizes="70px"
                        className="object-contain"
                      />
                    )}
                  </div>
                )}
                <div className="space-y-0.5">
                  <h2
                    className="text-lg sm:text-xl font-black font-serif leading-tight tracking-tight"
                    style={{ color: primaryColor }}
                  >
                    {activeBranch?.doctorName || clinic.doctorName || "د. الطبيب المعالج"}
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-slate-700">
                    {activeBranch?.doctorTitle || clinic.doctorTitle || "أخصائي واستشاري"}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    {(activeBranch?.specialty || clinic.specialty) && (
                      <span className="font-semibold text-slate-600">
                        {activeBranch?.specialty || clinic.specialty}
                      </span>
                    )}
                    {(activeBranch?.syndicateId || clinic.syndicateId) && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 font-mono">
                          ترخيص: {activeBranch?.syndicateId || clinic.syndicateId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Left: Clinic Details with distinctive, elegant typography for Clinic Name & Specialty */}
              <div className="text-left space-y-1">
                <h3
                  className="text-base sm:text-lg font-black leading-tight tracking-tight"
                  style={{
                    fontFamily: "'El Messiri', 'Alexandria', 'Cairo', serif",
                    color: "#0f172a",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {activeBranch?.nameAr || clinic.nameAr || "المركز الطبي"}
                </h3>
                {(activeBranch?.name || clinic.name || clinic.headerText) && (
                  <p
                    className="text-xs sm:text-[13px] font-bold"
                    style={{
                      fontFamily: "'Alexandria', 'Cairo', sans-serif",
                      color: primaryColor,
                    }}
                  >
                    {activeBranch?.name || clinic.name || clinic.headerText}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compact Patient Information Strip (Respects visibleFields) */}
        <div className="my-1.5 px-3 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200/80 text-[10px] relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-3">
            {/* Patient Name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-400 text-[9px] font-semibold">المريض:</span>
              <span className="text-slate-900 font-bold text-[10.5px] truncate">{patient.name || "—"}</span>
            </div>

            {/* Age & Gender */}
            {(visibleFields.showAge || visibleFields.showGender) && (
              <div className="flex items-center gap-1 text-slate-700 font-semibold">
                <span className="text-slate-400 text-[9.5px] font-normal">السن/النوع:</span>
                <span>
                  {visibleFields.showAge && (patient.age ? `${patient.age} سنة` : "—")}
                  {visibleFields.showAge && visibleFields.showGender && " / "}
                  {visibleFields.showGender &&
                    (patient.gender === "FEMALE" ? "أنثى" : "ذكر")}
                </span>
              </div>
            )}

            {/* Height & Weight */}
            {(visibleFields.showHeight || visibleFields.showWeight) && (
              <div className="flex items-center gap-1 text-slate-700 font-semibold">
                <span className="text-slate-400 text-[9.5px] font-normal">القياسات:</span>
                <span>
                  {visibleFields.showHeight && patient.height ? `${patient.height} سم` : ""}
                  {visibleFields.showHeight && visibleFields.showWeight && patient.height && patient.weight ? " • " : ""}
                  {visibleFields.showWeight && patient.weight ? `${patient.weight} كجم` : ""}
                </span>
              </div>
            )}

            {/* Blood Type */}
            {visibleFields.showBloodType && patient.bloodType && (
              <div className="flex items-center gap-1 font-bold">
                <span className="text-slate-400 text-[9.5px] font-normal">الفصيلة:</span>
                <span className="text-rose-600 font-black">{patient.bloodType}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-1 text-slate-600 font-medium">
              <span className="text-slate-400 text-[9.5px]">التاريخ:</span>
              <span suppressHydrationWarning className="font-mono font-bold">
                {mounted ? currentDate : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnosis Note if enabled and present */}
        {visibleFields.showDiagnosis && diagnosis && (
          <div
            className="mb-3 text-xs font-bold p-2.5 rounded-xl border"
            style={{
              backgroundColor: `${primaryColor}10`,
              borderColor: `${primaryColor}30`,
              color: primaryColor,
            }}
          >
            <span className="font-black">التشخيص الطبي (Diagnosis): </span>
            <span className="text-slate-800">{diagnosis}</span>
          </div>
        )}

        {/* Chronic History & Drug Allergies if enabled */}
        {(visibleFields.showMedicalHistory || visibleFields.showAllergies) && (
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {visibleFields.showMedicalHistory && patient.medicalHistory && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <span className="font-black">الأمراض المزمنة والتاريخ الطبي: </span>
                <span>{patient.medicalHistory}</span>
              </div>
            )}
            {visibleFields.showAllergies && patient.allergyNotes && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-black">⚠️ حساسية الأدوية: </span>
                <span>{patient.allergyNotes}</span>
              </div>
            )}
          </div>
        )}

        {/* Rx Symbol & Medication Items List */}
        <div className="flex-1 space-y-4 py-2 relative z-10">
          <div
            className="flex items-center gap-2 border-b pb-2"
            style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
          >
            <span className="font-serif font-black text-3xl italic tracking-wider">℞</span>
            <span className="text-xs font-extrabold text-slate-600">العلاج الدوائي والجرعات المحددة</span>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
              <HeartPulse className="w-8 h-8 text-slate-300 mx-auto" />
              <p>لم يتم إضافة أي أدوية للروشتة بعد. استخدم محرك البحث لإدراج الأدوية.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {items.map((item, idx) => {
                const isEditing = editingId === item.id;

                if (isEditing) {
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border-2 border-cyan-500 shadow-md space-y-3 text-xs no-print text-right"
                      dir="rtl"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-black text-cyan-800 flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5 text-cyan-600" />
                          <span>تعديل يدوي: {item.drugName}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">تعديل مباشر بالروشتة</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">اسم الدواء: *</label>
                          <input
                            type="text"
                            value={editForm.drugName || ""}
                            onChange={(e) => setEditForm((p) => ({ ...p, drugName: e.target.value }))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-slate-900 text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">المادة الفعالة:</label>
                          <input
                            type="text"
                            value={editForm.activeIngredient || ""}
                            onChange={(e) => setEditForm((p) => ({ ...p, activeIngredient: e.target.value }))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">الكمية والشكل الدوائي:</label>
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="text"
                              value={editForm.doseQuantity || ""}
                              onChange={(e) => setEditForm((p) => ({ ...p, doseQuantity: e.target.value }))}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                              placeholder="الكمية"
                            />
                            <input
                              type="text"
                              value={editForm.doseForm || ""}
                              onChange={(e) => setEditForm((p) => ({ ...p, doseForm: e.target.value }))}
                              className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                              placeholder="الشكل"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">مدة العلاج:</label>
                          <input
                            type="text"
                            value={editForm.duration || ""}
                            onChange={(e) => setEditForm((p) => ({ ...p, duration: e.target.value }))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">التكرار ومواعيد الجرعة:</label>
                          <input
                            type="text"
                            value={editForm.frequency || ""}
                            onChange={(e) => setEditForm((p) => ({ ...p, frequency: e.target.value }))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ملاحظات وتعليمات خاصة:</label>
                          <input
                            type="text"
                            value={editForm.instructions || ""}
                            onChange={(e) => setEditForm((p) => ({ ...p, instructions: e.target.value }))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>إلغاء</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(item.id)}
                          className="px-3.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black transition-all flex items-center gap-1 shadow cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>حفظ التعديل ✓</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-400 transition-all flex items-start justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full text-white font-mono font-bold text-[10px] leading-none flex items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {idx + 1}
                        </span>
                        <h4 className="font-black text-slate-900 text-xs sm:text-sm font-sans tracking-tight">
                          {item.drugName}
                        </h4>
                        {item.activeIngredient && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            ({item.activeIngredient})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold pr-6"
                        style={{ color: primaryColor }}
                      >
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-slate-800 text-[10px]">
                          {item.doseQuantity} {item.doseForm}
                        </span>
                        <span>•</span>
                        <span>{item.frequency}</span>
                        <span>•</span>
                        <span className="text-slate-600 font-medium">{item.duration}</span>
                      </div>

                      {item.instructions && (
                        <p className="text-[10px] text-slate-600 italic pr-6 font-medium">
                          ملاحظات: {item.instructions}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                        title="تعديل هذا الدواء يدويًا بواسطة القلم ✏️"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                        title="حذف هذا الدواء"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comfortable natural breathing margin between medications and footer */}
          <div className="flex-1 min-h-[60px] sm:min-h-[100px]" aria-hidden="true" />
        </div>

        {/* Footer: Branches & Clinic Contact & Greeting (Respects showFooter) */}
        {clinic.showFooter !== false && (
          <div className="mt-auto pt-2 space-y-1.5 relative z-10">
            {/* Notes if any */}
            {notes && (
              <p className="text-[10px] text-slate-700 font-medium leading-relaxed bg-slate-50 p-1.5 rounded-lg border border-slate-200/70 mb-1">
                <strong className="text-slate-900">ملاحظات وتعليمات:</strong> {notes}
              </p>
            )}

            {/* Branches & Clinic Phone Numbers & Working Hours (No Doctor Signature, No 'الفرع الرئيسي') */}
            <div className="border-t border-slate-200/90 pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-[9.5px] sm:text-[10px] text-slate-600 font-semibold w-full">
              {branches && branches.length > 0 ? (
                branches.map((b, idx) => (
                  <div key={b.id || idx} className="flex items-center gap-2 flex-wrap justify-center">
                    {(b.address || clinic.address) && (
                      <span>📍 {b.address || clinic.address}</span>
                    )}
                    {(b.phone || clinic.phone) && (
                      <span className="font-mono font-bold text-slate-800" dir="ltr">📞 {b.phone || clinic.phone}</span>
                    )}
                    {(b.workingHours || clinic.workingHours) && (
                      <span>🕒 {b.workingHours || clinic.workingHours}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  {(clinic.address || activeBranch?.address) && (
                    <span>📍 {clinic.address || activeBranch?.address}</span>
                  )}
                  {(clinic.phone || activeBranch?.phone) && (
                    <span className="font-mono font-bold text-slate-800" dir="ltr">
                      📞 {clinic.phone || activeBranch?.phone}
                    </span>
                  )}
                  {(clinic.workingHours || activeBranch?.workingHours) && (
                    <span>🕒 {clinic.workingHours || activeBranch?.workingHours}</span>
                  )}
                </div>
              )}
            </div>

            {/* Sentence: نتمنى لكم الشفاء العاجل (directly above the bottom border line) */}
            <div className="text-center w-full pt-0.5 pb-0.5">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                {clinic.footerText || "نتمنى لكم الشفاء العاجل ودوام الصحة والعافية"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
