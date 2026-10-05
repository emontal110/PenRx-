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
  X,
  AlertTriangle,
  Cloud,
  RefreshCw,
  CheckCircle2,
  WifiOff,
  Archive,
  ArchiveRestore,
  FolderArchive,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { usePrescriptionStore, SavedPrescription } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { NewRxGuard } from "@/components/prescription/NewRxGuard";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { normalizeWhatsAppNumber } from "@/components/prescription/WhatsAppShareModal";

export default function HistoryPage() {
  const router = useRouter();
  const {
    savedPrescriptions,
    deleteSavedPrescription,
    loadPrescriptionToEdit,
    syncWithCloud,
    cleanExpiredCache,
    toggleArchivePrescription,
    archivePrescriptionsForYear,
  } = usePrescriptionStore();
  const { clinic } = useClinicStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [rxToDelete, setRxToDelete] = useState<SavedPrescription | null>(null);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline" | "idle">("idle");
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Tab & Archiving state
  const [viewTab, setViewTab] = useState<"active" | "archived">("active");
  const [selectedYear, setSelectedYear] = useState<number | "ALL">("ALL");

  // Auto clean cache and pull cloud sync on mount
  React.useEffect(() => {
    cleanExpiredCache();
    syncWithCloud();

    const handleSyncStatus = (e: any) => {
      if (e.detail?.status) {
        setSyncStatus(e.detail.status);
      }
    };

    window.addEventListener("penrx_sync_status", handleSyncStatus);
    return () => {
      window.removeEventListener("penrx_sync_status", handleSyncStatus);
    };
  }, [cleanExpiredCache, syncWithCloud]);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncWithCloud();
      cleanExpiredCache();
      showGlobalToast("☁️ تم تحديث ومزامنة الروشتات سحابياً بنجاح", "success");
    } catch {
      showGlobalToast("⚠️ تعذر الاتصال بالسحابة حالياً، البيانات محفوظة محلياً", "info");
    } finally {
      setIsManualSyncing(false);
    }
  };

  const activePrescriptions = savedPrescriptions.filter((rx) => !rx.isArchived);
  const archivedPrescriptions = savedPrescriptions.filter((rx) => rx.isArchived);

  // Get unique years across all prescriptions
  const availableYears = Array.from(
    new Set(
      savedPrescriptions
        .map((rx) => new Date(rx.createdAt).getFullYear())
        .filter((y) => !isNaN(y) && y > 2000)
    )
  ).sort((a, b) => b - a);

  const displayedList = (viewTab === "active" ? activePrescriptions : archivedPrescriptions).filter((rx) => {
    if (viewTab === "archived" && selectedYear !== "ALL") {
      const rxYear = new Date(rx.createdAt).getFullYear();
      if (rxYear !== selectedYear) return false;
    }
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
    const cleanPhone = normalizeWhatsAppNumber(rx.patient.phone || "");
    if (!cleanPhone) {
      showGlobalToast("⚠️ لا يوجد رقم هاتف مسجل للمريض لإرسال الواتساب", "error");
      return;
    }
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

  const handleToggleArchive = (rx: SavedPrescription) => {
    const willArchive = !rx.isArchived;
    toggleArchivePrescription(rx.id);
    if (willArchive) {
      showGlobalToast(`🗄️ تم نقل روشتة ${rx.patient.name} إلى الأرشيف السنوي بنجاح`, "info");
    } else {
      showGlobalToast(`↩️ تم استعادة روشتة ${rx.patient.name} إلى السجل النشط`, "success");
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-md">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100">
                سجل الروشتات والمرضى
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Cloud className="w-3 h-3" />
                <span>حفظ سنوي (365 يوماً) + أرشفة</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة علائقية متقدمة مع إمكانية أرشفة الروشتات سنوياً وحفظها دائماً دون استهلاك سعة التخزين النشطة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="تحديث ومزامنة الروشتات سحابياً"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isManualSyncing || syncStatus === "syncing" ? "animate-spin" : ""}`} />
            <span>مزامنة سحابية</span>
          </button>

          <NewRxGuard>
            <Link
              href="/prescriptions/new"
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition-all flex items-center gap-2"
            >
              <span>كتابة روشتة جديدة ✍️</span>
            </Link>
          </NewRxGuard>
        </div>
      </div>

      {/* Tabs Switcher: Active vs Archive */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab("active")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewTab === "active"
                ? "bg-emerald-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>الروشتات النشطة</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              viewTab === "active" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {activePrescriptions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab("archived")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              viewTab === "archived"
                ? "bg-teal-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>الأرشيف السنوي</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              viewTab === "archived" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {archivedPrescriptions.length}
            </span>
          </button>
        </div>

        {/* Year Pills (Visible when in Archive tab) */}
        {viewTab === "archived" && availableYears.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold ml-1">تصفية بالسنة:</span>
            <button
              type="button"
              onClick={() => setSelectedYear("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                selectedYear === "ALL"
                  ? "bg-teal-500 text-slate-950 font-black"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              الكل
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  selectedYear === yr
                    ? "bg-teal-500 text-slate-950 font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
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
      {displayedList.length === 0 ? (
        <div className="p-12 sm:p-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 max-w-xl mx-auto my-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            {viewTab === "archived" ? <Archive className="w-8 h-8 text-teal-400" /> : <HeartPulse className="w-8 h-8" />}
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-slate-100">
              {searchQuery
                ? "لا توجد نتائج مطابقة للبحث"
                : viewTab === "archived"
                ? "الأرشيف السنوي فارغ حالياً"
                : "سجل الروشتات النشطة فارغ حالياً"}
            </h3>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              {searchQuery
                ? "تأكد من كتابة اسم المريض أو رقم الهاتف أو رقم الروشتة بشكل صحيح."
                : viewTab === "archived"
                ? "يمكنك أرشفة الروشتات الطبية القديمة بضغطة زر لحفظها للأبد مع الحفاظ على خفة وسرعة السجل النشط."
                : "أهلاً بك في PenRX+! لم يتم تسجيل أي روشتات بعد. بمجرد كتابة وحفظ أول روشتة، سيتم حفظها محلياً وعلائقياً ومزامنتها سحابياً تلقائياً مع كافة أجهزتك المعتمدة."}
            </p>
          </div>
          {!searchQuery && viewTab === "active" && (
            <div className="pt-2">
              <NewRxGuard>
                <Link
                  href="/prescriptions/new"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <span>كتابة أول روشتة الآن ✍️</span>
                </Link>
              </NewRxGuard>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedList.map((rx) => (
            <div
              key={rx.id}
              className={`p-5 rounded-3xl bg-slate-900/90 border transition-all space-y-4 shadow-xl flex flex-col justify-between group ${
                rx.isArchived
                  ? "border-teal-500/30 bg-gradient-to-b from-slate-900 to-slate-950/90"
                  : "border-slate-800 hover:border-emerald-500/40"
              }`}
            >
              <div className="space-y-3">
                {/* Header card */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-100 text-base">{rx.patient.name}</h3>
                      {rx.isArchived && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                          <Archive className="w-2.5 h-2.5" />
                          <span>مؤرشفة</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-0.5">
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
                  {/* WhatsApp */}
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(rx)}
                    className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all cursor-pointer"
                    title="مشاركة عبر الواتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit & Reissue */}
                  <button
                    type="button"
                    onClick={() => handleEditAndReissue(rx)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                    title="تعديل وإعادة إصدار الروشتة"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Toggle Archive */}
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(rx)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      rx.isArchived
                        ? "bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white border-teal-500/40"
                        : "bg-slate-800 hover:bg-teal-600/30 text-teal-400 border-slate-700"
                    }`}
                    title={rx.isArchived ? "استعادة من الأرشيف إلى السجل النشط" : "نقل إلى الأرشيف السنوي"}
                  >
                    {rx.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setRxToDelete(rx)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 transition-all cursor-pointer"
                    title="حذف الروشتة نهائياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Delete Confirmation Modal */}
      {rxToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 shadow-2xl shadow-rose-950/50 p-6 space-y-5 animate-in zoom-in-95 duration-200"
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-inner">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">حذف الروشتة من السجل</h3>
                  <p className="text-xs text-rose-400/90 font-medium">تحذير: هذا الإجراء نهائي ولا يمكن التراجع عنه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRxToDelete(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">اسم المريض:</span>
                <span className="font-black text-slate-100">{rxToDelete.patient.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">رقم الروشتة:</span>
                <span className="font-mono font-bold text-teal-400">#{rxToDelete.prescriptionNo}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">تاريخ الإصدار:</span>
                <span className="font-mono text-slate-300">
                  {new Date(rxToDelete.createdAt).toLocaleDateString("ar-EG")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">عدد الأدوية:</span>
                <span className="text-slate-300 font-semibold">{rxToDelete.items.length} صنف</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const patientName = rxToDelete.patient.name;
                  deleteSavedPrescription(rxToDelete.id);
                  setRxToDelete(null);
                  showGlobalToast(`🗑️ تم حذف روشتة (${patientName}) بنجاح من السجل`, "info");
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، حذف الروشتة</span>
              </button>
              <button
                type="button"
                onClick={() => setRxToDelete(null)}
                className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
