"use client";

import React from "react";
import { Eye } from "lucide-react";
import { Branch, PrescriptionTemplate } from "@/store/useClinicStore";
import {
  PrescriptionTemplateDecorations,
  getTemplateContainerStyles,
} from "@/components/prescription/PrescriptionTemplateDecorations";

export interface SettingsPrescriptionPreviewProps {
  doctorName: string;
  doctorTitle: string;
  specialty: string;
  syndicateId: string;
  nameAr: string;
  name: string;
  workingHours?: string;
  footerText: string;
  clinicPhone: string;
  logoUrl: string;
  primaryColor: string;
  fontFamily: string;
  templateId?: PrescriptionTemplate;
  paperSize: "A5" | "A6" | "A4" | "B5";
  showHeader: boolean;
  showFooter: boolean;
  visibleFields: {
    showAge: boolean;
    showGender: boolean;
    showHeight: boolean;
    showWeight: boolean;
    showBloodType: boolean;
    showDiagnosis: boolean;
    showMedicalHistory: boolean;
    showAllergies: boolean;
  };
  branchAddress?: string;
  branches?: Branch[];
  activeBranchId?: string;
  title?: string;
}

export function SettingsPrescriptionPreview({
  doctorName,
  doctorTitle,
  specialty,
  syndicateId,
  nameAr,
  name,
  workingHours = "",
  footerText,
  clinicPhone,
  logoUrl,
  primaryColor,
  fontFamily,
  templateId = "classic",
  paperSize,
  showHeader,
  showFooter,
  visibleFields,
  branchAddress = "",
  branches = [],
  activeBranchId = "",
  title = "معاينة حية فورية للروشتة المطبوعة:",
}: SettingsPrescriptionPreviewProps) {
  const paperLabels = {
    A5: { label: "A5", name: "A5 قياسي (الافتراضي)", desc: "14.8 × 21 سم (1748 × 2480 px)", maxW: "max-w-[440px] mx-auto text-[11px]", minH: "min-h-[660px] sm:min-h-[700px]" },
    A6: { label: "A6", name: "A6 مصغر", desc: "10.5 × 14.8 سم (1240 × 1748 px)", maxW: "max-w-[360px] mx-auto text-[10px]", minH: "min-h-[560px] sm:min-h-[600px]" },
    A4: { label: "A4", name: "A4 كامل", desc: "21 × 29.7 سم", maxW: "max-w-full", minH: "min-h-[820px] sm:min-h-[880px]" },
    B5: { label: "B5", name: "B5 وسيط", desc: "17.6 × 25 سم", maxW: "max-w-[480px] mx-auto text-xs", minH: "min-h-[720px] sm:min-h-[760px]" },
  };

  const currentPaper = paperLabels[paperSize] || paperLabels.A5;
  const templateStyles = getTemplateContainerStyles(templateId, primaryColor);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-emerald-400" />
          <span>{title}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            معاينة حية
          </span>
        </div>
      </div>

      {/* Prescription Preview Card */}
      <div
        style={{
          fontFamily,
          ...templateStyles.style,
        }}
        className={`text-slate-900 rounded-3xl p-5 sm:p-6 space-y-3.5 transition-all relative overflow-hidden flex flex-col justify-between ${templateStyles.className} ${currentPaper.maxW} ${currentPaper.minH}`}
        dir="rtl"
      >
        {/* Prescription Template Vector Decorations (Waves, Hexagons, Ornate Corners, etc.) */}
        <PrescriptionTemplateDecorations templateId={templateId} primaryColor={primaryColor} />

        {/* Center Watermark: Same Logo as Header with High Transparency */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          <div className="w-48 h-48 sm:w-60 sm:h-60 relative opacity-[0.045] flex items-center justify-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Clinic Watermark"
                className="max-h-full max-w-full object-contain grayscale"
              />
            ) : (
              <span className="font-serif text-8xl font-black" style={{ color: primaryColor }}>
                ℞
              </span>
            )}
          </div>
        </div>

        {/* Clinic & Doctor Header (Respects showHeader & Adapts to Template) */}
        {showHeader !== false ? (
          (() => {
            const isAcademic = templateId === "academic_crest";
            const isSoftCurves = templateId === "soft_curves";
            const isNordic = templateId === "nordic_pastel";
            const isGeometric = templateId === "geometric_frame";

            return (
              <div
                className={`transition-all relative z-10 ${
                  isAcademic
                    ? "-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 p-4 sm:p-5 pt-3 pb-3 mb-2 text-white"
                    : isSoftCurves
                    ? "-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 p-4 sm:p-5 pt-3 pb-3.5 mb-2 text-white"
                    : isNordic
                    ? "-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 p-4 sm:p-5 pt-3 pb-3.5 mb-2 text-emerald-950"
                    : isGeometric
                    ? "border-b-2 border-emerald-600 pb-2 mb-2 space-y-1.5"
                    : "border-b-2 pb-2.5 space-y-1.5 relative z-10"
                }`}
                style={
                  !isAcademic && !isSoftCurves && !isNordic && !isGeometric
                    ? { borderColor: `${primaryColor}30` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Right: Logo + Doctor Details */}
                  <div className="flex items-center gap-2.5">
                    {logoUrl && (
                      <div
                        className={`rounded-2xl overflow-hidden border p-1 shrink-0 flex items-center justify-center shadow-sm ${
                          isAcademic || isSoftCurves
                            ? "bg-white/95 border-white/60"
                            : isNordic
                            ? "bg-white border-teal-200"
                            : "bg-white border-slate-200"
                        }`}
                        style={{ width: "52px", height: "52px" }}
                      >
                        <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                    <div>
                      <h3
                        className={`text-base font-black leading-tight ${
                          isAcademic || isSoftCurves
                            ? "text-white drop-shadow-xs"
                            : isNordic
                            ? "text-emerald-950 font-black"
                            : isGeometric
                            ? "text-emerald-700"
                            : ""
                        }`}
                        style={
                          !isAcademic && !isSoftCurves && !isNordic && !isGeometric
                            ? { color: primaryColor }
                            : undefined
                        }
                      >
                        {doctorName || "اسم الطبيب المعالج"}
                      </h3>
                      <p
                        className={`text-[10px] font-bold ${
                          isAcademic
                            ? "text-slate-200"
                            : isSoftCurves
                            ? "text-rose-100"
                            : isNordic
                            ? "text-emerald-900"
                            : "text-slate-700"
                        }`}
                      >
                        {doctorTitle || "الدرجة العلمية والتخصص"}
                      </p>
                      <p
                        className={`text-[9px] font-semibold ${
                          isAcademic
                            ? "text-emerald-300"
                            : isSoftCurves
                            ? "text-orange-100"
                            : isNordic
                            ? "text-emerald-800"
                            : isGeometric
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                      >
                        {specialty || ""}
                      </p>
                      {syndicateId && (
                        <p
                          className={`text-[8px] font-mono ${
                            isAcademic || isSoftCurves
                              ? "text-white/80"
                              : isNordic
                              ? "text-emerald-900/80"
                              : "text-slate-400"
                          }`}
                        >
                          ترخيص: {syndicateId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Left: Clinic Details with distinctive, elegant typography for Clinic Name & Specialty */}
                  <div className="text-left space-y-1">
                    <h4
                      className={`text-sm font-black leading-tight tracking-tight drop-shadow-xs ${
                        isAcademic || isSoftCurves
                          ? "text-white"
                          : isNordic
                          ? "text-emerald-950"
                          : "text-slate-900"
                      }`}
                      style={{
                        fontFamily: "'El Messiri', 'Alexandria', 'Cairo', serif",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {nameAr || "اسم العيادة / المركز"}
                    </h4>
                    {name && (
                      <p
                        className={`text-[11px] font-bold ${
                          isAcademic
                            ? "text-emerald-300"
                            : isSoftCurves
                            ? "text-orange-100"
                            : isNordic
                            ? "text-teal-800"
                            : isGeometric
                            ? "text-emerald-600"
                            : ""
                        }`}
                        style={
                          !isAcademic && !isSoftCurves && !isNordic && !isGeometric
                            ? {
                                fontFamily: "'Alexandria', 'Cairo', sans-serif",
                                color: primaryColor,
                              }
                            : { fontFamily: "'Alexandria', 'Cairo', sans-serif" }
                        }
                      >
                        {name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="p-2 text-center text-[10px] font-bold text-slate-400 bg-slate-100 rounded-xl border border-dashed border-slate-300">
            (تم إخفاء الترويسة العلوية حسب رغبتك للطباعة على ورق مروّس جاهز)
          </div>
        )}

        {/* Patient Bar Preview (Reflects visibleFields & Adapts to Template) */}
        {(() => {
          const isSoftCurves = templateId === "soft_curves";
          const isNordic = templateId === "nordic_pastel";

          return (
            <div
              className={`px-3 py-1.5 rounded-xl border text-[10px] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 relative z-10 ${
                isSoftCurves
                  ? "bg-orange-50/70 border-orange-200/80"
                  : isNordic
                  ? "bg-teal-50/60 border-teal-200/70"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1">
                {isSoftCurves ? (
                  <span className="bg-[#fed7aa] text-orange-950 px-2 py-0.5 rounded-md font-bold text-[9px]">
                    الاسم:
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium text-[9px]">المريض: </span>
                )}
                <span className="font-bold text-slate-900 text-[10.5px]">محمد أحمد محمود</span>
              </div>

              {(visibleFields.showAge || visibleFields.showGender) && (
                <div className="text-slate-700 font-bold flex items-center gap-1">
                  {isSoftCurves ? (
                    <span className="bg-[#fed7aa] text-orange-950 px-2 py-0.5 rounded-md font-bold text-[9px]">
                      السن:
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">السن/النوع: </span>
                  )}
                  <span>
                    {visibleFields.showAge && "38 سنة"}
                    {visibleFields.showAge && visibleFields.showGender && " / "}
                    {visibleFields.showGender && "ذكر"}
                  </span>
                </div>
              )}

              {(visibleFields.showHeight || visibleFields.showWeight) && (
                <div className="text-slate-700 font-bold flex items-center gap-1 flex-wrap">
                  <span className="text-slate-400 font-medium">القياسات: </span>
                  <span>
                    {visibleFields.showHeight && "178 سم"}
                    {visibleFields.showHeight && visibleFields.showWeight && " • "}
                    {visibleFields.showWeight && "82 كجم"}
                  </span>
                  {visibleFields.showHeight && visibleFields.showWeight && (
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/60 inline-flex items-center gap-1 shadow-xs">
                      <span>⚠️</span>
                      <span>وزن زائد (Overweight)</span>
                      <span className="font-mono text-[8.5px] opacity-90" dir="ltr">(25.9)</span>
                    </span>
                  )}
                </div>
              )}

              {visibleFields.showBloodType && (
                <div>
                  <span className="text-slate-400 font-medium">فصيلة: </span>
                  <span className="font-black text-rose-600">A+</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                {isSoftCurves ? (
                  <span className="bg-[#bae6fd] text-sky-950 px-2 py-0.5 rounded-md font-bold text-[9px]">
                    التاريخ:
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">التاريخ: </span>
                )}
                <span className="font-bold text-slate-800">
                  {new Date().toLocaleDateString("ar-EG")}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Diagnosis Preview (Reflects visibleFields.showDiagnosis) */}
        {visibleFields.showDiagnosis && (
          <div
            className="p-2 rounded-xl text-[10px] border font-bold flex items-center gap-1.5"
            style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30`, color: primaryColor }}
          >
            <span className="font-black shrink-0">التشخيص الطبي:</span>
            <span className="text-slate-800 font-medium">التهاب اللوزتين الحاد (Acute Tonsillitis)</span>
          </div>
        )}

        {/* Medical History & Allergies (Reflects visibleFields) */}
        {(visibleFields.showMedicalHistory || visibleFields.showAllergies) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px]">
            {visibleFields.showMedicalHistory && (
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <span className="font-black block text-blue-800 mb-0.5">الأمراض المزمنة:</span>
                <span>ارتفاع ضغط الدم، حساسية صدرية</span>
              </div>
            )}
            {visibleFields.showAllergies && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-black block text-amber-800 mb-0.5">⚠️ حساسية الأدوية:</span>
                <span>البنسلين ومشتقات السلفا</span>
              </div>
            )}
          </div>
        )}

        {/* Rx Sample Items */}
        <div className="space-y-2 py-1 relative z-10">
          <div className="flex items-center gap-1.5" style={{ color: primaryColor }}>
            <span className="font-serif font-black text-2xl italic">℞</span>
            <span className="text-[10px] font-black text-slate-600">العلاج الدوائي والجرعات</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <span className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full text-white text-[10px] font-bold leading-none flex items-center justify-center font-mono shrink-0 shadow-xs" style={{ backgroundColor: primaryColor }}>
                1
              </span>
              <span>Augmentin 1gm Tablet</span>
            </div>
            <p className="text-[10px] pr-6" style={{ color: primaryColor }}>
              قرص واحد • كل 12 ساعة بعد الأكل • لمدة 7 أيام
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
              <span className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full text-white text-[10px] font-bold leading-none flex items-center justify-center font-mono shrink-0 shadow-xs" style={{ backgroundColor: primaryColor }}>
                2
              </span>
              <span>Panadol Extra Tablet</span>
            </div>
            <p className="text-[10px] pr-6" style={{ color: primaryColor }}>
              قرصين عند اللزوم للصداع وارتفاع الحرارة
            </p>
          </div>
        </div>

        {/* Comfortable natural breathing margin between medications and footer */}
        <div className="flex-1 min-h-[50px]" aria-hidden="true" />

        {/* Footer Preview (Adapts to Template) */}
        {showFooter !== false ? (
          (() => {
            const isAcademic = templateId === "academic_crest";
            const isSoftCurves = templateId === "soft_curves";
            const isNordic = templateId === "nordic_pastel";
            const isGeometric = templateId === "geometric_frame";

            return (
              <div
                className={`relative z-10 transition-all ${
                  isAcademic
                    ? "-mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 text-white"
                    : isSoftCurves
                    ? "-mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 text-slate-800"
                    : isNordic
                    ? "-mx-5 sm:-mx-6 -mb-5 sm:-mb-6 p-3 text-emerald-950"
                    : isGeometric
                    ? "border-t-2 border-emerald-600 pt-2 space-y-1"
                    : "space-y-1 pt-1"
                }`}
              >
                {/* Branches & Clinic Phone Numbers & Working Hours (No Doctor Signature, No 'الفرع الرئيسي') */}
                <div
                  className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[9px] font-semibold w-full ${
                    !isGeometric && !isAcademic && !isSoftCurves && !isNordic ? "border-t border-slate-200/80 pt-2" : "pt-1"
                  } ${
                    isAcademic
                      ? "text-slate-200"
                      : isNordic
                      ? "text-emerald-950"
                      : "text-slate-600"
                  }`}
                >
                  {(() => {
                    const liveBranches = branches && branches.length > 0
                      ? branches.map((b, idx) => {
                          const isTarget = activeBranchId ? b.id === activeBranchId : idx === 0;
                          if (isTarget) {
                            return {
                              ...b,
                              address: branchAddress !== undefined ? branchAddress : b.address,
                              phone: clinicPhone !== undefined ? clinicPhone : b.phone,
                              workingHours: workingHours !== undefined ? workingHours : b.workingHours,
                            };
                          }
                          return b;
                        })
                      : [
                          {
                            id: "preview-default",
                            name: "Main",
                            nameAr: nameAr || "الفرع الرئيسي",
                            address: branchAddress || "",
                            phone: clinicPhone || "",
                            workingHours: workingHours || "",
                            isDefault: true,
                          },
                        ];

                    return liveBranches.map((b, idx) => (
                      <div key={b.id || idx} className="flex items-center gap-2 flex-wrap justify-center">
                        {b.address && <span>📍 {b.address}</span>}
                        {b.phone && (
                          <span
                            className={`font-mono font-bold ${
                              isAcademic
                                ? "text-emerald-300"
                                : isNordic
                                ? "text-emerald-950 font-black"
                                : "text-slate-700"
                            }`}
                            dir="ltr"
                          >
                            📞 {b.phone}
                          </span>
                        )}
                        {b.workingHours && <span>🕒 {b.workingHours}</span>}
                      </div>
                    ));
                  })()}
                </div>

                {/* Sentence: نتمنى لكم الشفاء العاجل directly above the bottom border */}
                <p
                  className={`text-center font-bold text-[9px] pt-0.5 ${
                    isAcademic
                      ? "text-emerald-300"
                      : isSoftCurves
                      ? "text-rose-900"
                      : isNordic
                      ? "text-emerald-900 font-black"
                      : "text-slate-500"
                  }`}
                >
                  {footerText || "نتمنى لكم الشفاء العاجل ودوام الصحة والعافية"}
                </p>
              </div>
            );
          })()
        ) : (
          <div className="p-1.5 text-center text-[9px] font-bold text-slate-400 bg-slate-100 rounded-lg border border-dashed border-slate-300">
            (تم إخفاء التذييل السفلي حسب رغبتك)
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPrescriptionPreview;
