"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Crown,
  Check,
  Sparkles,
  Laptop,
  Copy,
  Clock,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  X,
  CreditCard,
  Zap,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  CheckCheck,
  Lock,
  PartyPopper,
  Gift,
  ArrowUpRight,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Bot,
  FolderClock,
  Printer,
  Sliders,
  Palette,
  WifiOff,
  Share2,
  Download,
  Smartphone,
  Settings,
} from "lucide-react";
import {
  useSubscriptionStore,
  getSubscriptionDetails,
  hasUsedFreeTrial,
} from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { NewRxGuard } from "@/components/prescription/NewRxGuard";
import { showGlobalToast } from "@/components/common/GlobalToast";

interface PaidPlan {
  id: string;
  nameAr: string;
  durationDays: number;
  durationLabel: string;
  price: number;
  originalPrice?: number;
  discountText?: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
  features: string[];
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const {
    subscriptions,
    machineId,
    subscriberId,
    submitSubscriptionRequest,
    cancelPendingRequest,
    syncWithServer,
    initHardwareId,
  } = useSubscriptionStore();
  const { clinic } = useClinicStore();

  const [mounted, setMounted] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("trial");

  // Modal & Flow states
  const [activePlanForCheckout, setActivePlanForCheckout] = useState<{
    id: string;
    nameAr: string;
    durationDays: number;
    durationLabel: string;
    price: number;
    isTrial?: boolean;
  } | null>(null);

