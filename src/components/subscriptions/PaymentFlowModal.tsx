"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ShieldCheck,
  Copy,
  CheckCircle2,
  Crown,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button, Input, Modal, Badge } from "@/components/ui";
import { PlanItem } from "./PlanCard";
import { showGlobalToast } from "@/components/common/GlobalToast";

export const OFFICIAL_TRANSFER_NUMBER = "01094085228";

interface PaymentFlowModalProps {
  plan: PlanItem | null;
  machineId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    planId: string;
    planName: string;
    price: number;
    paymentMethod: "vodafone" | "instapay";
    senderPhone: string;
    transactionRef: string;
    doctorName: string;
    clinicName: string;
    durationDays: number;
    isTrial: boolean;
  }) => Promise<void>;
  defaultDoctorName?: string;
  defaultClinicName?: string;
  defaultPhone?: string;
}

export function PaymentFlowModal({
  plan,
  machineId,
  isOpen,
  onClose,
  onSubmit,
  defaultDoctorName = "",
  defaultClinicName = "",
  defaultPhone = "",
}: PaymentFlowModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"vodafone" | "instapay">("vodafone");
  const [senderPhone, setSenderPhone] = useState(defaultPhone);
  const [transactionRef, setTransactionRef] = useState("");
  const [doctorName, setDoctorName] = useState(defaultDoctorName);
  const [clinicName, setClinicName] = useState(defaultClinicName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!plan) return null;

  const isFree = plan.price === 0;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showGlobalToast(`تم نسخ: ${text}`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!doctorName.trim()) {
      showGlobalToast("يرجى إدخال اسم الطبيب", "error");
      return;
    }

    if (!isFree) {
      if (!senderPhone.trim()) {
        showGlobalToast("يرجى إدخال رقم الهاتف المحول منه", "error");
        return;
      }
      if (!transactionRef.trim()) {
        showGlobalToast("يرجى إدخال رقم العملية أو كود التحويل", "error");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        planId: plan.id,
        planName: plan.nameAr,
        price: plan.price,
        paymentMethod,
        senderPhone: senderPhone.trim() || defaultPhone,
        transactionRef: transactionRef.trim() || `TRIAL-${Date.now().toString().slice(-6)}`,
        doctorName: doctorName.trim(),
        clinicName: clinicName.trim() || "عيادة د. " + doctorName.trim(),
        durationDays: plan.durationDays,
        isTrial: isFree,
      });
      onClose();
    } catch (err: any) {
      showGlobalToast(err?.message || "تعذر إرسال طلب التفعيل. يرجى المحاولة لاحقاً.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-emerald-400" />
          <span>{isFree ? "تفعيل الفترة التجريبية المجانية" : "إتمام الاشتراك والدفع"}</span>
        </div>
      }
      description={
        isFree
          ? "احصل على تجربة مجانية كاملة لجميع مزايا PenRX+ لمدة شهر"
          : `الباقة المختارة: ${plan.nameAr} (${plan.price} ج.م)`
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {/* Plan Summary Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="font-bold text-slate-100 text-sm block">{plan.nameAr}</span>
            <span className="text-slate-400 text-[11px]">{plan.durationLabel}</span>
          </div>
          <div className="text-left font-mono font-black text-emerald-400 text-lg">
            {isFree ? "مجاناً" : `${plan.price} ج.م`}
          </div>
        </div>

        {/* Machine ID Banner */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400">معرف جهازك:</span>
            <span dir="ltr" className="font-mono font-bold text-emerald-400 truncate">
              {machineId}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(machineId, "mid")}
            className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedKey === "mid" ? "تم" : "نسخ"}</span>
          </button>
        </div>

        {/* Doctor and Clinic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-slate-300 block mb-1">
              اسم الطبيب <span className="text-rose-400">*</span>
            </label>
            <Input
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="د. أحمد محمد"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">
              اسم العيادة / المركز الطبي
            </label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="عيادة الشفاء التخصصية"
            />
          </div>
        </div>

        {/* If Paid: Payment Method Selection & Instructions */}
        {!isFree && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="font-bold text-slate-300 block">
              اختر وسيلة التحويل:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("vodafone")}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paymentMethod === "vodafone"
                    ? "bg-rose-500/10 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-600/20 flex items-center justify-center font-black text-rose-400 text-xs">
                    VF
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-200 block text-xs">فودافون كاش</span>
                    <span className="text-[10px] text-slate-400">محفظة إلكترونية</span>
                  </div>
                </div>
                {paymentMethod === "vodafone" && (
                  <CheckCircle2 className="w-4 h-4 text-rose-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("instapay")}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paymentMethod === "instapay"
                    ? "bg-purple-500/10 border-purple-500/80 text-purple-200 ring-1 ring-purple-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-600/20 flex items-center justify-center font-black text-purple-400 text-xs">
                    IP
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-200 block text-xs">إنستا باي</span>
                    <span className="text-[10px] text-slate-400">تحويل لحظي</span>
                  </div>
                </div>
                {paymentMethod === "instapay" && (
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                )}
              </button>
            </div>

            {/* Transfer Number Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
              <span className="text-[11px] text-slate-400 font-bold block">
                حول مبلغ <span className="text-emerald-400 font-black">{plan.price} ج.م</span> إلى رقم التحويل المعتمد:
              </span>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span dir="ltr" className="font-mono text-base font-black text-emerald-400">
                  {OFFICIAL_TRANSFER_NUMBER}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="soft"
                  onClick={() => handleCopy(OFFICIAL_TRANSFER_NUMBER, "num")}
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedKey === "num" ? "تم النسخ" : "نسخ الرقم"}</span>
                </Button>
              </div>
            </div>

            {/* Proof of Transfer Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  رقم الهاتف المحوّل منه <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  type="tel"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  رقم العملية / المرجع <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="مثال: 94827103"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>

          <Button type="submit" variant="primary" isLoading={isSubmitting} className="min-w-[140px]">
            {isFree ? "تفعيل التجربة الآن 🎁" : "إرسال طلب التفعيل ⚡"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
