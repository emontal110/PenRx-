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

  // 6. NORDIC PASTEL (النبض النورديك الانسيابي - هدوء وبساطة اسكندنافية بأمواج الباستيل المينت والسيان)
  if (templateId === "nordic_pastel") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Full-width Top Pastel Mint Header Wave Banner with Cyan Accent Ribbon */}
        <div className="absolute top-0 inset-x-0 h-28 sm:h-32 overflow-hidden pointer-events-none z-0">
          <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none" fill="none">
            {/* Primary Mint Pastel Wave */}
            <path d="M0,0 L600,0 L600,78 C440,52 280,105 0,68 Z" fill="#9fe1d4" />
            {/* Secondary Soft Cyan Wave Ribbon */}
            <path d="M0,68 C280,105 440,52 600,78 L600,92 C440,65 280,118 0,82 Z" fill="#67e8f9" />
          </svg>
        </div>

        {/* Delicate Circular Pastel Watermark Stamp in Top Left */}
        <svg
          className="absolute top-3 left-4 w-10 h-10 opacity-30 pointer-events-none z-10"
          viewBox="0 0 32 32"
          fill="none"
          style={{ color: "#065f46" }}
        >
          <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="16" cy="16" r="9" fill="currentColor" fillOpacity="0.1" />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>

        {/* Matching Soft Mint & Cyan Bottom Footer Wave */}
        <div className="absolute bottom-0 inset-x-0 h-18 sm:h-22 overflow-hidden pointer-events-none z-0">
          <svg className="w-full h-full" viewBox="0 0 600 80" preserveAspectRatio="none" fill="none">
            {/* Secondary Cyan Ribbon */}
            <path d="M0,20 C180,-5 380,38 600,14 L600,25 C380,48 180,6 0,32 Z" fill="#67e8f9" />
            {/* Primary Mint Wave */}
            <path d="M0,32 C180,6 380,48 600,25 L600,80 L0,80 Z" fill="#9fe1d4" />
          </svg>
        </div>
      </div>
    );
  }

  // 7. GEOMETRIC FRAME (الإطار الهندسي الأنيق - إطار زمردي مزدوج وزوايا ألماسية معمارية)
  if (templateId === "geometric_frame") {
    return (
      <div className="absolute inset-0 pointer-events-none z-0 print:opacity-100 overflow-hidden">
        {/* Outer Perimeter Emerald Frame */}
        <div className="absolute inset-1.5 sm:inset-2.5 border-2 border-emerald-500 pointer-events-none" />

        {/* Inner Precision Inset Border */}
        <div className="absolute inset-3 sm:inset-4 border border-emerald-500/80 pointer-events-none" />

        {/* Top-Right Diamond Corner */}
        <svg className="absolute top-2 right-2 sm:top-3 sm:right-3 w-5 h-5 text-emerald-600" viewBox="0 0 20 20" fill="none">
          <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill="currentColor" />
        </svg>

        {/* Top-Left Diamond Corner */}
        <svg className="absolute top-2 left-2 sm:top-3 sm:left-3 w-5 h-5 text-emerald-600" viewBox="0 0 20 20" fill="none">
          <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill="currentColor" />
        </svg>

        {/* Bottom-Right Diamond Corner */}
        <svg className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-5 h-5 text-emerald-600" viewBox="0 0 20 20" fill="none">
          <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill="currentColor" />
        </svg>

        {/* Bottom-Left Diamond Corner */}
        <svg className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-5 h-5 text-emerald-600" viewBox="0 0 20 20" fill="none">
          <rect x="6" y="6" width="8" height="8" transform="rotate(45 10 10)" fill="currentColor" />
        </svg>

        {/* Geometric Margin Crosshairs */}
        <svg className="absolute top-8 left-8 w-3 h-3 text-emerald-500/50" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
        </svg>
        <svg className="absolute top-8 right-8 w-3 h-3 text-emerald-500/50" viewBox="0 0 12 12" fill="none">
          <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  // 8. SOFT CURVES CARE (الرعاية الدافئة وطب الأسرة - ترويسة مرجانية دافئة مع موجة سماوية ناعمة)
  if (templateId === "soft_curves") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Full-width Warm Coral Header Banner with Sky Blue Wave Ribbon */}
        <div className="absolute top-0 inset-x-0 h-28 sm:h-32 overflow-hidden pointer-events-none z-0">
          <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none" fill="none">
            {/* Primary Warm Coral Header */}
            <path d="M0,0 L600,0 L600,76 C420,58 240,98 0,70 Z" fill="#ff7659" />
            {/* Secondary Sky Blue Ribbon Wave */}
            <path d="M0,70 C240,98 420,58 600,76 L600,88 C420,70 240,110 0,82 Z" fill="#38bdf8" />
          </svg>
        </div>

        {/* Friendly Floating Circles in Top Corner */}
        <div className="absolute top-3 left-4 flex items-center gap-1.5 opacity-40 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-white" />
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>

        {/* Matching Warm Coral & Sky Blue Bottom Footer Wave */}
        <div className="absolute bottom-0 inset-x-0 h-18 sm:h-22 overflow-hidden pointer-events-none z-0">
          <svg className="w-full h-full" viewBox="0 0 600 80" preserveAspectRatio="none" fill="none">
            {/* Secondary Sky Blue Ribbon */}
            <path d="M0,18 C200,-5 380,36 600,12 L600,22 C380,46 200,5 0,28 Z" fill="#38bdf8" />
            {/* Primary Warm Coral Wave */}
            <path d="M0,28 C200,5 380,46 600,22 L600,80 L0,80 Z" fill="#ff7659" />
          </svg>
        </div>
      </div>
    );
  }

  // 9. ACADEMIC ROYAL CREST (الشريط الأكاديمي التخصصي - شريط كحلي وقور مع خط زمردي وشعار الكادوسيوس الطبي)
  if (templateId === "academic_crest") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 print:opacity-100">
        {/* Top Solid Royal Navy Banner with Emerald Green Bottom Stripe */}
        <div className="absolute top-0 inset-x-0 h-24 sm:h-28 bg-[#0f2942] pointer-events-none z-0">
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-emerald-500 shadow-sm" />
        </div>

        {/* Central Prominent Caduceus / Rod of Asclepius Medical Crest Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] z-0">
          <svg
            className="w-52 h-64 sm:w-64 sm:h-80"
            viewBox="0 0 200 280"
            fill="none"
            style={{ color: "#0f2942" }}
          >
            {/* Center Asclepius Rod & Pinecone finial */}
            <line x1="100" y1="18" x2="100" y2="265" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
            <circle cx="100" cy="16" r="8" fill="currentColor" />
            {/* Symmetrical Twin Serpents (Caduceus) */}
            <path
              d="M75,230 C50,200 135,175 115,145 C95,115 55,90 95,55 C125,35 75,25 95,16"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M125,230 C150,200 65,175 85,145 C105,115 145,90 105,55 C75,35 125,25 105,16"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Classical Angelic Healing Wings */}
            <path
              d="M100,52 C135,22 175,35 190,65 C165,68 135,60 100,75"
              fill="currentColor"
              fillOpacity="0.4"
            />
            <path
              d="M100,52 C65,22 25,35 10,65 C35,68 65,60 100,75"
              fill="currentColor"
              fillOpacity="0.4"
            />
            {/* Formal Medical Laurel Wreath Base */}
            <path
              d="M45,210 C35,235 65,260 100,265 C135,260 165,235 155,210"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="4 3"
            />
          </svg>
        </div>

        {/* Bottom Solid Royal Navy Footer Banner with Emerald Green Top Accent */}
        <div className="absolute bottom-0 inset-x-0 h-16 sm:h-18 bg-[#0f2942] pointer-events-none z-0">
          <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500 shadow-sm" />
        </div>
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
          backgroundColor: "#ffffff",
          borderColor: "#99f6e4",
        },
        className: "border-2 border-teal-200/90 shadow-2xl relative overflow-hidden",
      };

    case "geometric_frame":
      return {
        style: {
          backgroundColor: "#ffffff",
          border: "3px solid #10b981",
        },
        className: "shadow-2xl relative overflow-hidden",
      };

    case "soft_curves":
      return {
        style: {
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          border: "2px solid #fdba74",
        },
        className: "shadow-2xl relative overflow-hidden",
      };

    case "academic_crest":
      return {
        style: {
          backgroundColor: "#ffffff",
          border: "2px solid #0f2942",
        },
        className: "shadow-2xl relative overflow-hidden",
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
