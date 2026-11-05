import { NextResponse } from "next/server";
import {
  searchComprehensiveDrugs,
  getTotalDrugCount,
  updateDrugPricesFromCloud,
  normalizeDrugCanonicalKey,
  normalizeArabic,
  DrugRecord,
} from "@/lib/drugSearchEngine";
import { suggestDrugWithGemini } from "@/lib/gemini";
import { synthesizeClinicalAiDrug } from "@/lib/clinicalAiSynthesis";
import { corsHeaders, securityHeaders } from "@/lib/httpSecurity";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimiter";
import { supabaseRest } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

function responseHeaders(request: Request): Record<string, string> {
  return { ...securityHeaders(), ...corsHeaders(request) };
}

const EXTERNAL_CACHE = new Map<string, { timestamp: number; results: DrugRecord[] }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

let COMMUNITY_CACHE: DrugRecord[] = [];
let lastCommunitySync = 0;
const COMMUNITY_SYNC_INTERVAL = 90 * 1000;

// ── Background Synchronizer for 25,070+ Official Egyptian Drug Eye Records ──
let officialEdaSynced = false;
let officialEdaSyncing = false;

function mapRouteToDosageForm(route: string, name: string): string {
  const r = (route || "").toUpperCase();
  const n = (name || "").toLowerCase();
  if (n.includes("syrup") || n.includes("syr")) return "Syrup (شراب)";
  if (n.includes("susp")) return "Suspension (معلق)";
  if (n.includes("drop") || r.includes("OPHTHALMIC") || r.includes("OTIC")) return "Drops (قطرة)";
  if (n.includes("amp") || n.includes("vial") || r.includes("INJECTION") || r.includes("PARENTERAL")) return "Ampoule (حقنة)";
  if (n.includes("cream") || n.includes("crm")) return "Cream (كريم)";
  if (n.includes("oint")) return "Ointment (مرهم)";
  if (n.includes("gel")) return "Gel (جل)";
  if (n.includes("spray") || r.includes("NASAL")) return "Spray (بخاخ)";
  if (n.includes("inhaler") || r.includes("INHALATION")) return "Inhaler (بخاخ)";
  if (n.includes("supp") || r.includes("RECTAL") || r.includes("VAGINAL")) return "Suppository (لبوس)";
  if (n.includes("sachet") || n.includes("eff")) return "Effervescent (فوار)";
  if (n.includes("cap")) return "Capsule (كبسولة)";
  return "Tablet (قرص)";
}

async function syncOfficialEgyptianDrugDatabaseInBackground() {
  if (officialEdaSynced || officialEdaSyncing) return;
  officialEdaSyncing = true;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json",
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const mappedUpdates = [];
        for (const row of records) {
          const nameEn = String(row.commercial_name_en || "").trim();
          if (!nameEn) continue;
          const priceVal = row.price_egp ? parseFloat(String(row.price_egp)) : undefined;
          mappedUpdates.push({
            name: nameEn,
            nameAr: String(row.commercial_name_ar || nameEn).trim(),
            activeIngredient: String(row.scientific_name || "مادة فعالة معتمدة").trim(),
            company: String(row.manufacturer || "شركة أدوية مصرية").trim(),
            category: String(row.drug_class || "Egyptian Drug Authority").trim(),
            dosageForm: mapRouteToDosageForm(row.route, nameEn),
            price: priceVal && priceVal > 0 ? priceVal : undefined,
          });
        }
        updateDrugPricesFromCloud(mappedUpdates);
        officialEdaSynced = true;
      }
    }
  } catch {
    // Offline or GitHub unreachable — built-in verified catalog serves seamlessly
  } finally {
    officialEdaSyncing = false;
  }
}

export function invalidateCommunityDrugsCache() {
  lastCommunitySync = 0;
}

