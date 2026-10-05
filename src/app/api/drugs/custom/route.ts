import { NextResponse } from "next/server";
import { registerCustomDrug } from "@/lib/drugSearchEngine";
import { prisma } from "@/lib/prisma";
import { getSubscriptionBySubscriberId, getSubscriptionByMachine } from "@/lib/subscriptionManager";

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

    // 2. Security Check: Only active subscribers or verified devices can contribute to community catalog
    let isAuthorizedContributor = false;
    if (subscriberId) {
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

    // 4. Persist to database for community sync
    let dbRecord = null;
    try {
      dbRecord = await prisma.drug.create({
        data: {
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
        },
      });
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
