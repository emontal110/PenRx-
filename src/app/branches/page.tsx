"use client";

import React, { useState } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Clock,
  Trash2,
  CheckCircle2,
  Check,
  Building,
} from "lucide-react";
import { useClinicStore, Branch } from "@/store/useClinicStore";

export default function BranchesPage() {
  const { branches, addBranch, deleteBranch, activeBranchId, setActiveBranchId } = useClinicStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [workingHours, setWorkingHours] = useState("");

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !phone.trim()) {
      alert("يرجى إدخال اسم الفرع ورقم الهاتف على الأقل.");
      return;
    }

    addBranch({
      nameAr: nameAr.trim(),
      name: name.trim() || nameAr.trim(),
      address: address.trim() || "العنوان غير محدد",
      phone: phone.trim(),
      workingHours: workingHours.trim() || "مواعيد العيادة الاعتيادية",
      isDefault: branches.length === 0,
    });

    setNameAr("");
    setName("");
    setAddress("");
    setPhone("");
    setWorkingHours("");
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              إدارة فروع العيادات والمراكز
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديد فروع العمل، العناوين، وأرقام التواصل المطبوعة على ترويسة الروشتة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فرع جديد 🏥</span>
        </button>
      </div>

      {/* Branches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map((b) => {
          const isActive = b.id === activeBranchId;

          return (
            <div
              key={b.id}
              className={`p-6 rounded-3xl border transition-all space-y-4 shadow-xl flex flex-col justify-between ${
                isActive
                  ? "bg-slate-900/95 border-2 border-emerald-500 ring-4 ring-emerald-500/10"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-black text-slate-100 text-base">{b.nameAr}</h3>
                    <span className="text-[11px] text-slate-400 font-bold block">{b.name}</span>
                  </div>

                  {isActive ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>الفرع النشط حالياً</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveBranchId(b.id)}
                      className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      تعيين كفرع نشط
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-300 font-medium">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{b.address}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="font-mono text-emerald-300 font-bold">{b.phone}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{b.workingHours}</span>
                  </div>
                </div>
              </div>

              {/* Action: Delete Branch if more than 1 */}
              {branches.length > 1 && (
                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من حذف ${b.nameAr}؟`)) {
                        deleteBranch(b.id);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 transition-colors text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الفرع</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <div className="space-y-1 text-right border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>إضافة فرع عيادة جديد</span>
              </h3>
              <p className="text-xs text-slate-400">
                أدخل بيانات الفرع لتضمينه في ترويسة طباعة الروشتات
              </p>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">اسم الفرع بالعربية:</label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: فرع التجمع الخامس"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">اسم الفرع بالإنجليزية (اختياري):</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. New Cairo Branch"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">العنوان التفصيلي:</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع التسعين الجنوبي، مجمع عيادات الصفا، الدور الثالث"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">رقم الهاتف / الحجز:</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01094085228"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">مواعيد العمل:</label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="مثال: السبت والثلاثاء من 5 مساءً حتى 9 مساءً"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg transition-all"
                >
                  حفظ الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
