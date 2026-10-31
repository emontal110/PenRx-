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
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
        body: JSON.stringify({ email, password, pin }),
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

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 font-sans" dir="rtl">
        <Card className="w-full max-w-md p-6 sm:p-8 bg-slate-900/95 border-emerald-500/40 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-md">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <Badge variant="brand" className="text-[10px] font-mono px-2.5 py-0.5">
              MASTER ADMIN ACCESS
            </Badge>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              بورتال الإدارة والتحكم
            </h1>
            <p className="text-xs text-slate-400">
              تسجيل دخول آمن ثلاثي المشفر لإدارة اشتراكات وأجهزة الأطباء
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-300 block mb-1">
                البريد الإلكتروني للإدارة
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@your-domain.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">كلمة المرور المشفرة</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-300 block mb-1">
                رمز الأمان السري الإضافي (Master PIN)
              </label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoggingIn}
              className="w-full text-sm font-black mt-2"
            >
              <Lock className="w-4 h-4" />
              <span>دخول آمن لبورتال التحكم</span>
            </Button>
          </form>
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
