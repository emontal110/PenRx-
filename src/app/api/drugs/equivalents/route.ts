import { NextResponse } from "next/server";
import { searchComprehensiveDrugs, DrugRecord } from "@/lib/drugSearchEngine";

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Clean active ingredient to extract root chemical entity
 * e.g. "Paracetamol 500mg" -> "Paracetamol"
 * e.g. "Diclofenac Potassium 50mg" -> "Diclofenac"
 */
function extractCoreIngredient(ingredient: string): string {
  if (!ingredient) return "";
  return ingredient
    .replace(/\b(\d+(\.\d+)?\s*(mg|g|mcg|ml|%|iu|international units))\b/gi, "")
    .replace(/\b(potassium|sodium|hydrochloride|hcl|fumarate|maleate|sulfate|tartrate|hydrate|monohydrate)\b/gi, "")
    .replace(/[+&/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ingredient = searchParams.get("ingredient") || "";
  const currentDrugName = searchParams.get("currentDrug") || "";

  if (!ingredient.trim() && !currentDrugName.trim()) {
    return NextResponse.json({ equivalents: [] }, { headers: CORS_HEADERS });
  }

  const coreIngredient = extractCoreIngredient(ingredient || currentDrugName);
  const searchKey = coreIngredient.split(/\s+/)[0] || ingredient;

  if (searchKey.length < 2) {
    return NextResponse.json({ equivalents: [] }, { headers: CORS_HEADERS });
  }

  // 1. Find matches in in-memory catalog
  const catalogMatches = searchComprehensiveDrugs(searchKey, 40, {
    searchActiveIngredient: true,
  });

  // 2. Find matches in Supabase community drugs
  let communityMatches: DrugRecord[] = [];
  try {
    const encodedKey = encodeURIComponent(searchKey);
    const sRes = await fetch(
      `${SUPABASE_REST_URL}/Drug?or=(activeIngredient.ilike.*${encodedKey}*,name.ilike.*${encodedKey}*)&limit=15`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (sRes.ok) {
      const dbRows = await sRes.json();
      if (Array.isArray(dbRows)) {
        communityMatches = dbRows.map((d: any) => ({
          id: d.id,
          name: d.name,
          nameAr: d.nameAr || undefined,
          activeIngredient: d.activeIngredient,
          company: d.company || "شركة أدوية",
          price: d.price || undefined,
          dosageForm: d.dosageForm || "Tablet",
          category: d.category || "عام",
          isControlled: d.isControlled || false,
          sourceOrigin: "Doctor Community",
        }));
      }
    }
  } catch {
    // fallback to catalog
  }

  // 3. Merge & Deduplicate
  const map = new Map<string, DrugRecord>();
  const currLower = currentDrugName.toLowerCase().trim();

  for (const item of [...communityMatches, ...catalogMatches]) {
    const key = item.name.toLowerCase().trim();
    // Exclude the currently selected drug itself
    if (currLower && (key === currLower || key.startsWith(currLower))) continue;

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  const equivalents = Array.from(map.values());

  // 4. Sort: items with verified price first (ascending price), then alphabetical
  equivalents.sort((a, b) => {
    if (a.price && b.price) return a.price - b.price;
    if (a.price && !b.price) return -1;
    if (!a.price && b.price) return 1;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });

  return NextResponse.json(
    {
      coreIngredient,
      totalEquivalents: equivalents.length,
      equivalents: equivalents.slice(0, 15),
    },
    { headers: CORS_HEADERS }
  );
}
