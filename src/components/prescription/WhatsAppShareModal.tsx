"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Sparkles,
  Send,
  Phone,
  User,
} from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PatientInfo, PrescriptionItem } from "@/store/usePrescriptionStore";
import { ClinicSettings } from "@/store/useClinicStore";
import { LivePrescriptionPreview } from "./LivePrescriptionPreview";

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
  let cleaned = (phone || "").replace(/[^0-9]/g, "");
  if (!cleaned) return "";

  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.startsWith("20") && cleaned.length >= 11) {
    return cleaned;
  }

  if (cleaned.startsWith("0")) {
    return `2${cleaned}`;
  }

  if (cleaned.startsWith("1") && cleaned.length === 10) {
    return `20${cleaned}`;
  }

  return `2${cleaned}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bstr = atob(parts[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
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
  const [generationType, setGenerationType] = useState<"image" | "pdf" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: "image" | "pdf";
    fileName: string;
    fileUrl: string;
    message: string;
  } | null>(null);

  const dedicatedSheetRef = useRef<HTMLDivElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  // Reset modal state every time it opens or closed so share options NEVER disappear on reopen!
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(false);
      setGenerationType(null);
      setErrorMessage(null);
      setStatusBanner(null);
      setPhoneNumber(patient.phone || "");
    }
  }, [isOpen, patient.phone, prescriptionNo]);

  // Cleanup any created object URL when unmounting or changing statusBanner
  useEffect(() => {
    return () => {
      if (statusBanner?.fileUrl) {
        try {
          URL.revokeObjectURL(statusBanner.fileUrl);
        } catch {}
      }
    };
  }, [statusBanner]);

  if (!isOpen) return null;

  const cleanPhone = normalizeWhatsAppNumber(phoneNumber || patient.phone || "");

  const paperSize = clinic.paperSize || "A5";
  const standardWidth =
    paperSize === "A6"
      ? 460
      : paperSize === "A4"
      ? 720
      : paperSize === "B5"
      ? 600
      : 560;

  /**
   * Captures the prescription sheet into a high-resolution PNG Data URL.
   * Uses the dedicated off-screen sheet (which is always rendered at standard desktop/print width
   * even on mobile phones where the main column is hidden) and avoids CORS/Base64 cacheBust bugs.
   */
  const capturePrescriptionPngDataUrl = async (): Promise<string> => {
    // Allow a brief paint frame so all images/fonts inside the dedicated staging sheet are ready
    await new Promise((resolve) => setTimeout(resolve, 60));

    let sourceEl: HTMLElement | null = null;
    if (dedicatedSheetRef.current) {
      sourceEl = (dedicatedSheetRef.current.querySelector("#prescription-print-sheet") as HTMLElement) || dedicatedSheetRef.current;
    }
    if (!sourceEl && printAreaRef?.current) {
      sourceEl = (printAreaRef.current.querySelector("#prescription-print-sheet") as HTMLElement) || printAreaRef.current;
    }
    if (!sourceEl) {
      sourceEl = document.getElementById("prescription-print-sheet");
    }
    if (!sourceEl) {
      throw new Error("تعذر العثور على نموذج الروشتة لتوليد الملف.");
    }

    const filterNode = (node: HTMLElement) => {
      if (node && node.classList && node.classList.contains("no-print")) {
        return false;
      }
      return true;
    };

    try {
      // First pass: fast capture with skipFonts: true (uses browser's already-loaded Cairo font without CORS errors)
      const dataUrl = await toPng(sourceEl, {
        pixelRatio: 2.2,
        backgroundColor: "#ffffff",
        cacheBust: false,
        skipFonts: true,
        filter: filterNode as any,
        style: {
          opacity: "1",
          visibility: "visible",
          transform: "none",
          margin: "0",
        },
      });
      if (dataUrl && dataUrl.length > 1000) {
        return dataUrl;
      }
    } catch (firstErr) {
      console.warn("[WhatsAppShare] First pass capture notice, retrying:", firstErr);
    }

    // Fallback pass
    const fallbackUrl = await toPng(sourceEl, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: false,
      skipFonts: true,
    });
    if (!fallbackUrl || fallbackUrl.length < 500) {
      throw new Error("تعذر استخراج صورة الروشتة بجودة صالحة.");
    }
    return fallbackUrl;
  };

  /**
   * Generates a crisp, proportionally scaled PDF from the captured PNG Data URL
   */
  const buildPdfFromPngDataUrl = async (
    pngDataUrl: string
  ): Promise<{ pdfBlob: Blob; pdfDataUrl: string }> => {
    const formatMap: Record<string, "a4" | "a5" | "a6" | "b5"> = {
      A4: "a4",
      A5: "a5",
      A6: "a6",
      B5: "b5",
    };
    const format = formatMap[paperSize] || "a5";

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Load image dimensions reliably via browser Image object
    const imgDims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth || img.width || 560, height: img.naturalHeight || img.height || 790 });
      img.onerror = () => reject(new Error("تعذر قراءة أبعاد صورة الروشتة عند بناء ملف الـ PDF"));
      img.src = pngDataUrl;
    });

    const marginMm = 4;
    const availW = pageWidth - marginMm * 2;
    const availH = pageHeight - marginMm * 2;

    const scale = Math.min(availW / imgDims.width, availH / imgDims.height);
    const renderW = imgDims.width * scale;
    const renderH = imgDims.height * scale;
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = marginMm;

    pdf.addImage(pngDataUrl, "PNG", offsetX, offsetY, renderW, renderH, undefined, "FAST");

    const pdfBlob = pdf.output("blob");
    const pdfDataUrl = pdf.output("datauristring");
    return { pdfBlob, pdfDataUrl };
  };

  /**
   * Unified Instant Dispatch Engine:
   * Immediately generates the chosen format (Image or PDF) and sends it directly
   * to the patient's WhatsApp conversation across Android APK, Windows EXE, and Web.
   */
  const handleInstantWhatsAppSend = async (mode: "image" | "pdf") => {
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage("يرجى إدخال رقم واتساب المريض بشكل صحيح أولاً لإرسال الروشتة مباشرة.");
      phoneInputRef.current?.focus();
      return;
    }

    if (isGenerating) return;

    setErrorMessage(null);
    setStatusBanner(null);
    setIsGenerating(true);
    setGenerationType(mode);

    try {
      if (onSaveBeforeShare) {
        onSaveBeforeShare();
      }

      const safeRxNo = (prescriptionNo || "RX").replace(/[^a-zA-Z0-9_-]/g, "_");
      const patientLabel = (patient.name || "المريض").trim();
      const doctorLabel = clinic.doctorName ? `د. ${clinic.doctorName}` : clinic.nameAr || "العيادة الطبية";
      const caption = `📋 الروشتة الطبية الخاصة بـ: ${patientLabel} — ${doctorLabel} (${prescriptionNo})`;

      const pngDataUrl = await capturePrescriptionPngDataUrl();

      let targetBlob: Blob;
      let targetDataUrl: string;
      let targetFileName: string;
      let targetMimeType: string;

      if (mode === "image") {
        targetBlob = dataUrlToBlob(pngDataUrl);
        targetDataUrl = pngDataUrl;
        targetFileName = `Prescription_${safeRxNo}.png`;
        targetMimeType = "image/png";
      } else {
        const { pdfBlob, pdfDataUrl } = await buildPdfFromPngDataUrl(pngDataUrl);
        targetBlob = pdfBlob;
        targetDataUrl = pdfDataUrl;
        targetFileName = `Prescription_${safeRxNo}.pdf`;
        targetMimeType = "application/pdf";
      }

      const fileUrl = URL.createObjectURL(targetBlob);
      const w = typeof window !== "undefined" ? (window as any) : null;

      // ── 1. NATIVE ANDROID APK: Direct WhatsApp Patient JID Attachment (Zero Chooser, Direct to Patient Chat!) ──
      if (w?.PenRxNative && typeof w.PenRxNative.shareFileToWhatsAppDirect === "function") {
        const res = w.PenRxNative.shareFileToWhatsAppDirect(
          targetDataUrl,
          targetFileName,
          targetMimeType,
          cleanPhone,
          caption
        );
        if (res === "OK") {
          setStatusBanner({
            type: mode,
            fileName: targetFileName,
            fileUrl,
            message: `تم فتح محادثة المريض (${cleanPhone}) على واتساب وإرفاق ${
              mode === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"
            } تلقائياً وجاهز للإرسال الفوري!`,
          });
          setIsGenerating(false);
          setGenerationType(null);
          return;
        }
      }

      // ── 2. NATIVE WINDOWS DESKTOP EXE (Electron): Native WhatsApp App + Auto-Paste + Auto-Send ──
      if (w?.penrxDesktop && typeof w.penrxDesktop.shareWhatsAppDesktop === "function") {
        const res = await w.penrxDesktop.shareWhatsAppDesktop({
          base64Data: targetDataUrl,
          fileName: targetFileName,
          mimeType: targetMimeType,
          cleanPhone,
          caption,
        });
        if (res && res.success) {
          setStatusBanner({
            type: mode,
            fileName: targetFileName,
            fileUrl,
            message: `✅ تم فتح تطبيق واتساب على محادثة المريض (${cleanPhone}) مباشرةً، وتم الإرفاق التلقائي وإرسال ${
              mode === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"
            } بضغطة واحدة!`,
          });
          setIsGenerating(false);
          setGenerationType(null);
          return;
        }
      }

      // ── 3. MOBILE WEB / iOS / CAPACITOR FALLBACK ──
      const isMobile =
        typeof navigator !== "undefined" &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile && typeof navigator !== "undefined" && navigator.canShare) {
        const file = new File([targetBlob], targetFileName, { type: targetMimeType });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: caption,
              text: caption,
            });
            setStatusBanner({
              type: mode,
              fileName: targetFileName,
              fileUrl,
              message: `تم إرفاق ${mode === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"} عبر واتساب بنجاح!`,
            });
            setIsGenerating(false);
            setGenerationType(null);
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === "AbortError") {
              setIsGenerating(false);
              setGenerationType(null);
              return;
            }
          }
        }
      }

      // ── 4. BROWSER FALLBACK: Copy to Clipboard + Open Native WhatsApp App ──
      // Uses whatsapp:// URI first (opens WhatsApp Desktop/Mobile app), falls back to api.whatsapp.com
      let copiedImage = false;
      if (mode === "image" && typeof navigator !== "undefined" && navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ "image/png": targetBlob }),
          ]);
          copiedImage = true;
        } catch {}
      }

      if (mode === "pdf" || !copiedImage) {
        // Trigger automatic download so the doctor has the exact file immediately
        const a = document.createElement("a");
        a.href = fileUrl;
        a.download = targetFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Try native app protocol first, fall back to web
      const nativeWaUrl = `whatsapp://send?phone=${encodeURIComponent(cleanPhone)}&text=`;
      const webWaUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}`;
      try {
        window.open(nativeWaUrl, "_blank");
      } catch {
        window.open(webWaUrl, "_blank");
      }

      setStatusBanner({
        type: mode,
        fileName: targetFileName,
        fileUrl,
        message: copiedImage
          ? `تم نسخ صورة الروشتة تلقائياً وفتح تطبيق واتساب على محادثة المريض (${cleanPhone})! اضغط (Ctrl + V) داخل المحادثة لإرسالها فوراً.`
          : `تم تجهيز وتنزيل ${
              mode === "pdf" ? "ملف الروشتة (PDF)" : "صورة الروشتة"
            } وفتح تطبيق واتساب على محادثة المريض (${cleanPhone}) مباشرة!`,
      });
    } catch (err: any) {
      console.error("[WhatsAppShareModal] Error:", err);
      setErrorMessage(err?.message || "حدث خطأ أثناء تجهيز وإرسال ملف الروشتة.");
    } finally {
      setIsGenerating(false);
      setGenerationType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      {/* Off-screen Dedicated Export Sheet: Always rendered at standard print width with readOnly=true
          so Image & PDF generation works 100% reliably on Mobile APK, Tablet, and Desktop! */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: "-10000px",
          width: `${standardWidth}px`,
          margin: 0,
          padding: 0,
          backgroundColor: "transparent",
          opacity: 1,
          pointerEvents: "none",
          zIndex: -1,
        }}
        dir="rtl"
      >
        <div
          ref={dedicatedSheetRef}
          style={{
            width: `${standardWidth}px`,
            margin: 0,
            padding: 0,
            backgroundColor: "transparent",
          }}
        >
          <LivePrescriptionPreview
            prescriptionNo={prescriptionNo}
            patient={patient}
            diagnosis={diagnosis}
            notes={notes}
            items={items}
            onRemoveItem={() => {}}
            onSaveAndPrint={() => {}}
            onShareWhatsApp={() => {}}
            readOnly={true}
          />
        </div>
      </div>

      {/* Modal Dialog Card: Standardized responsive dimensions for Phone APK and Desktop EXE */}
      <div
        className="w-full max-w-[460px] sm:max-w-[520px] max-h-[92vh] flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3.5 sm:space-y-4 text-right relative overflow-y-auto overscroll-contain animate-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Top Glowing Accent Bar */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/90 pb-3.5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner shrink-0">
              <MessageCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-1.5">
                <span>إرسال الروشتة عبر واتساب</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                اختر الصيغة لإرفاق الروشتة وإرسالها لمحادثة المريض فوراً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient & WhatsApp Phone Bar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-3 text-xs relative z-10">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>اسم المريض:</span>
            </span>
            <span className="font-black text-slate-100 text-xs sm:text-sm truncate max-w-[200px]">
              {patient.name || "غير محدد"}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>رقم واتساب المريض:</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                إرسال مباشر للمحادثة
              </span>
            </label>
            <div
              className="flex items-stretch rounded-xl overflow-hidden border border-slate-700/90 focus-within:border-emerald-500 bg-slate-900 transition-colors"
              dir="ltr"
            >
              <span className="flex items-center justify-center px-3 bg-slate-800/90 border-r border-slate-700 text-emerald-400 font-mono font-black text-xs select-none">
                +2
              </span>
              <input
                ref={phoneInputRef}
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="01012345678"
                className="w-full px-3 py-2.5 bg-transparent text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none text-left"
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 relative z-10 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Two Clean, Modern Instant-Send Cards: HD Image & Official PDF */}
        <div className="space-y-2.5 relative z-10">
          <p className="text-xs font-extrabold text-slate-300">
            اضغط على الصيغة المطلوبة للإرفاق والإرسال التلقائي:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: HD Image */}
            <button
              type="button"
              onClick={() => handleInstantWhatsAppSend("image")}
              disabled={isGenerating}
              className="relative p-4 rounded-2xl bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 hover:from-emerald-950/60 text-right flex flex-col justify-between gap-3 transition-all group cursor-pointer active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-emerald-950/30"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center transition-all shadow-sm">
                  {isGenerating && generationType === "image" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5 stroke-[2.2]" />
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1">
                  <Send className="w-2.5 h-2.5" />
                  <span>إرسال فوري</span>
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-100 text-sm group-hover:text-emerald-300 transition-colors">
                  صورة الروشتة (HD)
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  توليد صورة عالية الوضوح وإرفاقها مباشرة داخل محادثة المريض على واتساب.
                </p>
              </div>
            </button>

            {/* Option 2: PDF File */}
            <button
              type="button"
              onClick={() => handleInstantWhatsAppSend("pdf")}
              disabled={isGenerating}
              className="relative p-4 rounded-2xl bg-gradient-to-b from-cyan-950/40 via-slate-950 to-slate-950 border-2 border-cyan-500/40 hover:border-cyan-400 hover:from-cyan-950/60 text-right flex flex-col justify-between gap-3 transition-all group cursor-pointer active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-cyan-950/30"
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 flex items-center justify-center transition-all shadow-sm">
                  {isGenerating && generationType === "pdf" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-black flex items-center gap-1">
                  <Send className="w-2.5 h-2.5" />
                  <span>إرسال فوري</span>
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-100 text-sm group-hover:text-cyan-300 transition-colors">
                  ملف الروشتة (PDF)
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  توليد مستند PDF رسمي بمقاس {paperSize} وإرفاقه مباشرة في واتساب المريض.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Live Progress Indicator */}
        {isGenerating && (
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 flex items-center justify-center gap-2.5 text-xs font-bold text-emerald-300 relative z-10 animate-in fade-in">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
            <span>
              جارٍ تجهيز وإرفاق {generationType === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"} وفتح محادثة المريض تلقائياً...
            </span>
          </div>
        )}

        {/* Non-destructive Status Confirmation Banner (Never hides the 2 buttons above!) */}
        {statusBanner && !isGenerating && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5 text-xs relative z-10 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-black">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  تم تجهيز وإرسال {statusBanner.type === "pdf" ? "ملف الـ PDF" : "صورة الروشتة"} بنجاح!
                </span>
              </div>
              <a
                href={statusBanner.fileUrl}
                download={statusBanner.fileName}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors shrink-0"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>حفظ نسخة</span>
              </a>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{statusBanner.message}</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 relative z-10">
          <span>يتم حفظ الروشتة تلقائياً في سجل العيادة عند الإرسال</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
