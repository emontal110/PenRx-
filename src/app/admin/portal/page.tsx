"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
  Laptop,
  Smartphone,
  Play,
  Pause,
  ArrowLeft,
  X,
  Sparkles,
  CreditCard,
  Hash,
  Lock,
  LogOut,
  ShieldCheck,
  Plus,
  Users,
  Link2,
} from "lucide-react";
import { useSubscriptionStore, SubscriptionRecord } from "@/store/useSubscriptionStore";

export default function AdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const {
    subscriptions,
    activateSubscription,
    suspendSubscription,
    deleteSubscription,
    adjustSubscriptionDays,
    addDeviceToSubscriber,
    removeDeviceFromSubscriber,
    syncWithServer,
  } = useSubscriptionStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "ACTIVE" | "FREE_TRIAL">("ALL");
  const [selectedSubForManage, setSelectedSubForManage] = useState<SubscriptionRecord | null>(null);
  const [newDeviceInputMap, setNewDeviceInputMap] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Fast real-time sync with server (every 2.5 seconds)
  useEffect(() => {
    if (isAuthenticated) {
      syncWithServer();
      const interval = setInterval(syncWithServer, 2500);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, syncWithServer]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "3060630" || adminPin === "admin123" || adminPin === "penrx") {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/95 border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center backdrop-blur-2xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-wider">
              PORTAL SECURITY GATE
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              بورتال الإدارة والتحكم السري
            </h2>
            <p className="text-xs text-slate-400">
              مخصص لمالك المنظومة فقط لإدارة المشتركين وربط الأجهزة وتفعيل التراخيص.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block text-right">رمز المرور السري (Admin PIN):</label>
              <input
                type="password"
                required
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="أدخل رمز الدخول..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 text-center text-sm focus:outline-none focus:border-purple-500"
              />
              {pinError && (
                <span className="text-[11px] text-rose-400 font-bold block pt-1">
                  رمز المرور غير صحيح، يرجى المحاولة مجدداً.
                </span>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs shadow-xl shadow-purple-950/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              تسجيل الدخول للبورتال 🔐
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter subscriptions
  const filteredSubs = subscriptions.filter((sub) => {
    const isFreeTrial = sub.isTrial || sub.price === 0;
    const matchesFilter =
      filterStatus === "ALL"
        ? true
        : filterStatus === "FREE_TRIAL"
        ? isFreeTrial
        : sub.status === filterStatus;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesFilter;

    const subIdMatch = (sub.subscriberId || "").toLowerCase().includes(q);
    const nameMatch = (sub.doctorName || "").toLowerCase().includes(q);
    const clinicMatch = (sub.clinicName || "").toLowerCase().includes(q);
    const phoneMatch = sub.senderPhone.includes(q);
    const refMatch = sub.transactionRef.toLowerCase().includes(q);
    const machineMatch = sub.machineId.toLowerCase().includes(q);
    const allowedMatch = (sub.allowedMachineIds || []).some((m) => m.toLowerCase().includes(q));

    return matchesFilter && (subIdMatch || nameMatch || clinicMatch || phoneMatch || refMatch || machineMatch || allowedMatch);
  });

  const totalRequests = subscriptions.length;
  const pendingCount = subscriptions.filter((s) => s.status === "PENDING").length;
  const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
  const freeTrialCount = subscriptions.filter((s) => s.isTrial || s.price === 0).length;
  const totalRevenue = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((acc, curr) => acc + curr.price, 0);

  const handleDirectActivate = (sub: SubscriptionRecord) => {
    const days = sub.durationDays || 30;
    activateSubscription(sub.id, days);
    setToast(`✅ تم تفعيل اشتراك الطبيب (${sub.doctorName || sub.subscriberId}) لمدة ${days} يوماً!`);
    setTimeout(() => setToast(null), 5000);
  };

  const handleAddDeviceForSubscriber = async (sub: SubscriptionRecord) => {
    const machine = newDeviceInputMap[sub.id]?.trim();
    if (!machine) {
      alert("يرجى كتابة أو لصق كود الجهاز الجديد أولاً.");
      return;
    }

    await addDeviceToSubscriber(sub.id, machine);
    setNewDeviceInputMap({ ...newDeviceInputMap, [sub.id]: "" });
    setToast(`✅ تم ربط وإضافة الجهاز الجديد (${machine}) لحساب المشترك (${sub.subscriberId}) بنجاح!`);
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-emerald-500 text-white shadow-lg shadow-purple-900/30">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100">
                بورتال التحكم وإدارة المشتركين والأجهزة
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black">
                OWNER PORTAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              تفعيل الاشتراكات، ربط عدة أجهزة لكل مشترك (كمبيوتر + موبايل)، وتعديل مدد الصلاحيات لحظياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة للبرنامج</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>قفل البورتال</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-1.5 shadow-lg">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-400" />
            <span>إجمالي المشتركين:</span>
          </span>
          <p className="text-2xl font-black text-slate-100 font-mono">{totalRequests}</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 space-y-1.5 shadow-lg">
          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>بانتظار التفعيل:</span>
          </span>
          <p className="text-2xl font-black text-amber-300 font-mono">{pendingCount}</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-emerald-500/30 space-y-1.5 shadow-lg">
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>الحسابات المفعلة:</span>
          </span>
          <p className="text-2xl font-black text-emerald-400 font-mono">{activeCount}</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-purple-500/30 space-y-1.5 shadow-lg">
          <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>التجربة المجانية:</span>
          </span>
          <p className="text-2xl font-black text-purple-300 font-mono">{freeTrialCount}</p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/30 space-y-1.5 shadow-lg">
          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-cyan-400" />
            <span>إجمالي الإيرادات:</span>
          </span>
          <p className="text-2xl font-black text-cyan-300 font-mono">{totalRevenue.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-3xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بكود المشترك (SUB-...)، اسم الطبيب، الهاتف، أو كود الجهاز..."
            className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-100 focus:outline-none focus:border-purple-500 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === "ALL" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            الكل ({subscriptions.length})
          </button>
          <button
            onClick={() => setFilterStatus("PENDING")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === "PENDING" ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            قيد الانتظار ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus("ACTIVE")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === "ACTIVE" ? "bg-emerald-500 text-slate-950 font-black" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            المفعلة ({activeCount})
          </button>
          <button
            onClick={() => setFilterStatus("FREE_TRIAL")}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              filterStatus === "FREE_TRIAL" ? "bg-purple-500 text-white font-black" : "bg-slate-800 text-purple-300 hover:text-white"
            }`}
          >
            🎁 المجانية ({freeTrialCount})
          </button>
        </div>
      </div>

      {/* SUBSCRIBERS CARDS / LIST WITH DIRECT DEVICE LINKING */}
      <div className="space-y-4">
        {filteredSubs.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-2">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">لا توجد اشتراكات مطابقة للبحث الحالي.</p>
          </div>
        ) : (
          filteredSubs.map((sub) => {
            const now = Date.now();
            let daysRemaining = sub.durationDays || 30;
            if (sub.expiresAt) {
              daysRemaining = Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24)));
            }
            const allowedList = sub.allowedMachineIds || [];

            return (
              <div
                key={sub.id}
                className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all space-y-5 shadow-xl"
              >
                {/* Subscriber Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Subscriber ID Badge */}
                      <span className="font-mono font-black text-xs px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 tracking-wider">
                        {sub.subscriberId || "SUB-0000"}
                      </span>

                      <h3 className="font-black text-slate-100 text-base">
                        👨‍⚕️ {sub.doctorName || "طبيب بدون اسم"}
                      </h3>

                      <span className="text-xs text-slate-400 font-bold">
                        (🏥 {sub.clinicName || "عيادة"})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-0.5">
                      <span>الباقة: <strong className="text-emerald-300">{sub.planName}</strong></span>
                      <span>•</span>
                      <span>القيمة: <strong className="font-mono text-emerald-400">{sub.price === 0 ? "مجاناً" : `${sub.price} ج.م`}</strong></span>
                      <span>•</span>
                      <span>الهاتف: <strong className="font-mono text-slate-200">{sub.senderPhone}</strong></span>
                      <span>•</span>
                      <span>المرجع: <strong className="font-mono text-cyan-400">{sub.transactionRef}</strong></span>
                    </div>
                  </div>

                  {/* Status & Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {sub.status === "ACTIVE" ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مفعل ({daysRemaining} يوماً)</span>
                      </span>
                    ) : sub.status === "PENDING" ? (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        <span>قيد الانتظار ({sub.durationDays || 30} يوم)</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black">
                        موقوف مؤقتاً
                      </span>
                    )}

                    {sub.status !== "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => handleDirectActivate(sub)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>تفعيل الحساب 🚀</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedSubForManage(sub)}
                      className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white font-bold text-xs border border-purple-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تعديل الأيام</span>
                    </button>

                    {sub.status === "ACTIVE" && (
                      <button
                        type="button"
                        onClick={() => suspendSubscription(sub.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-600/30 text-amber-400 border border-slate-700 transition-colors cursor-pointer"
                        title="إيقاف مؤقت"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف اشتراك المشترك (${sub.subscriberId})؟`)) {
                          deleteSubscription(sub.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                      title="حذف نهائي"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* MULTI-DEVICE MANAGEMENT SECTION FOR THIS SUBSCRIBER */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-emerald-400" />
                      <span>الأجهزة المربوطة والمصرّح لها بالدخول لهذا المشترك ({allowedList.length} أجهزة):</span>
                    </span>
                  </div>

                  {/* List of currently authorized machine IDs */}
                  <div className="flex flex-wrap gap-2">
                    {/* Primary Machine */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/30 font-mono text-xs text-emerald-300">
                      <span className="font-bold">🖥️ الأساسي:</span>
                      <span dir="ltr">{sub.machineId}</span>
                    </div>

                    {/* Secondary & Additional Machines */}
                    {allowedList
                      .filter((m) => m !== sub.machineId)
                      .map((mId, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-purple-500/30 font-mono text-xs text-purple-200"
                        >
                          <span className="font-bold">📱 جهاز {idx + 2}:</span>
                          <span dir="ltr">{mId}</span>
                          <button
                            type="button"
                            onClick={() => removeDeviceFromSubscriber(sub.id, mId)}
                            className="p-1 rounded-md text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-[10px] font-bold"
                            title="إلغاء ربط هذا الجهاز"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Direct Input to Add a New Device for this Subscriber */}
                  <div className="pt-1 flex flex-wrap sm:flex-nowrap items-center gap-2 max-w-lg">
                    <input
                      type="text"
                      value={newDeviceInputMap[sub.id] || ""}
                      onChange={(e) =>
                        setNewDeviceInputMap({ ...newDeviceInputMap, [sub.id]: e.target.value })
                      }
                      placeholder="الصق كود الجهاز الجديد هنا (PRX-XXXX-XXXX-XXXX)..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddDeviceForSubscriber(sub)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة وربط هذا الجهاز ➕</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adjust Days Modal */}
      {selectedSubForManage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedSubForManage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 text-right border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>تمديد أو تعديل أيام الصلاحية</span>
              </span>
              <h3 className="text-base font-black text-slate-100">
                المشترك: {selectedSubForManage.doctorName} ({selectedSubForManage.subscriberId})
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  adjustSubscriptionDays(selectedSubForManage.id, 5);
                  setToast("✅ تم إضافة 5 أيام للاشتراك.");
                  setSelectedSubForManage(null);
                }}
                className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition-all cursor-pointer text-center"
              >
                +5 أيام إضافية
              </button>
              <button
                type="button"
                onClick={() => {
                  adjustSubscriptionDays(selectedSubForManage.id, 30);
                  setToast("✅ تم إضافة شهر (30 يوم) للاشتراك.");
                  setSelectedSubForManage(null);
                }}
                className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition-all cursor-pointer text-center"
              >
                +شهر واحد (30 يوم)
              </button>
              <button
                type="button"
                onClick={() => {
                  adjustSubscriptionDays(selectedSubForManage.id, 90);
                  setToast("✅ تم إضافة 90 يوماً للاشتراك.");
                  setSelectedSubForManage(null);
                }}
                className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold transition-all cursor-pointer text-center"
              >
                +3 شهور (90 يوم)
              </button>
              <button
                type="button"
                onClick={() => {
                  adjustSubscriptionDays(selectedSubForManage.id, 365);
                  setToast("✅ تم تمديد الاشتراك لسنة كاملة (365 يوم).");
                  setSelectedSubForManage(null);
                }}
                className="p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 font-bold transition-all cursor-pointer text-center"
              >
                +سنة كاملة (365 يوم) ⭐
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
