"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  LogOut,
  Calendar,
  Laptop,
  Check,
  X,
  Plus,
  AlertTriangle,
  User,
  Phone,
  Filter,
} from "lucide-react";
import { Button, Card, Input, Badge, Modal } from "@/components/ui";
import { showGlobalToast } from "@/components/common/GlobalToast";

interface SubscriptionRecord {
  id: string;
  subscriberId: string;
  planId: string;
  planName: string;
  price: number;
  paymentMethod: string;
  senderPhone: string;
  transactionRef: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REJECTED";
  machineId: string;
  allowedMachineIds: string[];
  doctorName?: string;
  clinicName?: string;
  durationDays: number;
  isTrial?: boolean;
  activatedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRecoverMode, setIsRecoverMode] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState("");

  // Subscriptions management
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSub, setSelectedSub] = useState<SubscriptionRecord | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Activation custom modal
  const [activateDays, setActivateDays] = useState(30);
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);

  // Verify session on mount
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions?limit=1", {
        headers: { "x-penrx-admin": "1" },
      });
      if (res.ok) {
        setIsAuthenticated(true);
        fetchSubscriptions();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-penrx-admin": "1",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        showGlobalToast("تم تسجيل الدخول بنجاح إلى بورتال الإدارة", "success");
        fetchSubscriptions();
      } else {
        showGlobalToast(data.error || "بيانات الدخول غير صحيحة", "error");
      }
    } catch {
      showGlobalToast("تعذر الاتصال بخادم الإدارة", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showGlobalToast("يرجى كتابة البريد الإلكتروني أولاً", "error");
      return;
    }
    setIsRecovering(true);
    setRecoverySuccessMsg("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-penrx-admin": "1",
        },
        body: JSON.stringify({ action: "recover", email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecoverySuccessMsg(data.message || "تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.");
        showGlobalToast("تم إرسال الرابط إلى بريدك بنجاح", "success");
      } else {
        showGlobalToast(data.error || "تعذر إرسال رابط الاستعادة", "error");
      }
    } catch {
      showGlobalToast("تعذر الاتصال بخادم الإدارة", "error");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        headers: { "x-penrx-admin": "1" },
      });
    } catch {}
    setIsAuthenticated(false);
    setSubscriptions([]);
    showGlobalToast("تم تسجيل الخروج من بورتال الإدارة", "info");
  };

  const fetchSubscriptions = async () => {
    setIsLoadingSubs(true);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        headers: { "x-penrx-admin": "1" },
      });
      const data = await res.json();
      if (res.ok && data.subscriptions) {
        setSubscriptions(data.subscriptions);
      }
    } catch {
      showGlobalToast("تعذر جلب قائمة الاشتراكات", "error");
    } finally {
      setIsLoadingSubs(false);
    }
  };

  const handleAction = async (id: string, action: string, extraBody: any = {}) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-penrx-admin": "1",
        },
        body: JSON.stringify({ action, ...extraBody }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showGlobalToast(`تم تنفيذ الإجراء (${action}) بنجاح`, "success");
        setIsActivateModalOpen(false);
        fetchSubscriptions();
      } else {
        showGlobalToast(data.error || "فشل تنفيذ الإجراء", "error");
      }
    } catch {
      showGlobalToast("حدث خطأ أثناء الاتصال بالسيرفر", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredSubs = subscriptions.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = s.doctorName?.toLowerCase().includes(q);
    const clinicMatch = s.clinicName?.toLowerCase().includes(q);
    const phoneMatch = s.senderPhone?.includes(q);
    const refMatch = s.transactionRef?.toLowerCase().includes(q);
    const machineMatch = s.machineId?.toLowerCase().includes(q);
    return nameMatch || clinicMatch || phoneMatch || refMatch || machineMatch;
  });

  const pendingCount = subscriptions.filter((s) => s.status === "PENDING").length;

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">جاري التحقق من جلسة الإدارة...</p>
        </div>
      </div>
    );
  }

  // Login & Password Recovery Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden" dir="rtl">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <Card className="w-full max-w-md p-6 sm:p-9 bg-slate-900/95 border-emerald-500/30 rounded-3xl shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          <div className="text-center space-y-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-transparent text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
              <ShieldCheck className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>MASTER ADMIN ACCESS • V1.65</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              {isRecoverMode ? "استعادة كلمة المرور" : "بورتال الإدارة والتحكم"}
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              {isRecoverMode
                ? "أدخل بريدك الإلكتروني المسجل في Supabase لإرسال رابط إعادة تعيين كلمة المرور"
                : "تسجيل دخول آمن وسريع عبر Supabase Auth لإدارة اشتراكات وأجهزة الأطباء"}
            </p>
          </div>

          {recoverySuccessMsg && (
            <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold leading-relaxed text-center">
              {recoverySuccessMsg}
            </div>
          )}

          {isRecoverMode ? (
            <form onSubmit={handleRecoverPassword} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 flex items-center gap-1.5 mb-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>البريد الإلكتروني المسجل:</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@penrx.com"
                  required
                  autoFocus
                  className="rounded-2xl"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isRecovering}
                className="w-full text-sm font-black mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 shadow-lg shadow-emerald-950/50"
              >
                <KeyRound className="w-4 h-4" />
                <span>إرسال رابط استعادة كلمة المرور</span>
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoverMode(false);
                    setRecoverySuccessMsg("");
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  ← العودة لتسجيل الدخول
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 flex items-center gap-1.5 mb-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span>البريد الإلكتروني للإدارة:</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@penrx.com"
                  required
                  autoFocus
                  className="rounded-2xl"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>كلمة المرور:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoverMode(true);
                      setRecoverySuccessMsg("");
                    }}
                    className="text-[11px] text-emerald-400/80 hover:text-emerald-300 hover:underline transition-all cursor-pointer"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="rounded-2xl pr-3 pl-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 cursor-pointer p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isLoggingIn}
                className="w-full text-sm font-black mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 shadow-lg shadow-emerald-950/50"
              >
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>دخول آمن إلى لوحة التحكم</span>
              </Button>
            </form>
          )}

          <div className="pt-5 mt-5 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>حماية مشفرة • جلسة HttpOnly آمنة • مصادقة Supabase</span>
          </div>
        </Card>
      </div>
    );
  }

  // Dashboard / Management Screen
  return (
    <div className="space-y-6 pb-16 font-sans" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100">
                بورتال التحكم والاشتراكات
              </h1>
              {pendingCount > 0 && (
                <Badge variant="warning" className="animate-pulse">
                  {pendingCount} طلب بانتظار التفعيل
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              إدارة طلبات الدفع، تفعيل التراخيص، وإدارة أجهزة المشتركين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSubscriptions}
            isLoading={isLoadingSubs}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث</span>
          </Button>

          <Button variant="danger" size="sm" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الطبيب، العيادة، رقم الهاتف، المرجع، أو معرف الجهاز..."
            className="pr-10"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto">
          {["ALL", "PENDING", "ACTIVE", "EXPIRED", "SUSPENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st === "ALL"
                ? `الكل (${subscriptions.length})`
                : st === "PENDING"
                ? `بانتظار التفعيل (${pendingCount})`
                : st === "ACTIVE"
                ? `نشط`
                : st === "EXPIRED"
                ? `منتهي`
                : `موقوف`}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions List */}
      {filteredSubs.length === 0 ? (
        <Card className="text-center py-16 px-4">
          <Clock className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <h3 className="text-base font-bold text-slate-300">لا توجد طلبات اشتراك في هذه القائمة</h3>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubs.map((sub) => {
            const isPending = sub.status === "PENDING";
            const isActive = sub.status === "ACTIVE";

            return (
              <Card
                key={sub.id}
                className={`p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isPending
                    ? "border-amber-500/40 bg-amber-950/10"
                    : isActive
                    ? "border-emerald-500/30 bg-slate-900/80"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                {/* Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-black text-slate-100">
                      {sub.doctorName || "طبيب بدون اسم"}
                    </span>
                    {sub.clinicName && (
                      <span className="text-xs text-slate-400 font-medium">
                        ({sub.clinicName})
                      </span>
                    )}
                    <Badge
                      variant={
                        isPending
                          ? "warning"
                          : isActive
                          ? "success"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {sub.status}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {sub.planName} ({sub.price} ج.م)
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                    {sub.senderPhone && (
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-teal-400" />
                        {sub.senderPhone}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      الوسيلة: <strong className="text-slate-300">{sub.paymentMethod}</strong>
                    </span>

                    <span className="flex items-center gap-1 font-mono">
                      المرجع: <strong className="text-slate-300">{sub.transactionRef}</strong>
                    </span>

                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      الجهاز: {sub.machineId}
                    </span>

                    {sub.expiresAt && (
                      <span className="text-slate-400">
                        ينتهي: {new Date(sub.expiresAt).toLocaleDateString("ar-EG")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {isPending && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedSub(sub);
                        setActivateDays(sub.durationDays || 30);
                        setIsActivateModalOpen(true);
                      }}
                      isLoading={isActionLoading}
                    >
                      <Check className="w-4 h-4" />
                      <span>تفعيل الترخيص ⚡</span>
                    </Button>
                  )}

                  {isActive && (
                    <>
                      <Button
                        variant="soft"
                        size="xs"
                        onClick={() => handleAction(sub.id, "ADJUST_DAYS", { daysDelta: 30 })}
                        isLoading={isActionLoading}
                        title="تمديد 30 يوماً إضافية"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+30 يوم</span>
                      </Button>

                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => handleAction(sub.id, "SUSPEND")}
                        isLoading={isActionLoading}
                      >
                        إيقاف
                      </Button>
                    </>
                  )}

                  {sub.status === "SUSPENDED" && (
                    <Button
                      variant="success"
                      size="xs"
                      onClick={() => handleAction(sub.id, "ACTIVATE", { durationDays: 30 })}
                      isLoading={isActionLoading}
                    >
                      إعادة تفعيل
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Activation Confirmation Modal */}
      <Modal
        isOpen={isActivateModalOpen}
        onClose={() => setIsActivateModalOpen(false)}
        title="تأكيد تفعيل اشتراك الطبيب"
        description={
          selectedSub ? `تفعيل ${selectedSub.doctorName} (${selectedSub.planName})` : ""
        }
        maxWidth="md"
      >
        {selectedSub && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">اسم الطبيب:</span>
                <span className="font-bold text-slate-100">{selectedSub.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الباقة المطلوبة:</span>
                <span className="font-bold text-emerald-400">{selectedSub.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم الهاتف المحول منه:</span>
                <span dir="ltr" className="font-mono text-slate-200">{selectedSub.senderPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم العملية / المرجع:</span>
                <span className="font-mono text-slate-200">{selectedSub.transactionRef}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                مدة الصلاحية الممنوحة (بالأيام)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[30, 90, 180, 365].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActivateDays(d)}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      activateDays === d
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {d} يوم
                  </button>
                ))}
              </div>
              <Input
                type="number"
                value={activateDays}
                onChange={(e) => setActivateDays(Number(e.target.value))}
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setIsActivateModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  handleAction(selectedSub.id, "ACTIVATE", { durationDays: activateDays })
                }
                isLoading={isActionLoading}
              >
                تأكيد التفعيل وإصدار التوقيع السري ⚡
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

