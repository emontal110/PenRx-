import { NextResponse } from "next/server";
import { searchComprehensiveDrugs, getTotalDrugCount, DrugRecord } from "@/lib/drugSearchEngine";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "25");

  if (!query.trim()) {
    // Return standard popular medications
    const popular = searchComprehensiveDrugs("Panadol", 15);
    return NextResponse.json({
      results: popular,
      totalCatalogSize: getTotalDrugCount(),
      executionTimeMs: Date.now() - startTime,
      source: "popular-defaults",
    });
  }

  const cleanQuery = query.trim();

  // 1. In-memory Sub-Millisecond Search Engine (~0.3ms)
  const memoryResults = searchComprehensiveDrugs(cleanQuery, limit);

  // 2. Fetch any newly added community drugs from Supabase Database
  let dbCommunityResults: DrugRecord[] = [];
  try {
    const dbMatches = await prisma.drug.findMany({
      where: {
        OR: [
          { name: { contains: cleanQuery, mode: "insensitive" } },
          { nameAr: { contains: cleanQuery, mode: "insensitive" } },
          { activeIngredient: { contains: cleanQuery, mode: "insensitive" } },
        ],
      },
      take: 10,
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
        sourceOrigin: "Doctor Community",
        isCrowdSourced: true,
      }));
    }
  } catch (err) {
    // Database query failover to memory
  }

  // Merge and deduplicate by name
  const seenNames = new Set<string>();
  const combined: DrugRecord[] = [];

  // Add DB community results first (highest recency)
  for (const item of dbCommunityResults) {
    const key = item.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      combined.push(item);
    }
  }

  for (const item of memoryResults) {
    const key = item.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      combined.push(item);
    }
  }

  return NextResponse.json({
    query: cleanQuery,
    results: combined.slice(0, limit),
    totalCatalogSize: getTotalDrugCount() + dbCommunityResults.length,
    executionTimeMs: Date.now() - startTime,
    source: combined.length > 0 ? "hybrid-memory-and-crowd-db" : "empty",
  });
}
