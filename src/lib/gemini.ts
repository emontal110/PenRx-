/**
 * Google Gemini Clinical Integration Module (PenRX+)
 * ─────────────────────────────────────────────────────────────
 * Architected for maximum free-tier longevity:
 *  1. Sliding window rate limiter (max 10 calls/min vs 15 RPM limit)
 *  2. In-memory LRU cache with 2-hour TTL (0 duplicate API calls)
 *  3. Silent fallback to local pharmacology engine on 429 or timeout
 *  4. Powered by Google's latest Gemini 3.8 Flash (gemini-flash-latest)
 */

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Rate limiter state (max 10 requests per rolling 60 seconds)
const REQUEST_TIMESTAMPS: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 10;

function canMakeRequest(): boolean {
  const now = Date.now();
  // Clear timestamps older than 60s
  while (REQUEST_TIMESTAMPS.length > 0 && REQUEST_TIMESTAMPS[0] < now - 60000) {
    REQUEST_TIMESTAMPS.shift();
  }
  return REQUEST_TIMESTAMPS.length < MAX_REQUESTS_PER_MINUTE;
}

function recordRequest(): void {
  REQUEST_TIMESTAMPS.push(Date.now());
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

/**
 * Generic Gemini API Caller with caching, rate-limiting, and error tolerance
 */
export async function callGemini(
  prompt: string,
  options: { json?: boolean; cacheKey?: string; timeoutMs?: number } = {}
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  // 1. Check Cache
  const cacheKey = options.cacheKey || prompt;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Check Rate Limit
  if (!canMakeRequest()) {
    console.warn("[Gemini Guard] Free tier rate limit window reached. Falling back to local engine.");
    return null;
  }

  try {
    recordRequest();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const timeout = options.timeoutMs || 4500;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: options.json
          ? { responseMimeType: "application/json", temperature: 0.1 }
          : { temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      console.warn(`[Gemini API] Request returned status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (text) {
      // Store in cache
      CACHE.set(cacheKey, { data: text, timestamp: Date.now() });
      // Keep cache size bounded
      if (CACHE.size > 500) {
        const firstKey = CACHE.keys().next().value;
        if (firstKey) CACHE.delete(firstKey);
      }
    }

    return text;
  } catch (err: any) {
    console.warn("[Gemini API Call Failed]:", err.message);
    return null;
  }
}

/**
 * Deep Clinical Pharmacology Analysis for Prescriptions via Gemini
 */
export async function analyzePrescriptionWithGemini(
  items: Array<{ drugName: string; activeIngredient?: string; doseQuantity?: string; doseForm?: string; frequency?: string; duration?: string }>,
  patientAllergies?: string,
  patientHistory?: string
): Promise<any[] | null> {
  if (!items || items.length === 0) return null;

  // Generate deterministic cache key
  const sortedNames = items.map((i) => `${i.drugName}_${i.frequency || ""}`).sort().join("|");
  const cacheKey = `rx-analysis:${sortedNames}:allergies:${patientAllergies || ""}:hist:${patientHistory || ""}`;

  const drugDescriptions = items
    .map((it, idx) => `${idx + 1}. ${it.drugName} (Active: ${it.activeIngredient || "N/A"}) - Dose: ${it.doseQuantity || "1"} ${it.doseForm || ""} - Frequency: ${it.frequency || "daily"}`)
    .join("\n");

  const prompt = `You are a world-class Clinical Pharmacologist. Analyze this medical prescription for drug-drug interactions, duplicate therapies, allergy contraindications, and patient safety hazards.
Patient Allergies: ${patientAllergies || "None reported"}
Patient Medical History: ${patientHistory || "None reported"}

Prescribed Medications:
${drugDescriptions}

Analyze thoroughly. If there are interactions, return a valid JSON object matching this schema:
{
  "interactions": [
    {
      "severity": "CRITICAL" | "HIGH" | "MODERATE",
      "titleAr": "عنوان التنبيه بالعربية بدقة طبية مع اسم العائلة الدوائية بالإنجليزي",
      "titleEn": "Alert Title in English",
      "mechanismAr": "الشرح العلمي الدقيق للآلية الحيوية والفارماكولوجية وكيف تؤثر على المريض بالعربية الفصحى",
      "recommendationAr": "التوصية السريرية والبديل العلاجي الآمن الذي يقترحه الطبيب الصيدلي",
      "involvedDrugs": ["DrugName1", "DrugName2"]
    }
  ]
}
If the prescription is safe and has no significant interactions, return:
{
  "interactions": []
}`;

  const jsonText = await callGemini(prompt, { json: true, cacheKey, timeoutMs: 5000 });
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed.interactions) ? parsed.interactions : [];
  } catch {
    return null;
  }
}

/**
 * Synthesize unknown drug data and suggest candidate formulations via Gemini
 */
export async function suggestDrugWithGemini(query: string): Promise<any[] | null> {
  const cleanQ = query.trim();
  if (cleanQ.length < 3) return null;

  const cacheKey = `drug-suggest:${cleanQ.toLowerCase()}`;
  const prompt = `Act as an expert pharmaceutical catalog specialist. A doctor is searching for medication: "${cleanQ}".
Identify the drug, active ingredient, standard dosage forms, typical clinical dose, and therapeutic category.
Return a valid JSON object matching:
{
  "suggestions": [
    {
      "name": "Commercial Brand Name and Strength (e.g. Panadol Extra 500mg/65mg)",
      "nameAr": "الاسم التجاري بالعربية (مثال: بنادول إكسترا أقراص)",
      "activeIngredient": "Active chemical entity and strength",
      "activeIngredientAr": "المادة الفعالة بالعربية",
      "category": "Therapeutic Category (e.g. Analgesic / NSAID)",
      "dosageForm": "Tablet / Capsule / Syrup / Injection / etc.",
      "recommendedDose": "الجرعة الشائعة الموصى بها بالعربية (مثال: قرص كل 8 ساعات بعد الأكل)",
      "confidence": "High"
    }
  ]
}
Return up to 3 candidate formulations. If the query does not resemble any medical product, return: { "suggestions": [] }`;

  const jsonText = await callGemini(prompt, { json: true, cacheKey, timeoutMs: 4000 });
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  } catch {
    return null;
  }
}