  // Smoothly scroll to top when opening checkout
  useEffect(() => {
    if (activePlanForCheckout) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activePlanForCheckout]);

  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingPlanToConfirm, setPendingPlanToConfirm] = useState<{
    id: string;
    nameAr: string;
    durationDays: number;
    durationLabel: string;
    price: number;
    isTrial?: boolean;
  } | null>(null);

  // Activation Welcome Modal States
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const wasPendingRef = useRef(false);

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState<"vodafone" | "instapay">("vodafone");
  const [senderPhone, setSenderPhone] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [checkoutDoctorName, setCheckoutDoctorName] = useState("");
  const [checkoutClinicName, setCheckoutClinicName] = useState("");
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [showIosGuideModal, setShowIosGuideModal] = useState(false);

  const TRANSFER_NUMBER = "01094085228";

  const subDetails = getSubscriptionDetails(subscriptions, machineId, subscriberId);
  const currentSub = subDetails.record || null;
  const trialClaimed = hasUsedFreeTrial(subscriptions, machineId);

  // Fast polling sync (every 3 seconds when pending for instant unlock upon portal action, otherwise 8s)
  useEffect(() => {
    setMounted(true);
    initHardwareId().catch(() => {});
    syncWithServer(true);
    const intervalMs = subDetails.isPending ? 3000 : 8000;
    const interval = setInterval(() => {
      syncWithServer(true);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [syncWithServer, initHardwareId, subDetails.isPending]);

  // Auto-redirect to dashboard when subscription is active
  useEffect(() => {
    if (mounted && subDetails.isActive) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mounted, subDetails.isActive, router]);

  // Monitor activation transition (PENDING -> ACTIVE) to show welcome modal reliably
  useEffect(() => {
    if (subDetails.isPending) {
      wasPendingRef.current = true;
      try {
        localStorage.setItem("penrx_was_pending", "true");
      } catch {}
    } else if (subDetails.isActive) {
      let isNewlyActivated = wasPendingRef.current;
      try {
        if (localStorage.getItem("penrx_was_pending") === "true") {
          isNewlyActivated = true;
          localStorage.removeItem("penrx_was_pending");
        }
      } catch {}

      if (isNewlyActivated) {
        wasPendingRef.current = false;
        setShowWelcomeModal(true);
      }
    }
  }, [subDetails.isPending, subDetails.isActive]);

  // Manual button check with direct feedback and instant entry
  const handleManualActivationCheck = async () => {
    setIsManualSyncing(true);
    try {
      await syncWithServer(true);
      const state = useSubscriptionStore.getState();
      const details = getSubscriptionDetails(state.subscriptions, state.machineId, state.subscriberId);
      if (details.isActive) {
        showGlobalToast("تم تأكيد وتفعيل اشتراكك بنجاح! مرحباً بك 🌿", "success");
        setTimeout(() => {
          router.push("/");
        }, 500);
      } else {
        showGlobalToast("الطلب مسجل ونظام البورتال يؤكد المراجعة ⏳", "info");
      }
    } catch {
      showGlobalToast("جاري فحص حالة التفعيل تلقائياً...", "info");
    } finally {
      setTimeout(() => setIsManualSyncing(false), 600);
    }
  };

  // Countdown timer for auto-redirect when welcome modal is open
  useEffect(() => {
    if (!showWelcomeModal) return;

    if (redirectCountdown <= 0) {
      setShowWelcomeModal(false);
      router.push("/settings");
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showWelcomeModal, redirectCountdown, clinic, router]);

  // ==========================================
  // PLAN CONFIGURATIONS
  // ==========================================
  const TRIAL_PLAN = {
    id: "trial",
    nameAr: "الاشتراك المجاني (تجريبي)",
    durationDays: 30,
    durationLabel: "شهر كامل (30 يوماً مجاناً)",
    price: 0,
    badge: "هدية الانضمام • مجاناً بالكامل 🎁",
    badgeColor: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 text-slate-950 font-black border-emerald-300 shadow-lg shadow-emerald-950/60",
    isTrial: true,
    features: [
      "تجربة مجانية بالكامل لمدة شهر (30 يوماً)",
      "🧠 مساعد الذكاء الاصطناعي لفحص وتنبيه تعارض وتداخل الأدوية (AI Drug Interactions) لحظياً",
      "وصول كامل لبنك الأدوية الشامل (+200,000 دواء ومستحضر)",
      "التعبئة التلقائية الذكية للجرعات والمواعيد والمدة حسب العائلة الدوائية",
      "طباعة الروشتات بجودة عالية وتصدير PDF ومشاركة واتساب مباشرة",
      "تخصيص لوجو العيادة وبيانات الطبيب بالكامل",
    ],
  };

  const PAID_PLANS: PaidPlan[] = [
    {
      id: "monthly",
      nameAr: "الاشتراك الشهري",
      durationDays: 30,
      durationLabel: "تجديد شهري مرن (30 يوماً)",
      price: 150,
      badge: "تجديد مرن",
      badgeColor: "bg-slate-200 text-slate-950 font-black border-slate-300 shadow-md",
      features: [
        "تجديد شهري مرن بقيمة 150 جنيه شهرياً",
        "🧠 مساعد الذكاء الاصطناعي لكشف تعارض وتداخل الأدوية والجرعات اللحظي لحماية المريض",
        "وصول غير محدود لبنك الأدوية المحدث (+200,000 دواء ومستحضر) مع التعبئة الذكية للجرعات",
        "تحديث صامت وتلقائي لقاعدة الأدوية والأسعار بشكل دوري دون تدخل يدوي",
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
      badgeColor: "bg-amber-400 text-slate-950 font-black border-amber-300 shadow-md",
      features: [
        "اشتراك 3 شهور بقيمة 400 جنيه بدلاً من 450",
        "توفير فوري 50 جنيه مباشر",
        "🧠 فحص وإرشاد فوري لتعارض وتداخل الأدوية بالذكاء الاصطناعي الطبي لحظة بلحظة",
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
      badgeColor: "bg-cyan-400 text-slate-950 font-black border-cyan-300 shadow-md",
      features: [
        "اشتراك 6 شهور بقيمة 800 جنيه بدلاً من 900",
        "توفير فوري 100 جنيه مباشر",
        "🧠 الذكاء الاصطناعي الطبي المتقدم: فحص التعارضات الدوائية الحرجة وحساسية المرضى وموانع الاستعمال",
        "جميع مميزات النظام بدون أي قيود أو حدود للاستخدام",
        "أولوية قصوى في بنك الأدوية وربط أجهزة متعددة لجميع الفروع واللابتوب",
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
      badgeColor: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 text-slate-950 font-black border-emerald-300 shadow-lg",
      popular: true,
      features: [
        "اشتراك سنوي شامل بقيمة 1,500 جنيه بدلاً من 1,800 (شهران مجاناً)",
        "🧠 مساعد الذكاء الاصطناعي الشامل: فحص وتنبيه تعارض وتداخل الأدوية التفاعلي ومطابقة الجرعات والبدائل الآمنة",
        "دعم مخصص VIP واستجابة فورية عبر الواتساب على مدار الساعة",
        "تحديثات حصرية مجانية طوال السنة لكافة الميزات الجديدة",
        "ربط أجهزة متعددة (العيادة + لابتوب شخصي + هاتف) مع ترخيص رسمي للمنشأة الطبية",
      ],
    },
  ];
 
  // Unified plans array for the modern vertical stacked cards (Free Trial FIRST!)
  const ALL_PLANS = [
    {
      ...TRIAL_PLAN,
      periodMonths: "تجربة 30 يوماً",
      discountBadge: "مجانية بالكامل 🎁",
      discountBadgeColor: "bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black",
      isTrial: true,
      popular: false,
    },
    {
      ...PAID_PLANS[3], // annual_vip
      periodMonths: "12 شهر (VIP)",
      discountBadge: "خصم 20% 🔥",
      discountBadgeColor: "bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 text-slate-950 font-black",
      popular: true,
      isTrial: false,
    },
    {
      ...PAID_PLANS[2], // semi_annual
      periodMonths: "6 شهور",
      discountBadge: "وفر 100 ج.م",
      discountBadgeColor: "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30",
      isTrial: false,
    },
    {
      ...PAID_PLANS[1], // quarterly
      periodMonths: "3 شهور",
      discountBadge: "وفر 50 ج.م",
      discountBadgeColor: "bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30",
      isTrial: false,
    },
    {
      ...PAID_PLANS[0], // monthly
      periodMonths: "شهر واحد",
      discountBadge: "تجديد مرن",
      discountBadgeColor: "bg-slate-800 text-slate-300 font-bold border border-slate-700",
      isTrial: false,
    },
  ];

  const selectedPlan =
    ALL_PLANS.find((p) => p.id === selectedPlanId) || ALL_PLANS[0];

  const selectedPaidPlan =
    PAID_PLANS.find((p) => p.id === selectedPlanId) || PAID_PLANS[3];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(label);
    setTimeout(() => setCopySuccess(null), 3000);
  };

  // User clicked on a plan to subscribe
  const handleInitiatePlan = (plan: {
    id: string;
    nameAr: string;
    durationDays: number;
    durationLabel: string;
    price: number;
    isTrial?: boolean;
  }) => {
    // 1. If trial and already claimed, block
    if (plan.isTrial && trialClaimed) {
      alert("لقد قمت بالاستفادة من الفترة التجريبية المجانية مسبقاً لهذا الجهاز. يرجى اختيار إحدى الباقات المدفوعة.");
      return;
    }

    // 2. If user currently has an ACTIVE subscription, show warning modal about overwriting!
    if (subDetails.isActive) {
      setPendingPlanToConfirm(plan);
      setShowOverwriteWarning(true);
      return;
    }

    // 3. Otherwise proceed to checkout full page directly (always start with blank fields)
    setCheckoutDoctorName("");
    setCheckoutClinicName("");
    setSenderPhone("");
    setTransactionRef("");
    setActivePlanForCheckout(plan);
  };

  const handleConfirmOverwrite = () => {
    setShowOverwriteWarning(false);
    if (pendingPlanToConfirm) {
      setCheckoutDoctorName("");
      setCheckoutClinicName("");
      setSenderPhone("");
      setTransactionRef("");
      setActivePlanForCheckout(pendingPlanToConfirm);
      setPendingPlanToConfirm(null);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlanForCheckout) return;

    if (!checkoutDoctorName.trim()) {
      alert("يرجى إدخال اسم الطبيب الكامل.");
      return;
    }
    if (!checkoutClinicName.trim()) {
      alert("يرجى إدخال اسم العيادة / المركز الطبي.");
      return;
    }

    const isTrialPlan = activePlanForCheckout.price === 0;
    if (!isTrialPlan && (!senderPhone.trim() || !transactionRef.trim())) {
      alert("يرجى إدخال رقم هاتف المحول ورقم عملية الدفع.");
      return;
    }

    const finalDocName = checkoutDoctorName.trim();
    const finalClinicName = checkoutClinicName.trim();

    setIsSubmitting(true);
    try {
      await submitSubscriptionRequest({
        planId: activePlanForCheckout.id,
        planName: activePlanForCheckout.nameAr,
        price: activePlanForCheckout.price,
        paymentMethod,
        senderPhone: senderPhone.trim() || "",
        transactionRef: transactionRef.trim() || `TRIAL-${Date.now().toString().slice(-6)}`,
        doctorName: finalDocName,
        clinicName: finalClinicName,
        durationDays: activePlanForCheckout.durationDays,
        isTrial: isTrialPlan,
      });

      // Update local clinic store with subscriber info (keep isProfileSaved false until doctor saves in settings)
      useClinicStore.getState().updateClinic({
        doctorName: finalDocName,
        nameAr: finalClinicName,
        phone: senderPhone.trim() || clinic.phone,
        isProfileSaved: false,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("penrx_was_pending", "true");
        if (isTrialPlan) {
          localStorage.setItem("penrx_trial_claimed", "true");
        }
      }

      // Close checkout full page and reset fields
      setActivePlanForCheckout(null);
      setCheckoutDoctorName("");
      setCheckoutClinicName("");
      setSenderPhone("");
      setTransactionRef("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCancelConfirm = () => {
    setIsCancelConfirmOpen(true);
  };

  const handleConfirmCancelPending = async () => {
    setIsCanceling(true);
    try {
      await cancelPendingRequest();
      setIsCancelConfirmOpen(false);
    } finally {
      setIsCanceling(false);
    }
  };

  // ============================================================
  // DEDICATED FULL-PAGE CHECKOUT & PAYMENT SCREEN (صفحة الدفع الكاملة والمنفصلة)
  // ============================================================
  if (activePlanForCheckout) {
    return (
      <div className="space-y-4 pb-12 max-w-xl mx-auto px-3.5 sm:px-6 transition-all duration-300" dir="rtl">
        <div className="space-y-3.5 text-right">
          {/* Top Bar: Back to Plans & Security Indicator */}
          <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setActivePlanForCheckout(null);
                setCheckoutDoctorName("");
                setCheckoutClinicName("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>العودة لاختيار باقة أخرى</span>
            </button>

            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>دفع آمن ومشفّر</span>
            </div>
          </div>

          {/* Selected Plan Details Card - Compact, Refined & No Clutter */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-emerald-500/30 shadow-xl space-y-3 relative overflow-hidden backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Crown className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-emerald-400/90 block">تفاصيل الباقة المختارة</span>
                  <h2 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                    {activePlanForCheckout.nameAr}
                  </h2>
                </div>
              </div>

              <div className="text-left flex flex-col items-end shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80 mb-0.5">
                  {activePlanForCheckout.durationLabel}
                </span>
                <div className="flex items-baseline gap-1" dir="ltr">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    {activePlanForCheckout.price === 0 ? "0" : activePlanForCheckout.price}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {activePlanForCheckout.price === 0 ? "مجاناً" : "ج.م"}
                  </span>
                </div>
              </div>
            </div>

            {/* Machine ID - Small, Discreet & Compact */}
            <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 text-[10px] font-bold shrink-0">معرف الجهاز:</span>
                <span className="font-mono text-emerald-400/90 font-bold text-[11px] truncate tracking-wide" dir="ltr">
                  {machineId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(machineId, "checkout-mid")}
                className="px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 border border-slate-700/60"
              >
                <Copy className="w-2.5 h-2.5" />
                <span>{copySuccess === "checkout-mid" ? "تم" : "نسخ"}</span>
              </button>
            </div>
          </div>

          {/* Payment Details & Inputs Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl space-y-4">
            {/* If Paid Plan: Show Payment Methods & Direct Number */}
            {activePlanForCheckout.price > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    اختر وسيلة التحويل:
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    تحويل فوري ⚡
                  </span>
                </div>

                {/* Payment Methods Grid - Sleek, Compact & Balanced */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Vodafone Cash Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("vodafone")}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer relative flex items-center gap-2.5 text-right ${
                      paymentMethod === "vodafone"
                        ? "bg-rose-500/10 border-rose-500/80 text-rose-200 shadow-md shadow-rose-950/30 ring-1 ring-rose-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 shrink-0">
                      <img
                        src="/vodafone-cash.png"
                        alt="فودافون كاش"
                        className="h-5 w-auto max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black block text-slate-100 truncate">فودافون كاش</span>
                      <span className="text-[10px] text-rose-400 block font-medium">محفظة إلكترونية</span>
                    </div>
                    {paymentMethod === "vodafone" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </button>

                  {/* InstaPay Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("instapay")}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer relative flex items-center gap-2.5 text-right ${
                      paymentMethod === "instapay"
                        ? "bg-purple-500/10 border-purple-500/80 text-purple-200 shadow-md shadow-purple-950/30 ring-1 ring-purple-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 shrink-0">
                      <img
                        src="/instapay.png"
                        alt="إنستا باي"
                        className="h-5 w-auto max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-black block text-slate-100 truncate">إنستا باي</span>
                      <span className="text-[10px] text-purple-400 block font-medium">تحويل لحظي</span>
                    </div>
                    {paymentMethod === "instapay" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                  </button>
                </div>

                {/* Transfer Number Box - Compact, Clean & Visually Calm */}
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>رقم التحويل المعتمد ({paymentMethod === "vodafone" ? "فودافون كاش" : "إنستاباي"}):</span>
                  </div>

                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-sm sm:text-base font-mono font-black text-emerald-400 tracking-wider" dir="ltr">
                      {TRANSFER_NUMBER}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(TRANSFER_NUMBER, "page-transfer")}
                      className="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copySuccess === "page-transfer" ? "تم النسخ" : "نسخ الرقم"}</span>
                    </button>
                  </div>

                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    حول مبلغ <strong className="text-emerald-400 font-mono font-bold">{activePlanForCheckout.price} ج.م</strong> إلى هذا الرقم، ثم أدخل رقم عملية الدفع بالأسفل.
                  </p>
                </div>
              </div>
            )}

            {/* Confirmation Form */}
            <form onSubmit={handleConfirmSubmit} className="space-y-3.5" autoComplete="off">
              <div className="space-y-0.5 pb-1 border-b border-slate-800/80">
                <h3 className="text-xs sm:text-sm font-black text-slate-200">
                  بيانات التأكيد والتفعيل السحابي:
                </h3>
                <p className="text-[10.5px] text-slate-400">
                  يرجى كتابة الاسم والعيادة بدقة كما تريد ظهورهما بالروشتة والبورتال
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Doctor Name */}
                <div className="space-y-1">
                  <label htmlFor="checkout_doctor_name_input" className="font-bold text-slate-300 text-xs block">
                    اسم الطبيب بالكامل (الذي سيظهر بالروشتة): <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="checkout_doctor_name_input"
                    name="checkout_doc_name_custom"
                    type="text"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    value={checkoutDoctorName}
                    onChange={(e) => setCheckoutDoctorName(e.target.value)}
                    placeholder="د. اكتب اسمك هنا..."
                    className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Clinic Name */}
                <div className="space-y-1">
                  <label htmlFor="checkout_clinic_name_input" className="font-bold text-slate-300 text-xs block">
                    اسم العيادة / المركز الطبي: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="checkout_clinic_name_input"
                    name="checkout_clinic_name_custom"
                    type="text"
                    required
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-form-type="other"
                    value={checkoutClinicName}
                    onChange={(e) => setCheckoutClinicName(e.target.value)}
                    placeholder="اكتب اسم العيادة هنا..."
                    className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Sender Phone & Transaction Reference */}
              {activePlanForCheckout.price > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="checkout_sender_phone_input" className="font-bold text-slate-300 text-xs block">
                      رقم الهاتف المحول منه: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="checkout_sender_phone_input"
                      name="checkout_sender_phone"
                      type="tel"
                      required
                      autoComplete="off"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      dir="ltr"
                      className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-mono font-bold text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-right sm:text-left"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="checkout_tx_ref_input" className="font-bold text-slate-300 text-xs block">
                      رقم عملية الدفع: <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="checkout_tx_ref_input"
                      name="checkout_tx_ref"
                      type="text"
                      required
                      autoComplete="off"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="أدخل رقم عملية التحويل أو المرجع..."
                      className="w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-mono font-bold text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Submit Action Button - Balanced, Refined & Elegant */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-950/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isSubmitting
                      ? "جاري إرسال الطلب للبورتال السحابي..."
                      : activePlanForCheckout.price === 0
                      ? "تأكيد وتفعيل الاشتراك التجريبي مجاناً"
                      : `تأكيد وإرسال طلب التفعيل • ${activePlanForCheckout.price} ج.م`}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Instant Support Notice - Compact & Clean */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-200 block text-xs">تحتاج مساعدة فورية في التفعيل؟</span>
              <span className="text-[10px] text-slate-400 block">فريق الدعم متاح عبر الواتساب طوال اليوم</span>
            </div>
            <a
              href="https://wa.me/201094085228"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>واتساب</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-10 max-w-4xl mx-auto px-3.5 sm:px-6 transition-all duration-300">
      {/* ============================================================ */}
      {/* QUICK DOWNLOAD BAR: كمبيوتر • أندرويد • آيفون */}
      {/* ============================================================ */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Download className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>تحميل وتثبيت البرنامج لأجهزتك:</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* Windows PC - Classic Universal Windows Desktop Icon */}
          <a
            href="https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe"
            download
            target="_blank"
            rel="noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer text-center group"
          >
            <svg className="w-4 h-4 text-cyan-400 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0V3.449zm10.949-9.602L24 0v11.4H10.949V2.247zM0 12.6h9.75v9.451L0 20.699V12.6zm10.949 0H24V24l-13.051-1.8V12.6z"/>
            </svg>
            <span>تنزيل نسخة الكمبيوتر</span>
          </a>

          {/* Android Mobile - Classic Universal Android Robot Head Icon */}
          <a
            href="https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+.apk"
            download
            target="_blank"
            rel="noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer text-center group"
          >
            <svg className="w-4 h-4 text-emerald-400 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.412 13.8533 8.1 12 8.1s-3.5902.312-5.1368.8497L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/>
            </svg>
            <span>تنزيل نسخة أندرويد</span>
          </a>

          {/* Apple iPhone - Classic Universal Apple Icon */}
          <button
            type="button"
            onClick={() => setShowIosGuideModal(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer text-center group"
          >
            <svg className="w-4 h-4 text-slate-100 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.86.96-2.95-1 .04-2.18.66-2.83 1.43-.58.67-1.09 1.77-.95 2.83 1.11.09 2.21-.57 2.82-1.31z"/>
            </svg>
            <span>تثبيت نسخة الآيفون</span>
          </button>
        </div>
      </div>
      {/* ============================================================ */}
      {/* CASE 1: WAITING FOR ACTIVATION SCREEN (صفحة انتظار التفعيل) */}
      {/* ============================================================ */}
      {subDetails.isPending && (
        <div className="rounded-3xl bg-slate-900/95 border-2 border-amber-500/40 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl relative overflow-hidden animate-in fade-in duration-300">
          {/* Ambient Glows */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Status Header */}
          <div className="text-center space-y-4 max-w-xl mx-auto">
            {/* Animated Pulsing Radar Icon */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
              <span className="absolute inset-2 rounded-full bg-amber-500/30 animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-950/60">
                <Clock className="w-8 h-8 animate-spin-slow stroke-[2.5]" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>طلب التفعيل قيد المراجعة الإدارية اللحظية</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100">
                تم استلام طلب اشتراكك بنجاح! ⏳
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                بياناتك مسجلة لدينا وجاري التحقق من التفعيل لهذا الجهاز. سيتم فتح البرنامج تلقائياً هنا فور موافقة الإدارة دون الحاجة لإعادة التحميل.
              </p>
            </div>

            {/* Live Auto-Sync Beacon & Instant Refresh Action */}
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-[11px] sm:text-xs">
                  فحص التفعيل اللحظي نشط: <strong className="text-emerald-400">ستظهر لك نافذة الترحيب فوراً</strong> عند تفعيل حسابك من البورتال!
                </span>
              </div>

              <button
                type="button"
                onClick={handleManualActivationCheck}
                disabled={isManualSyncing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-75"
              >
                <RefreshCw className={`w-4 h-4 ${isManualSyncing ? "animate-spin" : ""}`} />
                <span>{isManualSyncing ? "جاري الفحص المباشر لقاعدة البيانات..." : "تم التفعيل من الإدارة؟ اضغط هنا للتحقق الفوري ⚡"}</span>
              </button>
            </div>
          </div>

          {/* Order Summary & Hardware ID Card */}
          <div className="mt-8 max-w-2xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5">
            <h3 className="text-xs font-black text-slate-400 flex items-center gap-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ملخص تفاصيل طلب التفعيل المقدم:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[11px]">الباقة المختارة:</span>
                <p className="text-sm font-black text-slate-100">{currentSub?.planName || "الاشتراك المحدد"}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[11px]">المبلغ المطلوب:</span>
                <p className="text-sm font-black text-emerald-400 font-mono">
                  {currentSub?.price === 0 ? "مجاناً (تجريبي)" : `${currentSub?.price} ج.م`}
                </p>
              </div>

              {currentSub && currentSub.price > 0 && (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 text-[11px]">رقم هاتف المحول:</span>
                    <p className="text-sm font-mono font-black text-slate-200" dir="ltr">
                      {currentSub.senderPhone || "غير مسجل"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 text-[11px]">رقم عملية الدفع:</span>
                    <p className="text-sm font-mono font-black text-purple-300 truncate" dir="ltr">
                      {currentSub.transactionRef || "قيد التسجيل"}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Machine ID Tag */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                  <span>معرّف هذا الجهاز المربوط (Machine ID):</span>
                </span>
                {copySuccess === "pending-machine" && (
                  <span className="text-[11px] font-black text-emerald-400">✓ تم النسخ!</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider truncate" dir="ltr">
                  {machineId}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(machineId, "pending-machine")}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ الكود</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Verification Direct Action */}
            <div className="pt-2 space-y-3">
              <a
                suppressHydrationWarning
                href={`https://wa.me/201094085228?text=${encodeURIComponent(
                  `مرحباً إدارة PenRX+، قمت بطلب تفعيل اشتراك (${currentSub?.planName || "الاشتراك"})\nالقيمة: ${currentSub?.price || 0} ج.م\nمعرّف جهازي (Machine ID): ${mounted ? machineId : ""}\nرقم العملية: ${currentSub?.transactionRef || ""}\nرقم الهاتف المحول: ${currentSub?.senderPhone || ""}\nطبيب: ${clinic.doctorName}\nمرفق لكم إيصال التحويل للتفعيل السريع 🌹`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-center"
              >
                <MessageCircle className="w-5 h-5 shrink-0 stroke-[2.2]" />
                <span>إرسال إيصال التحويل عبر الواتساب لتسريع التفعيل (01094085228)</span>
              </a>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleOpenCancelConfirm}
                  disabled={isCanceling}
                  className="text-xs text-slate-400 hover:text-amber-400 hover:underline font-bold transition-colors cursor-pointer py-1 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تعديل البيانات أو اختيار باقة أخرى</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CASE 2: ACTIVE SUBSCRIPTION HERO BANNER */}
      {/* ============================================================ */}
      {subDetails.isActive && (
        <div className={`rounded-3xl bg-slate-900/90 border p-5 sm:p-8 shadow-xl space-y-5 transition-all ${
          subDetails.daysRemaining <= 3
            ? "border-rose-500/50 shadow-rose-950/20"
            : subDetails.daysRemaining <= 7
            ? "border-amber-500/50 shadow-amber-950/20"
            : "border-emerald-500/30 shadow-emerald-950/20"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border transition-colors shrink-0 ${
                subDetails.daysRemaining <= 3
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : subDetails.daysRemaining <= 7
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-100">اشتراكك مفعل وجاهز للعمل</h2>
                  {subDetails.daysRemaining <= 3 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black border border-rose-500/40 animate-pulse">
                      ينتهي خلال {subDetails.daysRemaining} {subDetails.daysRemaining === 1 ? "يوم" : "أيام"} ⚠️
                    </span>
                  ) : subDetails.daysRemaining <= 7 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/40">
                      ينتهي خلال {subDetails.daysRemaining} أيام ⏳
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                      VIP نشط
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  باقة: <strong className="text-slate-200">{subDetails.planName}</strong> • {clinic.doctorName || "طبيبنا العزيز"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Distinctive Days Remaining Card in same position */}
              <div className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-all text-left ${
                subDetails.daysRemaining <= 3
                  ? "bg-gradient-to-br from-rose-950/60 via-slate-900 to-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/20"
                  : subDetails.daysRemaining <= 7
                  ? "bg-gradient-to-br from-amber-950/60 via-slate-900 to-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/20"
                  : "bg-gradient-to-br from-emerald-950/60 via-slate-900 to-teal-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/20"
              }`}>
                <div className="flex items-center gap-1.5 justify-end">
                  {subDetails.daysRemaining <= 3 ? (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                  ) : subDetails.daysRemaining <= 7 ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  )}
                  <span className="text-[11px] text-slate-300 font-bold">الأيام المتبقية:</span>
                </div>
                <div className="flex items-baseline gap-1 justify-end font-mono">
                  <span className={`text-2xl sm:text-3xl font-black ${
                    subDetails.daysRemaining <= 3
                      ? "text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                      : subDetails.daysRemaining <= 7
                      ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                      : "text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                  }`}>
                    {subDetails.daysRemaining}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">يوماً</span>
                </div>
              </div>

              {/* Action Button: Directly guide to /settings if profile is incomplete, or allow entry to prescriptions */}
              {!clinic.isProfileSaved ? (
                <Link
                  href="/settings"
                  className="flex-1 sm:flex-initial justify-center px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/60 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <span>إكمال بيانات العيادة والطبيب 🏥</span>
                  <ArrowRight className="w-4 h-4 rotate-180 stroke-[2.5]" />
                </Link>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    href="/settings"
                    className="flex-1 sm:flex-initial justify-center px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs border border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Settings className="w-4 h-4 text-emerald-400" />
                    <span>إعدادات العيادة</span>
                  </Link>
                  <Link
                    href="/prescriptions/new"
                    className="flex-1 sm:flex-initial justify-center px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-xl shadow-emerald-950/60 active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>الدخول للروشتات</span>
                    <ArrowRight className="w-4 h-4 rotate-180 stroke-[2.5]" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Machine ID info for linking additional devices */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>معرّف هذا الجهاز (Machine ID):</span>
              </span>
              <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider block" dir="ltr">
                {machineId}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleCopy(machineId, "active-machine")}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess === "active-machine" ? "تم النسخ" : "نسخ المعرّف"}</span>
              </button>

              <a
                suppressHydrationWarning
                href={`https://wa.me/201094085228?text=${encodeURIComponent(
                  `مرحباً، أنا مشترك في PenRX+ (${clinic.doctorName})، وأرغب في ربط هذا الجهاز الإضافي لاشتراكي:\nمعرّف الجهاز الجديد: ${mounted ? machineId : ""}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-emerald-600/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 text-xs font-bold border border-emerald-500/30 hover:border-emerald-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>ربط جهاز إضافي</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CASE 3: NO ACTIVE SUBSCRIPTION - MACHINE ID BANNER */}
      {/* ============================================================ */}
      {!subDetails.isActive && !subDetails.isPending && (
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>معرّف هذا الجهاز (Hardware Machine ID):</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                إذا كان لديك اشتراك قائم على جهاز آخر وتريد ربط هذا الجهاز به، انسخ هذا المعرّف وأرسله للإدارة لربطه فوراً.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider flex-1 sm:flex-initial text-center truncate" dir="ltr">
                {mounted ? machineId : "PRX-..."}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(machineId, "header-machine")}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess === "header-machine" ? "✓ تم" : "نسخ"}</span>
              </button>
              <a
                suppressHydrationWarning
                href={`https://wa.me/201094085228?text=${encodeURIComponent(
                  `مرحباً، أرغب في ربط هذا الجهاز الإضافي لاشتراكي الحالي في PenRX+:\nمعرّف الجهاز (Machine ID): ${mounted ? machineId : ""}\nاسم الطبيب: ${clinic.doctorName}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                title="إرسال كود الجهاز للإدارة لربطه بحسابك"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ربط عبر الواتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODERN COMPACT SUBSCRIPTION CARDS STACK (REPLACES DUAL CARDS) */}
      {/* ============================================================ */}
      {!subDetails.isPending && (
        <div className="space-y-6 max-w-xl mx-auto">
          {/* Section Header */}
          <div className="text-right space-y-1.5 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
                اختر باقتك
              </h2>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-bold">
                {subDetails.isActive ? "تجديد أو ترقية 👑" : "تفعيل فوري وآمن ⚡"}
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm">
              اختر الخطة المناسبة لعيادتك واستمتع بكامل أدوات الذكاء الاصطناعي وبنك الأدوية.
            </p>
          </div>

          {/* VERTICAL STACK OF COMPACT RECTANGULAR CARDS */}
          <div className="space-y-3">
            {ALL_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isTrial = plan.isTrial;
              const isTrialLocked = isTrial && trialClaimed;

              return (
                <div
                  key={plan.id}
                  onClick={() => {
                    if (isTrialLocked) return;
                    setSelectedPlanId(plan.id);
                  }}
                  className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer select-none flex items-center justify-between gap-3 border ${
                    isTrialLocked
                      ? "bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "bg-gradient-to-r from-emerald-500/15 via-slate-900 to-teal-500/15 border-2 border-emerald-400 shadow-xl shadow-emerald-950/60 ring-2 ring-emerald-400/25 scale-[1.01]"
                      : "bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md"
                  }`}
                >
                  {/* Right Side: Duration & Big Price (Matching user screenshot) */}
                  <div className="flex-1 text-right space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-base sm:text-lg font-black ${isSelected ? "text-white" : "text-slate-100"}`}>
                        {plan.periodMonths}
                      </span>
                      {plan.popular && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black border border-teal-500/30">
                          الأكثر طلباً ⭐
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
                        • {plan.nameAr}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {plan.price === 0 ? (
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className="text-2xl sm:text-3xl font-black text-emerald-400"
                            style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
                          >
                            مجاناً
                          </span>
                          <span
                            className="text-xs sm:text-sm font-bold text-slate-400"
                            style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
                          >
                            (0 جنيه مصري)
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${isSelected ? "text-emerald-300" : "text-slate-100"}`}>
                            {plan.price}
                          </span>
                          <span
                            className="text-xs sm:text-sm font-bold text-slate-400"
                            style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
                          >
                            جنيه مصري
                          </span>
                        </>
                      )}

                      {plan.originalPrice && (
                        <span className="text-xs text-slate-500 line-through font-mono mr-1.5">
                          {plan.originalPrice} ج.م
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Left Side: Radio Selector + Distinctive Pill Badge */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isTrialLocked
                          ? "border-slate-700 bg-slate-800"
                          : isSelected
                          ? "border-emerald-400 bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/40"
                          : "border-slate-600 bg-slate-800"
                      }`}
                    >
                      {isTrialLocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                      ) : isSelected ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
                      ) : null}
                    </div>

                    {plan.discountBadge && (
                      <span
                        className={`text-[10px] sm:text-[11px] font-black px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm ${
                          isTrialLocked
                            ? "bg-slate-800 text-slate-500"
                            : isSelected
                            ? "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 font-black shadow-sm"
                            : plan.discountBadgeColor || "bg-slate-800 text-emerald-300 border border-emerald-500/20"
                        }`}
                      >
                        {plan.discountBadge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Action Button (PenRX+ Signature Emerald/Teal/Cyan Gradient) */}
          <div className="pt-3 space-y-2 text-center max-w-sm sm:max-w-md mx-auto">
            <button
              type="button"
              disabled={selectedPlan.isTrial && trialClaimed}
              onClick={() => handleInitiatePlan(selectedPlan)}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                selectedPlan.isTrial && trialClaimed
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                  : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-950/60"
              }`}
            >
              {selectedPlan.isTrial ? (
                trialClaimed ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>تم الاستفادة من التجربة المجانية</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>تفعيل التجربة المجانية الآن (30 يوم)</span>
                  </>
                )
              ) : (
                <>
                  <Crown className="w-4 h-4 fill-slate-950" />
                  <span>اشترك الآن</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
              <span className="font-medium">تطبق الشروط والأحكام</span>
              <span className="text-slate-600">•</span>
              <a
                href="https://wa.me/201094085228"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline font-bold inline-flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>دعم وتفعيل فوري واتساب</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SECTION: COMPREHENSIVE FEATURES SHOWCASE (مميزات استثنائية صُممت للطبيب العصري) */}
      {/* ============================================================ */}
      <section className="pt-10 pb-4 border-t border-slate-800/80 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>منظومة متكاملة لا ينقصها شيء</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">مميزات استثنائية صُممت للطبيب العصري</h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
            تم بناء كل تفصيلة في <span dir="ltr" className="inline-block font-bold">PenRX+</span> لتختصر وقت الكشف، وتضمن أقصى أمان للمريض، وتمنح عيادتك مظهراً طبياً متطوراً.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-right">
          {/* 1. Drug Engine (1,000,000+ items across 5 tiers & Self-Evolving) */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/40">
                <Sparkles className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold mb-2">
                محرك ذاتي التطور • أكثر من مليون صنف
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">محرك بحث ذكي يتطور ذاتياً (Self-Learning)</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                محرك هجين فائق السرعة يبحث في <strong>أكثر من 1,000,000 دواء ومستحضر</strong> و<strong>يتعلم تلقائياً من نمط وصفاتك</strong>؛ فيرفع الأدوية الأكثر استخداماً في عيادتك إلى صدارة النتائج، مع استيعاب فوري لأي دواء أو تركيبة جديدة ومزامنتها سحابياً ومحلياً فور كتابتها.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
              <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span>يتعلم من تكرار وصفاتك ويرفع أدويتك المفضلة للمقدمة تلقائياً</span>
            </div>
          </div>

          {/* 2. AI Interaction Advisor */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-4 shadow-lg shadow-teal-950/40">
                <Bot className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-teal-500/15 text-teal-300 text-[10px] font-bold mb-2">
                ذكاء اصطناعي سريري
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">مساعد الذكاء الاصطناعي وتعارض الأدوية</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                فاحص استباقي يحلل الروشتة في أجزاء من الثانية؛ لتنبيهك فوراً بأي تعارضات أو تفاعلات دوائية خطيرة (Drug-Drug Interactions) مع اقتراح البدائل والجرعات الآمنة تلقائياً.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-teal-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>أمان طبي كامل وتفادي الأخطاء الدوائية</span>
            </div>
          </div>

          {/* 3. Records & Archive */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4 shadow-lg shadow-cyan-950/40">
                <FolderClock className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-[10px] font-bold mb-2">
                أرشيف العيادة الرقمي
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">سجلات وأرشفة شاملة للمرضى والروشتات</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                سجل إلكتروني متكامل لكل مريض وتاريخ زياراته وتشخيصاته وأدويته؛ مع ميزة تكرار الروشتة السابقة (Re-order Rx) بنقرة واحدة لتوفير وقت إعادة الإدخال في الزيارات الدورية.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-cyan-400 font-bold">
              <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span>بحث فوري برقم الهاتف أو اسم المريض أو التاريخ</span>
            </div>
          </div>

          {/* 4. WhatsApp Direct Sharing */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/40">
                <MessageCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold mb-2">
                تواصل سريع وعصري
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">دعم الإرسال المباشر عبر واتساب</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                أرسل الروشتة الطبية المعتمدة للمريض بصيغة PDF أنيقة أو صورة عالية الوضوح مباشرة على محادثة واتساب بنقرة واحدة، دون الحاجة لحفظ رقم هاتف المريض في جهات اتصالك.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>روشتة رقمية واضحة لا تضيع من المريض أبداً</span>
            </div>
          </div>

          {/* 5. Advanced Printing */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-4 shadow-lg shadow-blue-950/40">
                <Printer className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-bold mb-2">
                طباعة مرنة ومتطورة
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">دعم طباعة فائق وتخصيص الهوامش</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                طباعة فورية متوافقة مع مقاسات A4 و A5 والطابعات الحرارية وطابعات الليزر؛ مع تحكم كامل بالهوامش العلوية والسفلية للطباعة المباشرة على ورق العيادة المطبوع مسبقاً (Letterhead).
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-blue-400 font-bold">
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>ضبط الهوامش بالملليمتر وتفادي تداخل الترويسة</span>
            </div>
          </div>

          {/* 6. Custom Templates & Branch Branding */}
          <div className="bg-slate-900/80 hover:bg-slate-900 transition-all rounded-3xl p-6 border border-slate-800/90 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 shadow-lg shadow-purple-950/40">
                <Palette className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[10px] font-bold mb-2">
                هوية بصرية فخمة
              </div>
              <h4 className="font-black text-white text-base sm:text-lg mb-2">قوالب روشتات وهوية المركز والفروع</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                اختر من بين تشكيلة من القوالب الطبية العصرية، مع تخصيص كامل للوجو العيادة، اسم الطبيب ودرجته العلمية، والتخصص، وعناوين الفروع المتعددة، ومواعيد العيادة مع رمز QR للتحقق.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-purple-400 font-bold">
              <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span>إظهار الفروع والمواعيد بلمسة أنيقة وجذابة</span>
            </div>
          </div>
        </div>

        {/* 2 Secondary Pillar Highlights: Offline + Cloud Security */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-right">
          <div className="bg-slate-900/80 rounded-3xl p-6 border border-slate-800/80 flex items-start gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/30">
              <WifiOff className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-white text-base mb-1">العمل بكفاءة تامة بدون إنترنت (Offline-First)</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                العيادة لا تتوقف إطلاقاً؛ استمر في الكشف وكتابة وطباعة الروشتات حتى لو انقطعت شبكة الإنترنت أو السيرفرات دون أدنى بطء.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 rounded-3xl p-6 border border-slate-800/80 flex items-start gap-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40">
              <svg className="w-6 h-6 stroke-[2] fill-none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
                <rect width="8" height="6" x="12" y="14" rx="1" />
                <path d="M14 14v-2a2 2 0 0 1 4 0v2" />
              </svg>
            </div>
            <div>
              <h4 className="font-black text-white text-base mb-1">مزامنة سحابية خلفية وتشفير سيبراني</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                طابور مزامنة ذكي يحفظ الروشتات في السحابة فور توفر الإنترنت، وتأمين وحماية كاملة للبيانات برقم معرّف الجهاز (Device Security Fingerprint).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* WARNING MODAL: ACTIVE SUBSCRIPTION OVERWRITE WARNING */}
      {/* ============================================================ */}
      {showOverwriteWarning && pendingPlanToConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative animate-in zoom-in-95 duration-150">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-950/50">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-100">
                ⚠️ تنبيه هام: سيتم استبدال اشتراكك الحالي!
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                أنت مشترك حالياً في باقة:{" "}
                <strong className="text-emerald-400 font-bold">{subDetails.planName}</strong> ومتبقي
                في رصيدك <strong className="text-emerald-400 font-bold">{subDetails.daysRemaining} يوماً</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-right space-y-2">
              <span className="text-amber-400 font-black block">
                تنبيه بخصوص استبدال الاشتراك:
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                عند تقديم طلب اشتراك جديد لباقة{" "}
                <strong className="text-slate-100">({pendingPlanToConfirm.nameAr})</strong> وتفعيلها
                من قِبل الإدارة، <strong>سيتم إيقاف اشتراكك الحالي تلقائياً</strong> وسيبدأ احتساب مدة
                الاشتراك الجديد فوراً ({pendingPlanToConfirm.durationDays} يوماً).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>نعم، أرغب في الاستبدال والمتابعة ↪</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowOverwriteWarning(false);
                  setPendingPlanToConfirm(null);
                }}
                className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center justify-center cursor-pointer"
              >
                <span>إلغاء والاحتفاظ باشتراكي القائم ✕</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CELEBRATION & WELCOME MODAL (POST-ACTIVATION INSTANT ENTRY) */}
      {/* ============================================================ */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-400 rounded-3xl p-7 sm:p-9 space-y-6 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Festive ambient glow */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Trophy / Crown */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-0.5 shadow-xl shadow-emerald-950/60 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                  <PartyPopper className="w-8 h-8 text-emerald-400 animate-bounce" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
                <CheckCheck className="w-4 h-4 text-emerald-400" />
                <span>تم تنشيط وتفعيل الترخيص بنجاح ✅</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-100">
                🎉 أهلاً بك يا دكتور {clinic.doctorName ? `(${clinic.doctorName})` : ""}!
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                تهانينا! تم تفعيل وتنشيط حسابك في منظومة <strong className="text-emerald-400">PenRX+</strong> الطبية بنجاح. كافة أدوات بنك الأدوية والذكاء الاصطناعي أصبحت جاهزة للعمل فوراً.
              </p>
            </div>

            {/* Activation Details Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs grid grid-cols-2 gap-3 text-right">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[10px]">الباقة المفعلة:</span>
                <p className="text-xs font-black text-emerald-400">{subDetails.planName}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1">
                <span className="text-slate-400 text-[10px]">مدة الصلاحية:</span>
                <p className="text-xs font-black text-emerald-400 font-mono">
                  {subDetails.daysRemaining} يوماً كاملاً
                </p>
              </div>

              <div className="col-span-2 p-3 rounded-xl bg-slate-900 border border-slate-800/80 space-y-1 text-right">
                <span className="text-slate-400 text-[10px]">معرّف هذا الجهاز المربوط:</span>
                <p className="text-[11px] font-mono font-bold text-slate-300 truncate" dir="ltr">
                  {machineId}
                </p>
              </div>
            </div>

            {/* Auto Redirect Countdown */}
            <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>جاري الانتقال لضبط إعدادات العيادة والروشتة خلال <strong>{redirectCountdown}</strong> ثوانٍ...</span>
            </div>

            {/* Direct Instant Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-950/60 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>الانتقال لضبط هوية العيادة والروشتة الآن 🏥</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modern Cancel Confirmation Modal (هل تريد إلغاء طلب التفعيل الحالي واختيار باقة أخرى؟) */}
      {isCancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative overflow-hidden"
            dir="rtl"
          >
            {/* Top Amber Accent Glow */}
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 animate-pulse" />

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/40">
                  <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-100">
                    إلغاء طلب التفعيل الحالي
                  </h3>
                  <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                    تعديل بيانات التحويل أو اختيار باقة مختلفة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Box */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs leading-relaxed text-slate-300">
              <p className="font-bold text-slate-100 text-sm">
                هل تريد إلغاء طلب التفعيل الحالي واختيار باقة أخرى؟
              </p>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                عند تأكيد الإلغاء، سيتم إيقاف الطلب المعلق الحالي فوراً، وتستطيع اختيار أي باقة أخرى وتعديل بيانات التحويل بكل مرونة وسهولة.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isCanceling}
                onClick={handleConfirmCancelPending}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-600 to-rose-700 hover:brightness-110 active:scale-[0.99] text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الإلغاء...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>نعم، إلغاء واختيار باقة أخرى</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCanceling}
                onClick={() => setIsCancelConfirmOpen(false)}
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Simple iOS Guide Modal */}
      {showIosGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-right relative overflow-hidden" dir="rtl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-slate-100" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.86.96-2.95-1 .04-2.18.66-2.83 1.43-.58.67-1.09 1.77-.95 2.83 1.11.09 2.21-.57 2.82-1.31z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-100">تثبيت نسخة الآيفون 🍏</h3>
                  <p className="text-[11px] text-slate-400">خطوات بسيطة وسريعة من متصفح Safari</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuideModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <span>افتح الرابط في متصفح <strong>Safari</strong> على الآيفون.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <span>اضغط على أيقونة <strong>المشاركة (Share ⬆️)</strong> بالأسفل.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <span>اختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <a
                href="https://pen-rx.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 transition-all text-center cursor-pointer shadow-md"
              >
                فتح الرابط للآيفون الآن 📲
              </a>
              <button
                type="button"
                onClick={() => {
                  handleCopy("https://pen-rx.vercel.app", "ios-link");
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                {copySuccess === "ios-link" ? "✓ تم" : "نسخ الرابط"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
