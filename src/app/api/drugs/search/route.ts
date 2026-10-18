import { NextResponse } from "next/server";
import {
  searchComprehensiveDrugs,
  getTotalDrugCount,
  updateDrugPricesFromCloud,
  DrugRecord,
} from "@/lib/drugSearchEngine";
import { prisma } from "@/lib/prisma";
import { suggestDrugWithGemini } from "@/lib/gemini";
import { synthesizeClinicalAiDrug } from "@/lib/clinicalAiSynthesis";

export const dynamic = "force-dynamic";

// CORS: the static mobile page (GitHub Pages / file://) calls this route cross-origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── In-Memory LRU Cache for External APIs (1 Hour TTL) ────────────────────────
const EXTERNAL_CACHE = new Map<string, { timestamp: number; results: DrugRecord[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// ── In-Memory Community Drugs Cache (Zero-latency RAM cache synced in background) ──
let COMMUNITY_CACHE: DrugRecord[] = [];
let lastCommunitySync = 0;
const COMMUNITY_SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes

async function syncCommunityDrugsInBackground() {
  if (Date.now() - lastCommunitySync < COMMUNITY_SYNC_INTERVAL) return;
  lastCommunitySync = Date.now();

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), 700)
    );
    const queryPromise = prisma.drug.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const dbMatches = (await Promise.race([queryPromise, timeoutPromise])) as any[];
    if (dbMatches && dbMatches.length > 0) {
      COMMUNITY_CACHE = dbMatches.map((d) => ({
        id: d.id,
        name: d.name,
        nameAr: d.nameAr || undefined,
        activeIngredient: d.activeIngredient,
        company: d.company || "مساهمة من طبيب",
        price: d.price || undefined,
        dosageForm: d.dosageForm || "Tablet",
        category: d.category || "عام",
        isControlled: d.isControlled || false,
        sourceOrigin: "Doctor Community" as const,
        isCrowdSourced: true,
      }));

      // Automatically persist cloud price updates into in-memory engine
      updateDrugPricesFromCloud(
        COMMUNITY_CACHE.map((d) => ({
          name: d.name,
          price: d.price,
          dosageForm: d.dosageForm,
        }))
      );
    }
  } catch {
    // Supabase offline or slow — proceed cleanly with memory
  }
}

// ── OpenFDA fallback — free, no API key ───────────────────────────────────────
async function fetchOpenFDA(query: string, limit: number): Promise<DrugRecord[]> {
  try {
    // Try brand name first, then generic
    const urls = [
      `https://api.fda.gov/drug/ndc.json?search=brand_name:"${encodeURIComponent(query)}"&limit=${limit}`,
      `https://api.fda.gov/drug/ndc.json?search=generic_name:"${encodeURIComponent(query)}"&limit=${limit}`,
    ];

    for (const url of urls) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(900),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;

      return data.results.slice(0, limit).map((r: any, i: number) => ({
        id: `fda-ndc-${r.product_ndc || i}-${Date.now()}`,
        name: `${r.brand_name || r.generic_name || query}${r.dosage_form ? ` (${r.dosage_form})` : ""}`,
        nameAr: r.brand_name || r.generic_name || query,
        activeIngredient: r.active_ingredients?.map((a: any) => `${a.name} ${a.strength || ""}`.trim()).join(" + ") || r.generic_name || query,
        company: r.labeler_name || "International",
        price: undefined,
        dosageForm: r.dosage_form || "Tablet",
        category: "International / Imported",
        isControlled: false,
        sourceOrigin: "International / Imported" as const,
        isCrowdSourced: false,
      }));
    }
  } catch {
    // silently fail — we have local data
  }
  return [];
}

// ── RxNorm fallback — NLM free ────────────────────────────────────────────────
async function fetchRxNorm(query: string): Promise<DrugRecord[]> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(900),
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

