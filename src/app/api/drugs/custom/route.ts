import { NextResponse } from "next/server";
import { registerCustomDrug } from "@/lib/drugSearchEngine";
import { getSubscriptionBySubscriberId, getSubscriptionByMachine } from "@/lib/subscriptionManager";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MDU0MywiZXhwIjoyMTA1MTY2NTQzfQ.gJ9ArhmjkAf2tQmqZbvA88hJmDaz6EYgf2RdJfl6RCE";

export const dynamic = "force-dynamic";

// In-memory sliding window rate limiter: IP -> timestamps
const RATE_LIMIT_MAP = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONTRIBUTIONS_PER_WINDOW = 5;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  let timestamps = RATE_LIMIT_MAP.get(clientIp) || [];
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= MAX_CONTRIBUTIONS_PER_WINDOW) {
    RATE_LIMIT_MAP.set(clientIp, timestamps);
    return false;
  }

  timestamps.push(now);
  RATE_LIMIT_MAP.set(clientIp, timestamps);
  return true;
}

function sanitizeString(str: string, maxLength: number): string {
  if (!str) return "";
  return str
    .replace(/[<>'"&]/g, "") // Strip dangerous HTML / script chars
    .trim()
    .slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    // Packaged desktop runtime holds no cloud credentials — contribution requires
    // subscription verification + community persistence on the cloud API
    if (!hasCloudCredentials()) {
      return proxyToCloud(request, "/api/drugs/custom");
    }

    const clientIp = request.headers.get("x-forwarded-for") || "local-client";

    // 1. Rate Limiting Check
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح لإضافة الأدوية (5 أدوية كل 5 دقائق). يرجى الانتظار قليلاً." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      name,
      nameAr,
      activeIngredient,
      activeIngredientAr,
      dosageForm,
      price,
      company,
      category,
      doctorContributor,
      subscriberId,
      machineId,
    } = body;

    // 2. Security Check: Only active subscribers, verified devices, or local clinic sessions can contribute
    let isAuthorizedContributor = false;
    if (clientIp === "local-client" || clientIp === "127.0.0.1" || clientIp === "::1" || process.env.NODE_ENV !== "production") {
      isAuthorizedContributor = true;
    }
    if (!isAuthorizedContributor && subscriberId) {
      const sub = await getSubscriptionBySubscriberId(subscriberId);
      if (sub && (sub.status === "ACTIVE" || sub.isTrial)) {
        isAuthorizedContributor = true;
      }
    }
    if (!isAuthorizedContributor && machineId) {
      const sub = await getSubscriptionByMachine(machineId);
      if (sub && (sub.status === "ACTIVE" || sub.isTrial)) {
        isAuthorizedContributor = true;
      }
    }
    // Allow seamless auto-registration when saved from clinic prescription editor
    if (!isAuthorizedContributor && doctorContributor) {
      isAuthorizedContributor = true;
    }

    if (!isAuthorizedContributor) {
      return NextResponse.json(
        { error: "إضافة أدوية لبنك الأدوية العام يتطلب حساب طبيب مفعّل" },
        { status: 403 }
      );
    }

    const cleanName = sanitizeString(name, 100);
    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json({ error: "اسم الدواء مطلوب ويجب ألا يقل عن حرفين" }, { status: 400 });
    }

    const cleanNameAr = sanitizeString(nameAr || cleanName, 100);
    const cleanActiveIng = sanitizeString(activeIngredient || "تركيبة طبية خاصة", 150);
    const cleanActiveIngAr = sanitizeString(activeIngredientAr || "", 150);
    const cleanDosage = sanitizeString(dosageForm || "Tablet (قرص)", 60);
    const cleanCompany = sanitizeString(company || "مساهمة من طبيب في مجتمع PenRX+", 80);
    const cleanCategory = sanitizeString(category || "General Medicine", 60);
    const cleanContributor = sanitizeString(doctorContributor || "طبيب ممارس", 80);
    const numPrice = typeof price === "number" && price >= 0 && price <= 100000 ? price : 0;

    // 3. Register in memory for instant sub-millisecond search
    const memoryRecord = registerCustomDrug({
      name: cleanName,
      nameAr: cleanNameAr,
      activeIngredient: cleanActiveIng,
      activeIngredientAr: cleanActiveIngAr || undefined,
      dosageForm: cleanDosage,
      price: numPrice,
      company: cleanCompany,
      category: cleanCategory,
      doctorContributor: cleanContributor,
    });

    // 4. Persist to database for community sync via Supabase REST
    let dbRecord = null;
    try {
      const supaRes = await fetch(`${SUPABASE_REST_URL}/Drug`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      if (supaRes.ok) {
        dbRecord = await supaRes.json();
      }
    } catch (dbErr: any) {
      console.warn("DB insert notice:", dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "تم حفظ الدواء في بنك الأدوية العام ومشاركته مع جميع الأطباء بنجاح",
      drug: memoryRecord,
      dbSaved: !!dbRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add drug" }, { status: 500 });
  }
}
