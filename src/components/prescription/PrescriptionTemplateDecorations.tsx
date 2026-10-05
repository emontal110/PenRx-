"use client";

import React from "react";
import { PrescriptionTemplate } from "@/store/useClinicStore";

interface TemplateDecorationsProps {
  templateId?: PrescriptionTemplate;
  primaryColor: string;
}

/**
 * Renders decorative vector overlays (waves, hexagons, ornate corners, sidebar accents)
 * based on the active prescription template. Pure SVG ensures 100% crisp printing at any DPI.
 */
export function PrescriptionTemplateDecorations({
  templateId = "classic",
  primaryColor,
}: TemplateDecorationsProps) {
  if (!templateId || templateId === "classic") {
    return null;
  }

  // 1. MODERN FLOWING WAVES (User Attachment 1)
  if (templateId === "modern_wave") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Soft top gradient */}
        <div
          className="absolute top-0 inset-x-0 h-28 opacity-15"
          style={{
            background: `linear-gradient(180deg, ${primaryColor} 0%, rgba(255,255,255,0) 100%)`,
          }}
        />

        {/* Top Wave Lines */}
        <svg
          className="absolute top-0 inset-x-0 w-full h-24 sm:h-28 opacity-25"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path
            d="M0,0 L600,0 L600,50 C450,100 340,20 200,65 C100,95 40,40 0,55 Z"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path
            d="M0,35 C120,75 220,25 360,60 C480,90 540,45 600,70"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 2"
            opacity="0.8"
          />
          <path
            d="M0,20 C140,60 260,15 390,45 C500,75 560,30 600,55"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.5"
          />
          <path
            d="M0,50 C160,90 280,40 420,70 C520,100 570,60 600,80"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.5"
          />
        </svg>

        {/* Bottom Soft Gradient */}
        <div
          className="absolute bottom-0 inset-x-0 h-28 opacity-15"
          style={{
            background: `linear-gradient(0deg, ${primaryColor} 0%, rgba(255,255,255,0) 100%)`,
          }}
        />

        {/* Bottom Mirrored Wave Lines */}
        <svg
          className="absolute bottom-0 inset-x-0 w-full h-24 sm:h-28 opacity-25"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path
            d="M0,120 L600,120 L600,70 C480,20 380,95 240,45 C140,10 60,70 0,60 Z"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path
            d="M0,75 C120,35 220,85 360,50 C480,20 540,65 600,40"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 2"
            opacity="0.8"
          />
          <path
            d="M0,90 C140,50 260,100 390,65 C500,35 560,80 600,55"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.5"
          />
        </svg>
      </div>
    );
  }

  // 2. BIO-TECH HEXAGON (User Attachment 2)
  if (templateId === "tech_hex") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Right Circuit traces */}
        <svg
          className="absolute top-0 right-0 w-48 h-28 opacity-20"
          viewBox="0 0 200 120"
          fill="none"
          style={{ color: primaryColor }}
        >
          <polygon points="20,15 45,2 70,15 70,42 45,55 20,42" stroke="currentColor" strokeWidth="1.2" />
          <polygon points="65,42 90,28 115,42 115,70 90,82 65,70" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
          <line x1="115" y1="55" x2="165" y2="55" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="165" cy="55" r="3" fill="currentColor" />
          <line x1="70" y1="28" x2="130" y2="28" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 2" />
          <circle cx="130" cy="28" r="2" fill="currentColor" />
        </svg>

        {/* Bottom-Left Bio-Tech Hexagon Mesh (direct match to attachment 2) */}
        <svg
          className="absolute bottom-0 left-0 w-64 h-36 opacity-30"
          viewBox="0 0 260 150"
          fill="none"
          style={{ color: primaryColor }}
        >
          {/* Hexagon 1 */}
          <polygon points="30,55 60,38 90,55 90,92 60,110 30,92" stroke="currentColor" strokeWidth="1.5" />
          {/* Hexagon 2 */}
          <polygon points="85,92 115,75 145,92 145,130 115,146 85,130" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
          {/* Hexagon 3 */}
          <polygon points="140,55 170,38 200,55 200,92 170,110 140,92" stroke="currentColor" strokeWidth="1" />
          {/* Hexagon 4 */}
          <polygon points="85,20 115,5 145,20 145,55 115,72 85,55" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
          {/* Circuit connection nodes */}
          <circle cx="60" cy="38" r="3.5" fill="currentColor" />
          <circle cx="145" cy="92" r="3" fill="currentColor" />
          <line x1="90" y1="55" x2="115" y2="38" stroke="currentColor" strokeWidth="1.5" />
          <line x1="145" y1="130" x2="210" y2="130" stroke="currentColor" strokeWidth="1.2" />
          <line x1="210" y1="130" x2="235" y2="105" stroke="currentColor" strokeWidth="1.2" />
          <line x1="235" y1="105" x2="255" y2="105" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="255" cy="105" r="3" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // 3. ROYAL LUXURY FRAME
  if (templateId === "luxury_gold") {
    return (
      <div className="absolute inset-2 sm:inset-3 pointer-events-none rounded-2xl border border-dashed border-slate-300/80 z-0">
        {/* Top-Right Ornate Corner */}
        <svg
          className="absolute -top-1.5 -right-1.5 w-10 h-10 opacity-70"
          viewBox="0 0 50 50"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M2,2 L35,2 C40,2 45,7 45,12 L45,45" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <path d="M8,25 C15,20 20,15 25,8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M18,35 C25,28 28,25 35,18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>

        {/* Top-Left Ornate Corner */}
        <svg
          className="absolute -top-1.5 -left-1.5 w-10 h-10 opacity-70 transform -scale-x-100"
          viewBox="0 0 50 50"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M2,2 L35,2 C40,2 45,7 45,12 L45,45" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <path d="M8,25 C15,20 20,15 25,8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M18,35 C25,28 28,25 35,18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>

        {/* Bottom-Right Ornate Corner */}
        <svg
          className="absolute -bottom-1.5 -right-1.5 w-10 h-10 opacity-70 transform -scale-y-100"
          viewBox="0 0 50 50"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M2,2 L35,2 C40,2 45,7 45,12 L45,45" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <path d="M8,25 C15,20 20,15 25,8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M18,35 C25,28 28,25 35,18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>

        {/* Bottom-Left Ornate Corner */}
        <svg
          className="absolute -bottom-1.5 -left-1.5 w-10 h-10 opacity-70 transform -scale-100"
          viewBox="0 0 50 50"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M2,2 L35,2 C40,2 45,7 45,12 L45,45" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <path d="M8,25 C15,20 20,15 25,8" stroke="currentColor" strokeWidth="1.2" />
          <path d="M18,35 C25,28 28,25 35,18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>
      </div>
    );
  }

  // 4. BIO-CARDIO & DNA HELIX (نبض الحياة والجينوم الطبي)
  if (templateId === "minimal_clean" || (templateId as string) === "bio_pulse") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* DNA Double-Helix Vector running in the left background */}
        <svg
          className="absolute -top-4 -left-3 w-28 h-64 opacity-15 pointer-events-none"
          viewBox="0 0 100 220"
          fill="none"
          style={{ color: primaryColor }}
        >
          {/* Left and Right DNA helical backbone strands */}
          <path d="M25,10 Q50,45 75,80 T25,150 T75,220" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M75,10 Q50,45 25,80 T75,150 T25,220" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          {/* Base pair horizontal rungs */}
          <line x1="30" y1="22" x2="70" y2="22" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="42" y1="45" x2="58" y2="45" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="68" x2="70" y2="68" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="26" y1="92" x2="74" y2="92" stroke="currentColor" strokeWidth="1.2" />
          <line x1="42" y1="115" x2="58" y2="115" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="138" x2="70" y2="138" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="26" y1="162" x2="74" y2="162" stroke="currentColor" strokeWidth="1.2" />
          <line x1="42" y1="185" x2="58" y2="185" stroke="currentColor" strokeWidth="1.5" />
          <line x1="30" y1="208" x2="70" y2="208" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>

        {/* Top Header ECG Heartbeat Rhythm Wave Line */}
        <div className="absolute top-20 sm:top-24 inset-x-0 h-6 overflow-visible opacity-35">
          <svg className="w-full h-full" viewBox="0 0 600 24" preserveAspectRatio="none" fill="none" style={{ color: primaryColor }}>
            <path
              d="M0,12 L220,12 L228,12 L234,4 L240,20 L248,0 L256,23 L262,7 L268,15 L274,12 L600,12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Heartbeat pulse glow node */}
            <circle cx="248" cy="0" r="3" fill="currentColor" />
            <circle cx="248" cy="0" r="6" fill="currentColor" fillOpacity="0.25" />
          </svg>
        </div>

        {/* Bottom Footer Medical Rhythm Accent */}
        <div className="absolute bottom-16 sm:bottom-20 inset-x-0 h-5 overflow-visible opacity-25">
          <svg className="w-full h-full" viewBox="0 0 600 20" preserveAspectRatio="none" fill="none" style={{ color: primaryColor }}>
            <path
              d="M0,10 L340,10 L346,10 L351,4 L356,16 L362,1 L368,19 L373,6 L378,12 L383,10 L600,10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="362" cy="1" r="2.5" fill="currentColor" />
          </svg>
        </div>

        {/* Subtle Medical Cross Watermark Badge in Top Right */}
        <svg
          className="absolute top-3 right-3 w-10 h-10 opacity-10 pointer-events-none"
          viewBox="0 0 40 40"
          fill="none"
          style={{ color: primaryColor }}
        >
          <rect x="16" y="4" width="8" height="32" rx="2.5" fill="currentColor" />
          <rect x="4" y="16" width="32" height="8" rx="2.5" fill="currentColor" />
        </svg>

        {/* Subtle Medical Cross Watermark Badge in Bottom Left */}
        <svg
          className="absolute bottom-3 left-3 w-8 h-8 opacity-10 pointer-events-none"
          viewBox="0 0 40 40"
          fill="none"
          style={{ color: primaryColor }}
        >
          <rect x="16" y="4" width="8" height="32" rx="2.5" fill="currentColor" />
          <rect x="4" y="16" width="32" height="8" rx="2.5" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // 5. CLINICAL SIDEBAR ACCENT
  if (templateId === "clinical_sidebar") {
    return (
      <div className="absolute inset-y-0 right-0 w-2.5 sm:w-3 pointer-events-none z-10 overflow-hidden">
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(180deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}99 100%)`,
          }}
        />
      </div>
    );
  }

  return null;
}

/**
 * Returns custom outer container styles/classes for each template.
 */
export function getTemplateContainerStyles(
  templateId: PrescriptionTemplate = "classic",
  primaryColor: string
): { style: React.CSSProperties; className: string } {
  switch (templateId) {
    case "modern_wave":
      return {
        style: {
          borderTop: `5px solid ${primaryColor}`,
          borderBottom: `5px solid ${primaryColor}`,
          backgroundColor: "#fdfefe",
        },
        className: "border-x border-slate-200/90 shadow-2xl",
      };

    case "tech_hex":
      return {
        style: {
          borderTop: `6px solid ${primaryColor}`,
          borderBottom: `6px solid ${primaryColor}`,
          backgroundColor: "#ffffff",
        },
        className: "border-x-2 border-slate-300 shadow-2xl",
      };

    case "luxury_gold":
      return {
        style: {
          border: `3px double ${primaryColor}`,
          outline: `1px solid ${primaryColor}40`,
          outlineOffset: "4px",
          backgroundColor: "#faf9f6",
        },
        className: "shadow-2xl",
      };

    case "minimal_clean":
      return {
        style: {
          borderTop: `6px solid ${primaryColor}`,
          borderBottom: `5px solid ${primaryColor}`,
          backgroundColor: "#ffffff",
        },
        className: "border-x-2 border-slate-200/90 shadow-2xl relative",
      };

    case "clinical_sidebar":
      return {
        style: {
          borderRight: `6px solid ${primaryColor}`,
          borderTop: `1px solid ${primaryColor}20`,
          borderBottom: `2px solid ${primaryColor}40`,
          borderLeft: `1px solid ${primaryColor}20`,
          backgroundColor: "#ffffff",
        },
        className: "shadow-2xl",
      };

    case "classic":
    default:
      return {
        style: {
          borderTop: `6px solid ${primaryColor}`,
          borderBottom: `6px solid ${primaryColor}`,
        },
        className: "border-x border-slate-200 shadow-2xl bg-white",
      };
  }
}

/**
 * Metadata for all 6 prescription templates for the Settings UI.
 */
export const PRESCRIPTION_TEMPLATES: {
  id: PrescriptionTemplate;
  name: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  description: string;
}[] = [
  {
    id: "classic",
    name: "النمط الكلاسيكي الراقي",
    subtitle: "Classic Medical Standard",
    badge: "الافتراضي الحالي",
    badgeColor: "bg-slate-700 text-slate-200",
    description: "التصميم الكلاسيكي الأصلي بالخطوط العلوية والسفلية الأنيقة والشعار المائي دون أي تغيير.",
  },
  {
    id: "modern_wave",
    name: "الموجات الطبية الانسيابية",
    subtitle: "Modern Medical Waves",
    badge: "مستوحى من النموذج 1 🌊",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    description: "تموجات انسيابية فائقة الجمال في الترويسة والتذييل، خطوط أمان شبكية وخلفية مريحة للكتابة.",
  },
  {
    id: "tech_hex",
    name: "التقنية الطبية المتطورة",
    subtitle: "Bio-Tech Hexagon Network",
    badge: "مستوحى من النموذج 2 ⚡",
    badgeColor: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
    description: "شبكات خلايا سداسية ومسارات ذكاء رقمية دقيقة تعكس الحداثة والتقنية الطبية المتطورة.",
  },
  {
    id: "luxury_gold",
    name: "الإطار الملكي الفاخر",
    subtitle: "Royal Luxury Crest",
    badge: "فخامة وأصالة 👑",
    badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    description: "إطار ملكي مزدوج وزخارف زوايا كلاسيكية راقية مع تيجان طبية تعطي انطباعاً رسمياً عريقاً.",
  },
  {
    id: "minimal_clean",
    name: "نبض الحياة والجينوم الطبي",
    subtitle: "Bio-Pulse & DNA Helix",
    badge: "طبي حيوي متقدم 🧬",
    badgeColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    description: "تصميم طبي حيوي مفعم بالحياة؛ موجات تخطيط نبض القلب (ECG Pulse)، لولب الجينوم (DNA Helix)، وفواصل سريرية حيوية وعصرية.",
  },
  {
    id: "clinical_sidebar",
    name: "النمط السريري العمودي",
    subtitle: "Clinical Dossier Sidebar",
    badge: "طراز المراكز الكبرى 🏥",
    badgeColor: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    description: "شريط علامة سريرية جانبي بطول الروشتة مع محاذاة مؤسسية دقيقة للمستشفيات والعيادات الكبرى.",
  },
];
