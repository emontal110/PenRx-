import { apiError, apiJson, cleanSubscriberId, preflight, readJsonBody } from "@/lib/apiHttp";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { readDeviceToken } from "@/lib/deviceAuth";
import { supabaseRest } from "@/lib/supabaseRest";
import { registerCustomDrug } from "@/lib/drugSearchEngine";
import { getSubscriptionBySubscriberId, machineOwnsSubscription } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

const MAX_CONTRIBUTIONS_PER_WINDOW = 5;

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
 * Adds a doctor-contributed drug to the shared catalogue.
 * Contribution requires an ACTIVE subscription proven by a server-minted device
 * token; the subscriber id is taken from the token, never from the request body.
 */
export async function POST(request: Request) {
  // The packaged desktop runtime holds no cloud credentials, so contributions are
  // forwarded to the cloud API where the catalogue is shared.
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
    return rateLimitExceededResponse(request, 300);
  }

  const token = readDeviceToken(request);
  if (!token) {
    return apiError(request, "إضافة أدوية لبنك الأدوية العام تتطلب جلسة طبيب مفعّلة.", 401);
  }

  const subscriberId = cleanSubscriberId(token.subscriberId);
  if (!subscriberId) return apiError(request, "معرّف مشترك غير صالح.", 400);

  const sub = await getSubscriptionBySubscriberId(subscriberId).catch(() => null);
  if (!sub) return apiError(request, "حساب المشترك غير مسجل.", 403);
  if (sub.status !== "ACTIVE") {
    return apiError(request, "الاشتراك موقوف أو منتهي. يرجى التجديد قبل الإضافة لبنك الأدوية.", 403);
  }
  if (!machineOwnsSubscription(sub, token.machineId)) {
    return apiError(request, "هذا الجهاز غير مرتبط بحساب المشترك المطلوب.", 403);
  }

  const body = await readJsonBody<Record<string, unknown>>(request, 32 * 1024);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const cleanName = sanitizeString(body.data.name, 100);
  if (cleanName.length < 2) {
    return apiError(request, "اسم الدواء مطلوب ويجب ألا يقل عن حرفين.", 400);
  }

  const cleanNameAr = sanitizeString(body.data.nameAr || cleanName, 100);
  const cleanActiveIng = sanitizeString(body.data.activeIngredient || "تركيبة طبية خاصة", 150);
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

  try {
    await supabaseRest("Drug", {
      method: "POST",
      body: {
        id: memoryRecord.id,
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
        createdAt: new Date().toISOString(),
      },
      prefer: "return=minimal",
    });
  } catch (err: any) {
    console.warn("[DrugContribution] catalogue insert failed:", err?.message || err);
    return apiError(request, "تعذر حفظ الدواء في بنك الأدوية العام حالياً.", 502);
  }

  return apiJson(request, {
    success: true,
    message: "تم حفظ الدواء في بنك الأدوية العام ومشاركته مع جميع الأطباء بنجاح",
    drug: memoryRecord,
    dbSaved: true,
  });
}
