import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEgyptPhoneNumber(val: string): string {
  if (!val) return "";
  let digits = val.replace(/[^0-9]/g, "");
  if (digits.startsWith("20")) {
    digits = digits.substring(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.substring(1);
  }
  if (!digits) return "";
  return `+20 ${digits}`;
}

export interface BmiResult {
  bmi: number;
  bmiFormatted: string;
  category: "underweight" | "normal" | "overweight" | "obese1" | "obese2";
  label: string;
  badgeClass: string;
  printBadgeClass: string;
  colorHex: string;
  icon: string;
  gaugePercent: number;
  idealWeightMin: string;
  idealWeightMax: string;
}

export function calculateBmiInfo(
  height?: number | string,
  weight?: number | string
): BmiResult | null {
  if (!height || !weight) return null;
  const hNum = typeof height === "number" ? height : parseFloat(String(height));
  const wNum = typeof weight === "number" ? weight : parseFloat(String(weight));
  if (isNaN(hNum) || isNaN(wNum) || hNum <= 30 || hNum > 260 || wNum <= 2 || wNum > 400) {
    return null;
  }

  const hMeters = hNum / 100;
  const bmiVal = wNum / (hMeters * hMeters);
  if (!isFinite(bmiVal) || bmiVal <= 5 || bmiVal >= 100) return null;

  const bmiFormatted = bmiVal.toFixed(1);
  const idealWeightMin = (18.5 * hMeters * hMeters).toFixed(1);
  const idealWeightMax = (24.9 * hMeters * hMeters).toFixed(1);

  // Normalized gauge percentage across standard clinical zones (15 to 40)
  const clampedBmi = Math.max(15, Math.min(40, bmiVal));
  const gaugePercent = Math.round(((clampedBmi - 15) / (40 - 15)) * 100);

  if (bmiVal < 18.5) {
    return {
      bmi: bmiVal,
      bmiFormatted,
      category: "underweight",
      label: "نقص وزن (نحافة)",
      badgeClass:
        "bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-300 border-sky-400/50 shadow-sm shadow-sky-950/40",
      printBadgeClass: "bg-sky-50 text-sky-800 border-sky-300",
      colorHex: "#0284c7",
      icon: "⚖️",
      gaugePercent,
      idealWeightMin,
      idealWeightMax,
    };
  } else if (bmiVal < 25) {
    return {
      bmi: bmiVal,
      bmiFormatted,
      category: "normal",
      label: "وزن مثالي وطبيعي",
      badgeClass:
        "bg-gradient-to-r from-emerald-500/25 via-teal-500/20 to-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-sm shadow-emerald-950/50 ring-1 ring-emerald-500/30",
      printBadgeClass: "bg-emerald-50 text-emerald-800 border-emerald-400",
      colorHex: "#059669",
      icon: "🎯",
      gaugePercent,
      idealWeightMin,
      idealWeightMax,
    };
  } else if (bmiVal < 30) {
    return {
      bmi: bmiVal,
      bmiFormatted,
      category: "overweight",
      label: "وزن زائد (Overweight)",
      badgeClass:
        "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-950/40 ring-1 ring-amber-500/30",
      printBadgeClass: "bg-amber-50 text-amber-900 border-amber-400",
      colorHex: "#d97706",
      icon: "⚠️",
      gaugePercent,
      idealWeightMin,
      idealWeightMax,
    };
  } else if (bmiVal < 35) {
    return {
      bmi: bmiVal,
      bmiFormatted,
      category: "obese1",
      label: "سمنة درجة أولى",
      badgeClass:
        "bg-gradient-to-r from-orange-500/25 to-rose-500/20 text-orange-200 border-orange-500/60 shadow-sm shadow-orange-950/50 ring-1 ring-orange-500/30",
      printBadgeClass: "bg-orange-50 text-orange-900 border-orange-400",
      colorHex: "#ea580c",
      icon: "⚠️",
      gaugePercent,
      idealWeightMin,
      idealWeightMax,
    };
  } else {
    return {
      bmi: bmiVal,
      bmiFormatted,
      category: "obese2",
      label: "سمنة مفرطة عالية الخطورة",
      badgeClass:
        "bg-gradient-to-r from-rose-600/30 via-red-600/25 to-purple-600/25 text-rose-200 border-rose-500/70 shadow-md shadow-rose-950/60 ring-1 ring-rose-500/40 animate-pulse",
      printBadgeClass: "bg-rose-50 text-rose-950 border-rose-400",
      colorHex: "#e11d48",
      icon: "🚨",
      gaugePercent,
      idealWeightMin,
      idealWeightMax,
    };
  }
}
