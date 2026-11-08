"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Copy,
  CheckCircle2,
  Crown,
  Check,
} from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
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

  useEffect(() => {
    if (defaultDoctorName && !doctorName) setDoctorName(defaultDoctorName);
    if (defaultClinicName && !clinicName) setClinicName(defaultClinicName);
    if (defaultPhone && !senderPhone) setSenderPhone(defaultPhone);
  }, [defaultDoctorName, defaultClinicName, defaultPhone]);

  if (!plan) return null;

  const isFree = plan.price === 0;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showGlobalToast("تم النسخ بنجاح", "success");
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
        showGlobalToast("يرجى إدخال رقم المحوّل منه", "error");
        return;
      }
      if (!transactionRef.trim()) {
        showGlobalToast("يرجى إدخال رقم العملية أو المرجع", "error");
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
      showGlobalToast(err?.message || "تعذر إرسال الطلب. حاول مرة أخرى.", "error");
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
          <span>{isFree ? "تفعيل التجربة المجانية" : "تأكيد الاشتراك والدفع"}</span>
        </div>
      }
      description={
        isFree
          ? "تفعيل فوري لكامل مزايا النظام لمدة 30 يوماً"
          : `${plan.nameAr} — ${plan.durationLabel}`
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-sans">
        {/* Compact Plan & Device Summary Bar */}
        <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-black text-slate-100 text-sm block truncate">{plan.nameAr}</span>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
              <span>معرف الجهاز:</span>
              <span dir="ltr" className="font-mono text-slate-400 whitespace-nowrap">
                {machineId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(machineId, "mid")}
                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                title="نسخ معرف الجهاز"
              >
                {copiedKey === "mid" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="text-left font-mono font-black text-emerald-400 text-lg shrink-0 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/25">
            {isFree ? "مجاناً" : `${plan.price} ج.م`}
          </div>
        </div>

        {/* Paid Plan Transfer Section */}
        {!isFree && (
          <div className="space-y-3">
            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("vodafone")}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paymentMethod === "vodafone"
                    ? "bg-rose-500/10 border-rose-500/70 text-slate-100 ring-1 ring-rose-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                    <Image
                      src="/vodafone-cash.png"
                      alt="Vodafone Cash"
                      fill
                      unoptimized
                      sizes="28px"
                      className="object-contain p-0.5"
                    />
                  </div>
                  <span className="font-bold text-xs">فودافون كاش</span>
                </div>
                {paymentMethod === "vodafone" && (
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("instapay")}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paymentMethod === "instapay"
                    ? "bg-purple-500/10 border-purple-500/70 text-slate-100 ring-1 ring-purple-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                    <Image
                      src="/instapay.png"
                      alt="InstaPay"
                      fill
                      unoptimized
                      sizes="28px"
                      className="object-contain p-0.5"
                    />
                  </div>
                  <span className="font-bold text-xs">إنستا باي</span>
                </div>
                {paymentMethod === "instapay" && (
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                )}
              </button>
            </div>

            {/* Compact Transfer Number Box */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-400 block">
                  رقم التحويل المعتمد ({paymentMethod === "vodafone" ? "فودافون كاش" : "إنستا باي"}):
                </span>
                <span dir="ltr" className="font-mono text-base font-black text-emerald-400 tracking-wide">
                  {OFFICIAL_TRANSFER_NUMBER}
                </span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="soft"
                onClick={() => handleCopy(OFFICIAL_TRANSFER_NUMBER, "num")}
                className="shrink-0"
              >
                {copiedKey === "num" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === "num" ? "تم النسخ" : "نسخ الرقم"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Doctor & Clinic Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="font-bold text-slate-300 block mb-1 text-[11px]">
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
            <label className="font-bold text-slate-300 block mb-1 text-[11px]">
              اسم العيادة / المركز
            </label>
            <Input
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="عيادة الشفاء"
            />
          </div>
        </div>

        {/* Transfer Verification Inputs (Paid Plans Only) */}
        {!isFree && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-300 block mb-1 text-[11px]">
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
              <label className="font-bold text-slate-300 block mb-1 text-[11px]">
                رقم العملية / المرجع <span className="text-rose-400">*</span>
              </label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="آخر 6 أرقام أو رقم المرجع"
                required
              />
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>

          <Button type="submit" variant="primary" isLoading={isSubmitting} className="min-w-[155px] font-black">
            {isFree ? "تفعيل التجربة الآن 🎁" : "إرسال وتأكيد التفعيل ⚡"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
