/**
 * Client-Side Offline Drug Storage & Cache (Zero Latency & Fault Tolerant)
 * ───────────────────────────────────────────────────────────────────────────
 * Caches recently searched medications, custom clinic drugs, and essential
 * catalog items locally using IndexedDB + in-memory cache.
 * Guarantees doctors can search and write prescriptions even if offline.
 */

import { DrugRecord } from "@/types/drug";

const OFFLINE_CACHE_KEY = "penrx_offline_drugs_v1";
const CUSTOM_DRUGS_KEY = "penrx_custom_drugs";
const DB_NAME = "penrx_drugs_db";
const DB_VERSION = 1;
const STORE_NAME = "drugs";
const MAX_CACHED_ITEMS = 500;

// High-frequency Egyptian & regional essential medications to guarantee offline availability
export const ESSENTIAL_FALLBACK_DRUGS: DrugRecord[] = [
  { id: "off-pan-adv", name: "Panadol Advance 500mg Tablets", nameAr: "بنادول أدفانس 500 مجم أقراص مسكن وخافض للحرارة", activeIngredient: "Paracetamol 500mg", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 45, isEssential: true },
  { id: "off-pan-ext", name: "Panadol Extra Tablets", nameAr: "بنادول إكسترا أقراص مسكن قوي للصداع", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 52, isEssential: true },
  { id: "off-cat-50", name: "Cataflam 50mg Tablets", nameAr: "كتافلام 50 مجم أقراص مسكن سريع ومضاد للالتهاب", activeIngredient: "Diclofenac Potassium 50mg", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 63, isEssential: true },
  { id: "off-vol-50", name: "Voltaren 50mg Tablets", nameAr: "فولتارين 50 مجم أقراص مسكن ومضاد للروماتيزم", activeIngredient: "Diclofenac Sodium 50mg", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 58, isEssential: true },
  { id: "off-aug-1g", name: "Augmentin 1g Tablets", nameAr: "أوجمنتين 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 110, isEssential: true },
  { id: "off-cur-1g", name: "Curam 1g Tablets", nameAr: "كيورام 1 جم أقراص مضاد حيوي واسع المدى", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", company: "Sandoz", dosageForm: "Tablet", category: "Antibiotic", price: 98, isEssential: true },
  { id: "off-bru-400", name: "Brufen 400mg Tablets", nameAr: "بروفين 400 مجم أقراص مسكن ومضاد للالتهاب", activeIngredient: "Ibuprofen 400mg", company: "Abbott", dosageForm: "Tablet", category: "NSAID", price: 42, isEssential: true },
  { id: "off-ket-50", name: "Ketofan 50mg Capsules", nameAr: "كيتوفان 50 مجم كبسولات مسكن للآلام والروماتيزم", activeIngredient: "Ketoprofen 50mg", company: "Amoun", dosageForm: "Capsule", category: "Analgesic / NSAID", price: 34, isEssential: true },
  { id: "off-ant-cap", name: "Antinal 200mg Capsules", nameAr: "أنتينال 200 مجم كبسولات مطهر معوي للإسهال", activeIngredient: "Nifuroxazide 200mg", company: "Amoun", dosageForm: "Capsule", category: "Gastrointestinal", price: 32, isEssential: true },
  { id: "off-fla-500", name: "Flagyl 500mg Tablets", nameAr: "فلاجيل 500 مجم أقراص مطهر ومضاد للطفيليات", activeIngredient: "Metronidazole 500mg", company: "Sanofi", dosageForm: "Tablet", category: "Antiparasitic", price: 35, isEssential: true },
  { id: "off-con-5", name: "Concor 5mg Tablets", nameAr: "كونكور 5 مجم أقراص لعلاج ضغط الدم والقلب", activeIngredient: "Bisoprolol Fumarate 5mg", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular", price: 62, isEssential: true },
  { id: "off-nex-40", name: "Nexium 40mg Tablets", nameAr: "نيكسيوم 40 مجم أقراص لعلاج قرحة المعدة والارتجاع", activeIngredient: "Esomeprazole 40mg", company: "AstraZeneca", dosageForm: "Tablet", category: "Gastrointestinal", price: 135, isEssential: true },
  { id: "off-pan-40", name: "Pantoloc 40mg Tablets", nameAr: "بانتولوك 40 مجم أقراص لعلاج قرحة المعدة", activeIngredient: "Pantoprazole 40mg", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal", price: 82, isEssential: true },
  { id: "off-glu-500", name: "Glucophage 500mg Tablets", nameAr: "جلوكوفاج 500 مجم أقراص لعلاج السكري ومقاومة الإنسولين", activeIngredient: "Metformin Hydrochloride 500mg", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 36, isEssential: true },
  { id: "off-ato-20", name: "Ator 20mg Tablets", nameAr: "أتور 20 مجم أقراص لخفض الكوليسترول", activeIngredient: "Atorvastatin 20mg", company: "EPICO", dosageForm: "Tablet", category: "Cardiovascular", price: 56, isEssential: true },
  { id: "off-daf-500", name: "Daflon 500mg Tablets", nameAr: "دافلوين 500 مجم أقراص لعلاج البواسير والدوالي", activeIngredient: "Micronized Flavonoid Fraction 500mg", company: "Servier", dosageForm: "Tablet", category: "Vascular", price: 84, isEssential: true },
  { id: "off-dus-135", name: "Duspatalin 135mg Tablets", nameAr: "دوسباتالين 135 مجم أقراص للقولون العصبي والانتفاخ", activeIngredient: "Mebeverine Hydrochloride 135mg", company: "Abbott", dosageForm: "Tablet", category: "Antispasmodic", price: 65, isEssential: true },
  { id: "off-zyr-10", name: "Zyrtec 10mg Tablets", nameAr: "زيرتك 10 مجم أقراص لعلاج الحساسية والجيوب الأنفية", activeIngredient: "Cetirizine Dihydrochloride 10mg", company: "GSK", dosageForm: "Tablet", category: "Antihistamine", price: 58, isEssential: true },
  { id: "off-cla-10", name: "Claritine 10mg Tablets", nameAr: "كلاريتين 10 مجم أقراص لعلاج الحساسية والارتيكاريا", activeIngredient: "Loratadine 10mg", company: "Bayer", dosageForm: "Tablet", category: "Antihistamine", price: 54, isEssential: true },
  { id: "off-tel-120", name: "Telfast 120mg Tablets", nameAr: "تيلفاست 120 مجم أقراص لحساسية الأنف والجيوب الأنفية", activeIngredient: "Fexofenadine HCl 120mg", company: "Sanofi", dosageForm: "Tablet", category: "Antihistamine", price: 68, isEssential: true },
  { id: "off-cip-500", name: "Ciprobay 500mg Tablets", nameAr: "سيبروباي 500 مجم أقراص مضاد حيوي للمسالك", activeIngredient: "Ciprofloxacin 500mg", company: "Bayer", dosageForm: "Tablet", category: "Antibiotic", price: 75, isEssential: true },
  { id: "off-zit-500", name: "Zithromax 500mg Capsules", nameAr: "زيثروماكس 500 مجم كبسولات مضاد حيوي 3 أيام", activeIngredient: "Azithromycin 500mg", company: "Pfizer", dosageForm: "Capsule", category: "Antibiotic", price: 88, isEssential: true },
];

// In-Memory cache for superfast search
let inMemoryDrugsCache: DrugRecord[] = [...ESSENTIAL_FALLBACK_DRUGS];
let isIndexedDbInitialized = false;

/**
 * Open IndexedDB safely
 */
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

/**
 * Asynchronously load catalogs from /data/ in the background (Non-blocking)
 */
export async function loadOfflineCatalogAsync(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    // 1. Try to load from IndexedDB first
    const db = await openIndexedDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 50) {
          inMemoryDrugsCache = req.result;
          isIndexedDbInitialized = true;
        }
      };
    }

    // 2. Fetch extended specialty catalog asynchronously if not yet stored
    if (!isIndexedDbInitialized) {
      const res = await fetch("/data/extended-specialty-drugs.json", { cache: "default" });
      if (res.ok) {
        const drugs: DrugRecord[] = await res.json();
        if (Array.isArray(drugs) && drugs.length > 0) {
          inMemoryDrugsCache = [...drugs, ...ESSENTIAL_FALLBACK_DRUGS];
          // Save into IndexedDB in background
          if (db) {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            for (const d of inMemoryDrugsCache) {
              if (d && d.id) store.put(d);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Async offline drug catalog load completed with fallback:", err);
  }
}

/**
 * Save drugs to client offline storage
 */
export function cacheDrugsLocally(drugs: DrugRecord[]): void {
  if (typeof window === "undefined" || !drugs || drugs.length === 0) return;

  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    const existing: DrugRecord[] = raw ? JSON.parse(raw) : [];

    const map = new Map<string, DrugRecord>();
    for (const d of existing) map.set(d.name.toLowerCase().trim(), d);
    for (const d of drugs) map.set(d.name.toLowerCase().trim(), d);

    const combined = Array.from(map.values()).slice(0, MAX_CACHED_ITEMS);
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(combined));

    // Also update in-memory cache
    inMemoryDrugsCache = [...combined, ...ESSENTIAL_FALLBACK_DRUGS];
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * Search drugs in client offline cache (Max 25 results to prevent DOM Lag)
 */
export function searchOfflineDrugs(query: string, includeActiveIngredient = false): DrugRecord[] {
  if (typeof window === "undefined" || !query.trim()) return [];

  const q = query.trim().toLowerCase();
  let pool: DrugRecord[] = inMemoryDrugsCache;

  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (raw) {
      const cached: DrugRecord[] = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        pool = [...cached, ...inMemoryDrugsCache];
      }
    }
  } catch {
    // fallback to in-memory list
  }

  // Also include custom drugs if any
  try {
    const customRaw = localStorage.getItem(CUSTOM_DRUGS_KEY);
    if (customRaw) {
      const customList: DrugRecord[] = JSON.parse(customRaw);
      if (Array.isArray(customList) && customList.length > 0) {
        pool = [...customList, ...pool];
      }
    }
  } catch {}

  const seen = new Set<string>();
  const results: DrugRecord[] = [];

  for (const drug of pool) {
    if (!drug || seen.has(drug.id)) continue;
    const nameMatch = drug.name.toLowerCase().includes(q) || (drug.nameAr && drug.nameAr.toLowerCase().includes(q));
    const activeMatch = includeActiveIngredient && drug.activeIngredient && drug.activeIngredient.toLowerCase().includes(q);

    if (nameMatch || activeMatch) {
      seen.add(drug.id);
      results.push(drug);
      if (results.length >= 25) break;
    }
  }

  return results.slice(0, 25);
}

/**
 * Register a custom clinic drug locally without importing the huge server bundle
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
    name: drugData.name,
    nameAr: drugData.nameAr || drugData.name,
    activeIngredient: drugData.activeIngredient || "تركيبة طبية خاصة",
    dosageForm: drugData.dosageForm || "Tablet (قرص)",
    price: drugData.price || 0,
    company: drugData.company || "عيادة الطبيب",
    category: "Custom Medication",
    isControlled: false,
    sourceOrigin: "Doctor Community",
    isEssential: false,
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CUSTOM_DRUGS_KEY);
      const list: DrugRecord[] = raw ? JSON.parse(raw) : [];
      list.unshift(newDrug);
      localStorage.setItem(CUSTOM_DRUGS_KEY, JSON.stringify(list));
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
