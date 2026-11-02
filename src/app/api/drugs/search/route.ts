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
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";

export const dynamic = "force-dynamic";

function responseHeaders(request: Request): Record<string, string> {
  return { ...securityHeaders(), ...corsHeaders(request) };
}

// ── In-Memory LRU Cache for External Multi-Source APIs (2 Hour TTL) ──────────
const EXTERNAL_CACHE = new Map<string, { timestamp: number; results: DrugRecord[] }>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// ── In-Memory Community Drugs Cache (Zero-latency RAM cache synced in background) ──
let COMMUNITY_CACHE: DrugRecord[] = [];
let lastCommunitySync = 0;
const COMMUNITY_SYNC_INTERVAL = 90 * 1000; // 90 seconds for fast multi-doctor sharing

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

      // Automatically persist cloud price & new drug updates into in-memory engine
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
  } catch {
    // Supabase offline or slow — proceed cleanly with memory
  }
}

// ── Source 3: Live Egyptian Drug Database API (27,600+ Egyptian Drugs & Updated Prices) ──
async function fetchEgyptianDrugsLiveApi(query: string, limit = 15): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 2) return [];

    const url = `https://eg-drugs-api.mahmoudfalous.workers.dev/v1/search?q=${encodeURIComponent(cleanQ)}&limit=${Math.min(limit, 25)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(950),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.results) || data.results.length === 0) return [];

    const mapped: DrugRecord[] = data.results.map((r: any) => ({
      id: `eg-api-${r.id || Date.now()}`,
      name: r.name || cleanQ,
      nameAr: r.arabic || r.name || cleanQ,
      activeIngredient: r.active || "مادة فعالة معتمدة",
      company: r.company || "شركة أدوية مصرية",
      price: r.price ? parseFloat(String(r.price)) || undefined : undefined,
      dosageForm: /syrup|شراب/i.test(r.name || "")
        ? "Syrup (شراب)"
        : /susp|معلق/i.test(r.name || "")
        ? "Suspension (معلق)"
        : /amp|vial|حقن|امبول/i.test(r.name || "")
        ? "Ampoule (حقنة)"
        : /cream|كريم/i.test(r.name || "")
        ? "Cream (كريم)"
        : /cap|كبسول/i.test(r.name || "")
        ? "Capsule (كبسولة)"
        : "Tablet (قرص)",
      category: r.description || "Egyptian Market",
      isControlled: false,
      sourceOrigin: "Egyptian Bank" as const,
      isCrowdSourced: false,
    }));

    // Auto-sync live prices and new Egyptian drugs into the server's in-memory catalog!
    updateDrugPricesFromCloud(mapped);
    return mapped;
  } catch {
    return [];
  }
}

// ── Source 4: OpenFDA NDC Directory (International & Imported Drugs) ──────────
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
        signal: AbortSignal.timeout(850),
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
        dosageForm: r.dosage_form || "Tablet (قرص)",
        category: "International / Imported",
        isControlled: false,
        sourceOrigin: "International / Imported" as const,
        isCrowdSourced: false,
      }));
    }
  } catch {}
  return [];
}

// ── Source 5: RxNorm (National Library of Medicine) ───────────────────────────
async function fetchRxNorm(query: string): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 3 || /[\u0600-\u06FF]/.test(cleanQ)) return [];

    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(850),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const groups = data.drugGroup?.conceptGroup || [];
    const results: DrugRecord[] = [];

    for (const group of groups) {
      if (!group.conceptProperties) continue;
      for (const c of group.conceptProperties.slice(0, 4)) {
        results.push({
          id: `rxnorm-${c.rxcui}`,
          name: c.name,
          nameAr: c.name,
          activeIngredient: c.synonym || c.name,
          company: "International / NLM",
          dosageForm: "Tablet / Capsule",
          category: "International / Imported",
          isControlled: false,
          sourceOrigin: "International / Imported" as const,
          isCrowdSourced: false,
        });
      }
    }
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ── Source 6: DailyMed NLM ────────────────────────────────────────────────────
async function fetchDailyMed(query: string): Promise<DrugRecord[]> {
  try {
    const cleanQ = query.replace(/[*%]/g, " ").trim();
    if (cleanQ.length < 3 || /[\u0600-\u06FF]/.test(cleanQ)) return [];

    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json?drug_name=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(850),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data?.length) return [];

    return data.data.slice(0, 4).map((d: any, i: number) => ({
      id: `dailymed-${i}-${d.drug_name || cleanQ}`,
      name: d.drug_name || cleanQ,
      nameAr: d.drug_name || cleanQ,
      activeIngredient: cleanQ,
      company: "DailyMed / NLM",
      dosageForm: "Tablet / Capsule",
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
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/drugs/search");

  if (!checkRateLimit(request, { maxRequests: 300, windowMs: 60_000, prefix: "drugs-search" })) {
    return rateLimitExceededResponse(request, 10);
  }

  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 60);
  const includeActiveIngredient = searchParams.get("includeActiveIngredient") === "true";
  const useAi = searchParams.get("useAi") === "true";

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

  // ── Layer 1: In-memory sub-millisecond search (43,500+ drugs, Alphabetical + Drug Eye *) ──
  const memoryResults = searchComprehensiveDrugs(cleanQuery, limit, {
    searchActiveIngredient: includeActiveIngredient,
  });

  // Trigger non-blocking background community sync
  syncCommunityDrugsInBackground().catch(() => {});

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

  // ── Layer 3: Multi-Source External Databases (Egyptian Live API + OpenFDA + RxNorm + DailyMed) ──
  let externalResults: DrugRecord[] = [];
  const totalLocalResults = memoryResults.length + dbCommunityResults.length;

  // Query external sources when local results are sparse (< 8) and query >= 3 chars
  if (totalLocalResults < 8 && cleanQuery.replace(/[*]/g, "").trim().length >= 3) {
    const cacheKey = `${normQ}:${includeActiveIngredient}`;
    const cached = EXTERNAL_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      externalResults = cached.results;
    } else {
      const [egApiRes, fdaRes, rxRes, dailyRes] = await Promise.allSettled([
        fetchEgyptianDrugsLiveApi(cleanQuery, 12),
        totalLocalResults === 0 ? fetchOpenFDA(cleanQuery, 5) : Promise.resolve([]),
        totalLocalResults === 0 ? fetchRxNorm(cleanQuery) : Promise.resolve([]),
        totalLocalResults === 0 ? fetchDailyMed(cleanQuery) : Promise.resolve([]),
      ]);

      if (egApiRes.status === "fulfilled") externalResults.push(...egApiRes.value);
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

  // 1. Add primary memory results
  for (const item of memoryResults) {
    const key = normalizeDrugCanonicalKey(item.name, item.dosageForm);
    mergedMap.set(key, { ...item });
  }

  // 2. Overlay community & cloud price updates (never duplicates, updates prices)
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

  // 3. Overlay live Egyptian API & International results (updates prices if existing, adds if novel)
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

  // 4. Add AI / Close Suggestions if not already present in the merged list
  for (const aiItem of aiResults) {
    const key = normalizeDrugCanonicalKey(aiItem.name, aiItem.dosageForm);
    if (!mergedMap.has(key)) {
      mergedMap.set(key, aiItem);
    }
  }

  const combined: DrugRecord[] = Array.from(mergedMap.values());

  // ── Layer 6: Progressive Alphabetical & Relevance Sorting ──────────────────
  combined.sort((a, b) => {
    const aStarts = isAr
      ? normalizeArabic(a.nameAr || "").startsWith(normQAr) || a.name.toLowerCase().startsWith(normQ)
      : a.name.toLowerCase().startsWith(normQ);
    const bStarts = isAr
      ? normalizeArabic(b.nameAr || "").startsWith(normQAr) || b.name.toLowerCase().startsWith(normQ)
      : b.name.toLowerCase().startsWith(normQ);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    // Prioritize non-AI catalog items over synthesized AI items when prefix matches exist
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
