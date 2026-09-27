"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
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
} from "lucide-react";
import { useClinicStore } from "@/store/useClinicStore";
import { PrescriptionItem, PatientInfo } from "@/store/usePrescriptionStore";

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
  const printAreaRef = useRef<HTMLDivElement>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const currentDate = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-100">المعاينة الحية للروشتة</h4>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">{prescriptionNo}</span>
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

      {/* The Printable Prescription Sheet (White clean canvas for crisp print output) */}
      <div
        ref={printAreaRef}
        id="prescription-print-sheet"
        className="bg-white text-slate-900 rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-200 min-h-[700px] flex flex-col justify-between relative overflow-hidden"
        dir="rtl"
      >
        {/* Clinic & Doctor Header */}
        <div className="border-b-2 border-emerald-700/30 pb-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            {/* Doctor Info */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-emerald-900 font-serif">
                {clinic.doctorName}
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-700">{clinic.doctorTitle}</p>
              <p className="text-xs font-semibold text-emerald-700">{clinic.specialty}</p>
              {clinic.syndicateId && (
                <p className="text-[11px] text-slate-500 font-mono">ترخيص نقابة: {clinic.syndicateId}</p>
              )}
            </div>

            {/* Logo */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-300 shadow-md shrink-0">
              <Image
                src="/logo-penrx.jpg"
                alt="Clinic Logo"
                fill
                priority
                className="object-cover"
              />
            </div>

            {/* Clinic Info */}
            <div className="text-left space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900">{clinic.nameAr}</h3>
              <p className="text-xs font-bold text-slate-600">{activeBranch?.nameAr}</p>
              <p className="text-[11px] text-slate-500">{activeBranch?.phone}</p>
              <p className="text-[11px] text-slate-500">{activeBranch?.address}</p>
            </div>
          </div>
        </div>

        {/* Patient Bar */}
        <div className="my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
          <div>
            <span className="text-slate-400 block text-[10px]">اسم المريض:</span>
            <span className="text-slate-900 text-sm font-black">{patient.name || "—"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">السن / الجنس:</span>
            <span className="text-slate-800">
              {patient.age ? `${patient.age} سنة` : "—"} / {patient.gender === "FEMALE" ? "أنثى" : "ذكر"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">التاريخ:</span>
            <span className="text-slate-800">{currentDate}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">رقم الروشتة:</span>
            <span className="text-emerald-700 font-mono font-black">{prescriptionNo}</span>
          </div>
        </div>

        {/* Diagnosis Note if present */}
        {diagnosis && (
          <div className="mb-4 text-xs font-bold text-slate-700 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-emerald-800 font-black">التشخيص الطبي (Diagnosis): </span>
            <span>{diagnosis}</span>
          </div>
        )}

        {/* Rx Symbol & Medication Items List */}
        <div className="flex-1 space-y-4 py-2">
          <div className="flex items-center gap-2 text-emerald-800 border-b border-emerald-100 pb-2">
            <span className="font-serif font-black text-3xl italic tracking-wider">℞</span>
            <span className="text-xs font-extrabold text-slate-600">العلاج الدوائي والجرعات المحددة</span>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-bold space-y-2">
              <HeartPulse className="w-8 h-8 text-slate-300 mx-auto" />
              <p>لم يتم إضافة أي أدوية للروشتة بعد. استخدم محرك البحث بالأعلى لإدراج الأدوية.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-emerald-400 transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-800 text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm font-sans tracking-wide">
                        {item.drugName}
                      </h4>
                      {item.activeIngredient && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({item.activeIngredient})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-emerald-800 font-bold pr-7">
                      <span className="bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {item.doseQuantity} {item.doseForm}
                      </span>
                      <span>•</span>
                      <span>{item.frequency}</span>
                      <span>•</span>
                      <span className="text-slate-600 font-medium">{item.duration}</span>
                    </div>

                    {item.instructions && (
                      <p className="text-[11px] text-slate-600 italic pr-7 font-medium">
                        ملاحظات: {item.instructions}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="حذف هذا الدواء"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Notes, Signature, QR Code */}
        <div className="border-t-2 border-slate-200 pt-4 mt-6 flex flex-wrap items-end justify-between gap-4 text-xs">
          {/* Notes & Verification */}
          <div className="space-y-2 max-w-sm">
            {notes && (
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                <strong>تعليمات إضافية:</strong> {notes}
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-medium">
              {clinic.footerText || "نتمنى لكم الشفاء العاجل والدوام بالصحة والعافية"}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex items-center gap-3">
            <div className="p-1 bg-white border border-slate-300 rounded-xl shadow-sm">
              <QRCodeSVG
                value={`https://penrx.plus/rx/${prescriptionNo}`}
                size={54}
                level="M"
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
              <span>مسح للتحقق الرقمي</span>
              <span className="block text-slate-600 font-bold">{prescriptionNo}</span>
            </div>
          </div>

          {/* Doctor Signature Block */}
          <div className="text-center space-y-1 min-w-[120px]">
            <span className="text-[11px] text-slate-400 block font-medium">توقيع وخاتم الطبيب:</span>
            <div className="h-10 border-b border-dashed border-slate-400" />
            <span className="text-[10px] font-bold text-slate-700">{clinic.doctorName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
