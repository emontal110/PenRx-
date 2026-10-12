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

  // 6. NORDIC PASTEL (النبض النورديك الانسيابي - هدوء وبساطة اسكندنافية)
  if (templateId === "nordic_pastel") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Soft Pastel Header Horizon Wave */}
        <svg
          className="absolute top-0 inset-x-0 w-full h-20 sm:h-24 opacity-30"
          viewBox="0 0 600 100"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M0,0 L600,0 L600,45 C460,20 320,60 0,35 Z" fill="currentColor" fillOpacity="0.12" />
          <path d="M0,38 C220,62 420,22 600,48" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
          <path d="M0,22 C180,45 380,12 600,32" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
        </svg>

        {/* Delicate Pastel Circular Badge in Top-Left Corner */}
        <svg
          className="absolute top-3 left-3 w-8 h-8 opacity-25"
          viewBox="0 0 32 32"
          fill="none"
          style={{ color: primaryColor }}
        >
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="16" cy="16" r="10" fill="currentColor" fillOpacity="0.08" />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>

        {/* Soft Bottom Footer Wave Accent */}
        <svg
          className="absolute bottom-0 inset-x-0 w-full h-14 sm:h-16 opacity-25"
          viewBox="0 0 600 70"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <path d="M0,70 L600,70 L600,28 C450,55 240,15 0,40 Z" fill="currentColor" fillOpacity="0.08" />
          <path d="M0,38 C240,15 450,55 600,28" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
        </svg>
      </div>
    );
  }

  // 7. GEOMETRIC FRAME (الإطار الهندسي الأنيق - زوايا معمارية مقطوعة وأناقة دقيقة)
  if (templateId === "geometric_frame") {
    return (
      <div className="absolute inset-0 pointer-events-none z-0 print:opacity-100 overflow-hidden">
        {/* Precision Dotted Inner Margin Perimeter */}
        <div
          className="absolute inset-2 sm:inset-3 border border-dashed rounded-lg opacity-30 pointer-events-none"
          style={{ borderColor: primaryColor }}
        />

        {/* Top-Right Chamfered Angle & Diamond */}
        <svg
          className="absolute top-0 right-0 w-12 h-12 opacity-70"
          viewBox="0 0 48 48"
          fill="none"
          style={{ color: primaryColor }}
        >
          <polygon points="48,0 48,28 28,48 0,48 0,0" fill="currentColor" fillOpacity="0.08" />
          <path d="M48,28 L28,48" stroke="currentColor" strokeWidth="1.8" />
          <rect x="25" y="11" width="8" height="8" transform="rotate(45 29 15)" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Top-Left Chamfered Angle & Diamond */}
        <svg
          className="absolute top-0 left-0 w-12 h-12 opacity-70"
          viewBox="0 0 48 48"
          fill="none"
          style={{ color: primaryColor }}
        >
          <polygon points="0,0 0,28 20,48 48,48 48,0" fill="currentColor" fillOpacity="0.08" />
          <path d="M0,28 L20,48" stroke="currentColor" strokeWidth="1.8" />
          <rect x="15" y="11" width="8" height="8" transform="rotate(45 19 15)" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1" />
        </svg>

        {/* Bottom-Right Chamfered Angle */}
        <svg
          className="absolute bottom-0 right-0 w-10 h-10 opacity-70"
          viewBox="0 0 40 40"
          fill="none"
          style={{ color: primaryColor }}
        >
          <polygon points="40,40 40,16 16,40" fill="currentColor" fillOpacity="0.1" />
          <path d="M40,16 L16,40" stroke="currentColor" strokeWidth="1.8" />
        </svg>

        {/* Bottom-Left Chamfered Angle */}
        <svg
          className="absolute bottom-0 left-0 w-10 h-10 opacity-70"
          viewBox="0 0 40 40"
          fill="none"
          style={{ color: primaryColor }}
        >
          <polygon points="0,40 0,16 24,40" fill="currentColor" fillOpacity="0.1" />
          <path d="M0,16 L24,40" stroke="currentColor" strokeWidth="1.8" />
        </svg>

        {/* Precision Crosshairs in Margin Intersections */}
        <svg className="absolute top-6 left-6 w-3 h-3 opacity-40" viewBox="0 0 12 12" fill="none" style={{ color: primaryColor }}>
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
        </svg>
        <svg className="absolute top-6 right-6 w-3 h-3 opacity-40" viewBox="0 0 12 12" fill="none" style={{ color: primaryColor }}>
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  // 8. SOFT CURVES CARE (الرعاية الدافئة وطب الأسرة والأطفال - منحنيات وكبسولات دافئة)
  if (templateId === "soft_curves") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Soft Overlapping Cloud Pill Arcs in Header */}
        <svg
          className="absolute top-0 inset-x-0 w-full h-24 sm:h-28 opacity-35"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <rect x="-30" y="-30" width="380" height="95" rx="48" fill="currentColor" fillOpacity="0.1" />
          <rect x="260" y="-25" width="370" height="90" rx="45" fill="currentColor" fillOpacity="0.08" />
          {/* Friendly floating micro-bubbles */}
          <circle cx="230" cy="55" r="4.5" fill="currentColor" fillOpacity="0.35" />
          <circle cx="248" cy="42" r="3" fill="currentColor" fillOpacity="0.25" />
          <circle cx="370" cy="62" r="3.5" fill="currentColor" fillOpacity="0.3" />
        </svg>

        {/* Soft Pill Arc in Footer */}
        <svg
          className="absolute bottom-0 inset-x-0 w-full h-16 sm:h-20 opacity-30"
          viewBox="0 0 600 80"
          preserveAspectRatio="none"
          fill="none"
          style={{ color: primaryColor }}
        >
          <rect x="90" y="20" width="420" height="80" rx="40" fill="currentColor" fillOpacity="0.1" />
          <circle cx="70" cy="45" r="3.5" fill="currentColor" fillOpacity="0.25" />
          <circle cx="530" cy="45" r="3.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      </div>
    );
  }

  // 9. ACADEMIC ROYAL CREST (الشريط الأكاديمي التخصصي - وقار كبرى المستشفيات مع عصا الطب)
  if (templateId === "academic_crest") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Top Solid Institutional Header Ribbon Strip */}
        <div
          className="absolute top-0 inset-x-0 h-3 opacity-90"
          style={{ backgroundColor: primaryColor }}
        />
        <div
          className="absolute top-3.5 inset-x-0 h-0.5 opacity-50"
          style={{ backgroundColor: primaryColor }}
        />

        {/* Central Watermark: Authentic Rod of Asclepius & Caduceus Medical Crest */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
          <svg
            className="w-48 h-64 sm:w-56 sm:h-72"
            viewBox="0 0 200 280"
            fill="none"
            style={{ color: primaryColor }}
          >
            {/* Center Asclepius Rod */}
            <line x1="100" y1="20" x2="100" y2="260" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <circle cx="100" cy="18" r="9" fill="currentColor" />
            {/* Coiling Sacred Medical Serpent */}
            <path
              d="M85,240 C65,210 135,185 115,155 C95,125 65,95 100,65 C125,45 80,30 100,20"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Wing elements flanking the top */}
            <path
              d="M100,50 C125,30 155,40 170,65 C150,68 130,62 100,75"
              fill="currentColor"
              fillOpacity="0.3"
            />
            <path
              d="M100,50 C75,30 45,40 30,65 C50,68 70,62 100,75"
              fill="currentColor"
              fillOpacity="0.3"
            />
            {/* Classical Laurel Wreath base */}
            <path
              d="M50,220 C40,240 70,260 100,265 C130,260 160,240 150,220"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
          </svg>
        </div>

        {/* Formal Dual-Pinstripe Collegiate Footer */}
        <div
          className="absolute bottom-3.5 inset-x-0 h-0.5 opacity-50"
          style={{ backgroundColor: primaryColor }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-2.5 opacity-90"
          style={{ backgroundColor: primaryColor }}
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
          borderBottom: `6px solid ${primaryColor}`,
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

    case "nordic_pastel":
      return {
        style: {
          borderTop: `5px solid ${primaryColor}80`,
          borderBottom: `4px solid ${primaryColor}50`,
          backgroundColor: "#fafcfd",
        },
        className: "border-x border-slate-200 shadow-2xl relative",
      };

    case "geometric_frame":
      return {
        style: {
          border: `2px solid ${primaryColor}85`,
          outline: `1px dashed ${primaryColor}30`,
          outlineOffset: "-6px",
          backgroundColor: "#ffffff",
        },
        className: "shadow-2xl relative",
      };

    case "soft_curves":
      return {
        style: {
          borderTop: `5px solid ${primaryColor}`,
          borderBottom: `5px solid ${primaryColor}80`,
          borderRadius: "20px",
          backgroundColor: "#fdfefe",
        },
        className: "border-x border-slate-200 shadow-2xl relative overflow-hidden",
      };

    case "academic_crest":
      return {
        style: {
          borderTop: `7px solid ${primaryColor}`,
          borderBottom: `4px solid ${primaryColor}`,
          backgroundColor: "#fafbfc",
        },
        className: "border-x-2 border-slate-300 shadow-2xl relative",
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
 * Metadata for all 10 prescription templates for the Settings UI.
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
    id: "nordic_pastel",
    name: "النبض النورديك الانسيابي",
    subtitle: "Nordic Clean Pastel",
    badge: "جديد • ألوان باستيل 🌿",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    description: "بساطة اسكندنافية نقية وترويسة مموجة بتدرج باستيل هادئ مع مساحات واسعة مريحة للعين.",
  },
  {
    id: "geometric_frame",
    name: "الإطار الهندسي الأنيق",
    subtitle: "Modern Geometric Frame",
    badge: "جديد • إطار معماري 📐",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    description: "إطار محيطي هندسي مزدوج بزوايا مقطوعة وألماسية دقيقة تعكس الدقة المعمارية والرسمية.",
  },
  {
    id: "soft_curves",
    name: "الرعاية الدافئة وطب الأسرة",
    subtitle: "Warm Soft Curves Care",
    badge: "جديد • للأطفال والأسرة 🧸",
    badgeColor: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    description: "منحنيات دائرية دافئة وسحب كبسولية مبهجة تضفي إحساساً مريحاً ومطمئناً للمريض والطفل.",
  },
  {
    id: "academic_crest",
    name: "الشريط الأكاديمي التخصصي",
    subtitle: "Academic Royal Crest",
    badge: "جديد • وقار تخصصي 🏛️",
    badgeColor: "bg-blue-600/20 text-blue-300 border border-blue-500/30",
    description: "شريط علوي كحلي/زمردي عريض ووقور مع علامة مائية لعصا أسكليبيوس وشعار الطب العريق.",
  },
  {
    id: "modern_wave",
    name: "الموجات الطبية الانسيابية",
    subtitle: "Modern Medical Waves",
    badge: "أمواج انسيابية 🌊",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    description: "تموجات انسيابية فائقة الجمال في الترويسة والتذييل، خطوط أمان شبكية وخلفية مريحة للكتابة.",
  },
  {
    id: "tech_hex",
    name: "التقنية الطبية المتطورة",
    subtitle: "Bio-Tech Hexagon Network",
    badge: "خلايا رقمية ⚡",
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
    badge: "طبي حيوي 🧬",
    badgeColor: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    description: "تصميم طبي حيوي مفعم بالحياة؛ موجات تخطيط نبض القلب (ECG Pulse)، ولولب الجينوم (DNA Helix).",
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