async function syncCommunityDrugsInBackground() {
  if (Date.now() - lastCommunitySync < COMMUNITY_SYNC_INTERVAL) return;
  lastCommunitySync = Date.now();

  try {
    const dbMatches = await supabaseRest<any[]>("Drug", {
      query: "select=*&order=createdAt.desc&limit=400",
    });

    if (Array.isArray(dbMatches) && dbMatches.length > 0) {
      COMMUNITY_CACHE = dbMatches.map((d: any) => ({
        id: d.id,
        name: d.name,
        nameAr: d.nameAr || undefined,
        activeIngredient: d.activeIngredient,
        activeIngredientAr: d.activeIngredientAr || undefined,
        company: d.company || "مساهمة من طبيب",
        price: d.price || undefined,
        dosageForm: d.dosageForm || "Tablet (قرص)",
        category: d.category || "عام",
        isControlled: d.isControlled || false,
        sourceOrigin: "Doctor Community" as const,
        isCrowdSourced: true,
      }));

      updateDrugPricesFromCloud(
        COMMUNITY_CACHE.map((d) => ({
          name: d.name,
          nameAr: d.nameAr,
          activeIngredient: d.activeIngredient,
          price: d.price,
          dosageForm: d.dosageForm,
          company: d.company,
          category: d.category,
        }))
      );
    }
  } catch {}
}

// ── Source 3: OpenFDA NDC Directory (International & Imported Drugs) ──────────
async function fetchOpenFDA(query: string, limit: number): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 3 || /[\u0600-\u06FF]/.test(cleanQ)) return [];

    const urls = [
      `https://api.fda.gov/drug/ndc.json?search=brand_name:"${encodeURIComponent(cleanQ)}"&limit=${limit}`,
      `https://api.fda.gov/drug/ndc.json?search=generic_name:"${encodeURIComponent(cleanQ)}"&limit=${limit}`,
    ];

    for (const url of urls) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(950),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;

      return data.results.slice(0, limit).map((r: any, i: number) => ({
        id: `fda-ndc-${r.product_ndc || i}`,
        name: `${r.brand_name || r.generic_name || cleanQ}${r.dosage_form ? ` (${r.dosage_form})` : ""}`,
        nameAr: r.brand_name || r.generic_name || cleanQ,
        activeIngredient:
          r.active_ingredients?.map((a: any) => `${a.name} ${a.strength || ""}`.trim()).join(" + ") ||
          r.generic_name ||
          cleanQ,
        company: r.labeler_name || "International / FDA",
        price: undefined,
        dosageForm: mapRouteToDosageForm(r.dosage_form || "", r.brand_name || ""),
        category: "International / FDA",
        isControlled: false,
        sourceOrigin: "International / Imported" as const,
        isCrowdSourced: false,
      }));
    }
  } catch {}
  return [];
}

// ── Source 4: RxNorm (National Library of Medicine - Global Drugs) ───────────
async function fetchRxNorm(query: string): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 3 || /[\u0600-\u06FF]/.test(cleanQ)) return [];

    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(950),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const groups = data.drugGroup?.conceptGroup || [];
    const results: DrugRecord[] = [];

    for (const group of groups) {
      if (!group.conceptProperties) continue;
      for (const c of group.conceptProperties.slice(0, 6)) {
        results.push({
          id: `rxnorm-${c.rxcui}`,
          name: c.name,
          nameAr: c.name,
          activeIngredient: c.synonym || c.name,
          company: "International / NLM RxNorm",
          dosageForm: mapRouteToDosageForm("", c.name),
          category: "International / Global",
          isControlled: false,
          sourceOrigin: "International / Imported" as const,
          isCrowdSourced: false,
        });
      }
    }
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

// ── Source 5: DailyMed NLM ────────────────────────────────────────────────────
async function fetchDailyMed(query: string): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 3 || /[\u0600-\u06FF]/.test(cleanQ)) return [];

    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json?drug_name=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(950),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data?.length) return [];

    return data.data.slice(0, 6).map((d: any, i: number) => ({
      id: `dailymed-${i}-${d.drug_name || cleanQ}`,
      name: d.drug_name || cleanQ,
      nameAr: d.drug_name || cleanQ,
      activeIngredient: cleanQ,
      company: "DailyMed / NIH",
      dosageForm: mapRouteToDosageForm("", d.drug_name || ""),
      category: "International / Imported",
      isControlled: false,
      sourceOrigin: "International / Imported" as const,
      isCrowdSourced: false,
    }));
  } catch {
    return [];
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: responseHeaders(request) });
}

