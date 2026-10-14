import { NextResponse } from "next/server";
import {
  searchComprehensiveDrugs,
  getTotalDrugCount,
  updateDrugPricesFromCloud,
  DrugRecord,
} from "@/lib/drugSearchEngine";
import { prisma } from "@/lib/prisma";

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
        signal: AbortSignal.timeout(2500),
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
      signal: AbortSignal.timeout(2500),
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
      signal: AbortSignal.timeout(2500),
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

  if (!query.trim()) {
    const popular = searchComprehensiveDrugs("Panadol", 15);
    return NextResponse.json(
      {
        results: popular,
        totalCatalogSize: getTotalDrugCount(),
        executionTimeMs: Date.now() - startTime,
        source: "popular-defaults",
      },
      { headers: CORS_HEADERS }
    );
  }

  const cleanQuery = query.trim();

  // ── Layer 1: In-memory sub-millisecond search (~0.2ms) ────────────────────
  const memoryResults = searchComprehensiveDrugs(cleanQuery, limit, {
    searchActiveIngredient: includeActiveIngredient,
  });

  // ── Layer 2: Supabase community drugs (crowd-sourced by doctors) ──────────
  let dbCommunityResults: DrugRecord[] = [];
  try {
    const orConditions: any[] = [
      { name: { contains: cleanQuery, mode: "insensitive" } },
      { nameAr: { contains: cleanQuery, mode: "insensitive" } },
    ];
    if (includeActiveIngredient) {
      orConditions.push({ activeIngredient: { contains: cleanQuery, mode: "insensitive" } });
    }

    const dbMatches = await prisma.drug.findMany({
      where: {
        OR: orConditions,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    if (dbMatches.length > 0) {
      dbCommunityResults = dbMatches.map((d) => ({
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
        dbCommunityResults.map((d) => ({
          name: d.name,
          price: d.price,
          dosageForm: d.dosageForm,
        }))
      );
    }
  } catch {
    // Supabase offline — use local only
  }

  // ── Layer 3: External Multi-Source APIs (OpenFDA + RxNorm + DailyMed) ────
  let externalResults: DrugRecord[] = [];
  const totalLocalResults = memoryResults.length + dbCommunityResults.length;

  if (totalLocalResults < 5 && cleanQuery.length >= 3) {
    const cacheKey = cleanQuery.toLowerCase();
    const cached = EXTERNAL_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      externalResults = cached.results;
    } else {
      // Fetch external sources in parallel with strict timeout
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

  const combined: DrugRecord[] = Array.from(mergedMap.values());

  // ── Strict Alphabetical Sorting for Combined Results ─────────────────────
  const isAr = /[\u0600-\u06FF]/.test(cleanQuery);
  const normQ = cleanQuery.toLowerCase();

  combined.sort((a, b) => {
    // 1. Exact prefix match on brand names has priority
    const aStarts = isAr
      ? (a.nameAr && a.nameAr.startsWith(cleanQuery)) || a.name.toLowerCase().startsWith(normQ)
      : a.name.toLowerCase().startsWith(normQ);
    const bStarts = isAr
      ? (b.nameAr && b.nameAr.startsWith(cleanQuery)) || b.name.toLowerCase().startsWith(normQ)
      : b.name.toLowerCase().startsWith(normQ);

    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    // 2. Essential popular regional brands first
    const aEss = !!a.isEssential;
    const bEss = !!b.isEssential;
    if (aEss !== bEss) return aEss ? -1 : 1;

    // 3. Alphabetical order (أ-ي for Arabic, A-Z for English)
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
        externalResults.length > 0
          ? "hybrid-local-community-external"
          : dbCommunityResults.length > 0
          ? "hybrid-local-community"
          : "local-memory",
      hasExternalResults: externalResults.length > 0,
    },
    { headers: CORS_HEADERS }
  );
}
