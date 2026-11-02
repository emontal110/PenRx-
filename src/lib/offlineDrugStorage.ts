/**
 * Client-Side Offline Drug Storage & Cache (Zero Latency & Fault Tolerant)
 * ───────────────────────────────────────────────────────────────────────────
 * Caches recently searched medications, custom clinic drugs, and essential
 * catalog items locally using IndexedDB + in-memory cache.
 * Supports Progressive Alphabetical Filtering & Drug Eye Wildcard (*) offline!
 */

import { DrugRecord } from "@/types/drug";

const OFFLINE_CACHE_KEY = "penrx_offline_drugs_v1";
const CUSTOM_DRUGS_KEY = "penrx_custom_drugs";
const DB_NAME = "penrx_drugs_db";
const DB_VERSION = 1;
const STORE_NAME = "drugs";
const MAX_CACHED_ITEMS = 600;

export const ESSENTIAL_FALLBACK_DRUGS: DrugRecord[] = [
  { id: "off-pan-adv", name: "Panadol Advance 500mg Tablets", nameAr: "بنادول أدفانس 500 مجم أقراص مسكن وخافض للحرارة", activeIngredient: "Paracetamol 500mg", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 45, isEssential: true },
  { id: "off-pan-ext", name: "Panadol Extra Tablets", nameAr: "بنادول إكسترا أقراص مسكن قوي للصداع", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 52, isEssential: true },
  { id: "off-cat-50", name: "Cataflam 50mg Tablets", nameAr: "كتافلام 50 مجم أقراص مسكن سريع ومضاد للالتهاب", activeIngredient: "Diclofenac Potassium 50mg", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 78, isEssential: true },
  { id: "off-vol-50", name: "Voltaren 50mg Tablets", nameAr: "فولتارين 50 مجم أقراص مسكن ومضاد للروماتيزم", activeIngredient: "Diclofenac Sodium 50mg", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 72, isEssential: true },
  { id: "off-aug-1g", name: "Augmentin 1g Tablets", nameAr: "أوجمنتين 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 145, isEssential: true },
  { id: "off-aug-600", name: "Augmentin ES 600mg Suspension", nameAr: "أوجمنتين إي إس 600 مجم معلق للأطفال", activeIngredient: "Amoxicillin 600mg + Clavulanic Acid", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 98, isEssential: true },
  { id: "off-cur-1g", name: "Curam 1g Tablets", nameAr: "كيورام 1 جم أقراص مضاد حيوي واسع المدى", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "Sandoz", dosageForm: "Tablet", category: "Antibiotic", price: 126, isEssential: true },
  { id: "off-bru-400", name: "Brufen 400mg Tablets", nameAr: "بروفين 400 مجم أقراص مسكن ومضاد للالتهاب", activeIngredient: "Ibuprofen 400mg", company: "Abbott", dosageForm: "Tablet", category: "NSAID", price: 52, isEssential: true },
  { id: "off-ket-50", name: "Ketofan 50mg Capsules", nameAr: "كيتوفان 50 مجم كبسولات مسكن للآلام والروماتيزم", activeIngredient: "Ketoprofen 50mg", company: "Amoun", dosageForm: "Capsule", category: "Analgesic / NSAID", price: 34, isEssential: true },
  { id: "off-ant-cap", name: "Antinal 200mg Capsules", nameAr: "أنتينال 200 مجم كبسولات مطهر معوي للإسهال", activeIngredient: "Nifuroxazide 200mg", company: "Amoun", dosageForm: "Capsule", category: "Gastrointestinal", price: 42, isEssential: true },
  { id: "off-fla-500", name: "Flagyl 500mg Tablets", nameAr: "فلاجيل 500 مجم أقراص مطهر ومضاد للطفيليات", activeIngredient: "Metronidazole 500mg", company: "Sanofi", dosageForm: "Tablet", category: "Antiparasitic", price: 42, isEssential: true },
  { id: "off-con-5", name: "Concor 5mg Tablets", nameAr: "كونكور 5 مجم أقراص لعلاج ضغط الدم والقلب", activeIngredient: "Bisoprolol Fumarate 5mg", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular", price: 75, isEssential: true },
  { id: "off-con-10", name: "Concor 10mg Tablets", nameAr: "كونكور 10 مجم أقراص لارتفاع ضغط الدم", activeIngredient: "Bisoprolol Fumarate 10mg", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular", price: 99, isEssential: true },
  { id: "off-nex-40", name: "Nexium 40mg Tablets", nameAr: "نيكسيوم 40 مجم أقراص لعلاج قرحة المعدة والارتجاع", activeIngredient: "Esomeprazole 40mg", company: "AstraZeneca", dosageForm: "Tablet", category: "Gastrointestinal", price: 165, isEssential: true },
  { id: "off-pan-40", name: "Pantoloc 40mg Tablets", nameAr: "بانتولوك 40 مجم أقراص لعلاج قرحة المعدة", activeIngredient: "Pantoprazole 40mg", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal", price: 95, isEssential: true },
  { id: "off-glu-500", name: "Glucophage 500mg Tablets", nameAr: "جلوكوفاج 500 مجم أقراص لعلاج السكري ومقاومة الإنسولين", activeIngredient: "Metformin Hydrochloride 500mg", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 48, isEssential: true },
  { id: "off-ato-20", name: "Ator 20mg Tablets", nameAr: "أتور 20 مجم أقراص لخفض الكوليسترول", activeIngredient: "Atorvastatin 20mg", company: "EPICO", dosageForm: "Tablet", category: "Cardiovascular", price: 65, isEssential: true },
  { id: "off-daf-500", name: "Daflon 500mg Tablets", nameAr: "دافلوين 500 مجم أقراص لعلاج البواسير والدوالي", activeIngredient: "Micronized Flavonoid Fraction 500mg", company: "Servier", dosageForm: "Tablet", category: "Vascular", price: 98, isEssential: true },
  { id: "off-dus-135", name: "Duspatalin 135mg Tablets", nameAr: "دوسباتالين 135 مجم أقراص للقولون العصبي والانتفاخ", activeIngredient: "Mebeverine Hydrochloride 135mg", company: "Abbott", dosageForm: "Tablet", category: "Antispasmodic", price: 75, isEssential: true },
  { id: "off-zyr-10", name: "Zyrtec 10mg Tablets", nameAr: "زيرتك 10 مجم أقراص لعلاج الحساسية والجيوب الأنفية", activeIngredient: "Cetirizine Dihydrochloride 10mg", company: "GSK", dosageForm: "Tablet", category: "Antihistamine", price: 68, isEssential: true },
  { id: "off-cla-10", name: "Claritine 10mg Tablets", nameAr: "كلاريتين 10 مجم أقراص لعلاج الحساسية والارتيكاريا", activeIngredient: "Loratadine 10mg", company: "Bayer", dosageForm: "Tablet", category: "Antihistamine", price: 62, isEssential: true },
  { id: "off-tel-120", name: "Telfast 120mg Tablets", nameAr: "تيلفاست 120 مجم أقراص لحساسية الأنف والجيوب الأنفية", activeIngredient: "Fexofenadine HCl 120mg", company: "Sanofi", dosageForm: "Tablet", category: "Antihistamine", price: 78, isEssential: true },
  { id: "off-cip-500", name: "Ciprobay 500mg Tablets", nameAr: "سيبروباي 500 مجم أقراص مضاد حيوي للمسالك", activeIngredient: "Ciprofloxacin 500mg", company: "Bayer", dosageForm: "Tablet", category: "Antibiotic", price: 85, isEssential: true },
  { id: "off-zit-500", name: "Zithromax 500mg Capsules", nameAr: "زيثروماكس 500 مجم كبسولات مضاد حيوي 3 أيام", activeIngredient: "Azithromycin 500mg", company: "Pfizer", dosageForm: "Capsule", category: "Antibiotic", price: 115, isEssential: true },
];

let inMemoryDrugsCache: DrugRecord[] = [...ESSENTIAL_FALLBACK_DRUGS];
let isIndexedDbInitialized = false;

function normalizeArOffline(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function readAllFromIndexedDB(db: IDBDatabase): Promise<DrugRecord[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Asynchronously load catalogs into IndexedDB & RAM (Properly awaited so it never refetches unnecessarily)
 */
export async function loadOfflineCatalogAsync(): Promise<void> {
  if (typeof window === "undefined" || isIndexedDbInitialized) return;

  try {
    const db = await openIndexedDB();
    if (db) {
      const storedRecords = await readAllFromIndexedDB(db);
      if (storedRecords.length > 50) {
        const merged = new Map<string, DrugRecord>();
        for (const d of [...ESSENTIAL_FALLBACK_DRUGS, ...storedRecords]) {
          if (d && d.name) merged.set(d.name.toLowerCase().trim(), d);
        }
        inMemoryDrugsCache = Array.from(merged.values());
        isIndexedDbInitialized = true;
        return;
      }
    }

    const res = await fetch("/data/extended-specialty-drugs.json", { cache: "force-cache" });
    if (res.ok) {
      const drugs: DrugRecord[] = await res.json();
      if (Array.isArray(drugs) && drugs.length > 0) {
        const merged = new Map<string, DrugRecord>();
        for (const d of [...ESSENTIAL_FALLBACK_DRUGS, ...drugs]) {
          if (d && d.name) merged.set(d.name.toLowerCase().trim(), d);
        }
        inMemoryDrugsCache = Array.from(merged.values());
        isIndexedDbInitialized = true;

        if (db) {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          for (const d of inMemoryDrugsCache) {
            if (d && d.id) store.put(d);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Async offline drug catalog load completed with fallback:", err);
  }
}

/**
 * Save recently searched drugs to client offline storage WITHOUT overwriting the full in-memory catalog!
 */
export function cacheDrugsLocally(drugs: DrugRecord[]): void {
  if (typeof window === "undefined" || !drugs || drugs.length === 0) return;

  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    const existing: DrugRecord[] = raw ? JSON.parse(raw) : [];

    const localMap = new Map<string, DrugRecord>();
    for (const d of drugs) {
      if (d && d.name) localMap.set(d.name.toLowerCase().trim(), d);
    }
    for (const d of existing) {
      if (d && d.name && !localMap.has(d.name.toLowerCase().trim())) {
        localMap.set(d.name.toLowerCase().trim(), d);
      }
    }

    const combinedLocal = Array.from(localMap.values()).slice(0, MAX_CACHED_ITEMS);
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(combinedLocal));

    // Merge into inMemoryDrugsCache without losing previously loaded catalog items
    const memMap = new Map<string, DrugRecord>();
    for (const d of [...combinedLocal, ...inMemoryDrugsCache, ...ESSENTIAL_FALLBACK_DRUGS]) {
      if (d && d.name) memMap.set(d.name.toLowerCase().trim(), d);
    }
    inMemoryDrugsCache = Array.from(memMap.values());
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * Offline Drug Search supporting Progressive Alphabetical Prefix ("ب" -> "بن") & Drug Eye Wildcard (*)
 */
export function searchOfflineDrugs(query: string, includeActiveIngredient = false): DrugRecord[] {
  if (typeof window === "undefined" || !query.trim()) return [];

  const cleanQ = query.trim();
  const isAr = /[\u0600-\u06FF]/.test(cleanQ);
  const qLower = cleanQ.toLowerCase();
  const qAr = normalizeArOffline(cleanQ);

  let pool: DrugRecord[] = [...inMemoryDrugsCache];

  try {
    const customRaw = localStorage.getItem(CUSTOM_DRUGS_KEY);
    if (customRaw) {
      const customList: DrugRecord[] = JSON.parse(customRaw);
      if (Array.isArray(customList) && customList.length > 0) {
        pool = [...customList, ...pool];
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (raw) {
      const cached: DrugRecord[] = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        pool = [...cached, ...pool];
      }
    }
  } catch {}

  // Build Drug Eye wildcard regex if '*' or spaces are present
  let wildcardRx: RegExp | null = null;
  if (cleanQ.includes("*") || /\s+/.test(cleanQ)) {
    const segs = (isAr ? qAr : qLower)
      .split(/[\s*]+/)
      .filter(Boolean)
      .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    if (segs.length > 0) {
      try {
        wildcardRx = new RegExp(segs.join(".*"), "i");
      } catch {}
    }
  }

  const seen = new Set<string>();
  const scored: { drug: DrugRecord; score: number }[] = [];

  for (const drug of pool) {
    if (!drug || !drug.name) continue;
    const key = drug.name.toLowerCase().trim();
    if (seen.has(key)) continue;

    const nameEn = key;
    const nameAr = normalizeArOffline(drug.nameAr || "");
    const activeEn = (drug.activeIngredient || "").toLowerCase();

    let score = 0;
    if (isAr) {
      if (nameAr.startsWith(qAr)) score = 100;
      else if (cleanQ.length > 2 && (wildcardRx ? wildcardRx.test(nameAr) : nameAr.includes(qAr))) score = 85;
    } else {
      if (nameEn.startsWith(qLower)) score = 100;
      else if (cleanQ.length > 2 && (wildcardRx ? wildcardRx.test(nameEn) : nameEn.includes(qLower))) score = 85;
    }

    if (score === 0 && includeActiveIngredient && activeEn.includes(qLower)) {
      score = 75;
    }

    if (score > 0) {
      seen.add(key);
      scored.push({ drug, score });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (isAr) {
      return (a.drug.nameAr || a.drug.name).localeCompare(b.drug.nameAr || b.drug.name, "ar", { sensitivity: "base" });
    }
    return a.drug.name.localeCompare(b.drug.name, "en", { sensitivity: "base" });
  });

  return scored.slice(0, 25).map((s) => s.drug);
}

/**
 * Register a custom clinic drug locally and sync it to memory cache
 */
export function registerCustomDrug(drugData: {
  name: string;
  nameAr?: string;
  activeIngredient?: string;
  dosageForm?: string;
  company?: string;
  price?: number;
}): DrugRecord {
  const id = `custom-drug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newDrug: DrugRecord = {
    id,
    name: drugData.name.trim(),
    nameAr: (drugData.nameAr || drugData.name).trim(),
    activeIngredient: drugData.activeIngredient || "تركيبة طبية خاصة",
    dosageForm: drugData.dosageForm || "Tablet (قرص)",
    price: drugData.price || 0,
    company: drugData.company || "مساهمة طبيب في مجتمع PenRX+",
    category: "Custom Medication",
    isControlled: false,
    sourceOrigin: "Doctor Community",
    isEssential: false,
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CUSTOM_DRUGS_KEY);
      const list: DrugRecord[] = raw ? JSON.parse(raw) : [];
      const exists = list.some((d) => d.name.toLowerCase().trim() === newDrug.name.toLowerCase());
      if (!exists) {
        list.unshift(newDrug);
        localStorage.setItem(CUSTOM_DRUGS_KEY, JSON.stringify(list.slice(0, 300)));
      }
      inMemoryDrugsCache.unshift(newDrug);
    } catch {}
  }

  return newDrug;
}

export default {
  loadOfflineCatalogAsync,
  cacheDrugsLocally,
  searchOfflineDrugs,
  registerCustomDrug,
  ESSENTIAL_FALLBACK_DRUGS,
};
