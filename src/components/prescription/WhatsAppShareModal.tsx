"use client";

import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  FileText,
  Image as ImageIcon,
  Share2,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  ExternalLink,
  Smartphone,
  Laptop,
} from "lucide-react";
import { toPng, toBlob } from "html-to-image";
import { jsPDF } from "jspdf";
import { PatientInfo, PrescriptionItem } from "@/store/usePrescriptionStore";
import { ClinicSettings } from "@/store/useClinicStore";

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientInfo;
  clinic: ClinicSettings;
  prescriptionNo: string;
  diagnosis?: string;
  notes?: string;
  items?: PrescriptionItem[];
  printAreaRef?: React.RefObject<HTMLDivElement | null>;
  onSaveBeforeShare?: () => void;
}

export function normalizeWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return "";

  // Strip leading 00 if international format was entered as 0020...
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // Egyptian already starting with 20 (e.g. 201012345678)
  if (cleaned.startsWith("20") && cleaned.length >= 11) {
    return cleaned;
  }

  // Egyptian mobile with leading 0 (e.g. 01012345678, 011..., 012..., 015...) -> add 2 to make 2010... (+2)
  if (cleaned.startsWith("0")) {
    return `2${cleaned}`;
  }

  // Egyptian mobile without leading 0 (e.g. 1012345678) -> add 20 to make 2010... (+2)
  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return `20${cleaned}`;
  }

  // Default: prepend 2
  return `2${cleaned}`;
}

