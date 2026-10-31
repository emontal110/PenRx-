"use client";

import React, { useState } from "react";
import {
  Crown,
  ShieldCheck,
  Clock,
  Laptop,
  Copy,
  RotateCw,
  AlertTriangle,
  Gift,
  CheckCircle2,
} from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { showGlobalToast } from "@/components/common/GlobalToast";

interface SubscriptionHeroProps {
  subDetails: {
    isActive: boolean;
    isPending: boolean;
    isExpired: boolean;
    daysRemaining: number;
    planName: string;
    record?: any;
  };
  machineId: string;
  onRefresh: () => Promise<void>;
  onOpenRenew: () => void;
}

export function SubscriptionHero({
  subDetails,
  machineId,
  onRefresh,
  onOpenRenew,
}: SubscriptionHeroProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    showGlobalToast("تم نسخ معرف الجهاز بنجاح", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      showGlobalToast("تم تحديث حالة الاشتراك من السيرفر", "success");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isTrial = subDetails.record?.isTrial;

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-slate-800 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Status info */}
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-lg ${
              subDetails.isActive
                ? isTrial
                  ? "bg-teal-500/15 text-teal-400 border-teal-500/30 shadow-teal-950/40"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-950/40"
                : subDetails.isPending
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-950/40"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-rose-950/40"
            }`}
          >
            {subDetails.isActive ? (
              isTrial ? (
                <Gift className="w-7 h-7" />
              ) : (
                <Crown className="w-7 h-7" />
              )
            ) : subDetails.isPending ? (
              <Clock className="w-7 h-7 animate-pulse" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-black text-slate-100">
                {subDetails.isActive
                  ? subDetails.planName || "الاشتراك النشط"
                  : subDetails.isPending
                  ? "طلب الاشتراك قيد المراجعة"
                  : "لا يوجد اشتراك نشط"}
              </h2>

              <Badge
                variant={
                  subDetails.isActive
                    ? "success"
                    : subDetails.isPending
                    ? "warning"
                    : "danger"
                }
                className="text-xs font-bold"
              >
                {subDetails.isActive
                  ? isTrial
                    ? "فترة تجريبية مجانية 🎁"
                    : "نشط ومعتمد ⭐"
                  : subDetails.isPending
                  ? "بانتظار التفعيل ⏳"
                  : "منتهي أو غير مفعل"}
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              {subDetails.isActive ? (
                <>
                  متبقي في صلاحية الاشتراك{" "}
                  <span className="font-black text-emerald-400 font-mono">
                    {subDetails.daysRemaining}
                  </span>{" "}
                  يوم (تنتهي في{" "}
                  <span className="font-mono text-slate-300">
                    {subDetails.record?.expiresAt
                      ? new Date(subDetails.record.expiresAt).toLocaleDateString("ar-EG")
                      : "نهاية الفترة"}
                  </span>
                  )
                </>
              ) : subDetails.isPending ? (
                "تم إرسال بيانات التحويل بنجاح وسيقوم النظام بتفعيل حسابك فور مراجعة الدفعة."
              ) : (
                "يرجى اختيار باقة اشتراك وتفعيلها للوصول لكافة مزايا كتابة الروشتات وبنك الأدوية بالذكاء الاصطناعي."
              )}
            </p>

            {/* Hardware ID Info */}
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
              <Laptop className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>معرف هذا الجهاز:</span>
              <span dir="ltr" className="font-mono font-bold text-slate-200">
                {machineId}
              </span>
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="p-1 hover:text-emerald-400 transition-colors"
                title="نسخ معرف الجهاز"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>فحص التفعيل</span>
          </Button>

          <Button variant="primary" size="sm" onClick={onOpenRenew}>
            <Crown className="w-3.5 h-3.5" />
            <span>{subDetails.isActive ? "تجديد / ترقية الباقة" : "اشترك الآن"}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

