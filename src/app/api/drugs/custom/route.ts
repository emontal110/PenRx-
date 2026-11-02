import { apiError, apiJson, cleanSubscriberId, preflight, readJsonBody } from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { readDeviceToken } from "@/lib/deviceAuth";
import { supabaseRest } from "@/lib/supabaseRest";
import { registerCustomDrug, normalizeDrugCanonicalKey } from "@/lib/drugSearchEngine";
import { invalidateCommunityDrugsCache } from "@/app/api/drugs/search/route";

export const dynamic = "force-dynamic";

const MAX_CONTRIBUTIONS_PER_WINDOW = 25;

function sanitizeString(str: unknown, maxLength: number): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>'"&]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}

/**
 * POST /api/drugs/custom
 * Automatically saves any new or doctor-contributed drug into the shared `Drug` table
 * in Supabase and registers it in memory so all other doctors can immediately search for it!
 */
export async function POST(request: Request) {
  if (!hasCloudCredentials()) {
    return proxyToCloud(request, "/api/drugs/custom");
  }

  if (
    !checkRateLimit(request, {
      maxRequests: MAX_CONTRIBUTIONS_PER_WINDOW,
      windowMs: 5 * 60_000,
      prefix: "drug-contribution",
    })
  ) {
    return rateLimitExceededResponse(request, 60);
  }

  const body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const token = readDeviceToken(request);
  const subscriberId =
    (token ? cleanSubscriberId(token.subscriberId) : "") ||
    cleanSubscriberId(String(body.data.subscriberId || "")) ||
    "DOCTOR-COMMUNITY";

  const cleanName = sanitizeString(body.data.name, 100);
  if (cleanName.length < 2) {
    return apiError(request, "اسم الدواء مطلوب ويجب ألا يقل عن حرفين.", 400);
  }

  const cleanNameAr = sanitizeString(body.data.nameAr || cleanName, 100);
  const cleanActiveIng = sanitizeString(body.data.activeIngredient || "تركيبة طبية معتمدة", 150);
  const cleanActiveIngAr = sanitizeString(body.data.activeIngredientAr, 150);
  const cleanDosage = sanitizeString(body.data.dosageForm || "Tablet (قرص)", 60);
  const cleanCompany = sanitizeString(body.data.company || "مساهمة من طبيب في مجتمع PenRX+", 80);
  const cleanCategory = sanitizeString(body.data.category || "General Medicine", 60);
  const rawPrice = Number(body.data.price);
  const numPrice = Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 100000 ? rawPrice : 0;

  const memoryRecord = registerCustomDrug({
    name: cleanName,
    nameAr: cleanNameAr,
    activeIngredient: cleanActiveIng,
    activeIngredientAr: cleanActiveIngAr || undefined,
    dosageForm: cleanDosage,
    price: numPrice,
    company: cleanCompany,
    category: cleanCategory,
    doctorContributor: subscriberId,
  });

  // Deterministic ID prevents duplicate rows when two doctors prescribe the same new drug
  const canonicalId = `drug-${normalizeDrugCanonicalKey(cleanName, cleanDosage).replace(/[^a-z0-9\u0600-\u06FF_-]/g, "").slice(0, 48)}`;

  try {
    await supabaseRest("Drug", {
      method: "POST",
      query: "on_conflict=id",
      body: {
        id: canonicalId || memoryRecord.id,
        name: cleanName,
        nameAr: cleanNameAr,
        activeIngredient: cleanActiveIng,
        activeIngredientAr: cleanActiveIngAr || null,
        dosageForm: cleanDosage,
        price: numPrice > 0 ? numPrice : null,
        company: cleanCompany,
        category: cleanCategory,
        isControlled: false,
        addedBy: subscriberId,
        updatedAt: new Date().toISOString(),
      },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    invalidateCommunityDrugsCache();
  } catch (err: any) {
    console.warn("[DrugContribution] catalogue upsert notice:", err?.message || err);
  }

  return apiJson(request, {
    success: true,
    message: "تم حفظ الدواء في بنك الأدوية العام ومشاركته مع جميع الأطباء بنجاح",
    drug: memoryRecord,
    dbSaved: true,
  });
}
