"use client";

import React, { useState, useEffect } from "react";
import { Crown, Sparkles, ShieldCheck, Phone, Check } from "lucide-react";
import {
  useSubscriptionStore,
  getSubscriptionDetails,
  hasUsedFreeTrial,
} from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { PlanCard, PlanItem } from "@/components/subscriptions/PlanCard";
import { PaymentFlowModal, OFFICIAL_TRANSFER_NUMBER } from "@/components/subscriptions/PaymentFlowModal";
import { SubscriptionHero } from "@/components/subscriptions/SubscriptionHero";
import { Card, Badge } from "@/components/ui";
import { showGlobalToast } from "@/components/common/GlobalToast";

const PLANS_CONFIG: PlanItem[] = [
  {
    id: "trial",
    nameAr: "الاشتراك المجاني (تجريبي)",
    durationDays: 30,
    durationLabel: "صلاحية 30 يوماً مجاناً بكامل المزايا",
    price: 0,
    badge: "هدية الانضمام 🎁",
    isTrial: true,
  },
  {
    id: "monthly",
    nameAr: "الاشتراك الشهري",
    durationDays: 30,
    durationLabel: "صلاحية شهر كامل (30 يوماً)",
    price: 150,
    badge: "تجديد مرن",
  },
  {
    id: "quarterly",
    nameAr: "اشتراك 3 شهور (ربع سنوي)",
    durationDays: 90,
    durationLabel: "صلاحية 3 أشهر (90 يوماً)",
    price: 400,
    originalPrice: 450,
    discountText: "وفر 50 ج.م",
    badge: "توفير مميز ⚡",
  },
  {
    id: "semi_annual",
    nameAr: "اشتراك 6 شهور (نصف سنوي)",
    durationDays: 180,
    durationLabel: "صلاحية 6 أشهر (180 يوماً)",
    price: 800,
    originalPrice: 900,
    discountText: "وفر 100 ج.م",
    badge: "قيمة عالية 🔥",
  },
  {
    id: "annual_vip",
    nameAr: "الاشتراك السنوي (VIP)",
    durationDays: 365,
    durationLabel: "صلاحية سنة كاملة (12 شهراً)",
    price: 1500,
    originalPrice: 1800,
    discountText: "وفر 300 ج.م • شهران مجاناً",
    badge: "الأكثر طلباً ⭐",
    popular: true,
  },
];

const UNIFIED_SYSTEM_FEATURES: string[] = [
  "مساعد الذكاء الاصطناعي الطبي لفحص التعارضات والتداخلات الدوائية لحظياً",
  "وصول كامل لبنك الأدوية المصري والعالمي المحدث (أكثر من 43,700 دواء ومستحضر)",
  "تعبئة ذكية تلقائية للجرعات والمواعيد ومدة العلاج مع حفظ سجل المرضى",
  "طباعة الروشتات بجودة عالية (A4 / A5) وتصدير PDF وإرسال مباشر عبر واتساب",
  "تخصيص كامل لهوية ولوجو العيادة وبيانات الطبيب والفروع المتعددة",
  "نسخ احتياطي سحابي مشفر وتحديثات تلقائية مستمرة ودعم فني سريع",
];

export default function SubscriptionsPage() {
  const {
    subscriptions,
    machineId,
    subscriberId,
    submitSubscriptionRequest,
    syncWithServer,
    initHardwareId,
  } = useSubscriptionStore();
  const { clinic } = useClinicStore();

  const [mounted, setMounted] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanItem | null>(null);

  useEffect(() => {
    setMounted(true);
    initHardwareId().then(() => {
      syncWithServer();
    });
  }, [initHardwareId, syncWithServer]);

  const subDetails = getSubscriptionDetails(subscriptions, machineId, subscriberId);
  const userHasUsedTrial = hasUsedFreeTrial(subscriptions, machineId);

  const availablePlans = PLANS_CONFIG.filter((p) => {
    if (p.isTrial && userHasUsedTrial) return false;
    return true;
  });

  const handlePlanSelect = (plan: PlanItem) => {
    setSelectedPlanForModal(plan);
  };

  const handleSubscriptionSubmit = async (formData: any) => {
    await submitSubscriptionRequest(formData);

    useClinicStore.getState().updateClinic({
      doctorName: formData.doctorName,
      nameAr: formData.clinicName,
      phone: formData.senderPhone || clinic.phone,
    });

    showGlobalToast(
      formData.isTrial
        ? "🎉 تم إرسال طلب تفعيل التجربة المجانية بنجاح!"
        : "⚡ تم إرسال طلب الاشتراك بنجاح! جاري المراجعة والتفعيل.",
      "success"
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16 font-sans" dir="rtl">
      {/* Clean Concise Header */}
      <div className="text-center space-y-1.5 pt-1">
        <Badge variant="brand" className="text-[11px] px-3 py-0.5">
          باقات واشتراكات PenRX+ المعتمدة
        </Badge>
        <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
          اختر الباقة المناسبة لعيادتك
        </h1>
      </div>

      {/* Hero: Current License Status (Check Activation Only) */}
      {mounted && (
        <SubscriptionHero
          subDetails={subDetails}
          machineId={machineId}
          onRefresh={() => syncWithServer(true)}
        />
      )}

      {/* Stacked Plan Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm sm:text-base font-black text-slate-200 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>الباقات المتاحة</span>
          </h2>
          <span className="text-[11px] text-slate-400">جميع الباقات تشمل كامل المزايا</span>
        </div>

        <div className="flex flex-col gap-3">
          {availablePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={handlePlanSelect}
              isSelected={subDetails.record?.planId === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Unified System Features Card (Grouped Below All Plan Cards) */}
      <Card className="p-5 bg-slate-900/80 border-slate-800/90 rounded-2xl space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-black text-slate-100">
            مزايا منظومة PenRX+ المتاحة في جميع الباقات
          </h3>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
          {UNIFIED_SYSTEM_FEATURES.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Compact Security & Support Footer */}
      <Card className="p-4 bg-slate-900/50 border-slate-800/80 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-xs">تشفير وأمان تام</h4>
              <p className="text-[10px] text-slate-400">حماية كاملة لبيانات العيادة</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-xs">تحديثات مجانية</h4>
              <p className="text-[10px] text-slate-400">تحديث تلقائي للأدوية والأسعار</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-200 text-xs">دعم فني واتساب</h4>
              <p dir="ltr" className="text-[10px] text-emerald-400 font-mono font-bold text-right">
                {OFFICIAL_TRANSFER_NUMBER}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Flow Modal */}
      <PaymentFlowModal
        isOpen={Boolean(selectedPlanForModal)}
        onClose={() => setSelectedPlanForModal(null)}
        plan={selectedPlanForModal}
        machineId={machineId}
        onSubmit={handleSubscriptionSubmit}
        defaultDoctorName={clinic.doctorName}
        defaultClinicName={clinic.nameAr || clinic.name}
        defaultPhone={clinic.phone}
      />
    </div>
  );
}
