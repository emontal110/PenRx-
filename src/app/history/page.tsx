"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Search,
  User,
  Phone,
  Calendar,
  FileText,
  Printer,
  MessageCircle,
  Trash2,
  Edit2,
  Filter,
  ArrowRight,
  HeartPulse,
} from "lucide-react";
import { usePrescriptionStore, SavedPrescription } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";

export default function HistoryPage() {
  const router = useRouter();
  const { savedPrescriptions, deleteSavedPrescription, loadPrescriptionToEdit } = usePrescriptionStore();
  const { clinic } = useClinicStore();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = savedPrescriptions.filter((rx) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = rx.patient.name.toLowerCase().includes(q);
    const phoneMatch = rx.patient.phone?.includes(q);
    const noMatch = rx.prescriptionNo.toLowerCase().includes(q);
    const diagMatch = rx.diagnosis?.toLowerCase().includes(q);
    const drugMatch = rx.items.some((it) => it.drugName.toLowerCase().includes(q));
    return nameMatch || phoneMatch || noMatch || diagMatch || drugMatch;
  });

  const handleShareWhatsApp = (rx: SavedPrescription) => {
    const phone = rx.patient.phone?.replace(/[^0-9]/g, "") || "";
    const cleanPhone = phone.startsWith("20") ? phone : `20${phone.replace(/^0+/, "")}`;
    const itemsText = rx.items
      .map((it, idx) => `${idx + 1}. *${it.drugName}* (${it.doseQuantity} ${it.doseForm}) - ${it.frequency}`)
      .join("\n");

    const message = `مرحباً أستاذ/ة *${rx.patient.name}*،\n\nإليك تفاصيل الروشتة الطبية السابقة من عيادة *${clinic.doctorName}*:\n\n*رقم الروشتة:* ${rx.prescriptionNo}\n*التاريخ:* ${new Date(rx.createdAt).toLocaleDateString("ar-EG")}\n\n*الأدوية المقررة:*\n${itemsText}\n\n${rx.notes ? `*ملاحظات:* ${rx.notes}\n\n` : ""}مع تمنياتنا لكم بالصحة والعافية دائماً 🌹`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleEditAndReissue = (rx: SavedPrescription) => {
    loadPrescriptionToEdit(rx);
    router.push("/prescriptions/new");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-md">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              سجل الروشتات والمرضى
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              أرشيف شامل بجميع الروشتات المحررة، البحث السريع، الطباعة وإعادة الإرسال عبر الواتساب
            </p>
          </div>
        </div>

        <Link
          href="/prescriptions/new"
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all flex items-center gap-2"
        >
          <span>كتابة روشتة جديدة ✍️</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-4 top-3.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث باسم المريض، رقم الهاتف، رقم الروشتة، اسم الدواء، أو التشخيص..."
          className="w-full pr-11 pl-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
        />
      </div>

      {/* Prescriptions List / Cards */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <HeartPulse className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-400">
            {searchQuery ? "لا توجد نتائج مطابقة لبحثك." : "السجل فارغ حالياً."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((rx) => (
            <div
              key={rx.id}
              className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 shadow-xl flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header card */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="font-black text-slate-100 text-base">{rx.patient.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <span>{rx.patient.age ? `${rx.patient.age} سنة` : "غير محدد"}</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-400">{rx.patient.phone || "بدون هاتف"}</span>
                    </div>
                  </div>

                  <span className="font-mono text-[10px] font-black text-emerald-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    {rx.prescriptionNo}
                  </span>
                </div>

                {/* Diagnosis */}
                {rx.diagnosis && (
                  <p className="text-xs text-slate-300 font-medium bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                    <strong className="text-emerald-400">التشخيص:</strong> {rx.diagnosis}
                  </p>
                )}

                {/* Drugs Items List */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    الأدوية ({rx.items.length}):
                  </span>
                  <div className="space-y-1">
                    {rx.items.slice(0, 4).map((it, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-slate-300 flex items-center justify-between gap-2 bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-800/40"
                      >
                        <span className="font-bold truncate">{it.drugName}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {it.doseQuantity} {it.doseForm}
                        </span>
                      </div>
                    ))}
                    {rx.items.length > 4 && (
                      <p className="text-[10px] text-emerald-400 font-bold text-left">
                        +{rx.items.length - 4} أصناف أخرى...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(rx.createdAt).toLocaleDateString("ar-EG")}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(rx)}
                    className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all cursor-pointer"
                    title="مشاركة عبر الواتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEditAndReissue(rx)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                    title="تعديل وإعادة إصدار الروشتة"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذه الروشتة من السجل؟")) {
                        deleteSavedPrescription(rx.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 transition-all cursor-pointer"
                    title="حذف الروشتة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
