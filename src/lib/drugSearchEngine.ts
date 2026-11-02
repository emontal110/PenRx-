import comprehensiveCatalog from "@/data/comprehensive-drugs.json";
import extendedSpecialtyCatalog from "@/data/extended-specialty-drugs.json";

import type { DrugRecord } from "@/types/drug";
export type { DrugRecord } from "@/types/drug";

interface IndexedDrugRecord extends DrugRecord {
  normNameEng: string;
  normNameAr: string;
  normActiveIngEng: string;
  normActiveIngAr: string;
  normCategory: string;
  canonicalKey: string;
  arTokens: string[];
  engTokens: string[];
}

/**
 * Enhanced Arabic Text Normalization (handles Alef/Hamza, Ta Marbuta, Ya, Tashkeel)
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // remove Tashkeel & Tatweel
    .replace(/[^\w\s\u0600-\u06FF*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical deduplication key to prevent duplicate drugs across local, Egyptian API, and global sources
 */
export function normalizeDrugCanonicalKey(name: string, dosageForm?: string): string {
  const cleanName = (name || "")
    .toLowerCase()
    .replace(/\b(f\.?c\.?|s\.?r\.?|x\.?r\.?|tabs?|tablets?|caps?|capsules?|syrup|susp|suspension|amp|ampoules?|vials?)\b/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "")
    .trim();
  const cleanForm = (dosageForm || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "")
    .slice(0, 4);
  return `${cleanName}|${cleanForm}`;
}

/**
 * Transliterates Arabic phonetic search queries into an English regex pattern
 * so searching "كونكور" or "أوجمنتين" or "بانادول" also matches English trade names if Arabic alias is absent.
 */