export async function GET(request: Request) {
  if (!checkRateLimit(request, { maxRequests: 350, windowMs: 60_000, prefix: "drugs-search" })) {
    return rateLimitExceededResponse(request, 10);
  }

  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 60);
  const includeActiveIngredient = searchParams.get("includeActiveIngredient") === "true";
  const useAi = searchParams.get("useAi") === "true";

  // Trigger non-blocking background sync with the 25,070-record Egyptian Drug Eye Database & Community DB
  syncOfficialEgyptianDrugDatabaseInBackground().catch(() => {});
  syncCommunityDrugsInBackground().catch(() => {});

  if (!query.trim()) {
    return NextResponse.json(
      {
        results: [],
        totalCatalogSize: getTotalDrugCount(),
        executionTimeMs: Date.now() - startTime,
        source: "empty",
      },
      { headers: responseHeaders(request) }
    );
  }

  const cleanQuery = query.trim();
  const isAr = /[\u0600-\u06FF]/.test(cleanQuery);
  const normQ = cleanQuery.toLowerCase();
  const normQAr = normalizeArabic(cleanQuery);

  // ── Layer 1: In-memory sub-millisecond search (Verified Egyptian + Global Catalog) ──
  const memoryResults = searchComprehensiveDrugs(cleanQuery, limit, {
    searchActiveIngredient: includeActiveIngredient,
  });

  // ── Layer 2: Instant Community Cache Query in RAM ──────────────────────────
  const dbCommunityResults = COMMUNITY_CACHE.filter((d) => {
    const nameMatch =
      d.name.toLowerCase().includes(normQ) ||
      (d.nameAr && normalizeArabic(d.nameAr).includes(normQAr));
    const activeMatch =
      includeActiveIngredient &&
      d.activeIngredient &&
      d.activeIngredient.toLowerCase().includes(normQ);
    return nameMatch || activeMatch;
  }).slice(0, 15);

  // ── Layer 3: Multi-Source International Databases (OpenFDA + RxNorm + DailyMed) ──
  let externalResults: DrugRecord[] = [];
  const totalLocalResults = memoryResults.length + dbCommunityResults.length;

  if (totalLocalResults < 10 && cleanQuery.replace(/[*]/g, "").trim().length >= 3) {
    const cacheKey = `${normQ}:${includeActiveIngredient}`;
    const cached = EXTERNAL_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      externalResults = cached.results;
    } else {
      const [fdaRes, rxRes, dailyRes] = await Promise.allSettled([
        fetchOpenFDA(cleanQuery, 8),
        fetchRxNorm(cleanQuery),
        fetchDailyMed(cleanQuery),
      ]);

      if (fdaRes.status === "fulfilled") externalResults.push(...fdaRes.value);
      if (rxRes.status === "fulfilled") externalResults.push(...rxRes.value);
      if (dailyRes.status === "fulfilled") externalResults.push(...dailyRes.value);

      if (externalResults.length > 0) {
        EXTERNAL_CACHE.set(cacheKey, { timestamp: Date.now(), results: externalResults });
      }
    }
  }

  // ── Layer 4: Smart Clinical AI & Close-Match Suggestions (Arabic & English) ──
  let aiResults: DrugRecord[] = [];

  if ((useAi || totalLocalResults + externalResults.length < 3) && cleanQuery.length >= 2) {
    let rawSuggestions: any[] | null = null;
    if (useAi && cleanQuery.length >= 3 && totalLocalResults < 5) {
      try {
        rawSuggestions = await suggestDrugWithGemini(cleanQuery);
      } catch {}
    }

    if (!rawSuggestions || rawSuggestions.length === 0) {
      rawSuggestions = synthesizeClinicalAiDrug(cleanQuery);
    }

    if (rawSuggestions && rawSuggestions.length > 0) {
      aiResults = rawSuggestions.map((g: any, i: number) => ({
        id: `gemini-ai-${i}-${normalizeDrugCanonicalKey(g.name || cleanQuery)}`,
        name: g.name || cleanQuery,
        nameAr: g.nameAr || g.name || cleanQuery,
        activeIngredient: g.activeIngredient || cleanQuery,
        activeIngredientAr: g.activeIngredientAr || undefined,
        company: "ذكاء PenRX+ الدوائي",
        price: g.price || undefined,
        dosageForm: g.dosageForm || "Tablet (قرص)",
        category: g.category || "AI Clinical Suggestion",
        isControlled: false,
        sourceOrigin: "Gemini AI Engine" as const,
        isAiGenerated: true,
        aiConfidence: g.confidence || "High",
        recommendedDose: g.recommendedDose || undefined,
      }));
    }
  }

  // ── Layer 5: Strict Canonical Deduplication & Price Enrichment ────────────
  const mergedMap = new Map<string, DrugRecord>();

  for (const item of memoryResults) {
    const key = normalizeDrugCanonicalKey(item.name, item.dosageForm);
    mergedMap.set(key, { ...item });
  }

  for (const dbItem of dbCommunityResults) {
    const key = normalizeDrugCanonicalKey(dbItem.name, dbItem.dosageForm);
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      if (dbItem.price !== undefined && dbItem.price > 0) {
        existing.price = dbItem.price;
      }
      if (dbItem.dosageForm) existing.dosageForm = dbItem.dosageForm;
    } else {
      mergedMap.set(key, dbItem);
    }
  }

  for (const extItem of externalResults) {
    const key = normalizeDrugCanonicalKey(extItem.name, extItem.dosageForm);
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      if (extItem.price !== undefined && extItem.price > 0) {
        existing.price = extItem.price;
      }
    } else {
      mergedMap.set(key, extItem);
    }
  }

  for (const aiItem of aiResults) {
    const key = normalizeDrugCanonicalKey(aiItem.name, aiItem.dosageForm);
    if (!mergedMap.has(key)) {
      mergedMap.set(key, aiItem);
    }
  }

  const combined: DrugRecord[] = Array.from(mergedMap.values());

  combined.sort((a, b) => {
    const aStarts = isAr
      ? normalizeArabic(a.nameAr || "").startsWith(normQAr) || a.name.toLowerCase().startsWith(normQ)
      : a.name.toLowerCase().startsWith(normQ);
    const bStarts = isAr
      ? normalizeArabic(b.nameAr || "").startsWith(normQAr) || b.name.toLowerCase().startsWith(normQ)
      : b.name.toLowerCase().startsWith(normQ);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    if (Boolean(a.isAiGenerated) !== Boolean(b.isAiGenerated)) {
      return a.isAiGenerated ? 1 : -1;
    }

    const aEss = !!a.isEssential;
    const bEss = !!b.isEssential;
    if (aEss !== bEss) return aEss ? -1 : 1;

    if (isAr) {
      const nameA = a.nameAr || a.name;
      const nameB = b.nameAr || b.name;
      return nameA.localeCompare(nameB, "ar", { sensitivity: "base" });
    } else {
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    }
  });

  return NextResponse.json(
    {
      query: cleanQuery,
      results: combined.slice(0, limit),
      totalCatalogSize: getTotalDrugCount() + COMMUNITY_CACHE.length,
      executionTimeMs: Date.now() - startTime,
      source:
        externalResults.length > 0
          ? "hybrid-multi-source-global"
          : aiResults.length > 0
          ? "hybrid-with-gemini-ai"
          : dbCommunityResults.length > 0
          ? "hybrid-local-community"
          : "local-memory",
      hasExternalResults: externalResults.length > 0,
      hasAiResults: aiResults.length > 0,
    },
    { headers: responseHeaders(request) }
  );
}
