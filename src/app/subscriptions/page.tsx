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
} from "lucide-react";
import {
  useSubscriptionStore,
  getSubscriptionDetails,
  hasUsedFreeTrial,
} from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { NewRxGuard } from "@/components/prescription/NewRxGuard";

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
    submitSubscriptionRequest,
    cancelPendingRequest,
    syncWithServer,
    initHardwareId,
  } = useSubscriptionStore();
  const { clinic } = useClinicStore();

  const [mounted, setMounted] = useState(false);
  const [selectedPaidPlanId, setSelectedPaidPlanId] = useState<string>("annual_vip");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Modal & Flow states
  const [activePlanForCheckout, setActivePlanForCheckout] = useState<{
    id: string;
    nameAr: string;
    durationDays: number;
    durationLabel: string;
    price: number;
    isTrial?: boolean;
  } | null>(null);

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
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const TRANSFER_NUMBER = "01094085228";

  // Fast polling sync (every 2.5 seconds) for instant unlock upon portal action
  useEffect(() => {
    setMounted(true);
    initHardwareId().catch(() => {});
    syncWithServer();
    const interval = setInterval(syncWithServer, 2500);
    return () => clearInterval(interval);
  }, [syncWithServer, initHardwareId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);
  const currentSub = subDetails.record || null;
  const trialClaimed = hasUsedFreeTrial(subscriptions, machineId);

  // Auto-redirect active subscribers away from subscriptions page
  useEffect(() => {
    if (!mounted) return;
    if (subDetails.isActive && !showWelcomeModal) {
      const isProfileComplete = Boolean(
        clinic.isProfileSaved &&
        clinic.doctorName?.trim() &&
        (clinic.name?.trim() || clinic.nameAr?.trim()) &&
        clinic.phone?.trim()
      );
      if (!isProfileComplete) {
        router.replace("/settings");
      } else {
        router.replace("/");
      }
    }
  }, [mounted, subDetails.isActive, showWelcomeModal, clinic, router]);

  // Monitor activation transition (PENDING -> ACTIVE) to show welcome modal without page reload
  useEffect(() => {
    if (subDetails.isPending) {
      wasPendingRef.current = true;
    } else if (subDetails.isActive && wasPendingRef.current) {
      wasPendingRef.current = false;
      setShowWelcomeModal(true);
    }
  }, [subDetails.isPending, subDetails.isActive]);

  // Countdown timer for auto-redirect when welcome modal is open
  useEffect(() => {
    if (!showWelcomeModal) return;

    if (redirectCountdown <= 0) {
      const isProfileComplete = Boolean(
        clinic.isProfileSaved &&
        clinic.doctorName?.trim() &&
        (clinic.name?.trim() || clinic.nameAr?.trim()) &&
        clinic.phone?.trim()
      );
      router.push(isProfileComplete ? "/" : "/settings");
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
    badge: "هدية الانضمام 🎁",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    isTrial: true,
    features: [
      "تجربة مجانية بالكامل لمدة شهر (30 يوماً)",
      "🧠 مساعد الذكاء الاصطناعي لفحص وتنبيه تعارض وتداخل الأدوية (AI Drug Interactions) لحظياً",
      "وصول كامل لبنك الأدوية المصري والعربي (43,500+ دواء)",
      "محرك البحث الفوري فائق السرعة مع إمكانية الكتابة المانيول الحرة للروشتات",
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
      badgeColor: "bg-slate-700 text-slate-200 border-slate-600",
      features: [
        "تجديد شهري مرن بقيمة 150 جنيه شهرياً",
        "🧠 مساعد الذكاء الاصطناعي لكشف تعارض وتداخل الأدوية والجرعات اللحظي لحماية المريض",
        "وصول غير محدود لبنك الأدوية المحدث (43,500+ دواء) مع الإدخال المانيول الحر",
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
      badge: "خصم 50 ج.م",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
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
      badge: "توفير 100 ج.م",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
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
      badgeColor: "bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-md",
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

  const selectedPaidPlan =
    PAID_PLANS.find((p) => p.id === selectedPaidPlanId) || PAID_PLANS[3];

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

    // 3. Otherwise proceed to checkout modal directly
    setActivePlanForCheckout(plan);
  };

  const handleConfirmOverwrite = () => {
    setShowOverwriteWarning(false);
    if (pendingPlanToConfirm) {
      setActivePlanForCheckout(pendingPlanToConfirm);
      setPendingPlanToConfirm(null);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlanForCheckout) return;

    const isTrialPlan = activePlanForCheckout.price === 0;
    if (!isTrialPlan && (!senderPhone.trim() || !transactionRef.trim())) {
      alert("يرجى إدخال رقم هاتف المحول ورقم العملية المرجعي.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSubscriptionRequest({
        planId: activePlanForCheckout.id,
        planName: activePlanForCheckout.nameAr,
        price: activePlanForCheckout.price,
        paymentMethod,
        senderPhone: senderPhone.trim() || "",
        transactionRef: transactionRef.trim() || `TRIAL-${Date.now().toString().slice(-6)}`,
        doctorName: clinic.isProfileSaved && clinic.doctorName?.trim() ? clinic.doctorName.trim() : "",
        clinicName: clinic.isProfileSaved && (clinic.nameAr || clinic.name)?.trim() ? (clinic.nameAr || clinic.name).trim() : "",
        durationDays: activePlanForCheckout.durationDays,
        isTrial: isTrialPlan,
      });

      if (isTrialPlan && typeof window !== "undefined") {
        localStorage.setItem("penrx_trial_claimed", "true");
      }

      // Close checkout modal - page will cleanly show waiting screen
      setActivePlanForCheckout(null);
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

  return (
    <div className="space-y-8 pb-16 max-w-6xl mx-auto">
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

            {/* Live Auto-Sync Beacon */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-[11px] sm:text-xs">
                فحص التفعيل اللحظي نشط: <strong className="text-emerald-400">ستظهر لك نافذة الترحيب فوراً</strong> عند تفعيل حسابك من البورتال!
              </span>
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
                    <span className="text-slate-400 text-[11px]">رقم العملية المرجعي:</span>
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
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-center"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                <span>إرسال إيصال التحويل عبر الواتساب لتسريع التفعيل الفوري (01094085228) 💬</span>
              </a>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleOpenCancelConfirm}
                  disabled={isCanceling}
                  className="text-xs text-slate-400 hover:text-amber-400 hover:underline font-bold transition-colors cursor-pointer py-1 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تعديل البيانات أو اختيار باقة أخرى ↩</span>
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
        <div className={`rounded-3xl bg-slate-900/90 border p-6 sm:p-8 shadow-xl space-y-5 transition-all ${
          subDetails.daysRemaining <= 3
            ? "border-rose-500/50 shadow-rose-950/20"
            : subDetails.daysRemaining <= 7
            ? "border-amber-500/50 shadow-amber-950/20"
            : "border-emerald-500/30 shadow-emerald-950/20"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border transition-colors ${
                subDetails.daysRemaining <= 3
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : subDetails.daysRemaining <= 7
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-100">اشتراكك مفعل وجاهز للعمل</h2>
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
                <p className="text-xs text-slate-400">
                  باقة: <strong className="text-slate-200">{subDetails.planName}</strong> • {clinic.doctorName || "طبيبنا العزيز"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Distinctive Days Remaining Card in same position */}
              <div className={`px-4 py-2.5 rounded-2xl border backdrop-blur-md transition-all text-left ${
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

              {/* Direct Link to Prescriptions New without NewRxGuard interception */}
              <Link
                href="/prescriptions/new"
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <span>الدخول لكتابة الروشتات 🚀</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          </div>

          {/* Machine ID info for linking additional devices */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span>معرّف هذا الجهاز (Machine ID):</span>
              </span>
              <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider block" dir="ltr">
                {machineId}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(machineId, "active-machine")}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess === "active-machine" ? "✓ تم النسخ" : "نسخ المعرّف"}</span>
              </button>

              <a
                suppressHydrationWarning
                href={`https://wa.me/201094085228?text=${encodeURIComponent(
                  `مرحباً، أنا مشترك في PenRX+ (${clinic.doctorName})، وأرغب في ربط هذا الجهاز الإضافي لاشتراكي:\nمعرّف الجهاز الجديد: ${mounted ? machineId : ""}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>طلب ربط جهاز إضافي عبر الواتساب 📲</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CASE 3: NO ACTIVE SUBSCRIPTION - MACHINE ID BANNER */}
      {/* ============================================================ */}
      {!subDetails.isActive && !subDetails.isPending && (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>معرّف هذا الجهاز (Hardware Machine ID):</span>
              </h3>
              <p className="text-xs text-slate-400">
                إذا كان لديك اشتراك قائم على جهاز آخر وتريد ربط هذا الجهاز به، انسخ هذا المعرّف وأرسله للإدارة لربطه فوراً.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-black text-emerald-400 text-xs sm:text-sm tracking-wider" dir="ltr">
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
      {/* EXACTLY TWO SUBSCRIPTION CARDS (CARD 1: FREE TRIAL | CARD 2: DYNAMIC PAID) */}
      {/* ============================================================ */}
      {!subDetails.isPending && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="text-center space-y-2 max-w-2xl mx-auto pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black">
              <Crown className="w-3.5 h-3.5" />
              <span>خطط وباقات أسعار PenRX+</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              {subDetails.isActive ? "تجديد أو ترقية باقة الاشتراك" : "اختر الخطة المناسبة لعيادتك وابدأ فوراً"}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              تجربة مجانية كاملة للمشتركين الجدد، أو باقات مدفوعة مرنة تناسب جميع الأطباء والعيادات.
            </p>
          </div>

          {/* TWO CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch max-w-5xl mx-auto">
            {/* ============================================================ */}
            {/* CARD 1: FREE TRIAL (30 DAYS FULL ACCESS - ONE-TIME ONLY) */}
            {/* ============================================================ */}
            <div
              className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 border ${
                trialClaimed
                  ? "bg-slate-900/60 border-slate-800 opacity-90"
                  : "bg-slate-900/90 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/40 hover:border-emerald-400"
              }`}
            >
              {/* Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 shrink-0 whitespace-nowrap">
                <span
                  className={`px-4 py-1 rounded-full text-xs font-black tracking-wide border shadow-md flex items-center gap-1.5 ${
                    trialClaimed
                      ? "bg-slate-800 text-slate-400 border-slate-700"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {trialClaimed ? (
                    <>
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>تم الاستفادة من التجربة مسبقاً 🔒</span>
                    </>
                  ) : (
                    <>
                      <Gift className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{TRIAL_PLAN.badge}</span>
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-5">
                <div className="text-center pt-2 pb-5 border-b border-slate-800 space-y-2">
                  <h3 className="text-xl font-black text-slate-100 flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span>{TRIAL_PLAN.nameAr}</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold block">
                    {TRIAL_PLAN.durationLabel}
                  </span>

                  <div className="pt-2 flex items-baseline justify-center gap-1.5">
                    <span className="text-4xl font-black text-emerald-400">مجاناً</span>
                    <span className="text-sm font-bold text-slate-400">(0 ج.م)</span>
                  </div>

                  <span className="inline-block text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    كامل الصلاحيات والميزات لمدة 30 يوماً
                  </span>
                </div>

                {/* If trial already claimed notice */}
                {trialClaimed ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5 text-right">
                    <div className="flex items-center gap-2 font-black">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>التجربة المجانية متاحة لمرة واحدة فقط</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      لقد تم تفعيل واستخدام الفترة التجريبية (30 يوماً) لهذا الجهاز مسبقاً. للاستمرار في استخدام المنظومة دون انقطاع، يمكنك اختيار إحدى الباقات المدفوعة في الكارت المجاور.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] leading-relaxed">
                      لا تتطلب أي مصاريف تفعيل - ابدأ كتابة الروشتات الآن واستمتع بكافة أدوات الذكاء الاصطناعي مجاناً!
                    </span>
                  </div>
                )}

                {/* Features list */}
                <div className="space-y-2.5 py-1 text-xs">
                  <span className="text-[11px] font-black text-slate-400 block pb-1">
                    المميزات المشمولة في الباقة التجريبية:
                  </span>
                  {TRIAL_PLAN.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-snug text-xs">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  disabled={trialClaimed}
                  onClick={() => handleInitiatePlan(TRIAL_PLAN)}
                  className={`w-full py-4 rounded-2xl font-black text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                    trialClaimed
                      ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50 hover:brightness-110"
                  }`}
                >
                  {trialClaimed ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>تم الاستفادة من التجربة المجانية سابقاً 🔒</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>تفعيل التجربة المجانية الآن (30 يوم مجاناً) 🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* CARD 2: DYNAMIC PAID PLAN CARD (WITH INTEGRATED ELEGANT DROPDOWN) */}
            {/* ============================================================ */}
            <div className="relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 bg-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/60 ring-4 ring-emerald-500/20">
              {/* Dynamic Badge */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 shrink-0 whitespace-nowrap">
                <span className={`px-4 py-1 rounded-full text-xs font-black tracking-wide border shadow-md flex items-center gap-1.5 ${selectedPaidPlan.badgeColor || "bg-emerald-500 text-slate-950"}`}>
                  <Crown className="w-3.5 h-3.5" />
                  <span>{selectedPaidPlan.badge || "الباقة المختارة"}</span>
                </span>
              </div>

              <div className="space-y-5">
                {/* Header & Dynamic Price Display */}
                <div className="text-center pt-2 pb-4 border-b border-slate-800 space-y-2">
                  <h3 className="text-xl font-black text-slate-100 flex items-center justify-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span>الباقات والاشتراكات الرسمية</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold block">
                    اختر خطة التجديد المناسبة لعيادتك من القائمة
                  </span>

                  {/* Big Dynamic Price */}
                  <div className="pt-2 flex items-baseline justify-center gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-slate-100 font-mono transition-all">
                      {selectedPaidPlan.price}
                    </span>
                    <span className="text-sm font-bold text-emerald-400">جنيه مصري</span>
                    {selectedPaidPlan.originalPrice && (
                      <span className="text-sm text-slate-500 line-through mr-1.5 font-mono">
                        {selectedPaidPlan.originalPrice} ج.م
                      </span>
                    )}
                  </div>

                  {selectedPaidPlan.discountText && (
                    <span className="inline-block text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 animate-pulse">
                      {selectedPaidPlan.discountText}
                    </span>
                  )}
                </div>

                {/* ELEGANT INTEGRATED DROPDOWN MENU */}
                <div className="space-y-2" ref={dropdownRef}>
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>اختر نوع الباقة المرغوبة:</span>
                    <span className="text-[10px] text-emerald-400 font-normal">اضغط لتغيير الباقة ⬇</span>
                  </label>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full p-3.5 rounded-2xl bg-slate-950 border-2 border-slate-700 hover:border-emerald-500/60 text-slate-100 text-xs font-bold flex items-center justify-between transition-all cursor-pointer shadow-inner"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-100 block">
                            {selectedPaidPlan.nameAr}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {selectedPaidPlan.durationLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-emerald-400 font-mono font-black text-xs border border-slate-800">
                          {selectedPaidPlan.price} ج.م
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-emerald-400" : ""}`} />
                      </div>
                    </button>

                    {/* Dropdown Options Popup */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-slate-950 border-2 border-emerald-500/40 rounded-2xl p-2 shadow-2xl space-y-1.5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                        {PAID_PLANS.map((plan) => {
                          const isSelected = plan.id === selectedPaidPlanId;

                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => {
                                setSelectedPaidPlanId(plan.id);
                                setIsDropdownOpen(false);
                              }}
                              className={`w-full p-3 rounded-xl text-right flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "border-emerald-400 bg-emerald-500 text-slate-950"
                                      : "border-slate-600 bg-slate-800"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-slate-100">{plan.nameAr}</span>
                                    {plan.popular && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/30">
                                        الأفضل ⭐
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block">{plan.durationLabel}</span>
                                </div>
                              </div>

                              <div className="text-left font-mono shrink-0">
                                <span className="text-sm font-black text-emerald-400 block">
                                  {plan.price} ج.م
                                </span>
                                {plan.discountText && (
                                  <span className="text-[10px] text-amber-400 block font-sans font-bold">
                                    {plan.discountText}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Features list of the selected paid plan */}
                <div className="space-y-2.5 py-1 text-xs">
                  <span className="text-[11px] font-black text-slate-400 block pb-1">
                    مميزات {selectedPaidPlan.nameAr}:
                  </span>
                  {selectedPaidPlan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-snug text-xs">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => handleInitiatePlan(selectedPaidPlan)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Crown className="w-4 h-4" />
                  <span>اشترك الآن في {selectedPaidPlan.nameAr} ({selectedPaidPlan.price} ج.م) ⚡</span>
                </button>
              </div>
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

      {/* ============================================================ */}
      {/* CHECKOUT MODAL: PAYMENT DETAILS SUBMISSION */}
      {/* ============================================================ */}
      {activePlanForCheckout && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setActivePlanForCheckout(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 text-right border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Crown className="w-4 h-4" />
                <span>طلب تفعيل: {activePlanForCheckout.nameAr}</span>
              </span>
              <h3 className="text-xl font-black text-slate-100">
                القيمة: {activePlanForCheckout.price === 0 ? "مجاناً (0 ج.م)" : `${activePlanForCheckout.price} ج.م`}
              </h3>
              <span className="text-[11px] text-slate-400 block">
                {activePlanForCheckout.durationLabel}
              </span>
            </div>

            {/* Payment Method Selector */}
            {activePlanForCheckout.price > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">اختر وسيلة التحويل:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("vodafone")}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === "vodafone"
                        ? "bg-rose-500/15 border-rose-500 text-rose-300 shadow-lg"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="relative w-24 h-7">
                      <Image src="/vodafone-cash.png" alt="Vodafone Cash" fill sizes="96px" className="object-contain" />
                    </div>
                    <span className="text-[11px] font-black">فودافون كاش</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("instapay")}
                    className={`p-3.5 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === "instapay"
                        ? "bg-purple-500/15 border-purple-500 text-purple-300 shadow-lg"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="relative w-24 h-7">
                      <Image src="/instapay.png" alt="InstaPay" fill sizes="96px" className="object-contain" />
                    </div>
                    <span className="text-[11px] font-black">إنستا باي (InstaPay)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Transfer Number Card */}
            {activePlanForCheckout.price > 0 && (
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
                    onClick={() => handleCopy(TRANSFER_NUMBER, "modal-transfer")}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copySuccess === "modal-transfer" ? "تم النسخ" : "نسخ الرقم"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation Form */}
            <form onSubmit={handleConfirmSubmit} className="space-y-4 text-xs">
              {activePlanForCheckout.price > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block">رقم الهاتف المحول منه:</label>
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
                    <label className="font-bold text-slate-300 block">رقم العملية المرجعي (Ref ID):</label>
                    <input
                      type="text"
                      required
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="رقم مرجع الإيصال..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-mono font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* Machine ID info in Modal */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>معرّف جهازك الحالي:</span>
                <span className="font-mono font-bold text-emerald-400 truncate max-w-[200px]" dir="ltr">
                  {machineId}
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Crown className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "جاري إرسال الطلب..."
                      : activePlanForCheckout.price === 0
                      ? "تأكيد الاشتراك المجاني فوراً 🚀"
                      : "تأكيد وإرسال طلب التفعيل 🚀"}
                  </span>
                </button>
              </div>
            </form>
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
    </div>
  );
}