export function WhatsAppShareModal({
  isOpen,
  onClose,
  patient,
  clinic,
  prescriptionNo,
  diagnosis = "",
  notes = "",
  items = [],
  printAreaRef,
  onSaveBeforeShare,
}: WhatsAppShareModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(patient.phone || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<"text" | "image" | "pdf" | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    type: "text" | "image" | "pdf";
    fileName?: string;
    fileUrl?: string;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync phone if patient changes
  useEffect(() => {
    if (patient.phone) {
      setPhoneNumber(patient.phone);
    }
  }, [patient.phone]);

  if (!isOpen) return null;

  const cleanPhone = normalizeWhatsAppNumber(phoneNumber || patient.phone || "");

  const getTargetElement = (): HTMLElement | null => {
    if (printAreaRef && printAreaRef.current) return printAreaRef.current;
    return document.getElementById("prescription-print-sheet");
  };

  // Build the complete structured prescription text message
  const buildPrescriptionTextMessage = () => {
    const doctor = clinic.doctorName || "الطبيب المعالج";
    const clinicTitle = clinic.nameAr || clinic.name || "العيادة التخصصية";
    const dateStr = new Date().toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let msg = `📋 *الروشتة الطبية الإلكترونية*\n`;
    msg += `🏥 *عيادة:* ${clinicTitle}\n`;
    msg += `👨‍⚕️ *الطبيب:* ${doctor}${clinic.doctorTitle ? ` (${clinic.doctorTitle})` : ""}\n`;
    msg += `────────────────────\n`;
    msg += `👤 *اسم المريض:* ${patient.name || "مريض"}\n`;
    msg += `🔢 *رقم الروشتة:* ${prescriptionNo}\n`;
    msg += `📅 *التاريخ:* ${dateStr}\n`;
    if (diagnosis && diagnosis.trim()) {
      msg += `🩺 *التشخيص:* ${diagnosis.trim()}\n`;
    }
    msg += `────────────────────\n`;
    msg += `💊 *العلاج الدوائي والجرعات:*\n`;

    if (items && items.length > 0) {
      items.forEach((item, i) => {
        msg += `\n*${i + 1}. ${item.drugName}*`;
        if (item.activeIngredient) {
          msg += ` _(${item.activeIngredient})_`;
        }
        msg += `\n   • الجرعة: ${item.doseQuantity} ${item.doseForm}`;
        msg += `\n   • التكرار: ${item.frequency}`;
        msg += `\n   • المدة: ${item.duration}`;
        if (item.instructions && item.instructions.trim()) {
          msg += `\n   • تعليمات: ${item.instructions.trim()}`;
        }
      });
    } else {
      msg += `\n(يرجى الرجوع للتعليمات المرفقة)`;
    }

    msg += `\n\n────────────────────\n`;
    if (notes && notes.trim()) {
      msg += `📝 *ملاحظات:* ${notes.trim()}\n`;
    }
    if (clinic.footerText) {
      msg += `✨ ${clinic.footerText}\n`;
    } else {
      msg += `✨ مع تمنياتنا لكم بدوام الصحة والشفاء العاجل\n`;
    }
    if (clinic.phone) {
      msg += `📞 للتواصل والاستفسار: ${clinic.phone}\n`;
    }

    return msg;
  };

  // Direct WhatsApp URL that opens straight into the patient's chat
  const getDirectWhatsAppUrl = (textMsg: string) => {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMsg)}`;
  };

  // Direct Send: Text Only
  const handleSendTextDirect = () => {
    if (!cleanPhone) {
      setErrorMessage("يرجى كتابة رقم هاتف المريض بشكل صحيح.");
      return;
    }
    setErrorMessage(null);

    if (onSaveBeforeShare) {
      onSaveBeforeShare();
    }

    const text = buildPrescriptionTextMessage();
    const url = getDirectWhatsAppUrl(text);
    window.open(url, "_blank");

    setSuccessInfo({
      type: "text",
      message: `تم فتح محادثة الواتساب مباشرة مع المريض (${cleanPhone}) مع تفاصيل الروشتة كاملة!`,
    });
  };

  // Standardized capture helper that creates an isolated staging element
  // to render the prescription at standard width (unconstrained by screen or column width)
  const renderStandardPrescription = async <T,>(
    captureFn: (element: HTMLElement) => Promise<T>
  ): Promise<T | null> => {
    const target = getTargetElement();
    if (!target) return null;

    // Standard width for prescription layout based on chosen paper size
    const paperSize = clinic.paperSize || "A5";
    const standardWidth =
      paperSize === "A6"
        ? 420
        : paperSize === "A4"
        ? 720
        : paperSize === "B5"
        ? 580
        : 530; // Default A5: 530px provides ample room for full header, doctor name, and ornate borders

    // Clone the prescription node
    const clone = target.cloneNode(true) as HTMLElement;

    // Clean up any interactive preview buttons (pencil, trash, etc.)
    clone.querySelectorAll(".no-print").forEach((el) => el.remove());

    // Create a pristine staging container attached to document.body
    // Positioned at top:0, left:0 with zIndex:-9999 and opacity:0 so it doesn't flash or affect user view
    const stage = document.createElement("div");
    stage.setAttribute("dir", "rtl");
    stage.style.position = "fixed";
    stage.style.top = "0";
    stage.style.left = "0";
    stage.style.width = `${standardWidth + 24}px`;
    stage.style.padding = "12px";
    stage.style.backgroundColor = "#ffffff";
    stage.style.zIndex = "-9999";
    stage.style.opacity = "0";
    stage.style.pointerEvents = "none";
    stage.style.boxSizing = "border-box";

    // Configure clone styles for an exact, unconstrained, clean presentation
    clone.style.width = `${standardWidth}px`;
    clone.style.minWidth = `${standardWidth}px`;
    clone.style.maxWidth = `${standardWidth}px`;
    clone.style.margin = "0 auto";
    clone.style.boxSizing = "border-box";
    clone.style.transform = "none";
    clone.style.direction = "rtl";

    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      // Allow browser microtask for layout & font calculation
      await new Promise((resolve) => setTimeout(resolve, 80));

      return await captureFn(stage);
    } finally {
      if (stage.parentNode) {
        stage.parentNode.removeChild(stage);
      }
    }
  };

  // Generate Image
  const generateImageBlob = async (): Promise<Blob | null> => {
    return await renderStandardPrescription(async (stageEl) => {
      return await toBlob(stageEl, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: {
          opacity: "1",
          visibility: "visible",
        },
      });
    });
  };

  // Generate PDF
  const generatePdfBlob = async (): Promise<Blob | null> => {
    return await renderStandardPrescription(async (stageEl) => {
      const dataUrl = await toPng(stageEl, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: {
          opacity: "1",
          visibility: "visible",
        },
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: clinic.paperSize === "A6" ? "a6" : clinic.paperSize === "A5" ? "a5" : clinic.paperSize === "B5" ? "b5" : "a4",
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, Math.min(pdfHeight, pdf.internal.pageSize.getHeight() - 5));
      return pdf.output("blob");
    });
  };

  // Direct Send: Image (HD) - Mobile Native Attach / Desktop Clipboard
  const handleShareImage = async () => {
    if (!cleanPhone) {
      setErrorMessage("يرجى كتابة رقم هاتف المريض بشكل صحيح.");
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setGenerationType("image");
    setCopiedToClipboard(false);

    try {
      if (onSaveBeforeShare) {
        onSaveBeforeShare();
      }

      const blob = await generateImageBlob();
      if (!blob) throw new Error("تعذر استخراج صورة الروشتة.");

      const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 1. On Mobile devices: Use mobile native share which directly attaches the image into WhatsApp!
      if (isMobile) {
        const fileName = `Prescription_${prescriptionNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `روشتة طبية - ${patient.name || "مريض"}`,
            });
            setSuccessInfo({
              type: "image",
              message: `تم فتح الواتساب وإرفاق صورة الروشتة مباشرة لإرسالها للمريض (${cleanPhone})!`,
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === "AbortError") {
              setIsGenerating(false);
              return;
            }
          }
        }
      }

      // 2. On Desktop (PC/Windows): Copy image directly to clipboard to avoid Windows 11 share window
      let copied = false;
      if (typeof window !== "undefined" && navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ "image/png": blob }),
          ]);
          copied = true;
          setCopiedToClipboard(true);
        } catch (clipErr) {
          console.log("Clipboard write image error:", clipErr);
        }
      }

      // Open WhatsApp directly to patient's chat on Desktop
      const directUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
      window.open(directUrl, "_blank");

      setSuccessInfo({
        type: "image",
        message: copied
          ? `تم فتح محادثة المريض (${cleanPhone}) في الواتساب ونسخ صورة الروشتة تلقائياً! اضغط (Ctrl + V) أو 'لصق' في المحادثة لإرسال الصورة فوراً.`
          : `تم فتح محادثة المريض (${cleanPhone}) مباشرة في الواتساب.`,
      });
    } catch (err: any) {
      console.error("WhatsApp share image error:", err);
      setErrorMessage(err?.message || "حدث خطأ أثناء تجهيز صورة الروشتة.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Direct Send: PDF Document - Mobile Native Attach / Desktop Direct
  const handleSharePdf = async () => {
    if (!cleanPhone) {
      setErrorMessage("يرجى كتابة رقم هاتف المريض بشكل صحيح.");
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);
    setGenerationType("pdf");

    try {
      if (onSaveBeforeShare) {
        onSaveBeforeShare();
      }

      const blob = await generatePdfBlob();
      if (!blob) throw new Error("تعذر استخراج ملف الروشتة.");

      const isMobile = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // 1. On Mobile devices: Directly attaches PDF into WhatsApp!
      if (isMobile) {
        const fileName = `Prescription_${prescriptionNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        const file = new File([blob], fileName, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `روشتة طبية - ${patient.name || "مريض"}`,
            });
            setSuccessInfo({
              type: "pdf",
              message: `تم فتح الواتساب وإرفاق ملف الروشتة PDF مباشرة لإرسالها للمريض (${cleanPhone})!`,
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === "AbortError") {
              setIsGenerating(false);
              return;
            }
          }
        }
      }

      // 2. On Desktop: Open WhatsApp directly to patient's conversation
      const directUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}`;
      window.open(directUrl, "_blank");

      const fileName = `Prescription_${prescriptionNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const fileUrl = URL.createObjectURL(blob);

      setSuccessInfo({
        type: "pdf",
        fileName,
        fileUrl,
        message: `تم فتح محادثة المريض (${cleanPhone}) مباشرة على الواتساب.`,
      });
    } catch (err: any) {
      console.error("WhatsApp share pdf error:", err);
      setErrorMessage(err?.message || "حدث خطأ أثناء تجهيز ملف الروشتة.");
    } finally {
      setIsGenerating(false);
    }
  };

  const openDirectWhatsAppChat = () => {
    if (!cleanPhone) return;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right relative overflow-hidden"
        dir="rtl"
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100">
                إرسال الروشتة عبر الواتساب مباشرة 💬
              </h3>
              <p className="text-xs text-slate-400">
                أرسل صورة أو ملف PDF عالي الجودة للروشتة مباشرة إلى هاتف المريض
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Patient & Phone Info */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400">اسم المريض:</span>
            <span className="font-black text-slate-100 text-sm">{patient.name || "غير محدد"}</span>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 block">رقم هاتف المريض (واتساب):</label>
            <div className="flex items-stretch rounded-xl overflow-hidden border border-slate-700 focus-within:border-emerald-500 bg-slate-900 transition-colors" dir="ltr">
              <span className="flex items-center justify-center px-3.5 bg-slate-800/90 border-r border-slate-700 text-emerald-400 font-mono font-bold text-xs select-none shadow-inner">
                +2
              </span>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01012345678"
                className="w-full px-3.5 py-2.5 bg-transparent text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none text-left"
              />
            </div>
            <p className="text-[10px] text-slate-400 font-medium">مفتاح الدولة (+2) ثابت تلقائياً ومدرج عند الإرسال</p>
          </div>
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Options: Direct Text vs HD Image vs PDF */}
        {!successInfo ? (
          <div className="space-y-3.5">
            <p className="text-xs font-bold text-slate-300">اختر طريقة الإرسال المباشر للواتساب:</p>

            {/* Fast Option 1: Direct Text Message */}
            <button
              type="button"
              onClick={handleSendTextDirect}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/50 hover:border-emerald-400 text-right flex items-center justify-between gap-3 transition-all group cursor-pointer active:scale-95 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-100 text-xs sm:text-sm group-hover:text-emerald-300 transition-colors">
                      إرسال نص الروشتة مباشرة إلى واتساب المريض
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                      فوري بنقرة واحدة ⚡
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    يفتح محادثة رقم المريض مباشرة محملة ببيانات الروشتة، التشخيص، وقائمة الأدوية والجرعات كاملة.
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 2: HD Image */}
              <button
                type="button"
                onClick={handleShareImage}
                disabled={isGenerating}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-950/20 text-right space-y-2 transition-all group cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                    صورة HD + نسخ 📋
                  </span>
                </div>
                <div>
                  <h4 className="font-black text-slate-100 text-xs group-hover:text-emerald-300 transition-colors">
                    صورة الروشتة (HD)
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    نسخ تلقائي للصورة بالحافظة وفتح محادثة المريض مباشرة للصقها فوراً.
                  </p>
                </div>
              </button>

              {/* Option 3: PDF */}
              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isGenerating}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-400 hover:bg-cyan-950/20 text-right space-y-2 transition-all group cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-black">
                    ملف PDF معتمد 📄
                  </span>
                </div>
                <div>
                  <h4 className="font-black text-slate-100 text-xs group-hover:text-cyan-300 transition-colors">
                    ملف الروشتة (PDF)
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    توليد ملف PDF عالي الجودة بحجم الورق المعتمد وفتح محادثة المريض.
                  </p>
                </div>
              </button>
            </div>

            {isGenerating && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 flex items-center justify-center gap-3 text-xs font-bold text-emerald-300">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>
                  جاري تجهيز {generationType === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"} وفتح محادثة المريض...
                </span>
              </div>
            )}
          </div>
        ) : (
          /* Success & Direct Actions */
          <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-3.5 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {successInfo.type === "text"
                  ? "تم تجهيز محادثة واتساب المريض بنجاح!"
                  : `تم تجهيز ${successInfo.type === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"} بنجاح!`}
              </span>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              {successInfo.message}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={openDirectWhatsAppChat}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إعادة فتح محادثة واتساب المريض 💬</span>
              </button>

              {successInfo.fileUrl && successInfo.fileName && (
                <a
                  href={successInfo.fileUrl}
                  download={successInfo.fileName}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>تحميل الملف</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>إرسال مباشر إلى هاتف المريض دون وسائط أو اختيار تطبيقات</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