export function arabicToEnglishPhoneticRegex(arQuery: string): RegExp | null {
  const norm = normalizeArabic(arQuery).replace(/[*]/g, "");
  if (!norm || norm.length < 2 || !/[\u0600-\u06FF]/.test(norm)) return null;

  const charMap: Record<string, string> = {
    ا: "[aeiouv]*",
    ب: "[bp]+",
    ت: "t+",
    ث: "(th|s|t)+",
    ج: "[jg]+",
    ح: "h+",
    خ: "(kh|k|x)+",
    د: "d+",
    ذ: "(z|th|d)+",
    ر: "r+",
    ز: "[zs]+",
    س: "[sc]+",
    ش: "(sh|ch|s)+",
    ص: "[sc]+",
    ض: "d+",
    ط: "t+",
    ظ: "z+",
    ع: "[aeo]*",
    غ: "(gh|g)+",
    ف: "(f|ph|v)+",
    ق: "[qkc]+",
    ك: "[ckq]+",
    ل: "l+",
    م: "m+",
    ن: "n+",
    ه: "h*",
    و: "[ouwv]*",
    ي: "[iey]*",
  };

  let pattern = "^[aeiou]*";
  for (const ch of norm) {
    if (ch === " ") {
      pattern += ".*";
    } else if (charMap[ch]) {
      pattern += charMap[ch] + "[aeiouy]*";
    } else if (/[0-9]/.test(ch)) {
      pattern += ch;
    }
  }
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/**
 * Calculate Damerau-Levenshtein distance for fuzzy matching.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = [];
  for (let i = 0; i <= al; i++) d[i] = [i];
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[al][bl];
}

/**
 * Clean mixed Arabic-English drug names into pure, professional medical Arabic
 */
export function cleanArabicDrugName(nameAr?: string): string {
  if (!nameAr) return "";
  return nameAr
    .replace(/\bChewable Tablets?\b/gi, "أقراص للمضغ")
    .replace(/\bXR Tablets?\b/gi, "أقراص ممتدة المفعول")
    .replace(/\bSR Tablets?\b/gi, "أقراص ممتدة الإفراز")
    .replace(/\bTablets?\b/gi, "أقراص")
    .replace(/\bCapsules?\b/gi, "كبسولات")
    .replace(/\bTopical Gel\b/gi, "جل موضعي")
    .replace(/\bGel\b/gi, "جل")
    .replace(/\bEye Ointment\b/gi, "مرهم للعين")
    .replace(/\bOintment\b/gi, "مرهم")
    .replace(/\bEye Drops\b/gi, "قطرة للعين")
    .replace(/\bEar Drops\b/gi, "قطرة للأذن")
    .replace(/\bOral Drops\b/gi, "نقط بالفم")
    .replace(/\bDrops\b/gi, "نقط")
    .replace(/\bNasal Spray\b/gi, "بخاخ للأنف")
    .replace(/\bSpray\b/gi, "بخاخ")
    .replace(/\bOral Liquid\b/gi, "شراب / سائل")
    .replace(/\bVials?\b/gi, "فيال حقن")
    .replace(/\bAmpoules?\b/gi, "أمبول")
    .replace(/\bSuppositories\b/gi, "لبوس")
    .replace(/\bCream\b/gi, "كريم")
    .replace(/\bSuspension\b/gi, "معلق")
    .replace(/\bSyrup\b/gi, "شراب")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Essential Popular Regional Brand Medications ─────────────────────────────
const ESSENTIAL_POPULAR_DRUGS: DrugRecord[] = [
  { id: "pan-adv-500", name: "Panadol Advance 500mg Tablets", nameAr: "بنادول أدفانس 500 مجم أقراص", activeIngredient: "Paracetamol 500mg", activeIngredientAr: "باراسيتامول 500 مجم", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-ext-tab", name: "Panadol Extra Tablets", nameAr: "بنادول إكسترا أقراص مسكن للصداع", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", activeIngredientAr: "باراسيتامول + كافيين", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 52, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-jnt-tab", name: "Panadol Joint 665mg Tablets", nameAr: "بنادول جوينت للمفاصل 665 مجم", activeIngredient: "Paracetamol 665mg", activeIngredientAr: "باراسيتامول 665 مجم ممتد المفعول", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-nig-tab", name: "Panadol Night Tablets", nameAr: "بنادول نايت أقراص للنوم والألم", activeIngredient: "Paracetamol 500mg + Diphenhydramine 25mg", activeIngredientAr: "باراسيتامول + ديفينهيدرامين", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 55, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-cold-day", name: "Panadol Cold & Flu Day Tablets", nameAr: "بنادول كولد أند فلو داي (أصفر)", activeIngredient: "Paracetamol + Phenylephrine + Caffeine", activeIngredientAr: "باراسيتامول + فينيل إفرين", company: "GSK", dosageForm: "Tablet", category: "Cold & Flu", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-cold-all", name: "Panadol Cold & Flu All in One", nameAr: "بنادول كولد أند فلو الكل في واحد", activeIngredient: "Paracetamol + Phenylephrine + Guaifenesin", activeIngredientAr: "باراسيتامول + طارد للبلغم", company: "GSK", dosageForm: "Tablet", category: "Cold & Flu", price: 62, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-baby-syr", name: "Panadol Baby & Infant 100ml Syrup", nameAr: "بنادول شراب للأطفال والرضع", activeIngredient: "Paracetamol 120mg/5ml", activeIngredientAr: "باراسيتامول شراب للأطفال", company: "GSK", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-200-tab", name: "Brufen 200mg Tablets", nameAr: "بروفين 200 مجم أقراص مسكن للألم", activeIngredient: "Ibuprofen 200mg", activeIngredientAr: "إيبوبروفين 200 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-400-tab", name: "Brufen 400mg Tablets", nameAr: "بروفين 400 مجم أقراص مسكن ومضاد للالتهاب", activeIngredient: "Ibuprofen 400mg", activeIngredientAr: "إيبوبروفين 400 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 52, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-600-tab", name: "Brufen 600mg Tablets", nameAr: "بروفين 600 مجم أقراص مسكن قوي ومضاد للروماتيزم", activeIngredient: "Ibuprofen 600mg", activeIngredientAr: "إيبوبروفين 600 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-800-ret", name: "Brufen Retard 800mg Tablets", nameAr: "بروفين ريتارد 800 مجم ممتد المفعول", activeIngredient: "Ibuprofen 800mg SR", activeIngredientAr: "إيبوبروفين 800 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 75, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-syr-100", name: "Brufen 100mg/5ml Syrup", nameAr: "بروفين شراب للأطفال خافض حرارة ومسكن", activeIngredient: "Ibuprofen 100mg/5ml", activeIngredientAr: "إيبوبروفين شراب", company: "Abbott", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "busc-10-tab", name: "Buscopan 10mg Tablets", nameAr: "بوسكوبان 10 مجم أقراص للتقلصات والمغص", activeIngredient: "Hyoscine Butylbromide 10mg", activeIngredientAr: "هيوسين بيوتيل بروميد", company: "Sanofi", dosageForm: "Tablet", category: "Antispasmodic", price: 34, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "busc-pls-tab", name: "Buscopan Plus Tablets", nameAr: "بوسكوبان بلس أقراص للمغص والمسكن", activeIngredient: "Hyoscine Butylbromide 10mg + Paracetamol 500mg", activeIngredientAr: "هيوسين + باراسيتامول", company: "Sanofi", dosageForm: "Tablet", category: "Antispasmodic", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "panto-20-tab", name: "Pantoloc 20mg Tablets", nameAr: "بانتولوك 20 مجم أقراص للمعدة والحموضة", activeIngredient: "Pantoprazole 20mg", activeIngredientAr: "بانتوبرازول 20 مجم", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "panto-40-tab", name: "Pantoloc 40mg Tablets", nameAr: "بانتولوك 40 مجم أقراص لعلاج قرحة المعدة", activeIngredient: "Pantoprazole 40mg", activeIngredientAr: "بانتوبرازول 40 مجم", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 95, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-1g-tab", name: "Augmentin 1g Tablets", nameAr: "أوجمنتين 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 145, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-625-tab", name: "Augmentin 625mg Tablets", nameAr: "أوجمنتين 625 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 500mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 110, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-es-600", name: "Augmentin ES 600mg Suspension", nameAr: "أوجمنتين إي إس 600 مجم معلق للأطفال", activeIngredient: "Amoxicillin 600mg + Clavulanic Acid 42.9mg/5ml", activeIngredientAr: "أموكسيسيلين معلق 600 مجم", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 98, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "antin-cap-200", name: "Antinal 200mg Capsules", nameAr: "أنتينال 200 مجم كبسولات مطهر معوي للإسهال", activeIngredient: "Nifuroxazide 200mg", activeIngredientAr: "نيفوروكسازيد 200 مجم", company: "Amoun", dosageForm: "Capsule", category: "Gastrointestinal", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "alphin-tab", name: "Alphintern Tablets", nameAr: "ألفانترن أقراص مضاد للالتهاب والتورم", activeIngredient: "Chymotrypsin + Trypsin", activeIngredientAr: "كيموتربسين + تربسين", company: "Amoun", dosageForm: "Tablet", category: "Anti-inflammatory", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "cataf-50-tab", name: "Cataflam 50mg Tablets", nameAr: "كتافلام 50 مجم أقراص مسكن سريع ومضاد للالتهاب", activeIngredient: "Diclofenac Potassium 50mg", activeIngredientAr: "ديكلوفيناك بوتاسيوم 50 مجم", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 78, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-5-tab", name: "Concor 5mg Tablets", nameAr: "كونكور 5 مجم أقراص لعلاج ضغط الدم والقلب", activeIngredient: "Bisoprolol Fumarate 5mg", activeIngredientAr: "بيسوبرولول 5 مجم", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular / Beta Blocker", price: 75, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-10-tab", name: "Concor 10mg Tablets", nameAr: "كونكور 10 مجم أقراص لارتفاع ضغط الدم", activeIngredient: "Bisoprolol Fumarate 10mg", activeIngredientAr: "بيسوبرولول 10 مجم", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular / Beta Blocker", price: 99, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-pls-5", name: "Concor 5 Plus Tablets", nameAr: "كونكور 5 بلس أقراص ضغط الدم مع مدر بول", activeIngredient: "Bisoprolol 5mg + Hydrochlorothiazide 12.5mg", activeIngredientAr: "بيسوبرولول + هيدروكلوروثيازيد", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular", price: 85, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "curam-1g-tab", name: "Curam 1g Tablets", nameAr: "كيورام 1 جم أقراص مضاد حيوي واسع المدى", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "Sandoz", dosageForm: "Tablet", category: "Antibiotic", price: 126, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flag-500-tab", name: "Flagyl 500mg Tablets", nameAr: "فلاجيل 500 مجم أقراص مطهر ومضاد للطفيليات", activeIngredient: "Metronidazole 500mg", activeIngredientAr: "ميترونيدازول 500 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Antiparasitic / Antibacterial", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-50-tab", name: "Voltaren 50mg Tablets", nameAr: "فولتارين 50 مجم أقراص مغلفة مسكن ومضاد للروماتيزم", activeIngredient: "Diclofenac Sodium 50mg", activeIngredientAr: "ديكلوفيناك صوديوم 50 مجم", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 72, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "zith-500-cap", name: "Zithromax 500mg Capsules", nameAr: "زيثروماكس 500 مجم كبسولات مضاد حيوي 3 أيام", activeIngredient: "Azithromycin 500mg", activeIngredientAr: "أزيثروميسين 500 مجم", company: "Pfizer", dosageForm: "Capsule", category: "Antibiotic", price: 115, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "nex-40-tab", name: "Nexium 40mg Tablets", nameAr: "نيكسيوم 40 مجم أقراص لعلاج قرحة المعدة والارتجاع الشديد", activeIngredient: "Esomeprazole 40mg", activeIngredientAr: "إيزوميبرازول 40 مجم", company: "AstraZeneca", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 165, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gluc-1000-tab", name: "Glucophage 1000mg Tablets", nameAr: "جلوكوفاج 1000 مجم أقراص لعلاج مرض السكر", activeIngredient: "Metformin Hydrochloride 1000mg", activeIngredientAr: "ميتفورمين 1000 مجم", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "hibio-1g-tab", name: "Hibiotic 1g Tablets", nameAr: "هاي بيوتك 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "Amoun", dosageForm: "Tablet", category: "Antibiotic", price: 120, sourceOrigin: "Egyptian Bank", isEssential: true },
];

const RAW_CATALOG = [
  ...ESSENTIAL_POPULAR_DRUGS,
  ...(extendedSpecialtyCatalog as DrugRecord[]),
  ...(comprehensiveCatalog as DrugRecord[]),
];

const deduplicatedCatalog: DrugRecord[] = [];
const seenDrugKeys = new Set<string>();

for (const drug of RAW_CATALOG) {
  const cleanName = (drug.name || "").trim();
  const cleanNameAr = cleanArabicDrugName(drug.nameAr || drug.name);
  const cleanActiveIng = (drug.activeIngredient || "").trim();

  let origin = drug.sourceOrigin || "Egyptian Bank";
  if (drug.category === "Dermatology & Topical") {
    origin = "Cosmetics & Aesthetics";
  } else if (drug.category === "Vitamins & Minerals") {
    origin = "Vitamins & Supplements";
  }

  const key = normalizeDrugCanonicalKey(cleanName, drug.dosageForm);
  if (!seenDrugKeys.has(key)) {
    seenDrugKeys.add(key);
    deduplicatedCatalog.push({
      ...drug,
      name: cleanName,
      nameAr: cleanNameAr,
      activeIngredient: cleanActiveIng,
      sourceOrigin: origin,
      isEssential: !!drug.isEssential,
    });
  }
}

const INDEXED_DRUGS: IndexedDrugRecord[] = deduplicatedCatalog.map((drug) => {
  const normNameAr = normalizeArabic(drug.nameAr || "");
  const normNameEng = (drug.name || "").toLowerCase().trim();
  const normActiveIngEng = (drug.activeIngredient || "").toLowerCase().trim();
  const normActiveIngAr = normalizeArabic(drug.activeIngredientAr || "");
  const normCategory = (drug.category || "").toLowerCase().trim();
  const canonicalKey = normalizeDrugCanonicalKey(drug.name, drug.dosageForm);

  return {
    ...drug,
    normNameEng,
    normNameAr,
    normActiveIngEng,
    normActiveIngAr,
    normCategory,
    canonicalKey,
    arTokens: normNameAr.split(/\s+/).filter(Boolean),
    engTokens: normNameEng.split(/\s+/).filter(Boolean),
  };
});

// ── Inverted Prefix Hash Maps for Instant Progressive Alphabetical Filtering ("ب" -> "بن" -> "بنا") ──
const AR_PREFIX_INDEX = new Map<string, number[]>();
const EN_PREFIX_INDEX = new Map<string, number[]>();
const CANONICAL_KEY_INDEX = new Map<string, number>();

function registerPrefixIndices(itemIndex: number) {
  const item = INDEXED_DRUGS[itemIndex];
  CANONICAL_KEY_INDEX.set(item.canonicalKey, itemIndex);

  const registerArPrefix = (token: string) => {
    if (!token) return;
    for (let len = 1; len <= Math.min(6, token.length); len++) {
      const p = token.substring(0, len);
      let list = AR_PREFIX_INDEX.get(p);
      if (!list) {
        list = [];
        AR_PREFIX_INDEX.set(p, list);
      }
      list.push(itemIndex);
    }
  };

  registerArPrefix(item.normNameAr);
  if (item.arTokens[0] && item.arTokens[0] !== item.normNameAr) {
    registerArPrefix(item.arTokens[0]);
  }

  const registerEnPrefix = (token: string) => {
    if (!token) return;
    for (let len = 1; len <= Math.min(6, token.length); len++) {
      const p = token.substring(0, len);
      let list = EN_PREFIX_INDEX.get(p);
      if (!list) {
        list = [];
        EN_PREFIX_INDEX.set(p, list);
      }
      list.push(itemIndex);
    }
  };

  registerEnPrefix(item.normNameEng);
  if (item.engTokens[0] && item.engTokens[0] !== item.normNameEng) {
    registerEnPrefix(item.engTokens[0]);
  }
}

let indicesBuilt = false;
function ensureIndicesBuilt() {
  if (indicesBuilt) return;
  indicesBuilt = true;
  for (let i = 0; i < INDEXED_DRUGS.length; i++) {
    registerPrefixIndices(i);
  }
}

export interface SearchOptions {
  searchActiveIngredient?: boolean;
  searchIndications?: boolean;
}

export const CLINICAL_INDICATION_MAP: Record<string, { labelAr: string; keywords: string[] }> = {
  "خافض حراره": { labelAr: "خافض حرارة وحمى", keywords: ["paracetamol", "ibuprofen", "panadol", "adol", "cetal", "brufen", "dolphin", "catafly"] },
  "حراره": { labelAr: "خافض حرارة وحمى", keywords: ["paracetamol", "ibuprofen", "panadol", "adol", "cetal", "brufen"] },
  "سخونيه": { labelAr: "خافض حرارة وحمى", keywords: ["paracetamol", "ibuprofen", "panadol", "adol", "cetal", "brufen"] },
  "مسكن": { labelAr: "مسكن للآلام ومضاد للالتهاب", keywords: ["diclofenac", "ibuprofen", "ketoprofen", "cataflam", "voltaren", "brufen", "ketofan", "panadol"] },
  "صداع": { labelAr: "علاج الصداع والآلام", keywords: ["panadol extra", "adol extra", "cataflam", "brufen", "migranil", "paracetamol"] },
  "مضاد حيوي": { labelAr: "مضاد حيوي واسع المجال", keywords: ["amoxicillin", "augmentin", "curam", "flumox", "amoxil", "ciprobay", "zithromax", "hibiotic"] },
  "كحه": { labelAr: "علاج الكحة والسعال", keywords: ["toplexil", "bronchopro", "ventolin", "farcolin", "sinecod"] },
  "سعال": { labelAr: "علاج الكحة والسعال", keywords: ["toplexil", "bronchopro", "ventolin"] },
  "بلغم": { labelAr: "مذيب وطارد للبلغم", keywords: ["bronchopro", "ambroxol", "acetylcysteine", "mucophylline", "bisolvon"] },
  "حموضه": { labelAr: "علاج الحموضة وارتجاع المريء", keywords: ["esomeprazole", "pantoprazole", "nexium", "pantoloc", "gaviscon", "antodine"] },
  "ارتجاع": { labelAr: "علاج ارتجاع المريء", keywords: ["nexium", "pantoloc", "gaviscon"] },
  "قرحه": { labelAr: "علاج قرحة المعدة", keywords: ["nexium", "pantoloc", "controloc"] },
  "مغص": { labelAr: "علاج المغص والتقلصات", keywords: ["buscopan", "spasmo", "visceralgine", "duspatalin"] },
  "قولون": { labelAr: "علاج القولون العصبي والانتفاخ", keywords: ["duspatalin", "mebeverine", "librax", "coloverin", "spasmocanulase"] },
  "اسهال": { labelAr: "علاج الإسهال ومطهر معوي", keywords: ["antinal", "flagyl", "diax", "streptoquin", "smecta"] },
  "مطهر معوي": { labelAr: "مطهر معوي ومضاد طفيليات", keywords: ["antinal", "flagyl", "nifuroxazide", "metronidazole"] },
  "امساك": { labelAr: "علاج الإمساك وملين", keywords: ["duphalac", "lactulose", "senna", "picolax", "dulcolax"] },
  "حساسيه": { labelAr: "علاج الحساسية والارتيكاريا", keywords: ["claritine", "zyrtec", "telfast", "loratadine", "cetirizine", "fexofenadine"] },
  "رشح": { labelAr: "علاج الرشح ونزلات البرد", keywords: ["congestal", "flutab", "123", "comtrex", "zyrtec", "panadol cold"] },
  "برد": { labelAr: "علاج نزلات البرد والانفلونزا", keywords: ["congestal", "panadol cold", "flutab", "123", "c-retard"] },
  "انفلونزا": { labelAr: "علاج نزلات البرد والانفلونزا", keywords: ["congestal", "panadol cold", "tamiflu"] },
  "ضغط": { labelAr: "علاج ارتفاع ضغط الدم", keywords: ["concor", "capoten", "tritace", "exforge", "norvasc", "natrilix", "co-diovan"] },
  "سكر": { labelAr: "علاج السكري وخفض السكر", keywords: ["glucophage", "metformin", "januvia", "amaryl", "forxiga", "galvus"] },
  "كوليسترول": { labelAr: "خفض الكوليسترول والدهون", keywords: ["ator", "lipitor", "crestor", "atorvastatin", "rosuvastatin"] },
  "دهون": { labelAr: "علاج دهون الدم والكوليسترول", keywords: ["ator", "lipitor", "crestor"] },
  "دوالي": { labelAr: "علاج الدوالي وضعف الأوردة", keywords: ["daflon", "diosmin", "venoruton"] },
  "بواسير": { labelAr: "علاج البواسير والشرخ", keywords: ["daflon", "sediproct", "proctosedyl", "faktu"] },
  "حرقان بول": { labelAr: "علاج التهاب وحرقان المسالك", keywords: ["ciprobay", "ciprofar", "urivin", "rowatinex", "coliurinal"] },
  "مسالك": { labelAr: "مطهر ومضاد حيوي للمسالك", keywords: ["ciprobay", "ciprofar", "urivin", "rowatinex"] },
  "عضلات": { labelAr: "بسط العضلات والشد العضلي", keywords: ["myofen", "dimra", "mark-fast", "sirdalud"] },
  "شد عضلي": { labelAr: "بسط العضلات والشد العضلي", keywords: ["myofen", "dimra", "mark-fast"] },
};

export const ARABIC_PHONETIC_ING_MAP: Record<string, string> = {
  "اوميبرازول": "omeprazole",
  "اميبرازول": "omeprazole",
  "باراسيتامول": "paracetamol",
  "اموكسيسيلين": "amoxicillin",
  "اموكسيلين": "amoxicillin",
  "ايبوبروفين": "ibuprofen",
  "بروفين": "ibuprofen",
  "ميتفورمين": "metformin",
  "اسبرين": "aspirin",
  "ديكلوفيناك": "diclofenac",
  "ازيثروميسين": "azithromycin",
  "سيبروفلوكساسين": "ciprofloxacin",
  "كيتوبروفين": "ketoprofen",
  "ايزوميبرازول": "esomeprazole",
  "بانتوبرازول": "pantoprazole",
  "لوراتادين": "loratadine",
  "سيتريزين": "cetirizine",
  "فيكسوفينادين": "fexofenadine",
  "سالبوتامول": "salbutamol",
  "بيسوبرولول": "bisoprolol",
  "اتورفاستاتين": "atorvastatin",
  "روزوفاستاتين": "rosuvastatin",
  "كلوبيدوجريل": "clopidogrel",
  "ديوسمين": "diosmin",
  "ميبفرين": "mebeverine",
  "ميترونيدازول": "metronidazole",
  "نيفوروكسازيد": "nifuroxazide",
  "سيلدينافيل": "sildenafil",
  "تادالافيل": "tadalafil",
  "وارفارين": "warfarin",
};

export { recordDrugPrescribed, getDrugUsageScore } from "@/lib/drugTracker";
import { getDrugUsageScore } from "@/lib/drugTracker";

/**
 * Compiles a Drug Eye style wildcard query (e.g. "*gm*n*600" or "aug 600" or "*بنا*اكسترا*")
 * into a fast sequential RegExp.
 */
export function buildDrugEyeWildcardRegex(rawQuery: string): RegExp | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  const hasWildcardOrMultiToken = trimmed.includes("*") || /\s+/.test(trimmed);
  if (!hasWildcardOrMultiToken) return null;

  const segments = trimmed
    .split(/[\s*]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));

  if (segments.length === 0) return null;
  try {
    return new RegExp(segments.join(".*"), "i");
  } catch {
    return null;
  }
}

/**
 * Supercharged Drug Eye + Progressive Alphabetical Search Engine
 * 1. Progressive Alphabetical Prefix Filtering: typing "ب" shows drugs starting with "ب",
 *    typing "بن" narrows to drugs starting with "بن", sorted alphabetically.
 * 2. Drug Eye Wildcard & Multi-Segment Matching: typing "*gm*n*600" or "aug 600"
 *    matches "Augmentin ES 600mg" or "Augmentin 600mg Tabs" instantaneously.
 * 3. Active Ingredient & Phonetic Bilingual Search (Arabic <-> English).
 * 4. Fuzzy Typo Tolerance so no valid drug search ever returns empty.
 */
export function searchComprehensiveDrugs(
  query: string,
  limit = 25,
  options: SearchOptions = {}
): DrugRecord[] {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  ensureIndicesBuilt();

  const searchActiveIngredient = !!options.searchActiveIngredient;
  const isAr = /[\u0600-\u06FF]/.test(cleanQ);
  const normQ = cleanQ.toLowerCase();
  const normQAr = normalizeArabic(cleanQ);
  const targetPrefix = isAr ? normQAr : normQ;

  const sortAlphabetical = (
    a: { drug: DrugRecord; score: number },
    b: { drug: DrugRecord; score: number }
  ) => {
    if (a.score !== b.score) return b.score - a.score;

    const usageA = getDrugUsageScore(a.drug.name);
    const usageB = getDrugUsageScore(b.drug.name);
    if (usageA !== usageB) return usageB - usageA;

    const aEss = !!a.drug.isEssential;
    const bEss = !!b.drug.isEssential;
    if (aEss !== bEss) return aEss ? -1 : 1;

    if (isAr) {
      const nameA = a.drug.nameAr || a.drug.name;
      const nameB = b.drug.nameAr || b.drug.name;
      return nameA.localeCompare(nameB, "ar", { sensitivity: "base" });
    } else {
      return a.drug.name.localeCompare(b.drug.name, "en", { sensitivity: "base" });
    }
  };

  const seenIds = new Set<string>();

  // ── Mode A: Drug Eye Wildcard Pattern (*gm*n*600 or multi-segment "aug 600") ──
  if (cleanQ.includes("*")) {
    const wildcardRx = buildDrugEyeWildcardRegex(isAr ? normQAr : normQ);
    if (wildcardRx) {
      const wildcardMatches: { drug: DrugRecord; score: number }[] = [];
      for (let i = 0; i < INDEXED_DRUGS.length; i++) {
        const item = INDEXED_DRUGS[i];
        const targetText = isAr
          ? `${item.normNameAr} ${item.normNameEng} ${item.normActiveIngAr}`
          : `${item.normNameEng} ${item.normActiveIngEng}`;
        if (wildcardRx.test(targetText)) {
          const firstSeg = (isAr ? normQAr : normQ).replace(/^\*+/, "").split(/[\s*]+/)[0] || "";
          const startsWithFirst =
            firstSeg &&
            !cleanQ.startsWith("*") &&
            (isAr ? item.normNameAr.startsWith(firstSeg) : item.normNameEng.startsWith(firstSeg));
          wildcardMatches.push({ drug: item, score: startsWithFirst ? 98 : 90 });
          seenIds.add(item.id);
          if (wildcardMatches.length >= limit * 3) break;
        }
      }
      wildcardMatches.sort(sortAlphabetical);
      return wildcardMatches.slice(0, limit).map((r) => r.drug);
    }
  }

  // ── Step 1: O(1) Progressive Alphabetical Prefix Filtering ("ب" -> "بن" -> "بنا") ──
  const prefixMap = isAr ? AR_PREFIX_INDEX : EN_PREFIX_INDEX;
  const firstToken = targetPrefix.split(/\s+/)[0] || targetPrefix;
  const keyLen = Math.min(6, firstToken.length);
  const lookupKey = firstToken.substring(0, keyLen);
  const rawBucket = prefixMap.get(lookupKey);

  const exactPrefixMatches: { drug: DrugRecord; score: number }[] = [];
  const multiWordRx = /\s+/.test(targetPrefix) ? buildDrugEyeWildcardRegex(targetPrefix) : null;

  if (rawBucket && rawBucket.length > 0) {
    for (let idx = 0; idx < rawBucket.length; idx++) {
      const item = INDEXED_DRUGS[rawBucket[idx]];
      if (seenIds.has(item.id)) continue;

      if (isAr) {
        const startsFull = item.normNameAr.startsWith(normQAr);
        const startsFirstWord = item.arTokens[0] && item.arTokens[0].startsWith(firstToken);
        const matchesMulti = multiWordRx ? multiWordRx.test(`${item.normNameAr} ${item.normNameEng}`) : true;

        if (startsFull || (startsFirstWord && matchesMulti)) {
          const isExactFull = item.normNameAr === normQAr;
          exactPrefixMatches.push({
            drug: item,
            score: isExactFull ? 100 : startsFull ? 96 : 92,
          });
          seenIds.add(item.id);
        }
      } else {
        const startsFull = item.normNameEng.startsWith(normQ);
        const startsFirstWord = item.engTokens[0] && item.engTokens[0].startsWith(firstToken);
        const matchesMulti = multiWordRx ? multiWordRx.test(item.normNameEng) : true;

        if (startsFull || (startsFirstWord && matchesMulti)) {
          const isExactFull = item.normNameEng === normQ;
          exactPrefixMatches.push({
            drug: item,
            score: isExactFull ? 100 : startsFull ? 96 : 92,
          });
          seenIds.add(item.id);
        }
      }
    }
  }

  // For 1 or 2 characters (without active ingredient mode): strictly return alphabetical prefix matches!
  if (cleanQ.length <= 2 && !searchActiveIngredient && exactPrefixMatches.length > 0) {
    exactPrefixMatches.sort(sortAlphabetical);
    return exactPrefixMatches.slice(0, limit).map((r) => r.drug);
  }

  // ── Step 2: Drug Eye Multi-Token & Substring Match Across Brand Name ─────────
  const tokenMatches: { drug: DrugRecord; score: number }[] = [];
  if (cleanQ.length >= 2 && exactPrefixMatches.length < limit) {
    const wildcardRx = buildDrugEyeWildcardRegex(targetPrefix);
    for (let i = 0; i < INDEXED_DRUGS.length; i++) {
      const item = INDEXED_DRUGS[i];
      if (seenIds.has(item.id)) continue;

      if (isAr) {
        const tokenStarts = item.arTokens.slice(1).some((t) => t.startsWith(normQAr));
        const wildcardHit = wildcardRx ? wildcardRx.test(item.normNameAr) : item.normNameAr.includes(normQAr);
        if (tokenStarts || wildcardHit) {
          tokenMatches.push({ drug: item, score: tokenStarts ? 86 : 80 });
          seenIds.add(item.id);
          if (exactPrefixMatches.length + tokenMatches.length >= limit * 2) break;
        }
      } else {
        const tokenStarts = item.engTokens.slice(1).some((t) => t.startsWith(normQ));
        const wildcardHit = wildcardRx ? wildcardRx.test(item.normNameEng) : item.normNameEng.includes(normQ);
        if (tokenStarts || wildcardHit) {
          tokenMatches.push({ drug: item, score: tokenStarts ? 86 : 80 });
          seenIds.add(item.id);
          if (exactPrefixMatches.length + tokenMatches.length >= limit * 2) break;
        }
      }
    }
  }

  // ── Step 3: Active Ingredient Search (Explicit OR Automatic Fallback) ────────
  const phoneticIng = isAr ? ARABIC_PHONETIC_ING_MAP[normQAr] : undefined;
  const shouldSearchActiveIng =
    searchActiveIngredient || !!phoneticIng || exactPrefixMatches.length + tokenMatches.length < 5;
  const activeIngResults: { drug: DrugRecord; score: number }[] = [];

  if (shouldSearchActiveIng && cleanQ.length >= 2) {
    const targetEng = phoneticIng || normQ;

    for (let i = 0; i < INDEXED_DRUGS.length; i++) {
      const item = INDEXED_DRUGS[i];
      if (seenIds.has(item.id)) continue;

      let score = 0;
      const ingEn = item.normActiveIngEng;
      const ingAr = item.normActiveIngAr;

      if (ingAr && (ingAr.startsWith(normQAr) || ingAr.includes(normQAr))) {
        score = ingAr.startsWith(normQAr) ? (searchActiveIngredient ? 94 : 78) : (searchActiveIngredient ? 88 : 72);
      } else if (targetEng && (ingEn.startsWith(targetEng) || ingEn.includes(targetEng))) {
        score = ingEn.startsWith(targetEng) ? (searchActiveIngredient ? 94 : 78) : (searchActiveIngredient ? 88 : 72);
      }

      if (score > 0) {
        activeIngResults.push({ drug: item, score });
        seenIds.add(item.id);
        if (activeIngResults.length >= limit * 2) break;
      }
    }
  }

  // ── Step 4: Bilingual Phonetic Transliteration (Arabic query -> English trade name) ──
  const phoneticResults: { drug: DrugRecord; score: number }[] = [];
  if (isAr && cleanQ.length >= 3 && exactPrefixMatches.length + tokenMatches.length < 5) {
    const phoneticRx = arabicToEnglishPhoneticRegex(cleanQ);
    if (phoneticRx) {
      for (let i = 0; i < INDEXED_DRUGS.length; i++) {
        const item = INDEXED_DRUGS[i];
        if (seenIds.has(item.id)) continue;
        if (phoneticRx.test(item.engTokens[0] || item.normNameEng)) {
          phoneticResults.push({ drug: item, score: 76 });
          seenIds.add(item.id);
          if (phoneticResults.length >= limit) break;
        }
      }
    }
  }

  const combined = [
    ...exactPrefixMatches,
    ...tokenMatches,
    ...activeIngResults,
    ...phoneticResults,
  ];

  // ── Step 5: Clinical Indication / Symptom Search ──────────────────────────
  const searchIndications = options.searchIndications !== false;
  if (combined.length < 5 && searchIndications && cleanQ.length >= 2) {
    const indicationEntry = Object.entries(CLINICAL_INDICATION_MAP).find(
      ([key]) => normQAr === key || normQAr.includes(key) || (normQAr.length >= 3 && key.includes(normQAr))
    );

    if (indicationEntry) {
      const [, info] = indicationEntry;
      for (let i = 0; i < INDEXED_DRUGS.length; i++) {
        const item = INDEXED_DRUGS[i];
        if (seenIds.has(item.id)) continue;

        const matchesKw = info.keywords.some(
          (kw) => item.normNameEng.includes(kw) || item.normActiveIngEng.includes(kw)
        );

        if (matchesKw) {
          combined.push({
            drug: {
              ...item,
              isIndicationMatch: true,
              matchedIndication: info.labelAr,
            },
            score: 74,
          });
          seenIds.add(item.id);
          if (combined.length >= limit) break;
        }
      }
    }
  }

  // ── Step 6: Fuzzy / Close Spelling Suggestions (Damerau-Levenshtein) ──────
  if (combined.length < 5 && cleanQ.length >= 3) {
    const maxDist = cleanQ.length <= 4 ? 1 : 2;
    const queryFirstWord = (isAr ? normQAr : normQ).split(/\s+/)[0];

    for (let i = 0; i < INDEXED_DRUGS.length; i++) {
      const item = INDEXED_DRUGS[i];
      if (seenIds.has(item.id)) continue;

      const candidateToken = isAr ? item.arTokens[0] : item.engTokens[0];
      if (!candidateToken) continue;

      const compareSlice = candidateToken.slice(0, Math.max(queryFirstWord.length, Math.min(candidateToken.length, queryFirstWord.length + 1)));
      if (Math.abs(compareSlice.length - queryFirstWord.length) <= maxDist) {
        const dist = damerauLevenshteinDistance(queryFirstWord, compareSlice);
        if (dist <= maxDist) {
          combined.push({ drug: item, score: 65 - dist * 10 });
          seenIds.add(item.id);
          if (combined.length >= limit) break;
        }
      }
    }
  }

  combined.sort(sortAlphabetical);
  return combined.slice(0, limit).map((r) => r.drug);
}

export function getTotalDrugCount(): number {
  return INDEXED_DRUGS.length;
}

/**
 * Checks whether a drug already exists in the in-memory catalog
 */
export function isDrugInCatalog(name: string): boolean {
  if (!name || !name.trim()) return false;
  ensureIndicesBuilt();
  const key = normalizeDrugCanonicalKey(name);
  if (CANONICAL_KEY_INDEX.has(key)) return true;
  const lower = name.toLowerCase().trim();
  return INDEXED_DRUGS.some((d) => d.normNameEng === lower);
}

/**
 * Live Cloud Price & New Drug Synchronizer:
 * Overlays updated prices AND inserts newly discovered medications from external/cloud databases
 * directly into the in-memory catalog with zero duplicates!
 */
export function updateDrugPricesFromCloud(
  updates: Array<{
    name: string;
    nameAr?: string;
    activeIngredient?: string;
    price?: number;
    dosageForm?: string;
    company?: string;
    category?: string;
  }>
): void {
  if (!updates || updates.length === 0) return;
  ensureIndicesBuilt();

  for (const up of updates) {
    if (!up.name || up.name.trim().length < 2) continue;
    const key = normalizeDrugCanonicalKey(up.name, up.dosageForm);
    const existingIdx = CANONICAL_KEY_INDEX.get(key);

    if (existingIdx !== undefined && INDEXED_DRUGS[existingIdx]) {
      const existing = INDEXED_DRUGS[existingIdx];
      if (up.price !== undefined && up.price > 0) {
        existing.price = up.price;
      }
      if (up.dosageForm && !existing.dosageForm) {
        existing.dosageForm = up.dosageForm;
      }
      if (up.nameAr && !existing.nameAr) {
        existing.nameAr = cleanArabicDrugName(up.nameAr);
        existing.normNameAr = normalizeArabic(existing.nameAr);
      }
    } else {
      registerCustomDrug({
        name: up.name,
        nameAr: up.nameAr,
        activeIngredient: up.activeIngredient,
        dosageForm: up.dosageForm,
        price: up.price,
        company: up.company,
        category: up.category,
      });
    }
  }
}

/**
 * Register a newly discovered or doctor-contributed drug into in-memory index
 * and make it instantly searchable to all queries without duplication.
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
  ensureIndicesBuilt();

  const cleanName = (drugData.name || "").trim();
  const cleanNameAr = cleanArabicDrugName(drugData.nameAr || cleanName);
  const normNameAr = normalizeArabic(cleanNameAr);
  const normNameEng = cleanName.toLowerCase().trim();
  const canonicalKey = normalizeDrugCanonicalKey(cleanName, drugData.dosageForm);

  const existingIdx = CANONICAL_KEY_INDEX.get(canonicalKey);
  if (existingIdx !== undefined && INDEXED_DRUGS[existingIdx]) {
    const existing = INDEXED_DRUGS[existingIdx];
    if (drugData.price !== undefined && drugData.price > 0) existing.price = drugData.price;
    if (drugData.dosageForm) existing.dosageForm = drugData.dosageForm;
    if (drugData.activeIngredient) existing.activeIngredient = drugData.activeIngredient;
    if (drugData.activeIngredientAr) existing.activeIngredientAr = drugData.activeIngredientAr;
    if (drugData.company) existing.company = drugData.company;
    return existing;
  }

  const id = `custom-drug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const activeIngredient = drugData.activeIngredient || "تركيبة طبية خاصة / Custom Formula";

  const newDrug: DrugRecord = {
    id,
    name: cleanName,
    nameAr: cleanNameAr,
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
    canonicalKey,
    arTokens: normNameAr.split(/\s+/).filter(Boolean),
    engTokens: normNameEng.split(/\s+/).filter(Boolean),
  };

  const newIndex = INDEXED_DRUGS.length;
  INDEXED_DRUGS.push(indexedItem);
  registerPrefixIndices(newIndex);

  return newDrug;
}