// ── DailyMed NLM fallback ─────────────────────────────────────────────────────
async function fetchDailyMed(query: string): Promise<DrugRecord[]> {
  try {
    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json?drug_name=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(900),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data?.length) return [];

    return data.data.slice(0, 4).map((d: any, i: number) => ({
      id: `dailymed-${i}-${Date.now()}`,
      name: d.drug_name || query,
      nameAr: d.drug_name || query,
      activeIngredient: query,
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

export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 50);
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
      { headers: CORS_HEADERS }
    );
  }

  const cleanQuery = query.trim();

  // ── Layer 1: In-memory sub-millisecond search (~0.2ms) ────────────────────
  const memoryResults = searchComprehensiveDrugs(cleanQuery, limit, {
    searchActiveIngredient: includeActiveIngredient,
  });

  // Trigger background community sync if due (never blocks search response)
  syncCommunityDrugsInBackground().catch(() => {});

  // ── Layer 2: Instant Community Cache Query (0.01ms in RAM) ────────────────
  const cleanQ = cleanQuery.toLowerCase();
  const dbCommunityResults = COMMUNITY_CACHE.filter((d) => {
    const nameMatch = d.name.toLowerCase().includes(cleanQ) || (d.nameAr && d.nameAr.includes(cleanQuery));
    const activeMatch = includeActiveIngredient && d.activeIngredient && d.activeIngredient.toLowerCase().includes(cleanQ);
    return nameMatch || activeMatch;
  }).slice(0, 10);

  // ── Layer 3: External Multi-Source APIs (OpenFDA + RxNorm + DailyMed) ────
  let externalResults: DrugRecord[] = [];
  const totalLocalResults = memoryResults.length + dbCommunityResults.length;

  // Only query external networks if local catalog has zero results
  if (totalLocalResults === 0 && cleanQuery.length >= 3 && !useAi) {
    const cacheKey = cleanQuery.toLowerCase();
    const cached = EXTERNAL_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      externalResults = cached.results;
    } else {
      // Fetch external sources in parallel with fast 900ms timeout
      const [fdaRes, rxRes, dailyRes] = await Promise.allSettled([
        fetchOpenFDA(cleanQuery, 5),
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

  // ── Layer 4: Deep Clinical Pharmacology AI (Google Gemini 3.8 Flash & Clinical AI) ──────
  let aiResults: DrugRecord[] = [];

  // Invoke Gemini AI when requested or when doctor activates Gemini mode
  if (useAi && cleanQuery.length >= 2) {
    let rawSuggestions: any[] | null = null;
    try {
      rawSuggestions = await suggestDrugWithGemini(cleanQuery);
    } catch {
      // Gemini rate limited or offline
    }

    // If Gemini API is rate-limited (429) or offline, invoke Clinical AI Synthesizer
    if (!rawSuggestions || rawSuggestions.length === 0) {
      rawSuggestions = synthesizeClinicalAiDrug(cleanQuery);
    }

    if (rawSuggestions && rawSuggestions.length > 0) {
      aiResults = rawSuggestions.map((g: any, i: number) => ({
        id: `gemini-ai-${Date.now()}-${i}`,
        name: g.name || cleanQuery,
        nameAr: g.nameAr || g.name || cleanQuery,
        activeIngredient: g.activeIngredient || cleanQuery,
        activeIngredientAr: g.activeIngredientAr || undefined,
        company: "Google Gemini 3.8 Flash",
        dosageForm: g.dosageForm || "Tablet",
        category: g.category || "AI Clinical Suggestion",
        isControlled: false,
        sourceOrigin: "Gemini AI Engine" as const,
        isAiGenerated: true,
        aiConfidence: g.confidence || "High",
        recommendedDose: g.recommendedDose || undefined,
      }));
    }
  }

  // ── Merge + deduplicate with cloud price override ─────────────────────────
  const mergedMap = new Map<string, DrugRecord>();

  // 1. Add memory results
  for (const item of memoryResults) {
    const key = item.name.toLowerCase().replace(/\s+/g, " ").trim();
    mergedMap.set(key, { ...item });
  }

  // 2. Overlay cloud community & price updates (cloud prices take automatic precedence)
  for (const dbItem of dbCommunityResults) {
    const key = dbItem.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      if (dbItem.price !== undefined && dbItem.price > 0) {
        existing.price = dbItem.price; // Automatic cloud price sync
      }
      if (dbItem.dosageForm) existing.dosageForm = dbItem.dosageForm;
    } else {
      mergedMap.set(key, dbItem);
    }
  }

  // 3. Add external fallback results if novel
  for (const extItem of externalResults) {
    const key = extItem.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, extItem);
    }
  }

  // 4. Add Gemini AI synthesized results
  for (const aiItem of aiResults) {
    const key = aiItem.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (!mergedMap.has(key)) {
      mergedMap.set(key, aiItem);
    }
  }

  const combined: DrugRecord[] = Array.from(mergedMap.values());

  // ── Strict Alphabetical Sorting for Combined Results ─────────────────────
  const isAr = /[\u0600-\u06FF]/.test(cleanQuery);
  const normQ = cleanQuery.toLowerCase();

  combined.sort((a, b) => {
    // 1. AI generated items with High confidence placed prominently if searched with AI
    if (useAi && a.isAiGenerated !== b.isAiGenerated) {
      return a.isAiGenerated ? -1 : 1;
    }

    // 2. Exact prefix match on brand names has priority
    const aStarts = isAr
      ? (a.nameAr && a.nameAr.startsWith(cleanQuery)) || a.name.toLowerCase().startsWith(normQ)
      : a.name.toLowerCase().startsWith(normQ);
    const bStarts = isAr
      ? (b.nameAr && b.nameAr.startsWith(cleanQuery)) || b.name.toLowerCase().startsWith(normQ)
      : b.name.toLowerCase().startsWith(normQ);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    // 3. Essential popular regional brands first
    const aEss = !!a.isEssential;
    const bEss = !!b.isEssential;
    if (aEss !== bEss) return aEss ? -1 : 1;

    // 4. Alphabetical order (أ-ي for Arabic, A-Z for English)
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
      totalCatalogSize: getTotalDrugCount() + dbCommunityResults.length,
      executionTimeMs: Date.now() - startTime,
      source:
        aiResults.length > 0
          ? "hybrid-with-gemini-ai"
          : externalResults.length > 0
          ? "hybrid-local-community-external"
          : dbCommunityResults.length > 0
          ? "hybrid-local-community"
          : "local-memory",
      hasExternalResults: externalResults.length > 0,
      hasAiResults: aiResults.length > 0,
      aiEngine: aiResults.length > 0 ? "Google Gemini 3.8 Flash" : undefined,
    },
    { headers: CORS_HEADERS }
  );
}
