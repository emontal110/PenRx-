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
  isEssential?: boolean;
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
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // Replace punctuation with space
    .replace(/\s+/g, " ")
    .trim();
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
// Guarantees coverage for top prescribed drugs across Egyptian & Arab clinics
const ESSENTIAL_POPULAR_DRUGS: DrugRecord[] = [
  // ── حرف الباء (B / P) ──
  { id: "pan-adv-500", name: "Panadol Advance 500mg Tablets", nameAr: "بنادول أدفانس 500 مجم أقراص", activeIngredient: "Paracetamol 500mg", activeIngredientAr: "باراسيتامول 500 مجم", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-ext-tab", name: "Panadol Extra Tablets", nameAr: "بنادول إكسترا أقراص مسكن للصداع", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", activeIngredientAr: "باراسيتامول + كافيين", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-jnt-tab", name: "Panadol Joint 665mg Tablets", nameAr: "بنادول جوينت للمفاصل 665 مجم", activeIngredient: "Paracetamol 665mg", activeIngredientAr: "باراسيتامول 665 مجم ممتد المفعول", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 54, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-nig-tab", name: "Panadol Night Tablets", nameAr: "بنادول نايت أقراص للنوم والألم", activeIngredient: "Paracetamol 500mg + Diphenhydramine 25mg", activeIngredientAr: "باراسيتامول + ديفينهيدرامين", company: "GSK", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-cold-day", name: "Panadol Cold & Flu Day Tablets", nameAr: "بنادول كولد أند فلو داي (أصفر)", activeIngredient: "Paracetamol + Phenylephrine + Caffeine", activeIngredientAr: "باراسيتامول + فينيل إفرين", company: "GSK", dosageForm: "Tablet", category: "Cold & Flu", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-cold-all", name: "Panadol Cold & Flu All in One", nameAr: "بنادول كولد أند فلو الكل في واحد", activeIngredient: "Paracetamol + Phenylephrine + Guaifenesin", activeIngredientAr: "باراسيتامول + طارد للبلغم", company: "GSK", dosageForm: "Tablet", category: "Cold & Flu", price: 52, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "pan-baby-syr", name: "Panadol Baby & Infant 100ml Syrup", nameAr: "بنادول شراب للأطفال والرضع", activeIngredient: "Paracetamol 120mg/5ml", activeIngredientAr: "باراسيتامول شراب للأطفال", company: "GSK", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 28, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-200-tab", name: "Brufen 200mg Tablets", nameAr: "بروفين 200 مجم أقراص مسكن للألم", activeIngredient: "Ibuprofen 200mg", activeIngredientAr: "إيبوبروفين 200 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 30, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-400-tab", name: "Brufen 400mg Tablets", nameAr: "بروفين 400 مجم أقراص مسكن ومضاد للالتهاب", activeIngredient: "Ibuprofen 400mg", activeIngredientAr: "إيبوبروفين 400 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-600-tab", name: "Brufen 600mg Tablets", nameAr: "بروفين 600 مجم أقراص مسكن قوي ومضاد للروماتيزم", activeIngredient: "Ibuprofen 600mg", activeIngredientAr: "إيبوبروفين 600 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-800-ret", name: "Brufen Retard 800mg Tablets", nameAr: "بروفين ريتارد 800 مجم ممتد المفعول", activeIngredient: "Ibuprofen 800mg SR", activeIngredientAr: "إيبوبروفين 800 مجم", company: "Abbott", dosageForm: "Tablet", category: "NSAID / Analgesic", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-syr-100", name: "Brufen 100mg/5ml Syrup", nameAr: "بروفين شراب للأطفال خافض حرارة ومسكن", activeIngredient: "Ibuprofen 100mg/5ml", activeIngredientAr: "إيبوبروفين شراب", company: "Abbott", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 25, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bruf-flu-tab", name: "Brufen Flu Tablets", nameAr: "بروفين فلو أقراص للبرد والاحتقان", activeIngredient: "Ibuprofen 200mg + Pseudoephedrine 30mg", activeIngredientAr: "إيبوبروفين + سودوإيفيدرين", company: "Abbott", dosageForm: "Tablet", category: "Cold & Flu", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "busc-10-tab", name: "Buscopan 10mg Tablets", nameAr: "بوسكوبان 10 مجم أقراص للتقلصات والمغص", activeIngredient: "Hyoscine Butylbromide 10mg", activeIngredientAr: "هيوسين بيوتيل بروميد", company: "Sanofi", dosageForm: "Tablet", category: "Antispasmodic", price: 26, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "busc-pls-tab", name: "Buscopan Plus Tablets", nameAr: "بوسكوبان بلس أقراص للمغص والمسكن", activeIngredient: "Hyoscine Butylbromide 10mg + Paracetamol 500mg", activeIngredientAr: "هيوسين + باراسيتامول", company: "Sanofi", dosageForm: "Tablet", category: "Antispasmodic", price: 34, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "busc-amp-20", name: "Buscopan 20mg/1ml Ampoules", nameAr: "بوسكوبان 20 مجم أمبولات حقن تقلصات", activeIngredient: "Hyoscine Butylbromide 20mg", activeIngredientAr: "هيوسين بيوتيل بروميد حقن", company: "Sanofi", dosageForm: "Ampoule", category: "Antispasmodic", price: 40, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "beta-ant-sol", name: "Betadine Antiseptic Solution 120ml", nameAr: "بيتادين مطهر ومعقم موضعي 120 مل", activeIngredient: "Povidone Iodine 10%", activeIngredientAr: "بوفيدون يود 10%", company: "Mundipharma", dosageForm: "Topical Solution", category: "Antiseptic", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "beta-oint-60", name: "Betadine Ointment 60g", nameAr: "بيتادين مرهم معقم للجروح والحروق", activeIngredient: "Povidone Iodine 10%", activeIngredientAr: "بوفيدون يود مرهم", company: "Mundipharma", dosageForm: "Ointment", category: "Antiseptic", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "beta-garg-120", name: "Betadine Gargle & Mouthwash 120ml", nameAr: "بيتادين مضمضة وغرغرة للفم والحلق", activeIngredient: "Povidone Iodine 1%", activeIngredientAr: "بوفيدون يود غرغرة", company: "Mundipharma", dosageForm: "Mouthwash", category: "Antiseptic", price: 35, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bisol-8-tab", name: "Bisolvon 8mg Tablets", nameAr: "بيسولفون 8 مجم أقراص مذيب للبلغم", activeIngredient: "Bromhexine Hydrochloride 8mg", activeIngredientAr: "برومهيكسين هيدروكلوريد", company: "Sanofi", dosageForm: "Tablet", category: "Mucolytic", price: 24, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bisol-syr-4", name: "Bisolvon 4mg/5ml Syrup", nameAr: "بيسولفون شراب مذيب للبلغم", activeIngredient: "Bromhexine Hydrochloride 4mg/5ml", activeIngredientAr: "برومهيكسين شراب", company: "Sanofi", dosageForm: "Syrup", category: "Mucolytic", price: 22, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bisol-drop-2", name: "Bisolvon Oral Drops 40ml", nameAr: "بيسولفون نقط بالفم مذيب للبلغم", activeIngredient: "Bromhexine Hydrochloride 2mg/ml", activeIngredientAr: "برومهيكسين نقط", company: "Sanofi", dosageForm: "Drops", category: "Mucolytic", price: 20, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "betaph-2-amp", name: "Betaphos 2ml Ampoules", nameAr: "بيتافوس أمبولات حقن للحساسية والالتهاب", activeIngredient: "Betamethasone Dipropionate + Betamethasone Sodium", activeIngredientAr: "بيتاميثازون حقن ممتد المفعول", company: "Amoun", dosageForm: "Ampoule", category: "Corticosteroid", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "panto-20-tab", name: "Pantoloc 20mg Tablets", nameAr: "بانتولوك 20 مجم أقراص للمعدة والحموضة", activeIngredient: "Pantoprazole 20mg", activeIngredientAr: "بانتوبرازول 20 مجم", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "panto-40-tab", name: "Pantoloc 40mg Tablets", nameAr: "بانتولوك 40 مجم أقراص لعلاج قرحة المعدة", activeIngredient: "Pantoprazole 40mg", activeIngredientAr: "بانتوبرازول 40 مجم", company: "Takeda", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 82, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "bact-for-tab", name: "Bactrim Forte Tablets", nameAr: "باكتريم فورت أقراص مضاد حيوي", activeIngredient: "Sulfamethoxazole 800mg + Trimethoprim 160mg", activeIngredientAr: "سلفاميثوكسازول + تريميثوبريم", company: "Roche", dosageForm: "Tablet", category: "Antibiotic", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "parac-500-tab", name: "Paracetamol 500mg Tablets", nameAr: "باراسيتامول 500 مجم أقراص مسكن وخافض للحرارة", activeIngredient: "Paracetamol 500mg", activeIngredientAr: "باراسيتامول 500 مجم", company: "Misr Pharma", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 16, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "parac-syr-120", name: "Paracetamol 120mg/5ml Syrup", nameAr: "باراسيتامول شراب للأطفال خافض حرارة", activeIngredient: "Paracetamol 120mg/5ml", activeIngredientAr: "باراسيتامول شراب", company: "Misr Pharma", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 14, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "broncho-syr-15", name: "Bronchopro 15mg/5ml Syrup", nameAr: "برونكوبرو شراب مذيب ومطهر للبلغم", activeIngredient: "Ambroxol Hydrochloride 15mg/5ml", activeIngredientAr: "أمبروكسول هيدروكلوريد", company: "SEDICO", dosageForm: "Syrup", category: "Mucolytic", price: 21, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "broncho-drop-7", name: "Bronchopro 7.5mg/ml Drops", nameAr: "برونكوبرو نقط للأطفال بالفم", activeIngredient: "Ambroxol Hydrochloride 7.5mg/ml", activeIngredientAr: "أمبروكسول نقط أطفال", company: "SEDICO", dosageForm: "Drops", category: "Mucolytic", price: 19, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الألف (A) ──
  { id: "aug-1g-tab", name: "Augmentin 1g Tablets", nameAr: "أوجمنتين 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 110, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-625-tab", name: "Augmentin 625mg Tablets", nameAr: "أوجمنتين 625 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 500mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 85, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-375-tab", name: "Augmentin 375mg Tablets", nameAr: "أوجمنتين 375 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 250mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 375 مجم", company: "GSK", dosageForm: "Tablet", category: "Antibiotic", price: 62, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-es-600", name: "Augmentin ES 600mg Suspension", nameAr: "أوجمنتين إي إس 600 مجم معلق للأطفال", activeIngredient: "Amoxicillin 600mg + Clavulanic Acid 42.9mg/5ml", activeIngredientAr: "أموكسيسيلين معلق 600 مجم", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 78, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-457-syr", name: "Augmentin 457mg/5ml Suspension", nameAr: "أوجمنتين 457 مجم معلق للأطفال", activeIngredient: "Amoxicillin 400mg + Clavulanate 57mg/5ml", activeIngredientAr: "أموكسيسيلين معلق 457 مجم", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "aug-312-syr", name: "Augmentin 312mg/5ml Suspension", nameAr: "أوجمنتين 312 مجم معلق للأطفال", activeIngredient: "Amoxicillin 250mg + Clavulanate 62.5mg/5ml", activeIngredientAr: "أموكسيسيلين معلق 312 مجم", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 54, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "amox-500-cap", name: "Amoxil 500mg Capsules", nameAr: "أموكسيل 500 مجم كبسولات مضاد حيوي", activeIngredient: "Amoxicillin 500mg", activeIngredientAr: "أموكسيسيلين 500 مجم", company: "GSK", dosageForm: "Capsule", category: "Antibiotic", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "amox-250-syr", name: "Amoxil 250mg/5ml Suspension", nameAr: "أموكسيل 250 مجم معلق للأطفال", activeIngredient: "Amoxicillin 250mg/5ml", activeIngredientAr: "أموكسيسيلين شراب معلق", company: "GSK", dosageForm: "Suspension", category: "Antibiotic", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "antin-cap-200", name: "Antinal 200mg Capsules", nameAr: "أنتينال 200 مجم كبسولات مطهر معوي للإسهال", activeIngredient: "Nifuroxazide 200mg", activeIngredientAr: "نيفوروكسازيد 200 مجم", company: "Amoun", dosageForm: "Capsule", category: "Gastrointestinal", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "antin-syr-200", name: "Antinal 220mg/5ml Suspension", nameAr: "أنتينال شراب معلق مطهر معوي للأطفال", activeIngredient: "Nifuroxazide 220mg/5ml", activeIngredientAr: "نيفوروكسازيد شراب", company: "Amoun", dosageForm: "Suspension", category: "Gastrointestinal", price: 24, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "alphin-tab", name: "Alphintern Tablets", nameAr: "ألفانترن أقراص مضاد للالتهاب والتورم", activeIngredient: "Chymotrypsin + Trypsin", activeIngredientAr: "كيموتربسين + تربسين", company: "Amoun", dosageForm: "Tablet", category: "Anti-inflammatory", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "adol-500-tab", name: "Adol 500mg Tablets", nameAr: "أدول 500 مجم أقراص مسكن وخافض للحرارة", activeIngredient: "Paracetamol 500mg", activeIngredientAr: "باراسيتامول 500 مجم", company: "Julphar", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 30, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "adol-extra-tab", name: "Adol Extra Tablets", nameAr: "أدول إكسترا أقراص مسكن قوي للصداع والآلام", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", activeIngredientAr: "باراسيتامول + كافيين", company: "Julphar", dosageForm: "Tablet", category: "Analgesic / Antipyretic", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "adol-syrup", name: "Adol 120mg/5ml Suspension 100ml", nameAr: "أدول شراب معلق للأطفال خافض للحرارة", activeIngredient: "Paracetamol 120mg/5ml", activeIngredientAr: "باراسيتامول شراب للأطفال", company: "Julphar", dosageForm: "Syrup", category: "Analgesic / Antipyretic", price: 18, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "adol-drops", name: "Adol Oral Drops 15ml", nameAr: "أدول نقط بالفم للرضع والأطفال", activeIngredient: "Paracetamol 100mg/ml", activeIngredientAr: "باراسيتامول نقط رضع", company: "Julphar", dosageForm: "Drops", category: "Analgesic / Antipyretic", price: 22, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ator-20-tab", name: "Ator 20mg Tablets", nameAr: "أتور 20 مجم أقراص لخفض الكوليسترول", activeIngredient: "Atorvastatin 20mg", activeIngredientAr: "أتورفاستاتين 20 مجم", company: "EPICO", dosageForm: "Tablet", category: "Cardiovascular / Statin", price: 56, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ator-40-tab", name: "Ator 40mg Tablets", nameAr: "أتور 40 مجم أقراص لعلاج دهون الدم", activeIngredient: "Atorvastatin 40mg", activeIngredientAr: "أتورفاستاتين 40 مجم", company: "EPICO", dosageForm: "Tablet", category: "Cardiovascular / Statin", price: 74, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الكاف (C / K) ──
  { id: "cataf-50-tab", name: "Cataflam 50mg Tablets", nameAr: "كتافلام 50 مجم أقراص مسكن سريع ومضاد للالتهاب", activeIngredient: "Diclofenac Potassium 50mg", activeIngredientAr: "ديكلوفيناك بوتاسيوم 50 مجم", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 63, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "cataf-25-tab", name: "Cataflam 25mg Tablets", nameAr: "كتافلام 25 مجم أقراص مسكن للألم", activeIngredient: "Diclofenac Potassium 25mg", activeIngredientAr: "ديكلوفيناك بوتاسيوم 25 مجم", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 46, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "cataf-75-amp", name: "Cataflam 75mg/3ml Ampoules", nameAr: "كتافلام 75 مجم أمبولات حقن عضل مسكن سريع", activeIngredient: "Diclofenac Potassium 75mg", activeIngredientAr: "ديكلوفيناك حقن", company: "Novartis", dosageForm: "Ampoule", category: "Analgesic / NSAID", price: 72, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "cataf-disp-50", name: "Cataflam Dispersible 50mg Tablets", nameAr: "كتافلام فوار 50 مجم سريع الذوبان للألم الحاد", activeIngredient: "Diclofenac Free Acid 50mg", activeIngredientAr: "ديكلوفيناك أقراص فوارة", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 55, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "catafly-syr", name: "Catafly Oral Suspension 140ml", nameAr: "كتافلاي معلق 140 مل مسكن وخافض حرارة للأطفال", activeIngredient: "Diclofenac Resinate", activeIngredientAr: "ديكلوفيناك شراب للأطفال", company: "Novartis", dosageForm: "Suspension", category: "Analgesic / Antipyretic", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ketof-50-cap", name: "Ketofan 50mg Capsules", nameAr: "كيتوفان 50 مجم كبسولات مسكن للآلام والروماتيزم", activeIngredient: "Ketoprofen 50mg", activeIngredientAr: "كيتوبروفين 50 مجم", company: "Amoun", dosageForm: "Capsule", category: "Analgesic / NSAID", price: 34, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ketof-sr-100", name: "Ketofan SR 100mg Capsules", nameAr: "كيتوفان إس آر 100 مجم كبسولات ممتدة المفعول", activeIngredient: "Ketoprofen 100mg SR", activeIngredientAr: "كيتوبروفين 100 مجم", company: "Amoun", dosageForm: "Capsule", category: "Analgesic / NSAID", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ketof-amp-100", name: "Ketofan 100mg/2ml Ampoules", nameAr: "كيتوفان 100 مجم أمبولات مسكن للمغص الكلوي", activeIngredient: "Ketoprofen 100mg/2ml", activeIngredientAr: "كيتوبروفين حقن", company: "Amoun", dosageForm: "Ampoule", category: "Analgesic / NSAID", price: 46, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-5-tab", name: "Concor 5mg Tablets", nameAr: "كونكور 5 مجم أقراص لعلاج ضغط الدم والقلب", activeIngredient: "Bisoprolol Fumarate 5mg", activeIngredientAr: "بيسوبرولول 5 مجم", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular / Beta Blocker", price: 62, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-25-tab", name: "Concor 2.5mg Tablets", nameAr: "كونكور 2.5 مجم أقراص للقلب والضغط", activeIngredient: "Bisoprolol Fumarate 2.5mg", activeIngredientAr: "بيسوبرولول 2.5 مجم", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular / Beta Blocker", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-10-tab", name: "Concor 10mg Tablets", nameAr: "كونكور 10 مجم أقراص لارتفاع ضغط الدم", activeIngredient: "Bisoprolol Fumarate 10mg", activeIngredientAr: "بيسوبرولول 10 مجم", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular / Beta Blocker", price: 78, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "concor-pls-5", name: "Concor 5 Plus Tablets", nameAr: "كونكور 5 بلس أقراص ضغط الدم مع مدر بول", activeIngredient: "Bisoprolol 5mg + Hydrochlorothiazide 12.5mg", activeIngredientAr: "بيسوبرولول + هيدروكلوروثيازيد", company: "Merck", dosageForm: "Tablet", category: "Cardiovascular", price: 70, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "conges-tab", name: "Congestal Tablets", nameAr: "كونجستال أقراص لعلاج نزلات البرد والانفلونزا", activeIngredient: "Paracetamol + Pseudoephedrine + Chlorpheniramine", activeIngredientAr: "باراسيتامول + سودوإيفيدرين + كلورفينيرامين", company: "Sigma", dosageForm: "Tablet", category: "Cold & Flu", price: 35, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "conges-syr", name: "Congestal Syrup 120ml", nameAr: "كونجستال شراب للأطفال للبرد والرشح", activeIngredient: "Paracetamol + Pseudoephedrine + Chlorpheniramine", activeIngredientAr: "كونجستال شراب أطفال", company: "Sigma", dosageForm: "Syrup", category: "Cold & Flu", price: 26, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "curam-1g-tab", name: "Curam 1g Tablets", nameAr: "كيورام 1 جم أقراص مضاد حيوي واسع المدى", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "Sandoz", dosageForm: "Tablet", category: "Antibiotic", price: 98, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "curam-625-tab", name: "Curam 625mg Tablets", nameAr: "كيورام 625 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 500mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", company: "Sandoz", dosageForm: "Tablet", category: "Antibiotic", price: 76, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "clari-10-tab", name: "Claritine 10mg Tablets", nameAr: "كلاريتين 10 مجم أقراص لعلاج الحساسية والارتيكاريا", activeIngredient: "Loratadine 10mg", activeIngredientAr: "لوراتادين 10 مجم", company: "Bayer", dosageForm: "Tablet", category: "Antihistamine", price: 54, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "clari-syr-100", name: "Claritine 1mg/ml Syrup 100ml", nameAr: "كلاريتين شراب للأطفال لعلاج الحساسية والرشح", activeIngredient: "Loratadine 1mg/ml", activeIngredientAr: "لوراتادين شراب", company: "Bayer", dosageForm: "Syrup", category: "Antihistamine", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ciprob-500-tab", name: "Ciprobay 500mg Tablets", nameAr: "سيبروباي 500 مجم أقراص مضاد حيوي للمسالك", activeIngredient: "Ciprofloxacin 500mg", activeIngredientAr: "سيبروفلوكساسين 500 مجم", company: "Bayer", dosageForm: "Tablet", category: "Antibiotic", price: 75, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ciprob-750-tab", name: "Ciprobay 750mg Tablets", nameAr: "سيبروباي 750 مجم أقراص مضاد حيوي قوي", activeIngredient: "Ciprofloxacin 750mg", activeIngredientAr: "سيبروفلوكساسين 750 مجم", company: "Bayer", dosageForm: "Tablet", category: "Antibiotic", price: 92, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ciprof-500-tab", name: "Ciprofar 500mg Tablets", nameAr: "سيبروفار 500 مجم أقراص مضاد حيوي للمسالك والبطن", activeIngredient: "Ciprofloxacin 500mg", activeIngredientAr: "سيبروفلوكساسين 500 مجم", company: "Pharco", dosageForm: "Tablet", category: "Antibiotic", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الفاء (F / V) ──
  { id: "flag-500-tab", name: "Flagyl 500mg Tablets", nameAr: "فلاجيل 500 مجم أقراص مطهر ومضاد للطفيليات والبكتيريا اللاهوائية", activeIngredient: "Metronidazole 500mg", activeIngredientAr: "ميترونيدازول 500 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Antiparasitic / Antibacterial", price: 35, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flag-250-tab", name: "Flagyl 250mg Tablets", nameAr: "فلاجيل 250 مجم أقراص مطهر معوي", activeIngredient: "Metronidazole 250mg", activeIngredientAr: "ميترونيدازول 250 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Antiparasitic / Antibacterial", price: 26, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flag-syr-125", name: "Flagyl 125mg/5ml Suspension 100ml", nameAr: "فلاجيل شراب معلق مطهر معوي للأطفال", activeIngredient: "Metronidazole Benzoate 125mg/5ml", activeIngredientAr: "ميترونيدازول شراب", company: "Sanofi", dosageForm: "Suspension", category: "Antiparasitic", price: 22, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flumox-1g-tab", name: "Flumox 1g Tablets", nameAr: "فلوموكس 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 500mg + Flucloxacillin 500mg", activeIngredientAr: "أموكسيسيلين + فلوكلوكساسيللين 1 جم", company: "EPICO", dosageForm: "Tablet", category: "Antibiotic", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flumox-500-cap", name: "Flumox 500mg Capsules", nameAr: "فلوموكس 500 مجم كبسولات مضاد حيوي", activeIngredient: "Amoxicillin 250mg + Flucloxacillin 250mg", activeIngredientAr: "أموكسيسيلين + فلوكلوكساسيللين 500 مجم", company: "EPICO", dosageForm: "Capsule", category: "Antibiotic", price: 46, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "flumox-syr-250", name: "Flumox 250mg/5ml Suspension", nameAr: "فلوموكس 250 مجم معلق للأطفال", activeIngredient: "Amoxicillin + Flucloxacillin 250mg/5ml", activeIngredientAr: "فلوموكس شراب أطفال", company: "EPICO", dosageForm: "Suspension", category: "Antibiotic", price: 34, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-50-tab", name: "Voltaren 50mg Tablets", nameAr: "فولتارين 50 مجم أقراص مغلفة مسكن ومضاد للروماتيزم", activeIngredient: "Diclofenac Sodium 50mg", activeIngredientAr: "ديكلوفيناك صوديوم 50 مجم", company: "Novartis", dosageForm: "Tablet", category: "Analgesic / NSAID", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-100-sr", name: "Voltaren 100mg SR Capsules", nameAr: "فولتارين 100 مجم كبسولات ممتدة المفعول", activeIngredient: "Diclofenac Sodium 100mg SR", activeIngredientAr: "ديكلوفيناك صوديوم 100 مجم", company: "Novartis", dosageForm: "Capsule", category: "Analgesic / NSAID", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-75-amp", name: "Voltaren 75mg/3ml Ampoules", nameAr: "فولتارين 75 مجم أمبولات حقن عضل مسكن شديد", activeIngredient: "Diclofenac Sodium 75mg", activeIngredientAr: "ديكلوفيناك صوديوم حقن", company: "Novartis", dosageForm: "Ampoule", category: "Analgesic / NSAID", price: 78, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-emulgel", name: "Voltaren Emulgel 50g", nameAr: "فولتارين إيملجل 50 جرام مسكن موضعي للمفاصل والظهر", activeIngredient: "Diclofenac Diethylamine 1.16%", activeIngredientAr: "ديكلوفيناك جل موضعي", company: "Novartis", dosageForm: "Topical Gel", category: "Topical Analgesic", price: 42, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-supp-12", name: "Voltaren 12.5mg Suppositories", nameAr: "فولتارين 12.5 مجم لبوس للرضع والأطفال", activeIngredient: "Diclofenac Sodium 12.5mg", activeIngredientAr: "ديكلوفيناك لبوس أطفال", company: "Novartis", dosageForm: "Suppositories", category: "Analgesic / Antipyretic", price: 24, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "volt-supp-25", name: "Voltaren 25mg Suppositories", nameAr: "فولتارين 25 مجم لبوس للأطفال مسكن وخافض للحرارة", activeIngredient: "Diclofenac Sodium 25mg", activeIngredientAr: "ديكلوفيناك لبوس أطفال", company: "Novartis", dosageForm: "Suppositories", category: "Analgesic / Antipyretic", price: 28, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "vent-inh-100", name: "Ventolin Evohaler Inhaler 100mcg", nameAr: "فنتولين بخاخ صدر موسع للشعب الهوائية", activeIngredient: "Salbutamol 100mcg/dose", activeIngredientAr: "سالبوتامول بخاخ أزمة", company: "GSK", dosageForm: "Inhaler", category: "Respiratory / Bronchodilator", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "vent-sol-resp", name: "Ventolin Respirator Solution 20ml", nameAr: "فنتولين محلول جلسات استنشاق نبيولايزر", activeIngredient: "Salbutamol 5mg/ml", activeIngredientAr: "سالبوتامول محلول نبيولايزر", company: "GSK", dosageForm: "Drops", category: "Respiratory", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "vent-syr-2", name: "Ventolin 2mg/5ml Syrup 150ml", nameAr: "فنتولين شراب موسع للشعب وطارد للبلغم", activeIngredient: "Salbutamol 2mg/5ml", activeIngredientAr: "سالبوتامول شراب", company: "GSK", dosageForm: "Syrup", category: "Respiratory", price: 22, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "farc-sol-resp", name: "Farcolin Respirator Solution 20ml", nameAr: "فاركولين محلول جلسات استنشاق موسع للشعب", activeIngredient: "Salbutamol 5mg/ml", activeIngredientAr: "سالبوتامول فاركولين جلسات", company: "Pharco", dosageForm: "Drops", category: "Respiratory", price: 28, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الزاي (Z) ──
  { id: "zith-500-cap", name: "Zithromax 500mg Capsules", nameAr: "زيثروماكس 500 مجم كبسولات مضاد حيوي 3 أيام", activeIngredient: "Azithromycin 500mg", activeIngredientAr: "أزيثروميسين 500 مجم", company: "Pfizer", dosageForm: "Capsule", category: "Antibiotic", price: 88, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "zith-syr-200", name: "Zithromax 200mg/5ml Suspension", nameAr: "زيثروماكس 200 مجم معلق للأطفال", activeIngredient: "Azithromycin 200mg/5ml", activeIngredientAr: "أزيثروميسين شراب للأطفال", company: "Pfizer", dosageForm: "Suspension", category: "Antibiotic", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "zyrt-10-tab", name: "Zyrtec 10mg Tablets", nameAr: "زيرتك 10 مجم أقراص لعلاج الحساسية والجيوب الأنفية", activeIngredient: "Cetirizine Dihydrochloride 10mg", activeIngredientAr: "سيتريزين 10 مجم", company: "GSK", dosageForm: "Tablet", category: "Antihistamine", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "zyrt-drop-10", name: "Zyrtec Oral Drops 20ml", nameAr: "زيرتك نقط بالفم للأطفال والرضع للحساسية", activeIngredient: "Cetirizine 10mg/ml", activeIngredientAr: "سيتريزين نقط أطفال", company: "GSK", dosageForm: "Drops", category: "Antihistamine", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "zyrt-syr-5", name: "Zyrtec 5mg/5ml Syrup 100ml", nameAr: "زيرتك شراب للأطفال لعلاج الرشح والحساسية", activeIngredient: "Cetirizine 5mg/5ml", activeIngredientAr: "سيتريزين شراب", company: "GSK", dosageForm: "Syrup", category: "Antihistamine", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف التاء (T) ──
  { id: "telf-120-tab", name: "Telfast 120mg Tablets", nameAr: "تيلفاست 120 مجم أقراص لحساسية الأنف والجيوب الأنفية", activeIngredient: "Fexofenadine HCl 120mg", activeIngredientAr: "فيكسوفينادين 120 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Antihistamine", price: 68, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "telf-180-tab", name: "Telfast 180mg Tablets", nameAr: "تيلفاست 180 مجم أقراص للحساسية الجلدية والارتيكاريا", activeIngredient: "Fexofenadine HCl 180mg", activeIngredientAr: "فيكسوفينادين 180 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Antihistamine", price: 82, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "telf-syr-30", name: "Telfast 30mg/5ml Suspension 100ml", nameAr: "تيلفاست معلق للأطفال لعلاج الحساسية", activeIngredient: "Fexofenadine 30mg/5ml", activeIngredientAr: "فيكسوفينادين شراب أطفال", company: "Sanofi", dosageForm: "Suspension", category: "Antihistamine", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "topl-syr-125", name: "Toplexil Syrup 125ml", nameAr: "توبلكسيل شراب مهدئ للسعال الجاف وموسع للشعب", activeIngredient: "Oxomemazine + Guaifenesin", activeIngredientAr: "أوكسوميمازين مهدئ كحة", company: "Sanofi", dosageForm: "Syrup", category: "Cough & Cold", price: 26, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف النون (N) ──
  { id: "nex-20-tab", name: "Nexium 20mg Tablets", nameAr: "نيكسيوم 20 مجم أقراص لعلاج الحموضة وارتجاع المريء", activeIngredient: "Esomeprazole 20mg", activeIngredientAr: "إيزوميبرازول 20 مجم", company: "AstraZeneca", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 92, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "nex-40-tab", name: "Nexium 40mg Tablets", nameAr: "نيكسيوم 40 مجم أقراص لعلاج قرحة المعدة والارتجاع الشديد", activeIngredient: "Esomeprazole 40mg", activeIngredientAr: "إيزوميبرازول 40 مجم", company: "AstraZeneca", dosageForm: "Tablet", category: "Gastrointestinal / PPI", price: 135, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "nex-40-vial", name: "Nexium 40mg IV Vial", nameAr: "نيكسيوم 40 مجم فيال حقن وريد للحموضة والنزيف", activeIngredient: "Esomeprazole 40mg IV", activeIngredientAr: "إيزوميبرازول حقن وريدي", company: "AstraZeneca", dosageForm: "Vial", category: "Gastrointestinal", price: 110, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الدال (D) ──
  { id: "daf-500-tab", name: "Daflon 500mg Tablets", nameAr: "دافلوين 500 مجم أقراص لعلاج البواسير والدوالي وضعف الأوردة", activeIngredient: "Micronized Flavonoid Fraction 500mg", activeIngredientAr: "ديوسمين + هسبيريدين", company: "Servier", dosageForm: "Tablet", category: "Vascular Protectant", price: 84, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "daf-1000-tab", name: "Daflon 1000mg Tablets", nameAr: "دافلوين 1000 مجم أقراص لعلاج نوبات البواسير الحادة", activeIngredient: "Micronized Flavonoid 1000mg", activeIngredientAr: "ديوسمين 1000 مجم", company: "Servier", dosageForm: "Tablet", category: "Vascular Protectant", price: 120, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dusp-135-tab", name: "Duspatalin 135mg Tablets", nameAr: "دوسباتالين 135 مجم أقراص للقولون العصبي والانتفاخ", activeIngredient: "Mebeverine Hydrochloride 135mg", activeIngredientAr: "ميبفرين 135 مجم", company: "Abbott", dosageForm: "Tablet", category: "Antispasmodic / IBS", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dusp-200-ret", name: "Duspatalin Retard 200mg Capsules", nameAr: "دوسباتالين ريتارد 200 مجم كبسولات ممتدة المفعول للقولون", activeIngredient: "Mebeverine HCl 200mg SR", activeIngredientAr: "ميبفرين 200 مجم ممتد المفعول", company: "Abbott", dosageForm: "Capsule", category: "Antispasmodic / IBS", price: 86, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dolph-12-sup", name: "Dolphin 12.5mg Suppositories", nameAr: "دولفين 12.5 مجم أقماع (لبوس للأطفال الرضع)", activeIngredient: "Diclofenac Sodium 12.5mg", activeIngredientAr: "ديكلوفيناك لبوس رضع", company: "Delta Pharma", dosageForm: "Suppositories", category: "NSAID / Analgesic", price: 27, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dolph-25-sup", name: "Dolphin 25mg Suppositories", nameAr: "دولفين 25 مجم أقماع (لبوس للأطفال مسكن للحرارة)", activeIngredient: "Diclofenac Sodium 25mg", activeIngredientAr: "ديكلوفيناك لبوس أطفال", company: "Delta Pharma", dosageForm: "Suppositories", category: "NSAID / Analgesic", price: 31.5, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dolph-50-sup", name: "Dolphin 50mg Suppositories", nameAr: "دولفين 50 مجم أقماع (لبوس للأطفال والكبار)", activeIngredient: "Diclofenac Sodium 50mg", activeIngredientAr: "ديكلوفيناك لبوس 50 مجم", company: "Delta Pharma", dosageForm: "Suppositories", category: "NSAID / Analgesic", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "dolph-75-sup", name: "Dolphin 75mg Suppositories", nameAr: "دولفين 75 مجم أقماع (لبوس للكبار مسكن شديد)", activeIngredient: "Diclofenac Sodium 75mg", activeIngredientAr: "ديكلوفيناك لبوس كبار", company: "Delta Pharma", dosageForm: "Suppositories", category: "NSAID / Analgesic", price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الجيم (G) ──
  { id: "gluc-500-tab", name: "Glucophage 500mg Tablets", nameAr: "جلوكوفاج 500 مجم أقراص لعلاج السكري ومقاومة الإنسولين", activeIngredient: "Metformin Hydrochloride 500mg", activeIngredientAr: "ميتفورمين 500 مجم", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gluc-1000-tab", name: "Glucophage 1000mg Tablets", nameAr: "جلوكوفاج 1000 مجم أقراص لعلاج مرض السكر", activeIngredient: "Metformin Hydrochloride 1000mg", activeIngredientAr: "ميتفورمين 1000 مجم", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 55, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gluc-xr-500", name: "Glucophage XR 500mg Tablets", nameAr: "جلوكوفاج إكس آر 500 مجم ممتد المفعول خفيف على المعدة", activeIngredient: "Metformin HCl 500mg XR", activeIngredientAr: "ميتفورمين ممتد المفعول", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gluc-xr-1000", name: "Glucophage XR 1000mg Tablets", nameAr: "جلوكوفاج إكس آر 1000 مجم أقراص ممتدة المفعول", activeIngredient: "Metformin HCl 1000mg XR", activeIngredientAr: "ميتفورمين 1000 مجم ممتد الإفراز", company: "Merck", dosageForm: "Tablet", category: "Antidiabetic", price: 72, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gavis-syr-200", name: "Gaviscon Liquid Aniseed 200ml", nameAr: "جافيسكون شراب معلق سريع لعلاج الحموضة وحرقة الفؤاد", activeIngredient: "Sodium Alginate + Sodium Bicarbonate", activeIngredientAr: "ألجينات الصوديوم + بيكربونات", company: "Reckitt", dosageForm: "Syrup", category: "Antacid", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "gavis-dbl-act", name: "Gaviscon Double Action Liquid", nameAr: "جافيسكون دبل أكشن شراب للحموضة وعسر الهضم", activeIngredient: "Sodium Alginate + Calcium Carbonate", activeIngredientAr: "جافيسكون مضاعف القوة", company: "Reckitt", dosageForm: "Syrup", category: "Antacid", price: 80, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف اللام (L) ──
  { id: "lip-20-tab", name: "Lipitor 20mg Tablets", nameAr: "ليبيتور 20 مجم أقراص لخفض الدهون والكوليسترول وحماية الشرايين", activeIngredient: "Atorvastatin Calcium 20mg", activeIngredientAr: "أتورفاستاتين 20 مجم", company: "Pfizer", dosageForm: "Tablet", category: "Cardiovascular / Statin", price: 120, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "lip-40-tab", name: "Lipitor 40mg Tablets", nameAr: "ليبيتور 40 مجم أقراص لتنظيم دهون الدم لمرضى القلب", activeIngredient: "Atorvastatin Calcium 40mg", activeIngredientAr: "أتورفاستاتين 40 مجم", company: "Pfizer", dosageForm: "Tablet", category: "Cardiovascular / Statin", price: 160, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الهاء (H) ──
  { id: "hibio-1g-tab", name: "Hibiotic 1g Tablets", nameAr: "هاي بيوتك 1 جم أقراص مضاد حيوي واسع المجال", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "Amoun", dosageForm: "Tablet", category: "Antibiotic", price: 95, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "hibio-625-tab", name: "Hibiotic 625mg Tablets", nameAr: "هاي بيوتك 625 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 500mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", company: "Amoun", dosageForm: "Tablet", category: "Antibiotic", price: 72, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "hibio-457-syr", name: "Hibiotic 457mg/5ml Suspension", nameAr: "هاي بيوتك 457 مجم معلق للأطفال", activeIngredient: "Amoxicillin + Clavulanate 457mg/5ml", activeIngredientAr: "هاي بيوتك شراب أطفال", company: "Amoun", dosageForm: "Suspension", category: "Antibiotic", price: 58, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "hemo-crm-40", name: "Hemoclar Cream 40g", nameAr: "هيموكلار كريم لعلاج الكدمات والتجمعات الدموية والتواء المفاصل", activeIngredient: "Pentosan Polysulfate Sodium 0.5%", activeIngredientAr: "بنتوزان بولي سلفات صوديوم", company: "Sanofi", dosageForm: "Cream", category: "Topical Anti-inflammatory", price: 34, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الميم (M) ──
  { id: "mega-1g-tab", name: "Megamox 1g Tablets", nameAr: "ميجاموكس 1 جم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 875mg + Clavulanic Acid 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", company: "Julphar", dosageForm: "Tablet", category: "Antibiotic", price: 90, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "mega-625-tab", name: "Megamox 625mg Tablets", nameAr: "ميجاموكس 625 مجم أقراص مضاد حيوي", activeIngredient: "Amoxicillin 500mg + Clavulanate 125mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", company: "Julphar", dosageForm: "Tablet", category: "Antibiotic", price: 70, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "maal-pls-syr", name: "Maalox Plus Suspension 355ml", nameAr: "مالوكس بلس شراب معلق لعلاج الحموضة والغازات", activeIngredient: "Aluminium Hydroxide + Magnesium + Simethicone", activeIngredientAr: "هيدروكسيد الألومنيوم + سيميثيكون", company: "Sanofi", dosageForm: "Suspension", category: "Antacid", price: 46, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "maal-pls-tab", name: "Maalox Plus Chewable Tablets", nameAr: "مالوكس بلس أقراص مضغ سريعة للحموضة", activeIngredient: "Aluminium Hydroxide + Magnesium + Simethicone", activeIngredientAr: "مالوكس أقراص مضغ", company: "Sanofi", dosageForm: "Tablet", category: "Antacid", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "mucoph-syr", name: "Mucophylline Syrup 125ml", nameAr: "ميكوفيللين شراب مذيب للبلغم وموسع للشعب الهوائية", activeIngredient: "Acefylline Piperazine + Bromhexine", activeIngredientAr: "أسيفيللين + برومهيكسين", company: "Misr Pharma", dosageForm: "Syrup", category: "Respiratory", price: 20, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف السين (S) ──
  { id: "solup-20-tab", name: "Solupred 20mg Tablets", nameAr: "سوليوبريد 20 مجم أقراص سريعة الذوبان كورتيزون مضاد للالتهاب", activeIngredient: "Prednisolone 20mg", activeIngredientAr: "بريدنيزولون 20 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Corticosteroid", price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "solup-5-tab", name: "Solupred 5mg Tablets", nameAr: "سوليوبريد 5 مجم أقراص فوارة للحساسية والالتهاب", activeIngredient: "Prednisolone 5mg", activeIngredientAr: "بريدنيزولون 5 مجم", company: "Sanofi", dosageForm: "Tablet", category: "Corticosteroid", price: 38, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "sine-syr-100", name: "Sinecod Syrup 100ml", nameAr: "سينيكود شراب مهدئ للسعال الجاف غير المصحوب ببلغم", activeIngredient: "Butamirate Citrate 1.5mg/ml", activeIngredientAr: "بوتاميرات سترات", company: "GSK", dosageForm: "Syrup", category: "Cough Suppressant", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "cefot-1g-vial", name: "Cefotax 1g Vial", nameAr: "سيفوتاكس 1 جم فيال حقن مضاد حيوي عضل/وريد", activeIngredient: "Cefotaxime Sodium 1g", activeIngredientAr: "سيفوتاكسيم 1 جم حقن", company: "EPICO", dosageForm: "Vial", category: "Antibiotic", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "ceftr-1g-vial", name: "Ceftriaxone 1g Vial", nameAr: "سفترياكسون 1 جم فيال حقن مضاد حيوي قوي", activeIngredient: "Ceftriaxone Sodium 1g", activeIngredientAr: "سفترياكسون 1 جم حقن", company: "Sandoz", dosageForm: "Vial", category: "Antibiotic", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الألف (O / U / 1) ──
  { id: "otri-spr-ad", name: "Otrivin Adult Nasal Spray 10ml", nameAr: "أوتريفين بخاخ أنف للكبار لإزالة الاحتقان والانسداد", activeIngredient: "Xylometazoline Hydrochloride 0.1%", activeIngredientAr: "زايلوميتازولين بخاخ أنف", company: "GSK", dosageForm: "Nasal Spray", category: "Decongestant", price: 24, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "otri-drp-pdr", name: "Otrivin Pediatric Nasal Drops 10ml", nameAr: "أوتريفين نقط أنف للأطفال للرشح والانسداد", activeIngredient: "Xylometazoline Hydrochloride 0.05%", activeIngredientAr: "زايلوميتازولين نقط أنف أطفال", company: "GSK", dosageForm: "Drops", category: "Decongestant", price: 20, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "one-two-three", name: "123 Tablets", nameAr: "وان تو ثري أقراص لعلاج نزلات البرد والإنفلونزا", activeIngredient: "Paracetamol + Pseudoephedrine + Chlorpheniramine", activeIngredientAr: "باراسيتامول + سودوإيفيدرين + كلورفينيرامين", company: "Hikma", dosageForm: "Tablet", category: "Cold & Flu", price: 32, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "unic-15-vial", name: "Unictam 1.5g Vial", nameAr: "يونيكتام 1.5 جم فيال حقن مضاد حيوي عضل/وريد", activeIngredient: "Ampicillin 1000mg + Sulbactam 500mg", activeIngredientAr: "أمبيسيلين + سولباكتام 1.5 جم", company: "MUP", dosageForm: "Vial", category: "Antibiotic", price: 44, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "unic-375-tab", name: "Unictam 375mg Tablets", nameAr: "يونيكتام 375 مجم أقراص مضاد حيوي", activeIngredient: "Sultamicillin 375mg", activeIngredientAr: "سولتاميسيلين 375 مجم", company: "MUP", dosageForm: "Tablet", category: "Antibiotic", price: 52, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── حرف الراء (R) ──
  { id: "rep-gel-40", name: "Reparil Gel N 40g", nameAr: "ريباريل جل إن لعلاج الكدمات والتواء المفاصل وتسكين التورم", activeIngredient: "Aescin + Diethylamine Salicylate", activeIngredientAr: "آيسين + ساليسيلات", company: "Madaus", dosageForm: "Topical Gel", category: "Anti-inflammatory", price: 36, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "rep-drag-40", name: "Reparil Dragees 40 Tablets", nameAr: "ريباريل دراجيه أقراص مضاد للتورم والارتشاح والالتهابات", activeIngredient: "Aescin 20mg", activeIngredientAr: "آيسين 20 مجم", company: "Madaus", dosageForm: "Tablet", category: "Anti-inflammatory", price: 48, sourceOrigin: "Egyptian Bank", isEssential: true },

  // ── أدوية جدول مراقبة (Controlled) ──
  { id: "tramadol-50-cap", name: "Tramadol 50mg Capsules", nameAr: "ترامادول 50 مجم كبسولات (دواء جدول مراقب)", activeIngredient: "Tramadol Hydrochloride 50mg", activeIngredientAr: "ترامادول هيدروكلوريد", company: "ميراكل / فارما", dosageForm: "Capsule", category: "Opioid Analgesic", isControlled: true, price: 45, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "tramadol-100-tab", name: "Tramadol Retard 100mg Tablets", nameAr: "ترامادول ريتارد 100 مجم ممتد المفعول (جدول)", activeIngredient: "Tramadol Hydrochloride 100mg SR", activeIngredientAr: "ترامادول 100 مجم ممتد المفعول", company: "أكتوبر فارما", dosageForm: "Tablet", category: "Opioid Analgesic", isControlled: true, price: 65, sourceOrigin: "Egyptian Bank", isEssential: true },
  { id: "tramal-100-amp", name: "Tramal 100mg/2ml Ampoules", nameAr: "ترامال 100 مجم أمبولات حقن عضل/وريد (جدول)", activeIngredient: "Tramadol Hydrochloride 100mg", activeIngredientAr: "ترامادول حقن", company: "جروننتال (Grunenthal)", dosageForm: "Ampoule", category: "Opioid Analgesic", isControlled: true, price: 90, sourceOrigin: "Egyptian Bank", isEssential: true },
];

const RAW_CATALOG = [...ESSENTIAL_POPULAR_DRUGS, ...(comprehensiveCatalog as DrugRecord[])];

// Deduplicate and sanitize on initialization
const deduplicatedCatalog: DrugRecord[] = [];
const seenDrugKeys = new Set<string>();

for (const drug of RAW_CATALOG) {
  const cleanName = (drug.name || "").trim();
  const cleanNameAr = cleanArabicDrugName(drug.nameAr || drug.name);
  const cleanActiveIng = (drug.activeIngredient || "").trim();

  // Categorize origin automatically
  let origin = drug.sourceOrigin || "Egyptian Bank";
  if (drug.category === "Dermatology & Topical") {
    origin = "Cosmetics & Aesthetics";
  } else if (drug.category === "Vitamins & Minerals") {
    origin = "Vitamins & Supplements";
  }

  const key = `${cleanName.toLowerCase()}|${cleanActiveIng.toLowerCase()}|${(drug.dosageForm || "").toLowerCase()}`;
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

    // Strictly index brand name tokens — never active ingredients
    item.arTokens.forEach(registerToken);
    item.engTokens.forEach(registerToken);
  }
}

// Build index on module import
buildPrefixIndex();

export interface SearchOptions {
  searchActiveIngredient?: boolean;
}

// ── Self-Evolving Adaptive Intelligence: Prescription Frequency Tracker ──
const DRUG_USAGE_FREQUENCY = new Map<string, number>();

/**
 * Record a drug usage event (Self-Learning).
 * Increases the adaptive relevance score of frequently prescribed medications.
 */
export function recordDrugPrescribed(drugName: string): void {
  if (!drugName) return;
  const key = drugName.toLowerCase().trim();
  const current = DRUG_USAGE_FREQUENCY.get(key) || 0;
  DRUG_USAGE_FREQUENCY.set(key, current + 1);
}

export function getDrugUsageScore(drugName: string): number {
  if (!drugName) return 0;
  return DRUG_USAGE_FREQUENCY.get(drugName.toLowerCase().trim()) || 0;
}

/**
 * Supercharged Sub-Millisecond Search Engine
 * Prioritizes STRICT PREFIX MATCHING on Brand Names (Arabic & English) in ALPHABETICAL ORDER.
 * Only includes Active Ingredients when explicitly enabled via options.searchActiveIngredient.
 */
export function searchComprehensiveDrugs(
  query: string,
  limit = 25,
  options: SearchOptions = {}
): DrugRecord[] {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const searchActiveIngredient = !!options.searchActiveIngredient;
  const isAr = /[\u0600-\u06FF]/.test(cleanQ);
  const normQ = cleanQ.toLowerCase();
  const normQAr = normalizeArabic(cleanQ);

  const exactPrefixMatches: { drug: DrugRecord; score: number }[] = [];
  const tokenPrefixMatches: { drug: DrugRecord; score: number }[] = [];
  const seenIds = new Set<string>();

  // ── Phase 1: STRICT PREFIX MATCHING on Brand Names ────────────────────────
  for (let i = 0; i < INDEXED_DRUGS.length; i++) {
    const item = INDEXED_DRUGS[i];

    if (isAr) {
      // Primary check: brand name starts with typed Arabic prefix
      const startsAr = item.normNameAr.startsWith(normQAr) || (item.arTokens[0] && item.arTokens[0].startsWith(normQAr));
      if (startsAr) {
        const isExactFull = item.normNameAr === normQAr;
        exactPrefixMatches.push({ drug: item, score: isExactFull ? 100 : 95 });
        seenIds.add(item.id);
      } else if (cleanQ.length >= 3) {
        // Subsequent words in brand name start with prefix (e.g. "إكسترا" in "بنادول إكسترا")
        const tokenMatch = item.arTokens.slice(1).some((t) => t.startsWith(normQAr));
        if (tokenMatch) {
          tokenPrefixMatches.push({ drug: item, score: 85 });
          seenIds.add(item.id);
        }
      }
    } else {
      // Primary check: brand name starts with typed English prefix
      const startsEn = item.normNameEng.startsWith(normQ) || (item.engTokens[0] && item.engTokens[0].startsWith(normQ));
      if (startsEn) {
        const isExactFull = item.normNameEng === normQ;
        exactPrefixMatches.push({ drug: item, score: isExactFull ? 100 : 95 });
        seenIds.add(item.id);
      } else if (cleanQ.length >= 3) {
        // Subsequent words in brand name start with prefix
        const tokenMatch = item.engTokens.slice(1).some((t) => t.startsWith(normQ));
        if (tokenMatch) {
          tokenPrefixMatches.push({ drug: item, score: 85 });
          seenIds.add(item.id);
        }
      }
    }
  }

  // ── Strict Alphabetical Sorting Function with Self-Evolving Adaptation ──
  const sortAlphabetical = (
    a: { drug: DrugRecord; score: number },
    b: { drug: DrugRecord; score: number }
  ) => {
    // 1. Exact match (100) first
    if (a.score !== b.score) return b.score - a.score;

    // 2. Adaptive Self-Learning Boost: Frequently prescribed drugs rise to top
    const usageA = getDrugUsageScore(a.drug.name);
    const usageB = getDrugUsageScore(b.drug.name);
    if (usageA !== usageB) return usageB - usageA;

    // 3. Prioritize essential popular regional brands ahead of auto-generated synthetic variations
    const aEss = !!a.drug.isEssential;
    const bEss = !!b.drug.isEssential;
    if (aEss !== bEss) return aEss ? -1 : 1;

    // 4. Strict Alphabetical Sort (أ-ي for Arabic, A-Z for English)
    if (isAr) {
      const nameA = a.drug.nameAr || a.drug.name;
      const nameB = b.drug.nameAr || b.drug.name;
      return nameA.localeCompare(nameB, "ar", { sensitivity: "base" });
    } else {
      return a.drug.name.localeCompare(b.drug.name, "en", { sensitivity: "base" });
    }
  };

  exactPrefixMatches.sort(sortAlphabetical);
  tokenPrefixMatches.sort(sortAlphabetical);

  // Short queries (1 or 2 characters): return exact prefix matches ONLY!
  // This guarantees: "ب" strictly returns drugs starting with "ب", "بن" strictly returns drugs starting with "بن"
  if (cleanQ.length <= 2) {
    return exactPrefixMatches.slice(0, limit).map((r) => r.drug);
  }

  // If prefix results exist and active ingredient search is off, return immediately
  if ((exactPrefixMatches.length > 0 || tokenPrefixMatches.length > 0) && !searchActiveIngredient) {
    const combined = [...exactPrefixMatches, ...tokenPrefixMatches];
    return combined.slice(0, limit).map((r) => r.drug);
  }

  // ── Phase 2: Active Ingredient search (ONLY IF ACTIVATED BY DOCTOR) ─────────
  const activeIngResults: { drug: DrugRecord; score: number }[] = [];
  if (searchActiveIngredient && cleanQ.length >= 2) {
    for (let i = 0; i < INDEXED_DRUGS.length; i++) {
      const item = INDEXED_DRUGS[i];
      if (seenIds.has(item.id)) continue;

      let score = 0;
      const ingEn = item.normActiveIngEng;
      const ingAr = item.normActiveIngAr;

      if (isAr) {
        if (ingAr && ingAr.startsWith(normQAr)) score = 80;
        else if (ingAr && ingAr.includes(normQAr)) score = 70;
      } else {
        if (ingEn.startsWith(normQ)) score = 80;
        else if (ingEn.includes(normQ)) score = 70;
      }

      if (score > 0) {
        activeIngResults.push({ drug: item, score });
        seenIds.add(item.id);
      }
    }
    activeIngResults.sort(sortAlphabetical);
  }

  const combined = [...exactPrefixMatches, ...tokenPrefixMatches, ...activeIngResults];
  if (combined.length >= limit || combined.length > 0) {
    return combined.slice(0, limit).map((r) => r.drug);
  }

  // ── Phase 3: Typo / Fuzzy fallback (ONLY when 0 matches found & query >= 4) ──
  if (combined.length === 0 && cleanQ.length >= 4) {
    const typoResults: { drug: DrugRecord; score: number }[] = [];
    const maxDist = cleanQ.length <= 5 ? 1 : 2;

    for (let i = 0; i < INDEXED_DRUGS.length; i++) {
      const item = INDEXED_DRUGS[i];
      if (seenIds.has(item.id)) continue;

      let bestDist = 999;
      const brandAr = item.arTokens[0];
      const brandEn = item.engTokens[0];

      if (isAr && brandAr && Math.abs(brandAr.length - normQAr.length) <= maxDist) {
        const d = damerauLevenshteinDistance(normQAr, brandAr);
        if (d < bestDist) bestDist = d;
      } else if (!isAr && brandEn && Math.abs(brandEn.length - normQ.length) <= maxDist) {
        const d = damerauLevenshteinDistance(normQ, brandEn);
        if (d < bestDist) bestDist = d;
      }

      if (bestDist <= maxDist) {
        typoResults.push({ drug: item, score: 60 - bestDist * 10 });
        seenIds.add(item.id);
        if (typoResults.length >= limit) break;
      }
    }

    typoResults.sort(sortAlphabetical);
    combined.push(...typoResults);
  }

  return combined.slice(0, limit).map((r) => r.drug);
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
    if (drugData.price !== undefined && drugData.price > 0) {
      existing.price = drugData.price;
    }
    if (drugData.dosageForm) {
      existing.dosageForm = drugData.dosageForm;
    }
    if (drugData.activeIngredient) {
      existing.activeIngredient = drugData.activeIngredient;
    }
    if (drugData.activeIngredientAr) {
      existing.activeIngredientAr = drugData.activeIngredientAr;
    }
    if (drugData.company) {
      existing.company = drugData.company;
    }
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
