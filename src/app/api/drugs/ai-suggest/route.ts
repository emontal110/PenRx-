import { NextResponse } from "next/server";
import { suggestDrugWithGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * AI Drug Suggestion Engine — v2.0
 * ─────────────────────────────────
 * When the local search engine finds nothing, this endpoint:
 *  1. Matches against an expanded clinical pharmacology rule-base
 *  2. Queries OpenFDA (free, no key needed) for real drug data
 *  3. Queries RxNorm (NLM) for active ingredient resolution
 *  4. Returns a LIST of candidate drugs the doctor can click to add directly
 */

interface DrugSuggestion {
  id: string;
  name: string;
  nameAr: string;
  activeIngredient: string;
  activeIngredientAr: string;
  category: string;
  dosageForm: string;
  recommendedDose: string;
  confidence: "High" | "Medium" | "Low";
  source: string;
}

// ── Expanded Clinical Pharmacology Rule-Base ──────────────────────────────────
const PHARMA_RULES: Array<{
  keys: string[];
  suggestions: Omit<DrugSuggestion, "id" | "source">[];
}> = [
  // الباء / P / B
  {
    keys: ["panadol", "paracet", "para", "بانادول", "بنادول", "باراسيتامول"],
    suggestions: [
      { name: "Panadol Advance 500mg Tablet", nameAr: "بنادول أدفانس 500 مجم قرص", activeIngredient: "Paracetamol 500mg", activeIngredientAr: "باراسيتامول 500 مجم", category: "Analgesic / Antipyretic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات عند اللزوم", confidence: "High" },
      { name: "Panadol Extra Tablet", nameAr: "بنادول اكسترا قرص", activeIngredient: "Paracetamol 500mg + Caffeine 65mg", activeIngredientAr: "باراسيتامول + كافيين", category: "Analgesic / Antipyretic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات مع الأكل", confidence: "High" },
      { name: "Panadol Joint 665mg Tablet", nameAr: "بنادول جوينت للمفاصل 665 مجم", activeIngredient: "Paracetamol 665mg", activeIngredientAr: "باراسيتامول ممتد المفعول", category: "Analgesic / Antipyretic", dosageForm: "Tablet", recommendedDose: "قرص مرتان يومياً", confidence: "High" },
      { name: "Panadol Night Tablet", nameAr: "بنادول نايت قرص", activeIngredient: "Paracetamol + Diphenhydramine", activeIngredientAr: "باراسيتامول + منوم خفيف", category: "Analgesic / Antipyretic", dosageForm: "Tablet", recommendedDose: "قرصان قبل النوم بنصف ساعة", confidence: "High" },
      { name: "Panadol Syrup 120mg/5ml", nameAr: "بنادول شراب للأطفال", activeIngredient: "Paracetamol 120mg/5ml", activeIngredientAr: "باراسيتامول شراب", category: "Analgesic / Antipyretic", dosageForm: "Syrup", recommendedDose: "5-10مل كل 6 ساعات حسب العمر", confidence: "High" },
    ],
  },
  {
    keys: ["buscopan", "busc", "بوسكوبان", "بوسك"],
    suggestions: [
      { name: "Buscopan 10mg Tablet", nameAr: "بوسكوبان 10 مجم قرص", activeIngredient: "Hyoscine Butylbromide 10mg", activeIngredientAr: "هيوسين بيوتيل بروميد", category: "Antispasmodic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات عند المغص أو التقلصات", confidence: "High" },
      { name: "Buscopan Plus Tablet", nameAr: "بوسكوبان بلس قرص", activeIngredient: "Hyoscine Butylbromide + Paracetamol", activeIngredientAr: "هيوسين + باراسيتامول", category: "Antispasmodic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات بعد الأكل", confidence: "High" },
      { name: "Buscopan 20mg Ampoule", nameAr: "بوسكوبان 20 مجم أمبول حقن", activeIngredient: "Hyoscine Butylbromide 20mg", activeIngredientAr: "هيوسين حقن عضل/وريد", category: "Antispasmodic", dosageForm: "Ampoule", recommendedDose: "أمبول عضل عند التقلصات الحادة", confidence: "High" },
    ],
  },
  {
    keys: ["brufen", "ibu", "ibupro", "بروفين", "ايبوبروفين"],
    suggestions: [
      { name: "Brufen 400mg Tablet", nameAr: "بروفين 400 مجم قرص", activeIngredient: "Ibuprofen 400mg", activeIngredientAr: "إيبوبروفين 400 مجم", category: "NSAID / Analgesic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات بعد الأكل مباشرة", confidence: "High" },
      { name: "Brufen 600mg Tablet", nameAr: "بروفين 600 مجم قرص", activeIngredient: "Ibuprofen 600mg", activeIngredientAr: "إيبوبروفين 600 مجم", category: "NSAID / Analgesic", dosageForm: "Tablet", recommendedDose: "قرص مرتان يومياً بعد الأكل", confidence: "High" },
      { name: "Brufen Retard 800mg Tablet", nameAr: "بروفين ريتارد 800 مجم", activeIngredient: "Ibuprofen 800mg SR", activeIngredientAr: "إيبوبروفين 800 مجم مديدة المفعول", category: "NSAID / Analgesic", dosageForm: "Tablet", recommendedDose: "قرص مرتان يومياً بعد الأكل", confidence: "High" },
      { name: "Brufen Syrup 100mg/5ml", nameAr: "بروفين شراب خافض حرارة للأطفال", activeIngredient: "Ibuprofen 100mg/5ml", activeIngredientAr: "إيبوبروفين شراب أطفال", category: "Analgesic / Antipyretic", dosageForm: "Syrup", recommendedDose: "5مل كل 8 ساعات بعد الرضاعة/الأكل", confidence: "High" },
    ],
  },
  {
    keys: ["betadine", "beta", "بيتادين", "بيتا"],
    suggestions: [
      { name: "Betadine Antiseptic Solution", nameAr: "بيتادين مطهر موضعي 10%", activeIngredient: "Povidone Iodine 10%", activeIngredientAr: "بوفيدون يود 10%", category: "Antiseptic", dosageForm: "Topical Solution", recommendedDose: "دهان موضعي معقم مرتان يومياً", confidence: "High" },
      { name: "Betadine Ointment", nameAr: "بيتادين مرهم معقم للجروح", activeIngredient: "Povidone Iodine 10%", activeIngredientAr: "بوفيدون يود مرهم", category: "Antiseptic", dosageForm: "Ointment", recommendedDose: "دهان طبقة رقيقة على الجرح مع غيار نظيف", confidence: "High" },
      { name: "Betadine Gargle & Mouthwash", nameAr: "بيتادين مضمضة وغرغرة للفم والحلق", activeIngredient: "Povidone Iodine 1%", activeIngredientAr: "بوفيدون يود غرغرة", category: "Antiseptic", dosageForm: "Mouthwash", recommendedDose: "مضمضة مخففة بالماء 3 مرات يومياً", confidence: "High" },
    ],
  },
  {
    keys: ["pantoloc", "panto", "بانتولوك", "بانتو"],
    suggestions: [
      { name: "Pantoloc 20mg Tablet", nameAr: "بانتولوك 20 مجم قرص", activeIngredient: "Pantoprazole 20mg", activeIngredientAr: "بانتوبرازول 20 مجم", category: "Gastrointestinal / PPI", dosageForm: "Tablet", recommendedDose: "قرص صباحاً على الريق قبل الفطور بنصف ساعة", confidence: "High" },
      { name: "Pantoloc 40mg Tablet", nameAr: "بانتولوك 40 مجم قرص", activeIngredient: "Pantoprazole 40mg", activeIngredientAr: "بانتوبرازول 40 مجم", category: "Gastrointestinal / PPI", dosageForm: "Tablet", recommendedDose: "قرص صباحاً على الريق يومياً لمدة 4-8 أسابيع", confidence: "High" },
    ],
  },

  // الألف / A
  {
    keys: ["amox", "amoxil", "اموكس", "اموكسيل", "أموكسيل"],
    suggestions: [
      { name: "Amoxil 500mg Capsule", nameAr: "أموكسيل 500 مجم كبسولة", activeIngredient: "Amoxicillin 500mg", activeIngredientAr: "أموكسيسيلين 500 مجم", category: "Antibiotic", dosageForm: "Capsule", recommendedDose: "كبسولة كل 8 ساعات بعد الأكل لمدة 7-10 أيام", confidence: "High" },
      { name: "Amoxil 250mg/5ml Suspension", nameAr: "أموكسيل 250 مجم/5مل معلق", activeIngredient: "Amoxicillin 250mg/5ml", activeIngredientAr: "أموكسيسيلين معلق للأطفال", category: "Antibiotic", dosageForm: "Suspension", recommendedDose: "5مل كل 8 ساعات للأطفال حسب الوزن", confidence: "High" },
    ],
  },
  {
    keys: ["augment", "اوجمنتين", "أوجمنتين"],
    suggestions: [
      { name: "Augmentin 1g Tablet", nameAr: "أوجمنتين 1 جم قرص", activeIngredient: "Amoxicillin+Clavulanate 1g", activeIngredientAr: "أموكسيسيلين+كلافيولانات 1 جم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
      { name: "Augmentin 625mg Tablet", nameAr: "أوجمنتين 625 مجم قرص", activeIngredient: "Amoxicillin+Clavulanate 625mg", activeIngredientAr: "أموكسيسيلين+كلافيولانات 625 مجم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
      { name: "Augmentin 457mg Suspension", nameAr: "أوجمنتين 457 مجم معلق للأطفال", activeIngredient: "Amoxicillin+Clavulanate 457mg/5ml", activeIngredientAr: "أموكسيسيلين شراب معلق", category: "Antibiotic", dosageForm: "Suspension", recommendedDose: "حسب وزن الطفل كل 12 ساعة", confidence: "High" },
    ],
  },
  {
    keys: ["antinal", "antin", "انتينال", "أنتينال"],
    suggestions: [
      { name: "Antinal 200mg Capsule", nameAr: "أنتينال 200 مجم كبسولة", activeIngredient: "Nifuroxazide 200mg", activeIngredientAr: "نيفوروكسازيد 200 مجم", category: "Gastrointestinal", dosageForm: "Capsule", recommendedDose: "كبسولة 4 مرات يومياً بعد الأكل", confidence: "High" },
      { name: "Antinal Suspension", nameAr: "أنتينال معلق للأطفال", activeIngredient: "Nifuroxazide 220mg/5ml", activeIngredientAr: "نيفوروكسازيد شراب مطهر معوي", category: "Gastrointestinal", dosageForm: "Suspension", recommendedDose: "ملعقة صغيرة 3 مرات يومياً", confidence: "High" },
    ],
  },
  {
    keys: ["alphintern", "alphin", "الفانترن", "ألفانترن"],
    suggestions: [
      { name: "Alphintern Tablet", nameAr: "ألفانترن قرص مضاد للتورم والارتشاح", activeIngredient: "Chymotrypsin + Trypsin", activeIngredientAr: "كيموتربسين + تربسين", category: "Anti-inflammatory", dosageForm: "Tablet", recommendedDose: "قرص قبل الأكل بنصف ساعة 3 مرات يومياً", confidence: "High" },
    ],
  },

  // الكاف / C / K
  {
    keys: ["cataflam", "cataf", "كتافلام", "كتاف"],
    suggestions: [
      { name: "Cataflam 50mg Tablet", nameAr: "كتافلام 50 مجم قرص", activeIngredient: "Diclofenac Potassium 50mg", activeIngredientAr: "ديكلوفيناك بوتاسيوم 50 مجم", category: "Analgesic / NSAID", dosageForm: "Tablet", recommendedDose: "قرص بعد الأكل كل 8-12 ساعة", confidence: "High" },
      { name: "Cataflam 75mg Ampoule", nameAr: "كتافلام 75 مجم أمبول حقن", activeIngredient: "Diclofenac Potassium 75mg", activeIngredientAr: "ديكلوفيناك حقن عضل", category: "Analgesic / NSAID", dosageForm: "Ampoule", recommendedDose: "أمبول عضل عند الألم الشديد", confidence: "High" },
      { name: "Catafly Oral Suspension", nameAr: "كتافلاي معلق للأطفال", activeIngredient: "Diclofenac Resinate", activeIngredientAr: "ديكلوفيناك شراب مسكن للأطفال", category: "Analgesic / Antipyretic", dosageForm: "Suspension", recommendedDose: "حسب وزن الطفل والحرارة", confidence: "High" },
    ],
  },
  {
    keys: ["concor", "conc", "كونكور", "كونك"],
    suggestions: [
      { name: "Concor 2.5mg Tablet", nameAr: "كونكور 2.5 مجم قرص", activeIngredient: "Bisoprolol Fumarate 2.5mg", activeIngredientAr: "بيسوبرولول 2.5 مجم", category: "Cardiovascular / Beta Blocker", dosageForm: "Tablet", recommendedDose: "قرص صباحاً يومياً بانتظام", confidence: "High" },
      { name: "Concor 5mg Tablet", nameAr: "كونكور 5 مجم قرص", activeIngredient: "Bisoprolol Fumarate 5mg", activeIngredientAr: "بيسوبرولول 5 مجم", category: "Cardiovascular / Beta Blocker", dosageForm: "Tablet", recommendedDose: "قرص صباحاً يومياً بعد الإفطار", confidence: "High" },
      { name: "Concor 10mg Tablet", nameAr: "كونكور 10 مجم قرص", activeIngredient: "Bisoprolol Fumarate 10mg", activeIngredientAr: "بيسوبرولول 10 مجم", category: "Cardiovascular / Beta Blocker", dosageForm: "Tablet", recommendedDose: "قرص صباحاً يومياً حسب ضغط الدم", confidence: "High" },
    ],
  },
  {
    keys: ["congestal", "conges", "كونجستال", "كونج"],
    suggestions: [
      { name: "Congestal Tablet", nameAr: "كونجستال قرص للبرد والإنفلونزا", activeIngredient: "Paracetamol + Pseudoephedrine + Chlorpheniramine", activeIngredientAr: "باراسيتامول + مزيل احتقان", category: "Cold & Flu", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات بعد الأكل", confidence: "High" },
      { name: "Congestal Syrup", nameAr: "كونجستال شراب للأطفال", activeIngredient: "Paracetamol + Pseudoephedrine + Chlorpheniramine", activeIngredientAr: "كونجستال شراب أطفال", category: "Cold & Flu", dosageForm: "Syrup", recommendedDose: "5مل كل 8 ساعات", confidence: "High" },
    ],
  },

  // الفاء / F / V
  {
    keys: ["flagyl", "flag", "فلاجيل", "فلاج"],
    suggestions: [
      { name: "Flagyl 500mg Tablet", nameAr: "فلاجيل 500 مجم قرص", activeIngredient: "Metronidazole 500mg", activeIngredientAr: "ميترونيدازول 500 مجم", category: "Antiparasitic / Antibacterial", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات وسط الأكل لمدة أسبوع", confidence: "High" },
      { name: "Flagyl 250mg Tablet", nameAr: "فلاجيل 250 مجم قرص", activeIngredient: "Metronidazole 250mg", activeIngredientAr: "ميترونيدازول 250 مجم", category: "Antiparasitic", dosageForm: "Tablet", recommendedDose: "قرص كل 8 ساعات وسط الأكل", confidence: "High" },
      { name: "Flagyl Suspension 125mg", nameAr: "فلاجيل شراب للأطفال", activeIngredient: "Metronidazole 125mg/5ml", activeIngredientAr: "ميترونيدازول شراب معلق", category: "Antiparasitic", dosageForm: "Suspension", recommendedDose: "5مل كل 8 ساعات للأطفال", confidence: "High" },
    ],
  },
  {
    keys: ["voltaren", "volt", "فولتارين", "فولت"],
    suggestions: [
      { name: "Voltaren 50mg Tablet", nameAr: "فولتارين 50 مجم قرص", activeIngredient: "Diclofenac Sodium 50mg", activeIngredientAr: "ديكلوفيناك صوديوم 50 مجم", category: "Analgesic / NSAID", dosageForm: "Tablet", recommendedDose: "قرص بعد الأكل كل 8-12 ساعة", confidence: "High" },
      { name: "Voltaren 75mg Ampoule", nameAr: "فولتارين 75 مجم أمبول حقن", activeIngredient: "Diclofenac Sodium 75mg", activeIngredientAr: "ديكلوفيناك صوديوم حقن عضل", category: "Analgesic / NSAID", dosageForm: "Ampoule", recommendedDose: "حقنة عضلية عميقة عند الألم", confidence: "High" },
      { name: "Voltaren Emulgel 50g", nameAr: "فولتارين إيملجل مسكن موضعي", activeIngredient: "Diclofenac Diethylamine", activeIngredientAr: "ديكلوفيناك جل موضعي", category: "Topical Analgesic", dosageForm: "Topical Gel", recommendedDose: "تدليك مكان الألم 3-4 مرات يومياً", confidence: "High" },
    ],
  },
  {
    keys: ["ventolin", "vent", "فنتولين", "فنت"],
    suggestions: [
      { name: "Ventolin Evohaler Inhaler", nameAr: "فنتولين بخاخ صدر موسع للشعب", activeIngredient: "Salbutamol 100mcg/puff", activeIngredientAr: "سالبوتامول بخاخ أزمة", category: "Respiratory", dosageForm: "Inhaler", recommendedDose: "بختان عند ضيق التنفس أو الأزمة", confidence: "High" },
      { name: "Ventolin Respirator Solution", nameAr: "فنتولين محلول جلسات استنشاق", activeIngredient: "Salbutamol 5mg/ml", activeIngredientAr: "سالبوتامول جلسات نبيولايزر", category: "Respiratory", dosageForm: "Drops", recommendedDose: "0.5-1مل مخفف بمحلول ملح في جلسة الاستنشاق", confidence: "High" },
      { name: "Ventolin Syrup", nameAr: "فنتولين شراب موسع للشعب", activeIngredient: "Salbutamol 2mg/5ml", activeIngredientAr: "سالبوتامول شراب", category: "Respiratory", dosageForm: "Syrup", recommendedDose: "ملعقة صغيرة 3 مرات يومياً", confidence: "High" },
    ],
  },

  // الزاي / Z
  {
    keys: ["zithro", "azith", "زيثروماكس", "زيثرو", "أزيثرو"],
    suggestions: [
      { name: "Zithromax 500mg Capsule", nameAr: "زيثروماكس 500 مجم كبسولة", activeIngredient: "Azithromycin 500mg", activeIngredientAr: "أزيثروميسين 500 مجم", category: "Macrolide Antibiotic", dosageForm: "Capsule", recommendedDose: "كبسولة يومياً قبل الأكل بساعة لمدة 3 أيام", confidence: "High" },
      { name: "Zithromax Suspension", nameAr: "زيثروماكس شراب للأطفال", activeIngredient: "Azithromycin 200mg/5ml", activeIngredientAr: "أزيثروميسين شراب", category: "Macrolide Antibiotic", dosageForm: "Suspension", recommendedDose: "جرعة واحدة يومياً لمدة 3 أيام", confidence: "High" },
    ],
  },
  {
    keys: ["zyrtec", "zyrt", "زيرتك", "زيرت"],
    suggestions: [
      { name: "Zyrtec 10mg Tablet", nameAr: "زيرتك 10 مجم قرص للحساسية", activeIngredient: "Cetirizine 10mg", activeIngredientAr: "سيتريزين 10 مجم", category: "Antihistamine", dosageForm: "Tablet", recommendedDose: "قرص واحد مساءً قبل النوم", confidence: "High" },
      { name: "Zyrtec Oral Drops", nameAr: "زيرتك نقط أطفال للحساسية", activeIngredient: "Cetirizine 10mg/ml", activeIngredientAr: "سيتريزين نقط للأطفال", category: "Antihistamine", dosageForm: "Drops", recommendedDose: "5-10 نقط بالفم مساءً", confidence: "High" },
    ],
  },

  // التاء / T
  {
    keys: ["telfast", "telf", "تيلفاست", "تيلف"],
    suggestions: [
      { name: "Telfast 120mg Tablet", nameAr: "تيلفاست 120 مجم قرص لحساسية الأنف", activeIngredient: "Fexofenadine HCl 120mg", activeIngredientAr: "فيكسوفينادين 120 مجم", category: "Antihistamine", dosageForm: "Tablet", recommendedDose: "قرص واحد يومياً صباحاً", confidence: "High" },
      { name: "Telfast 180mg Tablet", nameAr: "تيلفاست 180 مجم قرص للحساسية والارتيكاريا", activeIngredient: "Fexofenadine HCl 180mg", activeIngredientAr: "فيكسوفينادين 180 مجم", category: "Antihistamine", dosageForm: "Tablet", recommendedDose: "قرص واحد يومياً للحساسية الجلدية", confidence: "High" },
    ],
  },
  {
    keys: ["toplexil", "topl", "توبلكسيل", "توبل"],
    suggestions: [
      { name: "Toplexil Syrup 125ml", nameAr: "توبلكسيل شراب مهدئ للكحة", activeIngredient: "Oxomemazine + Guaifenesin", activeIngredientAr: "أوكسوميمازين مهدئ سعال", category: "Cough & Cold", dosageForm: "Syrup", recommendedDose: "ملعقة كبيرة 3 مرات يومياً وقبل النوم", confidence: "High" },
    ],
  },

  // النون / N
  {
    keys: ["nexium", "nex", "نيكسيوم", "نيكس"],
    suggestions: [
      { name: "Nexium 20mg Tablet", nameAr: "نيكسيوم 20 مجم قرص للحموضة", activeIngredient: "Esomeprazole 20mg", activeIngredientAr: "إيزوميبرازول 20 مجم", category: "Gastrointestinal / PPI", dosageForm: "Tablet", recommendedDose: "قرص على الريق قبل الإفطار بنصف ساعة", confidence: "High" },
      { name: "Nexium 40mg Tablet", nameAr: "نيكسيوم 40 مجم قرص لقرحة المعدة والارتجاع", activeIngredient: "Esomeprazole 40mg", activeIngredientAr: "إيزوميبرازول 40 مجم", category: "Gastrointestinal / PPI", dosageForm: "Tablet", recommendedDose: "قرص على الريق يومياً لمدة شهر", confidence: "High" },
    ],
  },

  // الدال / D
  {
    keys: ["daflon", "daf", "دافلوين", "دافل"],
    suggestions: [
      { name: "Daflon 500mg Tablet", nameAr: "دافلوين 500 مجم قرص للبواسير والدوالي", activeIngredient: "Micronized Flavonoids 500mg", activeIngredientAr: "ديوسمين + هسبيريدين", category: "Vascular Protectant", dosageForm: "Tablet", recommendedDose: "قرصان يومياً مع الوجبات", confidence: "High" },
      { name: "Daflon 1000mg Tablet", nameAr: "دافلوين 1000 مجم قرص للبواسير الحادة", activeIngredient: "Micronized Flavonoids 1000mg", activeIngredientAr: "ديوسمين 1000 مجم", category: "Vascular Protectant", dosageForm: "Tablet", recommendedDose: "قرص بعد الأكل حسب النوبة", confidence: "High" },
    ],
  },
  {
    keys: ["duspatalin", "dusp", "دوسباتالين", "دوسب"],
    suggestions: [
      { name: "Duspatalin 135mg Tablet", nameAr: "دوسباتالين 135 مجم قرص للقولون العصبي", activeIngredient: "Mebeverine HCl 135mg", activeIngredientAr: "ميبفرين 135 مجم", category: "Antispasmodic / IBS", dosageForm: "Tablet", recommendedDose: "قرص قبل الأكل بثلث ساعة 3 مرات يومياً", confidence: "High" },
      { name: "Duspatalin Retard 200mg", nameAr: "دوسباتالين ريتارد 200 مجم كبسولات ممتدة المفعول", activeIngredient: "Mebeverine HCl 200mg SR", activeIngredientAr: "ميبفرين 200 مجم", category: "Antispasmodic / IBS", dosageForm: "Capsule", recommendedDose: "كبسولة قبل الإفطار والعشاء بثلث ساعة", confidence: "High" },
    ],
  },

  // الجيم / G
  {
    keys: ["glucoph", "metform", "جلوكوفاج", "جلوك"],
    suggestions: [
      { name: "Glucophage 500mg Tablet", nameAr: "جلوكوفاج 500 مجم قرص", activeIngredient: "Metformin HCl 500mg", activeIngredientAr: "ميتفورمين 500 مجم", category: "Antidiabetic", dosageForm: "Tablet", recommendedDose: "قرص مع الإفطار والعشاء", confidence: "High" },
      { name: "Glucophage 1000mg Tablet", nameAr: "جلوكوفاج 1000 مجم قرص", activeIngredient: "Metformin HCl 1000mg", activeIngredientAr: "ميتفورمين 1000 مجم", category: "Antidiabetic", dosageForm: "Tablet", recommendedDose: "قرص مرتان يومياً مع الوجبات", confidence: "High" },
      { name: "Glucophage XR 1000mg Tablet", nameAr: "جلوكوفاج إكس آر 1000 مجم ممتد المفعول", activeIngredient: "Metformin HCl 1000mg XR", activeIngredientAr: "ميتفورمين ممتد الإفراز", category: "Antidiabetic", dosageForm: "Tablet", recommendedDose: "قرص مساءً بعد العشاء", confidence: "High" },
    ],
  },

  // اللام / L
  {
    keys: ["lipitor", "atorv", "ليبيتور", "ليبي"],
    suggestions: [
      { name: "Lipitor 20mg Tablet", nameAr: "ليبيتور 20 مجم قرص لخفض الكوليسترول", activeIngredient: "Atorvastatin 20mg", activeIngredientAr: "أتورفاستاتين 20 مجم", category: "Lipid-Lowering / Statin", dosageForm: "Tablet", recommendedDose: "قرص مساءً قبل النوم بانتظام", confidence: "High" },
      { name: "Lipitor 40mg Tablet", nameAr: "ليبيتور 40 مجم قرص", activeIngredient: "Atorvastatin 40mg", activeIngredientAr: "أتورفاستاتين 40 مجم", category: "Lipid-Lowering / Statin", dosageForm: "Tablet", recommendedDose: "قرص مساءً قبل النوم", confidence: "High" },
    ],
  },

  // الميم / M
  {
    keys: ["megamox", "mega", "ميجاموكس", "ميجا"],
    suggestions: [
      { name: "Megamox 1g Tablet", nameAr: "ميجاموكس 1 جم قرص مضاد حيوي", activeIngredient: "Amoxicillin + Clavulanate 1g", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
      { name: "Megamox 625mg Tablet", nameAr: "ميجاموكس 625 مجم قرص", activeIngredient: "Amoxicillin + Clavulanate 625mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
    ],
  },

  // الهاء / H
  {
    keys: ["hibiotic", "hibio", "هاي بيوتك", "هاي"],
    suggestions: [
      { name: "Hibiotic 1g Tablet", nameAr: "هاي بيوتك 1 جم قرص مضاد حيوي", activeIngredient: "Amoxicillin + Clavulanate 1g", activeIngredientAr: "أموكسيسيلين + كلافولانات 1 جم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
      { name: "Hibiotic 625mg Tablet", nameAr: "هاي بيوتك 625 مجم قرص", activeIngredient: "Amoxicillin + Clavulanate 625mg", activeIngredientAr: "أموكسيسيلين + كلافولانات 625 مجم", category: "Antibiotic", dosageForm: "Tablet", recommendedDose: "قرص كل 12 ساعة بعد الأكل", confidence: "High" },
    ],
  },
];

// ── Fetch from OpenFDA (free, no API key) ─────────────────────────────────────
async function fetchFromOpenFDA(query: string): Promise<DrugSuggestion[]> {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(query)}"&limit=5`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results?.length) return [];

    return data.results.slice(0, 4).map((r: any, i: number) => {
      const brandName = r.openfda?.brand_name?.[0] || query;
      const genericName = r.openfda?.generic_name?.[0] || r.openfda?.substance_name?.[0] || "Active Ingredient";
      const route = r.openfda?.route?.[0] || "Oral";
      const manufacturer = r.openfda?.manufacturer_name?.[0] || "International";
      return {
        id: `fda-${i}-${Date.now()}`,
        name: brandName,
        nameAr: brandName,
        activeIngredient: genericName,
        activeIngredientAr: genericName,
        category: r.openfda?.pharm_class_cs?.[0] || "International Drug",
        dosageForm: route === "OPHTHALMIC" ? "Eye Drops" : route === "TOPICAL" ? "Cream / Ointment" : "Tablet",
        recommendedDose: "حسب تعليمات الطبيب والنشرة الداخلية",
        confidence: "Medium" as const,
        source: `OpenFDA — ${manufacturer}`,
      };
    });
  } catch {
    return [];
  }
}

// ── Fetch from RxNorm (NLM — free) ────────────────────────────────────────────
async function fetchFromRxNorm(query: string): Promise<DrugSuggestion[]> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const groups = data.drugGroup?.conceptGroup || [];
    const results: DrugSuggestion[] = [];

    for (const group of groups) {
      if (!group.conceptProperties) continue;
      for (const concept of group.conceptProperties.slice(0, 3)) {
        results.push({
          id: `rxnorm-${concept.rxcui}`,
          name: concept.name,
          nameAr: concept.name,
          activeIngredient: concept.synonym || concept.name,
          activeIngredientAr: concept.name,
          category: group.tty === "BN" ? "Brand Name Drug" : group.tty === "IN" ? "Generic Drug" : "Drug",
          dosageForm: "Tablet / Capsule",
          recommendedDose: "حسب وصف الطبيب",
          confidence: "Medium" as const,
          source: "RxNorm — NLM",
        });
      }
    }

    return results.slice(0, 4);
  } catch {
    return [];
  }
}

function normalizeAr(str: string): string {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[أإآء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { drugName } = await request.json();
    if (!drugName?.trim()) {
      return NextResponse.json({ error: "Drug name required" }, { status: 400 });
    }

    const cleanInput = drugName.trim();
    const query = cleanInput.toLowerCase();
    const isAr = /[\u0600-\u06FF]/.test(cleanInput);
    const normQAr = normalizeAr(cleanInput);

    const suggestions: DrugSuggestion[] = [];
    const seenNames = new Set<string>();

    const addSuggestion = (s: DrugSuggestion) => {
      const key = s.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        suggestions.push(s);
      }
    };

    // 1. Match local rule-base with STRICT PREFIX priority
    for (const rule of PHARMA_RULES) {
      const isMatch = rule.keys.some((k) => {
        const normK = normalizeAr(k);
        return isAr
          ? normK.startsWith(normQAr) || normQAr.startsWith(normK)
          : k.toLowerCase().startsWith(query) || query.startsWith(k.toLowerCase());
      });

      if (isMatch) {
        for (const s of rule.suggestions) {
          // Check if candidate actually matches the typed prefix
          const sNameNorm = s.name.toLowerCase();
          const sNameArNorm = normalizeAr(s.nameAr);
          const prefixMatch = isAr
            ? sNameArNorm.startsWith(normQAr) || sNameNorm.startsWith(query)
            : sNameNorm.startsWith(query);

          if (prefixMatch || cleanInput.length >= 3) {
            addSuggestion({
              ...s,
              id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              source: "PenRX+ Clinical DB",
            });
          }
        }
      }
    }

    // 2. If fewer than 3 local results and query length >= 3, query external APIs in parallel
    if (suggestions.length < 3 && cleanInput.length >= 3) {
      const [fdaResults, rxResults] = await Promise.allSettled([
        fetchFromOpenFDA(cleanInput),
        fetchFromRxNorm(cleanInput),
      ]);

      if (fdaResults.status === "fulfilled") {
        fdaResults.value.forEach((item) => {
          if (!isAr || item.name.toLowerCase().startsWith(query)) addSuggestion(item);
        });
      }
      if (rxResults.status === "fulfilled") {
        rxResults.value.forEach((item) => {
          if (!isAr || item.name.toLowerCase().startsWith(query)) addSuggestion(item);
        });
      }
    }

    // 3. Google Gemini 3.8 Flash Deep Synthesis (Strictly for query prefix)
    if (suggestions.length === 0 && cleanInput.length >= 3) {
      try {
        const geminiSuggestions = await suggestDrugWithGemini(cleanInput);
        if (geminiSuggestions && geminiSuggestions.length > 0) {
          geminiSuggestions.forEach((g: any, i: number) => {
            addSuggestion({
              id: `gemini-sug-${Date.now()}-${i}`,
              name: g.name,
              nameAr: g.nameAr || g.name,
              activeIngredient: g.activeIngredient,
              activeIngredientAr: g.activeIngredientAr || g.activeIngredient,
              category: g.category || "General Medication",
              dosageForm: g.dosageForm || "Tablet",
              recommendedDose: g.recommendedDose || "حسب وصف الطبيب",
              confidence: g.confidence || "High",
              source: "Google Gemini 3.8 Flash AI",
            });
          });
        }
      } catch {
        // Silent failover
      }
    }

    // 4. Always add a generic fallback formatted to start with the user's typed prefix
    if (suggestions.length === 0) {
      suggestions.push(
        {
          id: `gen-tab-${Date.now()}`,
          name: `${cleanInput} Tablet (قرص)`,
          nameAr: `${cleanInput} قرص`,
          activeIngredient: `${cleanInput} (Active Formula)`,
          activeIngredientAr: `${cleanInput} - مادة فعالة`,
          category: "General Medicine",
          dosageForm: "Tablet (قرص)",
          recommendedDose: "حسب وصف الطبيب المعالج",
          confidence: "Low",
          source: "PenRX+ Clinical Assistant",
        },
        {
          id: `gen-cap-${Date.now()}`,
          name: `${cleanInput} Capsule (كبسولة)`,
          nameAr: `${cleanInput} كبسولة`,
          activeIngredient: `${cleanInput} (Active Formula)`,
          activeIngredientAr: `${cleanInput} - مادة فعالة`,
          category: "General Medicine",
          dosageForm: "Capsule (كبسولة)",
          recommendedDose: "حسب وصف الطبيب المعالج",
          confidence: "Low",
          source: "PenRX+ Clinical Assistant",
        },
        {
          id: `gen-syr-${Date.now()}`,
          name: `${cleanInput} Syrup (شراب)`,
          nameAr: `${cleanInput} شراب`,
          activeIngredient: `${cleanInput} (Active Formula)`,
          activeIngredientAr: `${cleanInput} - مادة فعالة`,
          category: "General Medicine",
          dosageForm: "Syrup (شراب)",
          recommendedDose: "5-10مل حسب العمر والوزن",
          confidence: "Low",
          source: "PenRX+ Clinical Assistant",
        }
      );
    }

    // ── Strict Alphabetical Sort for Suggestions ───────────────────────────
    suggestions.sort((a, b) => {
      // 1. Prefix match priority
      const aStarts = isAr
        ? normalizeAr(a.nameAr).startsWith(normQAr) || a.name.toLowerCase().startsWith(query)
        : a.name.toLowerCase().startsWith(query);
      const bStarts = isAr
        ? normalizeAr(b.nameAr).startsWith(normQAr) || b.name.toLowerCase().startsWith(query)
        : b.name.toLowerCase().startsWith(query);

      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      // 2. Alphabetical sort (أ-ي for Arabic, A-Z for English)
      if (isAr) {
        const nameA = a.nameAr || a.name;
        const nameB = b.nameAr || b.name;
        return nameA.localeCompare(nameB, "ar", { sensitivity: "base" });
      } else {
        return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
      }
    });

    return NextResponse.json({
      success: true,
      query: cleanInput,
      suggestions: suggestions.slice(0, 10),
      totalFound: suggestions.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
