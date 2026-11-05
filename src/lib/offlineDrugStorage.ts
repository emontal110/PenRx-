/**
 * Client-Side Offline Drug Storage & Cache (Zero Latency & Fault Tolerant)
 * ───────────────────────────────────────────────────────────────────────────
 * Caches recently searched medications, custom clinic drugs, and verified
 * catalog items locally using IndexedDB + in-memory cache.
 */

import { DrugRecord } from "@/types/drug";

const OFFLINE_CACHE_KEY = "penrx_offline_drugs_v26";
const CUSTOM_DRUGS_KEY = "penrx_custom_drugs";
const DB_NAME = "penrx_drugs_db_v26";
const DB_VERSION = 1;
const STORE_NAME = "drugs";
const MAX_CACHED_ITEMS = 600;

export const ESSENTIAL_FALLBACK_DRUGS: DrugRecord[] = [
  { id: "off-pan-adv", name: "Panadol Advance 500mg 24 Tablets", nameAr: "بنادول أدفانس 500 مجم 24 قرص مسكن وخافض للحرارة", activeIngredient: "Paracetamol 500mg", company: "GSK / Haleon", dosageForm: "Tablet (قرص)", category: "Analgesic / Antipyretic", price: 60, isEssential: true },
  { id: "off-pan-ext", name: "Panadol Extra 24 Tablets", nameAr: "بنادول إكسترا 24 قرص مسكن قوي للصداع", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", company: "GSK / Haleon", dosageForm: "Tablet (قرص)", category: "Analgesic / Antipyretic", price: 70, isEssential: true },
  { id: "off-cat-50", name: "Cataflam 50mg 20 Tablets", nameAr: "كتافلام 50 مجم 20 قرص مسكن سريع ومضاد للالتهاب", activeIngredient: "Diclofenac Potassium 50mg", company: "Novartis", dosageForm: "Tablet (قرص)", category: "Analgesic / NSAID", price: 86, isEssential: true },
  { id: "off-vol-50", name: "Voltaren 50mg 20 Tablets", nameAr: "فولتارين 50 مجم 20 قرص مسكن ومضاد للروماتيزم", activeIngredient: "Diclofenac Sodium 50mg", company: "Novartis", dosageForm: "Tablet (قرص)", category: "Analgesic / NSAID", price: 76, isEssential: true },
  { id: "off-aug-1g", name: "Augmentin 1g 14 Tablets", nameAr: "أوجمنتين 1 جم 14 قرص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "GSK", dosageForm: "Tablet (قرص)", category: "Antibiotic", price: 172, isEssential: true },
  { id: "off-aug-600", name: "Augmentin ES 600mg Suspension", nameAr: "أوجمنتين إي إس 600 مجم معلق للأطفال", activeIngredient: "Amoxicillin 600mg + Clavulanic Acid", company: "GSK", dosageForm: "Suspension (معلق)", category: "Antibiotic", price: 132, isEssential: true },
  { id: "off-cur-1g", name: "Curam 1g 14 Tablets", nameAr: "كيورام 1 جم 14 قرص مضاد حيوي واسع المدى", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "Sandoz", dosageForm: "Tablet (قرص)", category: "Antibiotic", price: 146, isEssential: true },
  { id: "off-bru-400", name: "Brufen 400mg 30 Tablets", nameAr: "بروفين 400 مجم 30 قرص مسكن ومضاد للالتهاب", activeIngredient: "Ibuprofen 400mg", company: "Abbott / Kahira", dosageForm: "Tablet (قرص)", category: "NSAID", price: 78, isEssential: true },
  { id: "off-ket-50", name: "Ketofan 50mg 20 Capsules", nameAr: "كيتوفان 50 مجم 20 كبسولة مسكن للآلام والروماتيزم", activeIngredient: "Ketoprofen 50mg", company: "Amoun", dosageForm: "Capsule (كبسولة)", category: "Analgesic / NSAID", price: 36, isEssential: true },
  { id: "off-ant-cap", name: "Antinal 200mg 24 Capsules", nameAr: "أنتينال 200 مجم 24 كبسولة مطهر معوي للإسهال", activeIngredient: "Nifuroxazide 200mg", company: "Amoun", dosageForm: "Capsule (كبسولة)", category: "Gastrointestinal", price: 52, isEssential: true },
  { id: "off-fla-500", name: "Flagyl 500mg 20 Tablets", nameAr: "فلاجيل 500 مجم 20 قرص مطهر ومضاد للطفيليات", activeIngredient: "Metronidazole 500mg", company: "Sanofi", dosageForm: "Tablet (قرص)", category: "Antiparasitic", price: 49, isEssential: true },
  { id: "off-con-5", name: "Concor 5mg 30 Tablets", nameAr: "كونكور 5 مجم 30 قرص لعلاج ضغط الدم والقلب", activeIngredient: "Bisoprolol Fumarate 5mg", company: "Merck", dosageForm: "Tablet (قرص)", category: "Cardiovascular", price: 84, isEssential: true },
  { id: "off-con-10", name: "Concor 10mg 30 Tablets", nameAr: "كونكور 10 مجم 30 قرص لارتفاع ضغط الدم", activeIngredient: "Bisoprolol Fumarate 10mg", company: "Merck", dosageForm: "Tablet (قرص)", category: "Cardiovascular", price: 117, isEssential: true },
  { id: "off-nex-40", name: "Nexium 40mg 28 Tablets", nameAr: "نيكسيوم 40 مجم 28 قرص لعلاج قرحة المعدة والارتجاع", activeIngredient: "Esomeprazole 40mg", company: "AstraZeneca", dosageForm: "Tablet (قرص)", category: "Gastrointestinal", price: 336, isEssential: true },
  { id: "off-pan-40", name: "Pantoloc 40mg 14 Tablets", nameAr: "بانتولوك 40 مجم 14 قرص لعلاج قرحة المعدة", activeIngredient: "Pantoprazole 40mg", company: "MUP / Takeda", dosageForm: "Tablet (قرص)", category: "Gastrointestinal", price: 112, isEssential: true },
  { id: "off-glu-1000", name: "Glucophage 1000mg 30 Tablets", nameAr: "جلوكوفاج 1000 مجم 30 قرص لعلاج السكري ومقاومة الإنسولين", activeIngredient: "Metformin Hydrochloride 1000mg", company: "Merck", dosageForm: "Tablet (قرص)", category: "Antidiabetic", price: 78, isEssential: true },
  { id: "off-ato-20", name: "Ator 20mg 14 Tablets", nameAr: "أتور 20 مجم 14 قرص لخفض الكوليسترول", activeIngredient: "Atorvastatin 20mg", company: "EIPICO", dosageForm: "Tablet (قرص)", category: "Cardiovascular", price: 72, isEssential: true },
  { id: "off-daf-500", name: "Daflon 500mg 30 Tablets", nameAr: "دافلون 500 مجم 30 قرص لعلاج البواسير والدوالي", activeIngredient: "Micronized Flavonoid Fraction 500mg", company: "Servier", dosageForm: "Tablet (قرص)", category: "Vascular", price: 168, isEssential: true },
  { id: "off-dus-200", name: "Duspatalin Retard 200mg 30 Capsules", nameAr: "دوسباتالين ريتارد 200 مجم 30 كبسولة للقولون العصبي", activeIngredient: "Mebeverine Hydrochloride 200mg", company: "Abbott", dosageForm: "Capsule (كبسولة)", category: "Antispasmodic", price: 129, isEssential: true },
  { id: "off-zyr-10", name: "Zyrtec 10mg 20 Tablets", nameAr: "زيرتك 10 مجم 20 قرص لعلاج الحساسية والجيوب الأنفية", activeIngredient: "Cetirizine Dihydrochloride 10mg", company: "GSK / UCB", dosageForm: "Tablet (قرص)", category: "Antihistamine", price: 100, isEssential: true },
  { id: "off-cla-10", name: "Claritine 10mg 20 Tablets", nameAr: "كلاريتين 10 مجم 20 قرص لعلاج الحساسية والارتيكاريا", activeIngredient: "Loratadine 10mg", company: "Bayer", dosageForm: "Tablet (قرص)", category: "Antihistamine", price: 92, isEssential: true },
  { id: "off-tel-180", name: "Telfast 180mg 20 Tablets", nameAr: "تيلفاست 180 مجم 20 قرص لحساسية الأنف والجيوب الأنفية", activeIngredient: "Fexofenadine HCl 180mg", company: "Sanofi", dosageForm: "Tablet (قرص)", category: "Antihistamine", price: 150, isEssential: true },
  { id: "off-cip-500", name: "Ciprobay 500mg 10 Tablets", nameAr: "سيبروباي 500 مجم 10 أقراص مضاد حيوي للمسالك", activeIngredient: "Ciprofloxacin 500mg", company: "Bayer / Hikma", dosageForm: "Tablet (قرص)", category: "Antibiotic", price: 118, isEssential: true },
  { id: "off-zit-500", name: "Zithromax 500mg 3 Tablets", nameAr: "زيثروماكس 500 مجم 3 أقراص مضاد حيوي 3 أيام", activeIngredient: "Azithromycin 500mg", company: "Pfizer", dosageForm: "Tablet (قرص)", category: "Antibiotic", price: 142, isEssential: true },
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

export async function loadOfflineCatalogAsync(): Promise<void> {
  if (typeof window === "undefined" || isIndexedDbInitialized) return;

  try {
    // Clean legacy v1 cache that contained synthetic items
    try {
      localStorage.removeItem("penrx_offline_drugs_v1");
    } catch {}

    const db = await openIndexedDB();
    if (db) {
      const storedRecords = await readAllFromIndexedDB(db);
      if (storedRecords.length > 50) {
        const merged = new Map<string, DrugRecord>();
        for (const d of [...ESSENTIAL_FALLBACK_DRUGS, ...storedRecords]) {
          if (d && d.name && !String(d.id || "").startsWith("eda-drug-")) {
            merged.set(d.name.toLowerCase().trim(), d);
          }
        }
        inMemoryDrugsCache = Array.from(merged.values());
        isIndexedDbInitialized = true;
        return;
      }
    }

    const res = await fetch("/data/extended-specialty-drugs.json", { cache: "no-cache" });
    if (res.ok) {
      const drugs: DrugRecord[] = await res.json();
      if (Array.isArray(drugs) && drugs.length > 0) {
        const merged = new Map<string, DrugRecord>();
        for (const d of [...ESSENTIAL_FALLBACK_DRUGS, ...drugs]) {
          if (d && d.name && !String(d.id || "").startsWith("eda-drug-")) {
            merged.set(d.name.toLowerCase().trim(), d);
          }
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

export function cacheDrugsLocally(drugs: DrugRecord[]): void {
  if (typeof window === "undefined" || !drugs || drugs.length === 0) return;

  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    const existing: DrugRecord[] = raw ? JSON.parse(raw) : [];

    const localMap = new Map<string, DrugRecord>();
    for (const d of drugs) {
      if (d && d.name && !String(d.id || "").startsWith("eda-drug-")) {
        localMap.set(d.name.toLowerCase().trim(), d);
      }
    }
    for (const d of existing) {
      if (d && d.name && !String(d.id || "").startsWith("eda-drug-") && !localMap.has(d.name.toLowerCase().trim())) {
        localMap.set(d.name.toLowerCase().trim(), d);
      }
    }

    const combinedLocal = Array.from(localMap.values()).slice(0, MAX_CACHED_ITEMS);
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(combinedLocal));

    const memMap = new Map<string, DrugRecord>();
    for (const d of [...combinedLocal, ...inMemoryDrugsCache, ...ESSENTIAL_FALLBACK_DRUGS]) {
      if (d && d.name) memMap.set(d.name.toLowerCase().trim(), d);
    }
    inMemoryDrugsCache = Array.from(memMap.values());
  } catch {}
}

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
    if (!drug || !drug.name || String(drug.id || "").startsWith("eda-drug-")) continue;
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
