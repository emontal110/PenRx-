import { NextResponse } from "next/server";
import { searchComprehensiveDrugs, DrugRecord } from "@/lib/drugSearchEngine";
import { corsHeaders, securityHeaders } from "@/lib/httpSecurity";
import { hasCloudCredentials, proxyToCloud } from "@/lib/cloudProxy";
import { supabaseRest } from "@/lib/supabaseRest";

export const dynamic = "force-dynamic";

function responseHeaders(request: Request): Record<string, string> {
  return { ...securityHeaders(), ...corsHeaders(request) };
}

/**
 * Clean active ingredient to extract the root chemical entity.
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

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: responseHeaders(request) });
}

export async function GET(request: Request) {
  if (!hasCloudCredentials()) return proxyToCloud(request, "/api/drugs/equivalents");

  const { searchParams } = new URL(request.url);
  const ingredient = (searchParams.get("ingredient") || "").slice(0, 120);
  const currentDrugName = (searchParams.get("currentDrug") || "").slice(0, 120);

  if (!ingredient.trim() && !currentDrugName.trim()) {
    return NextResponse.json({ equivalents: [] }, { headers: responseHeaders(request) });
  }

  const coreIngredient = extractCoreIngredient(ingredient || currentDrugName);
  const searchKey = coreIngredient.split(/\s+/)[0] || ingredient;

  if (searchKey.length < 2) {
    return NextResponse.json({ equivalents: [] }, { headers: responseHeaders(request) });
  }

  const catalogMatches = searchComprehensiveDrugs(searchKey, 40, {
    searchActiveIngredient: true,
  });

  let communityMatches: DrugRecord[] = [];
  try {
    const encodedKey = encodeURIComponent(searchKey.replace(/[%_*'"`\\();-]/g, ""));
    const dbRows = await supabaseRest<any[]>("Drug", {
      query: `or=(activeIngredient.ilike.*${encodedKey}*,name.ilike.*${encodedKey}*)&limit=15`,
    });
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
  } catch {
    // catalogue-only response when the database is unreachable
  }

  const map = new Map<string, DrugRecord>();
  const currLower = currentDrugName.toLowerCase().trim();

  for (const item of [...communityMatches, ...catalogMatches]) {
    const key = item.name.toLowerCase().trim();
    if (currLower && (key === currLower || key.startsWith(currLower))) continue;
    if (!map.has(key)) map.set(key, item);
  }

  const equivalents = Array.from(map.values());
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
    { headers: responseHeaders(request) }
  );
}
