"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Sparkles,
  Star,
  UserCheck,
  Stethoscope,
  Pill,
} from "lucide-react";
import { useClinicStore, Branch } from "@/store/useClinicStore";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { showGlobalToast } from "@/components/common/GlobalToast";
import { registerCustomDrug } from "@/lib/offlineDrugStorage";
import { SettingsPrescriptionPreview } from "./SettingsPrescriptionPreview";

interface CustomDrugItem {
  id: string;
  name: string;
  nameAr?: string;
  activeIngredient?: string;
  dosageForm?: string;
  company?: string;
  price?: number;
}

export function DrugsAndBranchesSettings() {
  const {
    clinic,
    updateClinic,
    branches,
    addBranch,
    updateBranch,
    deleteBranch,
    activeBranchId,
    setActiveBranchId,
    setDefaultBranch,
  } = useClinicStore();

  const { visibleFields, toggleVisibleField, setVisibleFields } = usePrescriptionStore();

  // Branch state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(branches.length === 0);
  const [branchName, setBranchName] = useState("");
  const [branchNameAr, setBranchNameAr] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchWorkingHours, setBranchWorkingHours] = useState("");

  // Custom Drugs Bank state
  const [customDrugs, setCustomDrugs] = useState<CustomDrugItem[]>([]);
  const [newDrugName, setNewDrugName] = useState("");
  const [newDrugActiveIng, setNewDrugActiveIng] = useState("");
  const [newDrugForm, setNewDrugForm] = useState("Tablet (أقراص)");
  const [newDrugCompany, setNewDrugCompany] = useState("");
  const [newDrugPrice, setNewDrugPrice] = useState("");

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  // Load active branch into local fields
  useEffect(() => {
    if (activeBranch && !isAddingNew) {
      setBranchName(activeBranch.name || "");
      setBranchNameAr(activeBranch.nameAr || "");
      setBranchAddress(activeBranch.address || "");
      setBranchPhone(activeBranch.phone || "");
      setBranchWorkingHours(activeBranch.workingHours || "");
    }
  }, [activeBranch, isAddingNew]);

  // Load custom drugs from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("penrx_custom_drugs");
        if (raw) {
          const list: CustomDrugItem[] = JSON.parse(raw);
          setCustomDrugs(list);
          // Register them in search engine memory
          list.forEach((d) => {
            registerCustomDrug({
              name: d.name,
              nameAr: d.nameAr,
              activeIngredient: d.activeIngredient,
              dosageForm: d.dosageForm,
              company: d.company,
              price: d.price,
            });
          });
        }
      } catch (err) {
        console.error("Error loading custom drugs:", err);
      }
    }
  }, []);

  const handleSelectBranch = (bId: string) => {
    setActiveBranchId(bId);
    setIsAddingNew(false);
    const target = branches.find((b) => b.id === bId);
    if (target) {
      setBranchName(target.name || "");
      setBranchNameAr(target.nameAr || "");
      setBranchAddress(target.address || "");
      setBranchPhone(target.phone || "");
      setBranchWorkingHours(target.workingHours || "");
    }
  };

  const handleSaveBranch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!branchNameAr.trim() && !branchName.trim()) {
      showGlobalToast("⚠️ يرجى إدخال اسم الفرع", "error");
      return;
    }

    if (isAddingNew || branches.length === 0) {
      const newId = addBranch({
        name: branchName.trim() || branchNameAr.trim(),
        nameAr: branchNameAr.trim() || branchName.trim(),
        address: branchAddress.trim(),
        phone: branchPhone.trim(),
        workingHours: branchWorkingHours.trim(),
        isDefault: branches.length === 0,
      });
      setActiveBranchId(newId);
      setIsAddingNew(false);
      showGlobalToast("🏥 تم إنشاء وحفظ الفرع الجديد بنجاح!", "success");
    } else if (activeBranchId) {
      updateBranch(activeBranchId, {
        name: branchName.trim(),
        nameAr: branchNameAr.trim(),
        address: branchAddress.trim(),
        phone: branchPhone.trim(),
        workingHours: branchWorkingHours.trim(),
      });
      showGlobalToast("✅ تم تحديث بيانات الفرع بنجاح!", "success");
    }
  };

  const handleApplyPreset = (preset: "standard" | "full" | "pediatric") => {
    if (preset === "standard") {
      const next = {
        showAge: false,
        showGender: false,
        showHeight: false,
        showWeight: false,
        showBloodType: false,
        showDiagnosis: true,
        showMedicalHistory: false,
        showAllergies: false,
      };
      setVisibleFields(next);
      updateClinic({ visibleFields: next });
      showGlobalToast("✅ تم تطبيق الوضع القياسي (التشخيص الطبي فقط) بنجاح!", "success");
    } else if (preset === "full") {
      const next = {
        showAge: true,
        showGender: true,
        showHeight: true,
        showWeight: true,
        showBloodType: true,
        showDiagnosis: true,
        showMedicalHistory: true,
        showAllergies: true,
      };
      setVisibleFields(next);
      updateClinic({ visibleFields: next });
      showGlobalToast("✅ تم تفعيل كافة حقول المريض (الوضع الشامل) وتطبيقها فوراً!", "success");
    } else if (preset === "pediatric") {
      const next = {
        showAge: true,
        showGender: true,
        showHeight: true,
        showWeight: true,
        showBloodType: false,
        showDiagnosis: true,
        showMedicalHistory: true,
        showAllergies: true,
      };
      setVisibleFields(next);
      updateClinic({ visibleFields: next });
      showGlobalToast("✅ تم تطبيق وضع الأطفال والباطنة (السن والوزن والتاريخ والحساسية)!", "success");
    }
  };

  const handleAddCustomDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName.trim()) {
      showGlobalToast("⚠️ يرجى كتابة اسم الدواء أو التركيبة", "error");
      return;
    }

    const newItem: CustomDrugItem = {
      id: `custom_${Date.now()}`,
      name: newDrugName.trim(),
      activeIngredient: newDrugActiveIng.trim() || "تركيبة طبية خاصة",
      dosageForm: newDrugForm,
      company: newDrugCompany.trim() || "تركيبة عيادة خاصة",
      price: parseFloat(newDrugPrice) || 0,
    };

    const updated = [newItem, ...customDrugs];
    setCustomDrugs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("penrx_custom_drugs", JSON.stringify(updated));
    }

    registerCustomDrug({
      name: newItem.name,
      activeIngredient: newItem.activeIngredient,
      dosageForm: newItem.dosageForm,
      company: newItem.company,
      price: newItem.price,
    });

    setNewDrugName("");
    setNewDrugActiveIng("");
    setNewDrugCompany("");
    setNewDrugPrice("");
    showGlobalToast("💊 تم إضافة الدواء المخصص لبنك أدوية العيادة ومحرك البحث بنجاح!", "success");
  };

  const handleDeleteCustomDrug = (id: string) => {
    const updated = customDrugs.filter((d) => d.id !== id);
    setCustomDrugs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("penrx_custom_drugs", JSON.stringify(updated));
    }
    showGlobalToast("🗑️ تم حذف الدواء من بنك الأدوية المخصصة", "info");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Right Column: Branch & Patient Fields (7 Cols on Desktop) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Branch Control Bar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <Building2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-slate-100">
                    إدارة فروع المركز والعيادات
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-950 text-emerald-400 border border-emerald-500/30">
                    {branches.length} {branches.length === 1 ? "فرع مسجل" : "فروع مسجلة"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  أضف فروع عيادتك وخصص عنوان وهاتف ومواعيد كل فرع على الروشتة المطبوعة.
                </p>
              </div>
            </div>

            {isAddingNew && (
              <div className="self-start sm:self-auto">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>وضع إضافة فرع جديد</span>
                </span>
              </div>
            )}
          </div>

          {/* Select Branch & Actions */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <select
                  value={activeBranchId}
                  onChange={(e) => handleSelectBranch(e.target.value)}
                  disabled={branches.length === 0}
                  className="w-full h-11 pr-10 pl-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-700/80 text-xs sm:text-sm font-bold text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer appearance-none truncate transition-colors shadow-inner"
                >
                  {branches.length === 0 ? (
                    <option value="">(لا توجد فروع مسجلة - اكتب البيانات أدناه لحفظ أول فرع)</option>
                  ) : (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.isDefault ? "⭐ " : ""}{b.nameAr || b.name || "فرع بدون اسم"} {b.address ? `• ${b.address}` : ""}
                      </option>
                    ))
                  )}
                </select>
                <Building2 className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>

              {branches.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeBranchId) {
                      setDefaultBranch(activeBranchId);
                      showGlobalToast("⭐ تم تعيين هذا الفرع كفرع افتراضي للروشتات بنجاح!", "success");
                    }
                  }}
                  className={`h-11 w-11 rounded-2xl border transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-95 ${
                    activeBranch?.isDefault
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-md shadow-amber-950/30"
                      : "bg-slate-950 border-slate-700/80 text-slate-400 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/10"
                  }`}
                  title={activeBranch?.isDefault ? "هذا هو الفرع الافتراضي حالياً للروشتات" : "اضغط هنا لتعيين هذا الفرع كفرع افتراضي"}
                >
                  <Star className={`w-4 h-4 ${activeBranch?.isDefault ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(true);
                  setBranchName("");
                  setBranchNameAr("");
                  setBranchAddress("");
                  setBranchPhone(clinic.phone || "");
                  setBranchWorkingHours("");
                  showGlobalToast("🏥 اكتب بيانات الفرع الجديد أدناه ثم انقر على حفظ الفرع.", "info");
                }}
                className="col-span-2 sm:col-span-1 h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إضافة فرع جديد</span>
              </button>

              {branches.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const branchToDelete = branches.find((b) => b.id === activeBranchId) || branches[0];
                    if (!branchToDelete) return;
                    if (confirm(`هل أنت متأكد من حذف فرع "${branchToDelete.nameAr || branchToDelete.name}"؟`)) {
                      deleteBranch(branchToDelete.id);
                      showGlobalToast("🗑️ تم حذف الفرع بنجاح.", "info");
                      if (branches.length <= 1) {
                        setIsAddingNew(true);
                      }
                    }
                  }}
                  className="h-10 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  title="حذف هذا الفرع"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الفرع</span>
                </button>
              )}
            </div>
          </div>

          {/* Branch Edit Form Fields */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">اسم الفرع بالعربية:</label>
                <input
                  type="text"
                  value={branchNameAr}
                  onChange={(e) => setBranchNameAr(e.target.value)}
                  placeholder="مثال: فرع التجمع الخامس"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">اسم الفرع بالإنجليزية:</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Fifth Settlement Branch"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 text-left shadow-inner"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-300 block">عنوان الفرع:</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="مثال: شارع التسعين الجنوبي، مجمع المروة الطبي، الدور الثاني"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">هاتف الفرع / الواتساب:</label>
                <input
                  type="tel"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="مثال: 01012345678"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500 text-left shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">مواعيد عمل الفرع:</label>
                <input
                  type="text"
                  value={branchWorkingHours}
                  onChange={(e) => setBranchWorkingHours(e.target.value)}
                  placeholder="مثال: يومياً من 5 إلى 11 مساءً"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveBranch}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isAddingNew ? "حفظ وإضافة الفرع الجديد 🏥" : "حفظ تعديلات الفرع الحالي 💾"}</span>
            </button>
          </div>
        </div>

        {/* Patient Fields Toggles Box */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-100">
                تخصيص حقول بيانات المريض في صفحة كتابة الروشتة
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حدد الحقول التي ترغب في ظهورها أثناء تحرير الروشتة. انظر للمعاينة الحية لرؤية التأثير فوراً:
              </p>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>تنسيقات سريعة جاهزة:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyPreset("standard")}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 border border-slate-700/80 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                الوضع القياسي (تشخيص فقط)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("pediatric")}
                className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                أطفال وباطنة (قياسات وحساسية)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("full")}
                className="px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-xs font-black transition-all cursor-pointer active:scale-95"
              >
                الوضع الشامل (جميع الحقول) 🌟
              </button>
            </div>
          </div>

          {/* Category 1: Demographics & Physical Vitals */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 border-b border-slate-800/80 pb-2">
              <span>👤 البيانات الشخصية والقياسات الحيوية للمريض:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">السن (Age):</span>
                  <span className="text-[11px] text-slate-400">إظهار حقل عمر المريض بالسنوات في الروشتة</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showAge}
                  onChange={() => toggleVisibleField("showAge")}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">الجنس (Gender):</span>
                  <span className="text-[11px] text-slate-400">إظهار خيار جنس المريض (ذكر / أنثى)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showGender}
                  onChange={() => toggleVisibleField("showGender")}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">الطول (Height):</span>
                  <span className="text-[11px] text-slate-400">إظهار حقل طول المريض بالسنتيمتر (سم)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showHeight}
                  onChange={() => toggleVisibleField("showHeight")}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">الوزن (Weight):</span>
                  <span className="text-[11px] text-slate-400">إظهار حقل وزن المريض بالكيلوجرام (كجم)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showWeight}
                  onChange={() => toggleVisibleField("showWeight")}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-all sm:col-span-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">فصيلة الدم (Blood Group):</span>
                  <span className="text-[11px] text-slate-400">إظهار قائمة فصائل الدم (A+, B+, O+, AB...)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showBloodType}
                  onChange={() => toggleVisibleField("showBloodType")}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Category 2: Clinical Diagnostic Records */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 border-b border-slate-800/80 pb-2">
              <span>🩺 التشخيص الطبي والسجل المرضي للمريض:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50 transition-all sm:col-span-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">التشخيص الطبي (Diagnosis):</span>
                  <span className="text-[11px] text-slate-400">إظهار مربع كتابة التشخيص الطبي المباشر في الروشتة</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showDiagnosis}
                  onChange={() => toggleVisibleField("showDiagnosis")}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-cyan-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-slate-100 block">الأمراض المزمنة والتاريخ الطبي:</span>
                  <span className="text-[11px] text-slate-400">إظهار حقل السجل المرضي المزمن (ضغط، سكري، ربو...)</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showMedicalHistory}
                  onChange={() => toggleVisibleField("showMedicalHistory")}
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-all">
                <div className="space-y-0.5">
                  <span className="font-bold text-xs text-amber-300 block">تنبيه حساسية الدواء (Drug Allergies):</span>
                  <span className="text-[11px] text-slate-400">إظهار مربع الحساسية الدوائية للتحذير أثناء وصف الدواء</span>
                </div>
                <input
                  type="checkbox"
                  checked={visibleFields.showAllergies}
                  onChange={() => toggleVisibleField("showAllergies")}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center gap-2 text-xs text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>تُحفظ وتُطبَّق هذه الإعدادات تلقائياً وفورياً على صفحة تحرير الروشتة والطباعة.</span>
          </div>
        </div>

        {/* Custom Drugs Bank Box */}
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-100">
                  بنك الأدوية والتركيبات المخصصة للعيادة
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  أضف أي أدوية خاصة أو تركيبات مخصصة لعيادتك لتظهر فوراً في الإكمال التلقائي ومحرك البحث.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-950 text-teal-400 border border-teal-500/30">
              {customDrugs.length} دواء مضاف
            </span>
          </div>

          {/* Add custom drug form */}
          <form onSubmit={handleAddCustomDrug} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">اسم الدواء التجاري أو التركيبة: *</label>
                <input
                  type="text"
                  required
                  value={newDrugName}
                  onChange={(e) => setNewDrugName(e.target.value)}
                  placeholder="مثال: Dermacort Special Cream"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">المادة الفعالة / المكونات:</label>
                <input
                  type="text"
                  value={newDrugActiveIng}
                  onChange={(e) => setNewDrugActiveIng(e.target.value)}
                  placeholder="مثال: Hydrocortisone 1% + Zinc Oxide"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">الشكل الدوائي:</label>
                <input
                  type="text"
                  value={newDrugForm}
                  onChange={(e) => setNewDrugForm(e.target.value)}
                  placeholder="مثال: Cream / Ointment / Syrup"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block">الشركة / الملاحظة:</label>
                <input
                  type="text"
                  value={newDrugCompany}
                  onChange={(e) => setNewDrugCompany(e.target.value)}
                  placeholder="مثال: تركيبة صيدلية العيادة"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 font-bold text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>إضافة الدواء لبنك الأدوية</span>
            </button>
          </form>

          {/* List of custom drugs */}
          {customDrugs.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {customDrugs.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-black text-slate-100 block truncate">{d.name}</span>
                    <span className="text-[11px] text-teal-400 block truncate">
                      {d.activeIngredient} • {d.dosageForm}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomDrug(d.id)}
                    className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                    title="حذف هذا الدواء"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Left Column: Live Prescription Preview (5 Cols on Desktop) */}
      <div className="lg:col-span-5 space-y-4">
        <SettingsPrescriptionPreview
          doctorName={clinic.doctorName || ""}
          doctorTitle={clinic.doctorTitle || ""}
          specialty={clinic.specialty || ""}
          syndicateId={clinic.syndicateId || ""}
          nameAr={clinic.nameAr || ""}
          name={clinic.name || ""}
          workingHours={branchWorkingHours || clinic.workingHours || ""}
          footerText={clinic.footerText || ""}
          clinicPhone={branchPhone || clinic.phone || ""}
          logoUrl={clinic.logoUrl || ""}
          primaryColor={clinic.primaryColor || "#059669"}
          fontFamily={clinic.fontFamily || "'Cairo', sans-serif"}
          templateId={clinic.templateId || "classic"}
          paperSize={clinic.paperSize || "A5"}
          showHeader={clinic.showHeader !== false}
          showFooter={clinic.showFooter !== false}
          visibleFields={visibleFields}
          branchAddress={branchAddress || clinic.address || ""}
          branches={branches}
          activeBranchId={activeBranchId}
          title="معاينة حية لانعكاس حقول المريض والفروع بالروشتة:"
        />

        {/* Action Bar below Tab 2 Live Preview */}
        <div className="mt-2 p-5 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-xs font-black text-slate-200 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>تأكيد الإعدادات وكتابة الروشتة:</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              تحديث فوري
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                updateClinic({ visibleFields });
                showGlobalToast("تم حفظ وتأكيد تفضيلات حقول الروشتة في ملف العيادة بنجاح!", "success");
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-900 text-white font-black text-xs transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-3 cursor-pointer active:scale-95 group hover:-translate-y-0.5"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all shrink-0 shadow-xs">
                <Save className="w-4 h-4 stroke-[2.4]" />
              </div>
              <div className="text-right">
                <span className="block text-xs font-black text-slate-100 group-hover:text-emerald-300">حفظ التفضيلات</span>
                <span className="block text-[10px] font-normal text-slate-400">تأمين حقول الروشتة</span>
              </div>
            </button>

            <Link
              href="/prescriptions/new"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-3 cursor-pointer active:scale-95 group hover:-translate-y-0.5"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-950/20 border border-slate-950/20 flex items-center justify-center text-slate-950 group-hover:scale-110 transition-transform shrink-0">
                <Stethoscope className="w-4 h-4 stroke-[2.6]" />
              </div>
              <div className="text-right">
                <span className="block text-xs font-black text-slate-950">تحرير روشتة الآن</span>
                <span className="block text-[10px] font-medium text-slate-900/80">الانتقال للروشتة الطبية</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrugsAndBranchesSettings;
