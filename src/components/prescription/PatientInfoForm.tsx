"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  Calendar,
  AlertTriangle,
  HeartPulse,
  Settings2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { PatientInfo, VisiblePatientFields } from "@/store/usePrescriptionStore";
import { UnifiedPatientRecord, normalizePatientName, searchPatientCatalog } from "@/lib/patientRegistry";
import { calculateBmiInfo } from "@/lib/utils";

interface PatientInfoFormProps {
  patient: PatientInfo;
  setPatient: (patient: Partial<PatientInfo>) => void;
  visibleFields: VisiblePatientFields;
  setVisibleFields: (fields: Partial<VisiblePatientFields>) => void;
  unifiedCatalog: UnifiedPatientRecord[];
  onSelectPatient: (p: UnifiedPatientRecord) => void;
}

export function PatientInfoForm({
  patient,
  setPatient,
  visibleFields,
  setVisibleFields,
  unifiedCatalog,
  onSelectPatient,
}: PatientInfoFormProps) {
  const [patientSuggestions, setPatientSuggestions] = useState<UnifiedPatientRecord[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const patientNameInputRef = useRef<HTMLInputElement>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);

  const bmiInfo = calculateBmiInfo(patient.height, patient.weight);

  const matchedPatientRecord = React.useMemo(() => {
    if (!patient.name || !patient.name.trim()) return null;
    const norm = normalizePatientName(patient.name);
    return unifiedCatalog.find((p) => normalizePatientName(p.name) === norm) || null;
  }, [patient.name, unifiedCatalog]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        patientDropdownRef.current &&
        !patientDropdownRef.current.contains(e.target as Node) &&
        patientNameInputRef.current &&
        !patientNameInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestionsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNameChange = (val: string) => {
    setPatient({ name: val });
    if (!val || val.trim().length < 2) {
      setPatientSuggestions([]);
      setShowSuggestionsDropdown(false);
      return;
    }
    const matches = searchPatientCatalog(val, unifiedCatalog, 6);
    setPatientSuggestions(matches);
    setShowSuggestionsDropdown(matches.length > 0);
    setHighlightedIndex(0);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestionsDropdown || patientSuggestions.length === 0) {
      if (e.key === "Enter" && matchedPatientRecord) {
        e.preventDefault();
        onSelectPatient(matchedPatientRecord);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < patientSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : patientSuggestions.length - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (patientSuggestions[highlightedIndex]) {
        e.preventDefault();
        onSelectPatient(patientSuggestions[highlightedIndex]);
        setShowSuggestionsDropdown(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestionsDropdown(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <span className="text-xs sm:text-sm font-black text-slate-200 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>بيانات المريض</span>
        </span>

        <Link
          href="/settings?tab=patientFields"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer group"
          title="تخصيص وإعدادات حقول بيانات المريض بالروشتة"
        >
          <Settings2 className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-45 transition-transform" />
          <span>إعدادات الحقول</span>
        </Link>
      </div>

      <div className="space-y-4">
        {/* Name and Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Patient Name with Autocomplete */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>اسم المريض: *</span>
              </label>

              {matchedPatientRecord && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>مسجل بالسجل</span>
                </span>
              )}

              {patient.allergyNotes && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="truncate max-w-[150px]">حساسية: {patient.allergyNotes}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                ref={patientNameInputRef}
                type="text"
                value={patient.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="اكتب اسم المريض للترشيح الفوري من السجل..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-black text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                autoComplete="off"
              />

              {patient.name && (
                <button
                  type="button"
                  onClick={() => {
                    setPatient({ name: "", phone: "", age: "", height: "", weight: "", bloodType: "", allergyNotes: "", medicalHistory: "" });
                    setPatientSuggestions([]);
                    setShowSuggestionsDropdown(false);
                    patientNameInputRef.current?.focus();
                  }}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestionsDropdown && patientSuggestions.length > 0 && (
              <div
                ref={patientDropdownRef}
                className="absolute z-50 top-full mt-2 w-full min-w-[320px] bg-slate-900/98 backdrop-blur-2xl border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800"
                dir="rtl"
              >
                <div className="px-4 py-2 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    نتائج مطابقة من سجل المرضى ({patientSuggestions.length})
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {patientSuggestions.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectPatient(item);
                        setShowSuggestionsDropdown(false);
                      }}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                        idx === highlightedIndex ? "bg-emerald-500/20 text-emerald-200" : "hover:bg-slate-800 text-slate-300"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-100">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {item.phone && <span>الهاتف: {item.phone}</span>}
                          {item.age && <span>السن: {item.age}</span>}
                        </div>
                      </div>
                      {item.prescriptionCount > 0 && (
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                          {item.prescriptionCount} روشتة
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Patient Phone */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
              <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>رقم الهاتف (واتساب):</span>
            </label>
            <input
              type="tel"
              value={patient.phone || ""}
              onChange={(e) => setPatient({ phone: e.target.value })}
              placeholder="010XXXXXXXX"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Optional Visible Fields (Age, Gender, Blood type, BMI) */}
        {(visibleFields.showAge || visibleFields.showGender || visibleFields.showBloodType) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60 text-xs">
            {visibleFields.showAge && (
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">السن (بالسنوات):</label>
                <input
                  type="number"
                  value={patient.age || ""}
                  onChange={(e) => setPatient({ age: e.target.value })}
                  placeholder="مثال: 35"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {visibleFields.showGender && (
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">النوع:</label>
                <select
                  value={patient.gender || "MALE"}
                  onChange={(e) => setPatient({ gender: e.target.value as "MALE" | "FEMALE" })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="MALE">ذكر</option>
                  <option value="FEMALE">أنثى</option>
                </select>
              </div>
            )}

            {visibleFields.showBloodType && (
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">فصيلة الدم:</label>
                <select
                  value={patient.bloodType || ""}
                  onChange={(e) => setPatient({ bloodType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                >
                  <option value="">غير محدد</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Clinical History & Allergies */}
        {(visibleFields.showAllergies || visibleFields.showMedicalHistory) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-xs">
            {visibleFields.showAllergies && (
              <div className="space-y-1">
                <label className="font-bold text-rose-300 text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  حساسية الأدوية:
                </label>
                <input
                  type="text"
                  value={patient.allergyNotes || ""}
                  onChange={(e) => setPatient({ allergyNotes: e.target.value })}
                  placeholder="حساسية بنسلين، سلفا..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-500/30 text-rose-200 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            {visibleFields.showMedicalHistory && (
              <div className="space-y-1">
                <label className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-amber-400" />
                  الأمراض المزمنة والتاريخ المرضي:
                </label>
                <input
                  type="text"
                  value={patient.medicalHistory || ""}
                  onChange={(e) => setPatient({ medicalHistory: e.target.value })}
                  placeholder="ضغط، سكري، قلب..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-200 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
