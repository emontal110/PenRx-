import { NextResponse } from "next/server";
import { analyzePrescriptionWithGemini } from "@/lib/gemini";
import { analyzePrescriptionInteractionsLocally } from "@/lib/clinicalInteractionChecker";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { corsHeaders, securityHeaders } from "@/lib/httpSecurity";

export const dynamic = "force-dynamic";

interface PrescriptionItemInput {
  id?: string;
  drugName: string;
  activeIngredient?: string;
  doseQuantity?: string;
  doseForm?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: { ...securityHeaders(), ...corsHeaders(request) } });
}

export async function POST(request: Request) {
  if (!checkRateLimit(request, { maxRequests: 120, windowMs: 60_000, prefix: "ai-analyze" })) {
    return rateLimitExceededResponse(request, 15);
  }
  try {
    const body = await request.json();
    const items: PrescriptionItemInput[] = body.items || [];
    const patientAllergies: string = (body.patientAllergies || "").trim();
    const patientHistory: string = (body.patientHistory || "").trim();

    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          success: true,
          interactions: [],
          safeMessage: "لم يتم إضافة أدوية كافية بعد لإجراء الفحص الدوائي.",
        },
        { headers: { ...securityHeaders(), ...corsHeaders(request) } }
      );
    }

    // 1. Instant deterministic bilingual pharmacology rules (Drug-Drug, Drug-Allergy, Drug-Disease)
    const detectedInteractions: any[] = analyzePrescriptionInteractionsLocally(
      items,
      patientAllergies,
      patientHistory
    );

    // 2. Deep Gemini Clinical Analysis (when API key is configured)
    if (items.length >= 2 || patientAllergies || patientHistory) {
      try {
        const geminiInteractions = await analyzePrescriptionWithGemini(
          items,
          patientAllergies,
          patientHistory
        );

        if (geminiInteractions && geminiInteractions.length > 0) {
          for (const gAlert of geminiInteractions) {
            const alreadyExists = detectedInteractions.some(
              (d) =>
                d.titleAr === gAlert.titleAr ||
                (d.titleEn && gAlert.titleEn && d.titleEn.toLowerCase() === gAlert.titleEn.toLowerCase())
            );
            if (!alreadyExists) {
              detectedInteractions.push({
                id: `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                severity: gAlert.severity || "HIGH",
                titleAr: gAlert.titleAr,
                titleEn: gAlert.titleEn,
                mechanismAr: gAlert.mechanismAr,
                recommendationAr: gAlert.recommendationAr,
                involvedDrugs: gAlert.involvedDrugs || items.map((i) => i.drugName),
                source: "Google Gemini Flash",
              });
            }
          }
        }
      } catch {
        // Local pharmacology engine guarantees 100% uptime
      }
    }

    return NextResponse.json(
      {
        success: true,
        hasInteractions: detectedInteractions.length > 0,
        totalInteractions: detectedInteractions.length,
        interactions: detectedInteractions,
        engine: "PenRX+ Clinical Pharmacology & AI Engine",
        analyzedItemsCount: items.length,
      },
      { headers: { ...securityHeaders(), ...corsHeaders(request) } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze prescription", interactions: [] },
      { status: 500, headers: { ...securityHeaders(), ...corsHeaders(request) } }
    );
  }
}
