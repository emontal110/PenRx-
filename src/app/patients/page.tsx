"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Plus,
  Phone,
  Calendar,
  FileText,
  HeartPulse,
  AlertTriangle,
  ArrowRight,
  Filter,
  UserPlus,
  CheckCircle2,
  Stethoscope,
  Activity,
} from "lucide-react";
import { usePrescriptionStore, PatientInfo } from "@/store/usePrescriptionStore";
import { UnifiedPatientRecord } from "@/lib/patientRegistry";
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge, Modal } from "@/components/ui";
import { showGlobalToast } from "@/components/common/GlobalToast";

export default function PatientsPage() {
  const router = useRouter();
  const {
    getUnifiedPatients,
    savedPrescriptions,
    setPatient,
    resetCurrentPrescription,
  } = usePrescriptionStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [selectedPatient, setSelectedPatient] = useState<UnifiedPatientRecord | null>(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

  // New patient quick form state
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientAge, setNewPatientAge] = useState("");
  const [newPatientGender, setNewPatientGender] = useState<"MALE" | "FEMALE">("MALE");
  const [newPatientAllergies, setNewPatientAllergies] = useState("");
  const [newPatientHistory, setNewPatientHistory] = useState("");

  const patientsList: UnifiedPatientRecord[] = useMemo(() => {
    return getUnifiedPatients();
  }, [getUnifiedPatients]);

  const filteredPatients = useMemo(() => {
    return patientsList.filter((p) => {
      if (genderFilter !== "ALL" && p.gender !== genderFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const nameMatch = p.name?.toLowerCase().includes(q);
      const phoneMatch = p.phone?.includes(q);
      const ageMatch = String(p.age || "").includes(q);
      const historyMatch = p.medicalHistory?.toLowerCase().includes(q);
      const allergyMatch = p.allergyNotes?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || ageMatch || historyMatch || allergyMatch;
    });
  }, [patientsList, searchQuery, genderFilter]);

  const handleStartPrescriptionForPatient = (patient: UnifiedPatientRecord) => {
    resetCurrentPrescription();
    setPatient({
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
      height: patient.height,
      weight: patient.weight,
      bloodType: patient.bloodType,
      allergyNotes: patient.allergyNotes,
      medicalHistory: patient.medicalHistory,
    });
    showGlobalToast(`تم تحميل بيانات المريض (${patient.name}) لبدء الروشتة`, "success");
    router.push("/prescriptions/new");
  };

  const handleCreateNewPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      showGlobalToast("يرجى إدخال اسم المريض", "error");
      return;
    }

    resetCurrentPrescription();
    setPatient({
      name: newPatientName.trim(),
      phone: newPatientPhone.trim(),
      age: newPatientAge.trim(),
      gender: newPatientGender,
      allergyNotes: newPatientAllergies.trim(),
      medicalHistory: newPatientHistory.trim(),
    });

    setIsNewPatientModalOpen(false);
    showGlobalToast(`تم تسجيل بيانات المريض (${newPatientName.trim()}) والتحويل لكتابة الروشتة`, "success");
    router.push("/prescriptions/new");
  };

  // Get prescriptions history for selected patient
  const patientPrescriptions = useMemo(() => {
    if (!selectedPatient) return [];
    return savedPrescriptions.filter(
      (rx) =>
        (selectedPatient.id && rx.patient.id === selectedPatient.id) ||
        (selectedPatient.phone && rx.patient.phone === selectedPatient.phone) ||
        (selectedPatient.name && rx.patient.name.trim() === selectedPatient.name.trim())
    );
  }, [selectedPatient, savedPrescriptions]);

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-md">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              سجل المرضى الموحد
              <Badge variant="brand" className="text-xs">
                {patientsList.length} مريض
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              بيانات المرضى والسجل الطبي
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsNewPatientModalOpen(true)}
          className="gap-2"
          size="md"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة مريض جديد</span>
        </Button>
      </div>

      {/* Statistics Quick Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">إجمالي المرضى</span>
            <Users className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{patientsList.length}</div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">الذكور</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 mt-2">
            {patientsList.filter((p) => p.gender === "MALE").length}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">الإناث</span>
            <Activity className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-black text-pink-300 mt-2">
            {patientsList.filter((p) => p.gender === "FEMALE").length}
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">بحاجة متابعة خاصة</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-2">
            {patientsList.filter((p) => p.allergyNotes || p.medicalHistory).length}
          </div>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم، رقم الهاتف، السن، أو السجل المرضي..."
            className="pr-10"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setGenderFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              genderFilter === "ALL"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            الكل ({patientsList.length})
          </button>
          <button
            onClick={() => setGenderFilter("MALE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              genderFilter === "MALE"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ذكور ({patientsList.filter((p) => p.gender === "MALE").length})
          </button>
          <button
            onClick={() => setGenderFilter("FEMALE")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              genderFilter === "FEMALE"
                ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            إناث ({patientsList.filter((p) => p.gender === "FEMALE").length})
          </button>
        </div>
      </div>

      {/* Patients Grid / List */}
      {filteredPatients.length === 0 ? (
        <Card className="text-center py-16 px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">لا يوجد مرضى مطابقين للبحث</h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            {searchQuery
              ? `لم نعثر على أي مريض يطابق "${searchQuery}". تأكد من صحة الاسم أو رقم الهاتف.`
              : "لا يوجد مرضى مسجلون بعد."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => setIsNewPatientModalOpen(true)}>
              <UserPlus className="w-4 h-4" />
              <span>إضافة مريض جديد الآن</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => (
            <Card
              key={patient.id}
              className="p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between group hover:shadow-2xl"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                        patient.gender === "FEMALE"
                          ? "bg-pink-500/10 text-pink-400 border-pink-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      }`}
                    >
                      {patient.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {patient.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 font-medium">
                        <span>{patient.gender === "FEMALE" ? "أنثى" : "ذكر"}</span>
                        {patient.age && <span>• {patient.age} سنة</span>}
                        {patient.bloodType && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            {patient.bloodType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[11px] shrink-0 font-mono">
                    {patient.prescriptionCount || 0} روشتة
                  </Badge>
                </div>

                {/* Patient details strip */}
                <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/60 text-xs">
                  {patient.phone ? (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span dir="ltr" className="font-mono text-slate-200">
                        {patient.phone}
                      </span>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-[11px]">لا يوجد هاتف مسجل</div>
                  )}

                  {patient.allergyNotes && (
                    <div className="flex items-center gap-1.5 text-rose-300 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span className="truncate">حساسية: {patient.allergyNotes}</span>
                    </div>
                  )}

                  {patient.medicalHistory && (
                    <div className="flex items-center gap-1.5 text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                      <HeartPulse className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">أمراض: {patient.medicalHistory}</span>
                    </div>
                  )}

                  {patient.lastDiagnosis && (
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Stethoscope className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span className="truncate">آخر تشخيص: {patient.lastDiagnosis}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedPatient(patient)}
                  className="flex-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>السجل الطبي</span>
                </Button>

                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => handleStartPrescriptionForPatient(patient)}
                  className="flex-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>روشتة جديدة</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Patient Detailed Drawer / Modal */}
      <Modal
        isOpen={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        title={
          selectedPatient ? (
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-teal-400" />
              <span>الملف الطبي للمريض: {selectedPatient.name}</span>
            </div>
          ) : null
        }
        description="السجل المرضي الشامل وتاريخ الروشتات السابقة"
        maxWidth="2xl"
      >
        {selectedPatient && (
          <div className="space-y-5">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block">السن / النوع</span>
                <span className="text-sm font-bold text-slate-200">
                  {selectedPatient.age || "غير محدد"} سنة / {selectedPatient.gender === "FEMALE" ? "أنثى" : "ذكر"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">الهاتف</span>
                <span dir="ltr" className="text-sm font-mono font-bold text-slate-200">
                  {selectedPatient.phone || "—"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">فصيلة الدم</span>
                <span className="text-sm font-bold text-emerald-400">
                  {selectedPatient.bloodType || "غير محدد"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">إجمالي الروشتات</span>
                <span className="text-sm font-bold text-teal-400">
                  {patientPrescriptions.length}
                </span>
              </div>
            </div>

            {/* Medical Warnings */}
            {(selectedPatient.allergyNotes || selectedPatient.medicalHistory) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedPatient.allergyNotes && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300">
                    <span className="font-bold text-xs flex items-center gap-1.5 mb-1 text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      تنبيه الحساسية الدوائية:
                    </span>
                    <p className="text-xs leading-relaxed">{selectedPatient.allergyNotes}</p>
                  </div>
                )}
                {selectedPatient.medicalHistory && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
                    <span className="font-bold text-xs flex items-center gap-1.5 mb-1 text-amber-400">
                      <HeartPulse className="w-4 h-4 shrink-0" />
                      الأمراض المزمنة والتاريخ المرضي:
                    </span>
                    <p className="text-xs leading-relaxed">{selectedPatient.medicalHistory}</p>
                  </div>
                )}
              </div>
            )}

            {/* Previous Prescriptions History */}
            <div>
              <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                الروشتات الطبية السابقة لهذا المريض ({patientPrescriptions.length})
              </h4>

              {patientPrescriptions.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                  لم يتم إصدار أي روشتة لهذا المريض بعد.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {patientPrescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200 flex items-center gap-2">
                          <span className="font-mono text-emerald-400">{rx.prescriptionNo}</span>
                          <span className="text-slate-400 font-normal">
                            {new Date(rx.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                        {rx.diagnosis && (
                          <div className="text-slate-400 mt-0.5">التشخيص: {rx.diagnosis}</div>
                        )}
                        <div className="text-slate-400 mt-0.5 text-[11px]">
                          {rx.items.length} أصناف دوائية (
                          {rx.items.map((i) => i.drugName).slice(0, 3).join("، ")}
                          {rx.items.length > 3 ? "..." : ""})
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setSelectedPatient(null);
                          usePrescriptionStore.getState().loadPrescriptionToEdit(rx);
                          router.push("/prescriptions/new");
                        }}
                      >
                        إعادة إصدار
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setSelectedPatient(null)}>
                إغلاق
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const p = selectedPatient;
                  setSelectedPatient(null);
                  handleStartPrescriptionForPatient(p);
                }}
              >
                <Plus className="w-4 h-4" />
                <span>كتابة روشتة جديدة لهذا المريض</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Patient Registration Modal */}
      <Modal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-slate-100">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <span>تسجيل مريض جديد</span>
          </div>
        }
        description="بيانات المريض الأساسية"
        maxWidth="md"
      >
        <form onSubmit={handleCreateNewPatient} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              اسم المريض <span className="text-rose-400">*</span>
            </label>
            <Input
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              placeholder="مثال: أحمد محمد علي"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">السن</label>
              <Input
                value={newPatientAge}
                onChange={(e) => setNewPatientAge(e.target.value)}
                placeholder="مثال: 35"
                type="number"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">النوع</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewPatientGender("MALE")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    newPatientGender === "MALE"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => setNewPatientGender("FEMALE")}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    newPatientGender === "FEMALE"
                      ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  أنثى
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">رقم الهاتف (واتساب)</label>
            <Input
              value={newPatientPhone}
              onChange={(e) => setNewPatientPhone(e.target.value)}
              placeholder="010XXXXXXXX"
              type="tel"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">حساسية الأدوية (اختياري)</label>
            <Input
              value={newPatientAllergies}
              onChange={(e) => setNewPatientAllergies(e.target.value)}
              placeholder="مثال: حساسية بنسلين، سلفا..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">التاريخ المرضي / أمراض مزمنة (اختياري)</label>
            <Input
              value={newPatientHistory}
              onChange={(e) => setNewPatientHistory(e.target.value)}
              placeholder="مثال: ضغط، سكري، ربو..."
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsNewPatientModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary">
              <CheckCircle2 className="w-4 h-4" />
              <span>حفظ وبدء الروشتة</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
