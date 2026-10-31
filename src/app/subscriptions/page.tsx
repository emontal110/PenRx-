"use client";

import React, { useState, useEffect } from "react";
import { Crown, Sparkles, ShieldCheck, Phone, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import {
  useSubscriptionStore,
  getSubscriptionDetails,
  hasUsedFreeTrial,
} from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { PlanCard, PlanItem } from "@/components/subscriptions/PlanCard";
import { PaymentFlowModal, OFFICIAL_TRANSFER_NUMBER } from "@/components/subscriptions/PaymentFlowModal";
import { SubscriptionHero } from "@/components/subscriptions/SubscriptionHero";
import { Button, Card, Badge } from "@/components/ui";
import { showGlobalToast } from "@/components/common/GlobalToast";

const PLANS_CONFIG: PlanItem[] = [
  {
    id: "trial",
    nameAr: "الاشتراك المجاني (تجريبي)",
    durationDays: 30,
    durationLabel: "شهر كامل (30 يوماً مجاناً)",
    price: 0,
    badge: "هدية الانضمام • مجاناً بالكامل 🎁",
    isTrial: true,
    features: [
      "تجربة مجانية بالكامل لمدة شهر (30 يوماً)",
      "مساعد الذكاء الاصطناعي لفحص وتنبيه تعارض وتداخل الأدوية لحظياً",
      "وصول كامل لبنك الأدوية الشامل (أكثر من 43,000 دواء ومستحضر)",
      "التعبئة التلقائية الذكية للجرعات والمواعيد والمدة",
      "طباعة الروشتات بجودة عالية وتصدير PDF ومشاركة واتساب مباشرة",
      "تخصيص لوجو العيادة وبيانات الطبيب بالكامل",
    ],
  },
  {
    id: "monthly",
    nameAr: "الاشتراك الشهري",
    durationDays: 30,
    durationLabel: "تجديد شهري مرن (30 يوماً)",
    price: 150,
    badge: "تجديد مرن",
    features: [
      "تجديد شهري مرن بقيمة 150 جنيه شهرياً",
      "مساعد الذكاء الاصطناعي لكشف تعارض وتداخل الأدوية والجرعات",
      "وصول غير محدود لبنك الأدوية المحدث مع التعبئة الذكية للجرعات",
      "تحديث صامت وتلقائي لقاعدة الأدوية والأسعار بشكل دوري",
      "طباعة روشتات ومشاركة واتساب مباشرة غير محدودة للمرضى",
      "تحديثات سحابية مستمرة ودعم فني سريع",
    ],
  },
  {
    id: "quarterly",
    nameAr: "اشتراك 3 شهور (ربع سنوي)",
    durationDays: 90,
    durationLabel: "صلاحية 3 أشهر (90 يوماً)",
    price: 400,
    originalPrice: 450,
    discountText: "توفير 50 ج.م",
    badge: "وفر 50 ج.م ⚡",
    features: [
      "اشتراك 3 شهور بقيمة 400 جنيه بدلاً من 450",
      "توفير فوري 50 جنيه مباشر",
      "فحص وإرشاد فوري لتعارض وتداخل الأدوية بالذكاء الاصطناعي الطبي",
      "تحديثات بنك الأدوية والذكاء الاصطناعي السحابية اللحظية",
      "دعم فني وتفعيل سريع وإمكانية ربط أجهزة إضافية لعيادتك",
    ],
  },
  {
    id: "semi_annual",
    nameAr: "اشتراك 6 شهور (نصف سنوي)",
    durationDays: 180,
    durationLabel: "صلاحية 6 أشهر (180 يوماً)",
    price: 800,
    originalPrice: 900,
    discountText: "توفير 100 ج.م",
    badge: "وفر 100 ج.م 🔥",
    features: [
      "اشتراك 6 شهور بقيمة 800 جنيه بدلاً من 900",
      "توفير فوري 100 جنيه مباشر",
      "الذكاء الاصطناعي الطبي المتقدم: فحص التعارضات الدوائية وموانع الاستعمال",
      "جميع مميزات النظام بدون أي قيود أو حدود للاستخدام",
      "أولوية قصوى في بنك الأدوية وربط أجهزة متعددة لجميع الفروع",
    ],
  },
  {
    id: "annual_vip",
    nameAr: "الاشتراك السنوي (VIP)",
    durationDays: 365,
    durationLabel: "اشتراك سنوي شامل (12 شهراً)",
    price: 1500,
    originalPrice: 1800,
    discountText: "توفير 300 ج.م 🔥 | شهران مجاناً",
    badge: "الأكثر طلباً وتوفيراً ⭐",
    popular: true,
    features: [
      "اشتراك سنوي شامل بقيمة 1,500 جنيه بدلاً من 1,800 (شهران مجاناً)",
      "مساعد الذكاء الاصطناعي الشامل: فحص التعارض ومطابقة الجرعات والبدائل",
      "دعم مخصص VIP واستجابة فورية عبر الواتساب على مدار الساعة",
      "تحديثات حصرية مجانية طوال السنة لكافة الميزات الجديدة",
      "ربط أجهزة متعددة (العيادة + لابتوب شخصي + هاتف) مع ترخيص رسمي",
    ],
  },
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
    initHardwareId();
    syncWithServer();
  }, [initHardwareId, syncWithServer]);

  const subDetails = getSubscriptionDetails(subscriptions, machineId, subscriberId);
  const userHasUsedTrial = hasUsedFreeTrial(subscriptions, machineId);

  // Filter plans: hide trial if already used
  const availablePlans = PLANS_CONFIG.filter((p) => {
    if (p.isTrial && userHasUsedTrial) return false;
    return true;
  });

  const handlePlanSelect = (plan: PlanItem) => {
    setSelectedPlanForModal(plan);
  };

  const handleSubscriptionSubmit = async (formData: any) => {
    await submitSubscriptionRequest(formData);

    // Sync clinic store
    useClinicStore.getState().updateClinic({
      doctorName: formData.doctorName,
      nameAr: formData.clinicName,
      phone: formData.senderPhone || clinic.phone,
    });

    showGlobalToast(
      formData.isTrial
        ? "🎉 تم تسجيل طلب تفعيل الفترة التجريبية بنجاح!"
        : "⚡ تم إرسال طلب الاشتراك بنجاح! جاري المراجعة والتفعيل.",
      "success"
    );
  };

  return (
    <div className="space-y-8 pb-16 font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-2 pt-2">
        <Badge variant="brand" className="text-xs px-3 py-1">
          باقات واشتراكات PenRX+ الطبية المعتمدة
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
          اختر الباقة المناسبة لعيادتك
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          نظام متكامل لكتابة الروشتات، إدارة المرضى، وبنك الأدوية بالذكاء الاصطناعي — متوافق مع الكمبيوتر والموبايل
        </p>
      </div>

      {/* Hero: Current License Status */}
      {mounted && (
        <SubscriptionHero
          subDetails={subDetails}
          machineId={machineId}
          onRefresh={() => syncWithServer(true)}
          onOpenRenew={() => {
            const annual = PLANS_CONFIG.find((p) => p.id === "annual_vip") || PLANS_CONFIG[1];
            setSelectedPlanForModal(annual);
          }}
        />
      )}

      {/* Plans Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>الباقات المتاحة للاشتراك والتجديد</span>
          </h2>
          <span className="text-xs text-slate-400">أسعار رسمية ثابتة بالجنيه المصري</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

      {/* Security & Support Footer Banner */}
      <Card className="p-6 bg-slate-900/60 border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-right">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">تشفير وأمان تام</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                بيانات المرضى والروشتات مشفرة بالكامل ومحمية وفق أعلى معايير الخصوصية الطبية
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">تحديثات دورية مجانية</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                تحديث صامت وتلقائي لقائمة الأدوية والأسعار والميزات الجديدة دون أي رسوم خفية
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-200">دعم فني مباشر على الواتساب</h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                فريق دعم فني متواجد لمساعدتك في أي استفسار أو تفعيل على الرقم {OFFICIAL_TRANSFER_NUMBER}
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
