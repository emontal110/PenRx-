"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Crown,
  Check,
  Sparkles,
  Laptop,
  Smartphone,
  Copy,
  Clock,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  AlertCircle,
  X,
  CreditCard,
  Pill,
  Bot,
  Zap,
  Link2,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails, SubscriptionRecord } from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";

interface Plan {
  id: string;
  nameAr: string;
  durationLabel: string;
  price: number;
  originalPrice?: number;
  discountText?: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
  isTrial?: boolean;
  features: string[];
}

export default function SubscriptionsPage() {
  const {
    subscriptions,
    machineId,
    subscriberId,
    submitSubscriptionRequest,
    linkDeviceToSubscriber,
    syncWithServer,
  } = useSubscriptionStore();
  const { clinic } = useClinicStore();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"vodafone" | "instapay">("vodafone");
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [existingSubIdInput, setExistingSubIdInput] = useState("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const TRANSFER_NUMBER = "01094085228";

  // Fast polling sync (every 2.5 seconds) for instant unlock upon portal action
  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 2500);
    return () => clearInterval(interval);
  }, [syncWithServer]);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const currentSub = subDetails.record || null;
  const activeSubscriberId = subDetails.subscriberId || subscriberId;

  const PLANS: Plan[] = [
    {
      id: "trial",
      nameAr: "الاشتراك المجاني (تجريبي)",
      durationLabel: "تجريبي لمدة شهر كامل (30 يوم)",
      price: 0,
      badge: "هدية الانضمام 🎁",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      isTrial: true,
      features: [
        "تجربة مجانية بالكامل لمدة شهر (30 يوم)",
        "وصول كامل لبنك الأدوية (43,500+ دواء)",
        "محرك البحث الفوري فائق السرعة",
        "طباعة روشتات ومشاركة واتساب مباشرة",
        "إضافة فرع عيادة وتخصيص اللوجو والبيانات",
      ],
    },
    {
      id: "monthly",
      nameAr: "الاشتراك الشهري",
      durationLabel: "تجديد شهري مرن",
      price: 150,
      features: [
        "تجديد شهري مرن بقيمة 150 جنيه",
        "وصول غير محدود لبنك الأدوية المحدث",
        "تنبيهات وفحص الذكاء الاصطناعي للأمان",
        "طباعة ومشاركة واتساب غير محدودة",
        "إمكانية ربط أجهزة متعددة (كمبيوتر + موبايل)",
      ],
    },
    {
      id: "quarterly",
      nameAr: "اشتراك 3 شهور",
      durationLabel: "لكل 3 شهور",
      price: 400,
      originalPrice: 450,
      discountText: "توفير 50 ج.م",
      badge: "خصم 50 ج.م",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      features: [
        "اشتراك 3 شهور بقيمة 400 جنيه بدلاً من 450",
        "توفير 50 جنيه مباشر",
        "تحديثات بنك الأدوية والذكاء الاصطناعي اللحظية",
        "دعم فني وتفعيل سريع خلال دقائق",
        "ربط حتى جهازين (كمبيوتر العيادة + الهاتف)",
      ],
    },
    {
      id: "semi_annual",
      nameAr: "اشتراك 6 شهور",
      durationLabel: "لكل 6 شهور",
      price: 800,
      originalPrice: 900,
      discountText: "تخفيض 100 ج.م",
      badge: "تخفيض 100 ج.م",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      features: [
        "اشتراك 6 شهور بقيمة 800 جنيه بدلاً من 900",
        "توفير 100 جنيه مباشر",
        "جميع مميزات النظام بدون أي قيود",
        "أولوية قصوى في بنك الأدوية والميزات الحصرية",
        "ربط أجهزة متعددة لكل فروع العيادة",
      ],
    },
    {
      id: "annual_vip",
      nameAr: "الاشتراك السنوي (VIP)",
      durationLabel: "اشتراك سنوي كامل (12 شهر)",
      price: 1600,
      originalPrice: 1800,
      discountText: "توفير 200 ج.م ⭐",
      badge: "الأكثر مبيعاً 🔥 | شهران مجاناً",
      badgeColor: "bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-md",
      popular: true,
      features: [
        "اشتراك سنوي كامل بقيمة 1,600 جنيه بدلاً من 1,800",
        "توفير 200 جنيه مباشر (شهران مجاناً)",
        "دعم مخصص VIP واستجابة فورية عبر الواتساب",
        "تحديثات حصرية مجانية طوال السنة",
        "ربط أجهزة غير محدود (أجهزة العيادة والمنزل والموبايل)",
        "تفعيل رسمي وترخيص معتمد للعيادة",
      ],
    },
  ];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 3000);
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const isTrialPlan = selectedPlan.price === 0;
    if (!isTrialPlan && (!senderPhone.trim() || !transactionRef.trim())) {
      alert("يرجى إدخال رقم هاتف المحول ورقم العملية المرجعي.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSubscriptionRequest({
        planId: selectedPlan.id,
        planName: selectedPlan.nameAr,
        price: selectedPlan.price,
        paymentMethod,
        senderPhone: senderPhone.trim() || "",
        transactionRef: transactionRef.trim() || `TRIAL-${Date.now().toString().slice(-6)}`,
        doctorName: clinic.doctorName,
        clinicName: clinic.nameAr || clinic.name,
        durationDays: selectedPlan.id === "annual_vip" ? 365 : selectedPlan.id === "semi_annual" ? 180 : selectedPlan.id === "quarterly" ? 90 : 30,
        isTrial: isTrialPlan,
      });

      setSelectedPlan(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingSubIdInput.trim()) return;

    setIsLinking(true);
    setLinkMessage(null);
    try {
      const ok = await linkDeviceToSubscriber(existingSubIdInput.trim());
      if (ok) {
        setLinkMessage("✅ تم إرسال طلب ربط هذا الجهاز بنجاح! سيتم تفعيله من الإدارة فوراً.");
      } else {
        setLinkMessage("⚠️ لم يتم العثور على معرّف المشترك هذا. يرجى التأكد من الكود أو التواصل مع الإدارة.");
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="space-y-10 pb-16 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-100">بوابة الاشتراكات وتراخيص الأجهزة</h2>
            <p className="text-xs text-slate-400">إدارة التراخيص وتعدد الأجهزة لكل طبيب</p>
          </div>
        </div>

        {subDetails.isActive && (
          <Link
            href="/"
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 transition-all flex items-center gap-2"
          >
            <span>الدخول للبرنامج 🚀</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        )}
      </div>

      {/* DUAL IDENTIFIERS CARD: Subscriber ID vs Device Machine ID */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/30 shadow-2xl space-y-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>بيانات ترخيص العيادة والأجهزة المربوطة</span>
            </h3>
            <p className="text-xs text-slate-400">
              معرّف المشترك يخص حسابك الطبي، بينما معرّف الجهاز يخص هذا الجهاز تحديداً
            </p>
          </div>

          <div className={`px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-2 shadow-lg ${subDetails.badgeColor}`}>
            <Sparkles className="w-4 h-4" />
            <span>{subDetails.statusLabel}</span>
          </div>
        </div>

        {/* The Two Distinct Identifiers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Subscriber ID Card (Distinct from Machine ID) */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-400" />
                <span>معرّف المشترك الخاص بك (Subscriber ID):</span>
              </span>
              {copySuccess === "subscriber" && (
                <span className="text-[11px] font-black text-purple-400">✓ تم النسخ!</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-black text-purple-300 text-lg sm:text-xl tracking-wider" dir="ltr">
                {activeSubscriberId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(activeSubscriberId, "subscriber")}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ كود المشترك</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              هذا المعرف الثابت يمثل حسابك الطبي، وتستطيع ربط أي أجهزة جديدة به.
            </p>
          </div>

          {/* 2. Device Machine ID Card */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>معرّف هذا الجهاز (Hardware Machine ID):</span>
              </span>
              {copySuccess === "machine" && (
                <span className="text-[11px] font-black text-emerald-400">✓ تم النسخ!</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-black text-emerald-400 text-sm sm:text-base tracking-wider truncate" dir="ltr">
                {machineId}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(machineId, "machine")}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ كود الجهاز</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              أرسل هذا المعرف للإدارة لربط هذا الجهاز بحسابك فوراً.
            </p>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold">نوع الباقة:</span>
            <p className="text-base font-black text-slate-100">{subDetails.planName}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold">الأجهزة المربوطة والمصرّحة:</span>
            <p className="text-base font-black text-purple-400 font-mono">
              {subDetails.allowedDevicesCount} {subDetails.allowedDevicesCount === 1 ? "جهاز واحد" : "أجهزة مفعّلة"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 font-bold">الأيام المتبقية:</span>
            <p className="text-xl font-black text-emerald-400 font-mono">
              {subDetails.daysRemaining} <span className="text-xs font-bold text-slate-400">يوماً</span>
            </p>
          </div>
        </div>

        {/* If Pending Banner with WhatsApp Direct Action */}
        {subDetails.isPending && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <Clock className="w-4 h-4 animate-pulse text-amber-400" />
              <span>طلب الاشتراك قيد المراجعة الإدارية (تفعيل لحظي):</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              يرجى إرسال صورة التحويل إلى رقم الواتساب المباشر <strong className="text-emerald-400 font-mono">01094085228</strong> فور إتمام التحويل لتفعيل حسابك وجهازك على الفور.
            </p>
            <a
              href={`https://wa.me/201094085228?text=${encodeURIComponent(
                `مرحباً، قمت بطلب اشتراك (${currentSub?.planName})\nكود المشترك: ${activeSubscriberId}\nكود الجهاز: ${machineId}\nرقم العملية: ${currentSub?.transactionRef}\nرقم الهاتف: ${currentSub?.senderPhone}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال إيصال التحويل عبر الواتساب (01094085228) 💬</span>
            </a>
          </div>
        )}

        {/* SECTION: LINK THIS DEVICE TO AN EXISTING SUBSCRIBER ACCOUNT */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-3">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
            <Link2 className="w-4 h-4 text-purple-400" />
            <span>هل لديك حساب اشتراك سابق وتريد ربط هذا الجهاز الإضافي به؟</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            إذا كنت مشتركاً بالفعل وتريد تشغيل PenRX+ على موبايلك أو لابتوب إضافي، أدخل معرّف المشترك الخاص بك (Subscriber ID) بالأسفل لربطه باشتراكك القائم فوراً:
          </p>

          <form onSubmit={handleLinkDeviceSubmit} className="flex flex-wrap sm:flex-nowrap gap-2.5 max-w-md">
            <input
              type="text"
              required
              value={existingSubIdInput}
              onChange={(e) => setExistingSubIdInput(e.target.value)}
              placeholder="مثال: SUB-8402"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs font-bold text-purple-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={isLinking}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              <span>{isLinking ? "جاري الربط..." : "ربط هذا الجهاز 🔗"}</span>
            </button>
          </form>

          {linkMessage && (
            <p className="text-xs font-bold text-purple-300 pt-1">
              {linkMessage}
            </p>
          )}

          <div className="pt-1">
            <a
              href={`https://wa.me/201094085228?text=${encodeURIComponent(
                `مرحباً، أنا مشترك في PenRX+ بكود المشترك (${activeSubscriberId})، وأرغب في إضافة جهازي الجديد هذا:\nمعرّف الجهاز (Machine ID): ${machineId}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:underline font-bold"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>أو إرسال كود الجهاز الجديد للإدارة عبر الواتساب لإضافته بنقرة زر ←</span>
            </a>
          </div>
        </div>
      </div>

      {/* Pricing Cards Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
          <Crown className="w-4 h-4" />
          <span>خطط وباقات أسعار PenRX+</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
          اختر الباقة المناسبة لعيادتك واستمتع بجميع المميزات
        </h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          تفعيل فوري خلال دقائق، بدون أي مصاريف خفية، مع دعم ربط أجهزة متعددة لنفس الحساب.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 items-stretch">
        {PLANS.map((plan) => {
          const isPopular = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:scale-[1.02] ${
                isPopular
                  ? "bg-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/50 ring-4 ring-emerald-500/20"
                  : "bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-xl"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 shrink-0 whitespace-nowrap">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide border shadow-md ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div className="text-center pt-2 pb-4 border-b border-slate-800 space-y-1.5">
                  <h3 className="text-base font-black text-slate-100">{plan.nameAr}</h3>
                  <span className="text-[11px] text-slate-400 font-medium block">{plan.durationLabel}</span>

                  <div className="pt-2 flex items-baseline justify-center gap-1">
                    {plan.price === 0 ? (
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400">مجاناً</span>
                    ) : (
                      <>
                        <span className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
                          {plan.price}
                        </span>
                        <span className="text-xs font-bold text-emerald-400">ج.م</span>
                      </>
                    )}
                    {plan.originalPrice && (
                      <span className="text-xs text-slate-500 line-through mr-1 font-mono">
                        {plan.originalPrice} ج.م
                      </span>
                    )}
                  </div>

                  {plan.discountText && (
                    <span className="inline-block text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {plan.discountText}
                    </span>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2 py-1 text-xs">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug text-[11px]">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full py-3 rounded-2xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isPopular
                      ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-emerald-950/50"
                      : plan.isTrial
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-emerald-500/50"
                  }`}
                >
                  <span>{plan.price === 0 ? "تفعيل التجربة المجانية 🚀" : `اشترك الآن (${plan.price} ج.م)`}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment / Activation Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 text-right border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Crown className="w-4 h-4" />
                <span>تفعيل باقة: {selectedPlan.nameAr}</span>
              </span>
              <h3 className="text-lg font-black text-slate-100">
                القيمة: {selectedPlan.price === 0 ? "مجاناً (0 ج.م)" : `${selectedPlan.price} ج.م`}
              </h3>
            </div>

            {/* Payment Method Selector (Vodafone vs InstaPay) */}
            {selectedPlan.price > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("vodafone")}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "vodafone"
                      ? "bg-rose-500/15 border-rose-500 text-rose-300 shadow-lg"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="relative w-24 h-8">
                    <Image src="/vodafone-cash.png" alt="Vodafone Cash" fill className="object-contain" />
                  </div>
                  <span className="text-[11px] font-black">فودافون كاش</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("instapay")}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === "instapay"
                      ? "bg-purple-500/15 border-purple-500 text-purple-300 shadow-lg"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="relative w-24 h-8">
                    <Image src="/instapay.png" alt="InstaPay" fill className="object-contain" />
                  </div>
                  <span className="text-[11px] font-black">إنستا باي (InstaPay)</span>
                </button>
              </div>
            )}

            {/* Transfer Number */}
            {selectedPlan.price > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <span className="text-slate-400 font-bold block">
                  رقم التحويل المباشر ({paymentMethod === "vodafone" ? "فودافون كاش" : "إنستاباي"}):
                </span>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-base font-mono font-black text-emerald-400 tracking-widest" dir="ltr">
                    {TRANSFER_NUMBER}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(TRANSFER_NUMBER, "transfer")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Form */}
            <form onSubmit={handleConfirmSubmit} className="space-y-4 text-xs">
              {selectedPlan.price > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">رقم الهاتف المحول منه:</label>
                    <input
                      type="text"
                      required
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="010..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-300">رقم العملية المرجعي (Ref ID):</label>
                    <input
                      type="text"
                      required
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="رقم المرجع من إيصال التحويل..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/50 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4" />
                  <span>{isSubmitting ? "جاري الإرسال..." : selectedPlan.price === 0 ? "تأكيد الاشتراك المجاني فوراً 🚀" : "تأكيد وإرسال طلب التفعيل 🚀"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
