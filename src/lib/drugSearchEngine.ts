import comprehensiveCatalog from "@/data/comprehensive-drugs.json";

export interface DrugRecord {
  id: string;
  name: string;
  nameAr?: string;
  activeIngredient: string;
  activeIngredientAr?: string;
  company?: string;
  price?: number;
  dosageForm?: string;
  category?: string;
  isControlled?: boolean;
  sourceOrigin?: "Egyptian Bank" | "International / Imported" | "Cosmetics & Aesthetics" | "Dental Care" | "Vitamins & Supplements" | "Doctor Community";
  isCrowdSourced?: boolean;
  doctorContributor?: string;
}

interface IndexedDrugRecord extends DrugRecord {
  normNameEng: string;
  normNameAr: string;
  normActiveIngEng: string;
  normActiveIngAr: string;
  normCategory: string;
  arTokens: string[];
  engTokens: string[];
}

/**
 * Enhanced Arabic Text Normalization
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // remove Tashkeel
    .replace(/[^\w\s\u0600-\u06FF]/g, " "); // Replace punctuation with space
}

/**
 * Egyptian Drug Synonym Mapping for Common Forms
 */
function expandSynonyms(token: string): string[] {
  const synonyms: Record<string, string[]> = {
    لبوس: ["لبوس", "اقماع", "قمع", "suppositories", "suppository"],
    اقماع: ["اقماع", "لبوس", "قمع", "suppositories"],
    حقن: ["حقن", "امبول", "امبولات", "حقنه", "ampoule", "injection", "vial"],
    امبول: ["امبول", "حقن", "امبولات", "ampoule", "injection"],
    شراب: ["شراب", "معلق", "نقط", "syrup", "suspension", "liquid"],
    معلق: ["معلق", "شراب", "suspension", "syrup"],
    قطره: ["قطره", "نقط", "بخاخ", "drops", "spray"],
    نقط: ["نقط", "قطره", "drops"],
    اقراص: ["اقراص", "كبسولات", "قرص", "كبسوله", "tablets", "capsules", "tab", "cap"],
    كبسولات: ["كبسولات", "اقراص", "كبسوله", "قرص", "capsules", "tablets"],
    فوار: ["فوار", "sachet", "effervescent"],
    مرهم: ["مرهم", "كريم", "دهان", "ointment", "cream", "gel"],
    كريم: ["كريم", "مرهم", "دهان", "cream", "ointment", "gel"],
  };

  const norm = normalizeArabic(token);
  return synonyms[norm] || [norm];
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

const RAW_CATALOG = comprehensiveCatalog as DrugRecord[];

const INDEXED_DRUGS: IndexedDrugRecord[] = RAW_CATALOG.map((drug) => {
  const normNameAr = normalizeArabic(drug.nameAr || "");
  const normNameEng = (drug.name || "").toLowerCase().trim();
  const normActiveIngEng = (drug.activeIngredient || "").toLowerCase().trim();
  const normActiveIngAr = normalizeArabic(drug.activeIngredientAr || "");
  const normCategory = (drug.category || "").toLowerCase().trim();

  return {
    ...drug,
    normNameEng,
    normNameAr,
    normActiveIngEng,
    normActiveIngAr,
    normCategory,
    arTokens: normNameAr.split(/\s+/).filter(Boolean),
    engTokens: normNameEng.split(/\s+/).filter(Boolean),
  };
});

// Fast Inverted Prefix Hash Map for Sub-Millisecond Candidate Retrieval
const PREFIX_INDEX = new Map<string, number[]>();

function buildPrefixIndex() {
  for (let i = 0; i < INDEXED_DRUGS.length; i++) {
    const item = INDEXED_DRUGS[i];

    const registerToken = (token: string) => {
      if (!token) return;
      for (let len = 1; len <= Math.min(5, token.length); len++) {
        const prefix = token.substring(0, len);
        let list = PREFIX_INDEX.get(prefix);
        if (!list) {
          list = [];
          PREFIX_INDEX.set(prefix, list);
        }
        if (list.length < 600) {
          list.push(i);
        }
      }
    };

    item.arTokens.forEach(registerToken);
    item.engTokens.forEach(registerToken);

    // Also index active ingredient prefixes
    if (item.normActiveIngEng) {
      item.normActiveIngEng.split(/\s+/).forEach(registerToken);
    }
  }
}

// Build index on module import
buildPrefixIndex();

/**
 * Supercharged Sub-Millisecond Search Engine
 * Searches Brand name (AR/EN), Active Ingredient, Dosage Form, and Company
 */
export function searchComprehensiveDrugs(query: string, limit = 25): DrugRecord[] {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const normQ = cleanQ.toLowerCase();
  const normQAr = normalizeArabic(cleanQ);

  const queryTokensAr = normQAr.split(/\s+/).filter(Boolean);
  const queryTokensEng = normQ.split(/\s+/).filter(Boolean);

  const candidateIndices = new Set<number>();

  // Gather candidate indices from prefix hash table
  const fetchCandidates = (tokens: string[]) => {
    tokens.forEach((t) => {
      const p3 = t.substring(0, 3);
      const p2 = t.substring(0, 2);
      const list3 = PREFIX_INDEX.get(p3);
      if (list3 && list3.length > 0) {
        list3.forEach((idx) => candidateIndices.add(idx));
      } else {
        const list2 = PREFIX_INDEX.get(p2);
        if (list2) list2.forEach((idx) => candidateIndices.add(idx));
      }
    });
  };

  fetchCandidates(queryTokensAr);
  fetchCandidates(queryTokensEng);

  // If query is short or prefix returned few results, expand candidates
  if (candidateIndices.size < 20) {
    const fallbackCount = Math.min(INDEXED_DRUGS.length, 3000);
    for (let i = 0; i < fallbackCount; i++) {
      candidateIndices.add(i);
    }
  }

  const scoredMap = new Map<string, { drug: DrugRecord; score: number }>();

  candidateIndices.forEach((idx) => {
    const item = INDEXED_DRUGS[idx];
    let score = 0;

    // 1. Exact Full Match
    if (item.normNameAr === normQAr || item.normNameEng === normQ) {
      score = 100;
    }
    // 2. Starts With Match (Highest clinical relevance while typing)
    else if (item.normNameAr.startsWith(normQAr) || item.normNameEng.startsWith(normQ)) {
      score = 92;
    }
    // 3. Active Ingredient Starts With or Matches
    else if (item.normActiveIngEng.startsWith(normQ) || (item.normActiveIngAr && item.normActiveIngAr.startsWith(normQAr))) {
      score = 88;
    }
    else if (item.normActiveIngEng.includes(normQ) || (item.normActiveIngAr && item.normActiveIngAr.includes(normQAr))) {
      score = 80;
    }
    // 4. Token & Synonym matches
    else {
      let matchedTokens = 0;
      for (const qToken of queryTokensAr) {
        const syns = expandSynonyms(qToken);
        const matchFound = syns.some(
          (syn) =>
            item.normNameAr.includes(syn) ||
            item.arTokens.some((t) => t.includes(syn)) ||
            item.normNameEng.includes(syn)
        );
        if (matchFound) matchedTokens++;
      }

      if (matchedTokens === queryTokensAr.length && queryTokensAr.length > 0) {
        score = 82;
      } else if (matchedTokens > 0) {
        score = 50 + (matchedTokens / queryTokensAr.length) * 25;
      } else {
        // English token matches
        let matchedEngTokens = 0;
        for (const qToken of queryTokensEng) {
          if (
            item.normNameEng.includes(qToken) ||
            item.normActiveIngEng.includes(qToken) ||
            item.normCategory.includes(qToken)
          ) {
            matchedEngTokens++;
          }
        }
        if (matchedEngTokens === queryTokensEng.length && queryTokensEng.length > 0) {
          score = 78;
        } else if (matchedEngTokens > 0) {
          score = 45 + (matchedEngTokens / queryTokensEng.length) * 20;
        }
      }
    }

    // 5. Fuzzy match for typos if no strong match and query is >= 4 chars
    if (score === 0 && normQ.length >= 4) {
      const dist = levenshteinDistance(normQ, item.normNameEng.substring(0, normQ.length));
      if (dist <= 1) {
        score = 65;
      } else if (dist === 2 && normQ.length >= 6) {
        score = 55;
      }
    }

    // Boost crowd-sourced / doctor-contributed drugs
    if (item.isCrowdSourced && score > 0) {
      score += 5;
    }

    if (score > 0) {
      const existing = scoredMap.get(item.id);
      if (!existing || score > existing.score) {
        scoredMap.set(item.id, { drug: item, score });
      }
    }
  });

  const results = Array.from(scoredMap.values());
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map((r) => r.drug);
}

export function getTotalDrugCount(): number {
  return INDEXED_DRUGS.length;
}

/**
 * Register a newly discovered or doctor-contributed drug into in-memory index
 * and make it instantly searchable to all queries.
 */
export function registerCustomDrug(drugData: {
  name: string;
  nameAr?: string;
  activeIngredient?: string;
  activeIngredientAr?: string;
  dosageForm?: string;
  price?: number;
  company?: string;
  category?: string;
  doctorContributor?: string;
}): DrugRecord {
  const normNameAr = normalizeArabic(drugData.nameAr || drugData.name);
  const normNameEng = drugData.name.toLowerCase().trim();

  // Check if identical drug already exists in memory
  const existing = INDEXED_DRUGS.find(
    (d) => d.normNameEng === normNameEng || (d.normNameAr && d.normNameAr === normNameAr)
  );

  if (existing) {
    return existing;
  }

  const id = `custom-drug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const activeIngredient = drugData.activeIngredient || "تركيبة طبية خاصة / Custom Formula";

  const newDrug: DrugRecord = {
    id,
    name: drugData.name,
    nameAr: drugData.nameAr || drugData.name,
    activeIngredient,
    activeIngredientAr: drugData.activeIngredientAr,
    dosageForm: drugData.dosageForm || "Tablet (قرص)",
    price: drugData.price || 0,
    company: drugData.company || "مساهمة من طبيب في مجتمع PenRX+",
    category: drugData.category || "General Medication",
    isControlled: false,
    sourceOrigin: "Doctor Community",
    isCrowdSourced: true,
    doctorContributor: drugData.doctorContributor || "طبيب ممارس",
  };

  const indexedItem: IndexedDrugRecord = {
    ...newDrug,
    normNameEng,
    normNameAr,
    normActiveIngEng: activeIngredient.toLowerCase().trim(),
    normActiveIngAr: normalizeArabic(drugData.activeIngredientAr || ""),
    normCategory: (newDrug.category || "").toLowerCase().trim(),
    arTokens: normNameAr.split(/\s+/).filter(Boolean),
    engTokens: normNameEng.split(/\s+/).filter(Boolean),
  };

  const newIndex = INDEXED_DRUGS.length;
  INDEXED_DRUGS.push(indexedItem);

  // Register in prefix index
  const registerToken = (token: string) => {
    if (!token) return;
    for (let len = 1; len <= Math.min(5, token.length); len++) {
      const prefix = token.substring(0, len);
      let list = PREFIX_INDEX.get(prefix);
      if (!list) {
        list = [];
        PREFIX_INDEX.set(prefix, list);
      }
      list.push(newIndex);
    }
  };

  indexedItem.arTokens.forEach(registerToken);
  indexedItem.engTokens.forEach(registerToken);

  return newDrug;
}
