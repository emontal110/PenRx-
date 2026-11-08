"use client";

import React, { useState } from "react";
import {
  Crown,
  Clock,
  Copy,
  RotateCw,
  AlertTriangle,
  Gift,
  Check,
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
}

export function SubscriptionHero({
  subDetails,
  machineId,
  onRefresh,
}: SubscriptionHeroProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    showGlobalToast("تم نسخ معرف الجهاز", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      showGlobalToast("تم تحديث حالة الاشتراك", "success");
    } finally {
      setIsRefreshing(false);
    }
  };

  const isTrial = subDetails.record?.isTrial;

  return (
    <Card className="p-4 sm:p-5 bg-slate-900/90 border-slate-800/90 shadow-lg rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status & Compact Device ID */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
              subDetails.isActive
                ? isTrial
                  ? "bg-teal-500/15 text-teal-400 border-teal-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : subDetails.isPending
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
            }`}
          >
            {subDetails.isActive ? (
              isTrial ? (
                <Gift className="w-5 h-5" />
              ) : (
                <Crown className="w-5 h-5" />
              )
            ) : subDetails.isPending ? (
              <Clock className="w-5 h-5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-100">
                {subDetails.isActive
                  ? subDetails.planName || "اشتراك نشط"
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
                className="text-[10px] px-2 py-0.5 font-bold"
              >
                {subDetails.isActive
                  ? isTrial
                    ? "تجريبي مجاني"
                    : "مفعل"
                  : subDetails.isPending
                  ? "بانتظار التفعيل"
                  : "غير مفعل"}
              </Badge>
            </div>

            <p className="text-xs text-slate-400">
              {subDetails.isActive ? (
                <>
                  متبقي{" "}
                  <span className="font-bold text-emerald-400 font-mono">
                    {subDetails.daysRemaining}
                  </span>{" "}
                  يوم في الصلاحية
                </>
              ) : subDetails.isPending ? (
                "سيتم تفعيل حسابك فور مراجعة التحويل."
              ) : (
                "اختر باقة من الأسفل لتفعيل حسابك."
              )}
            </p>

            {/* Very Small Single-Line Device ID */}
            <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>معرف الجهاز:</span>
              <button
                type="button"
                onClick={handleCopyMachineId}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-800/80 hover:border-emerald-500/40 text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                title="نسخ معرف الجهاز"
              >
                <span dir="ltr" className="font-mono text-[9px] sm:text-[10px] whitespace-nowrap tracking-tight">
                  {machineId}
                </span>
                {copied ? (
                  <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-2.5 h-2.5 shrink-0" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Single Action Button: Check Activation Only */}
        <div className="flex items-center sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            className="w-full sm:w-auto text-xs font-bold"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>فحص التفعيل</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
