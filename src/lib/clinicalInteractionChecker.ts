/**
 * Instant Client-Side & Server-Side Clinical Drug Interaction & Contraindication Engine
 * ──────────────────────────────────────────────────────────────────────────────────────
 * 1. Evaluates candidate drugs in real-time (<0.1ms) against currently prescribed items.
 * 2. Evaluates the full prescription list against Drug-Drug, Drug-Allergy, and Drug-Disease rules
 *    with 100% offline reliability in both English and Arabic.
 */

export interface InteractionConflict {
  hasConflict: boolean;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  conflictingWith: string;
  reasonAr: string;
  recommendationAr?: string;
}

export interface FullInteractionAlert {
  id: string;
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  titleEn: string;
  mechanismAr: string;
  recommendationAr: string;
  involvedDrugs: string[];
}

interface InteractionRule {
  id: string;
  groupA: string[];
  groupB: string[];
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  recommendationAr: string;
}

const NSAID_TOKENS = [
  "diclofenac", "ibuprofen", "ketoprofen", "ketorolac", "meloxicam", "piroxicam", "naproxen",
  "celecoxib", "etoricoxib", "indomethacin", "cataflam", "catafast", "catafly", "voltaren",
  "brufen", "ketofan", "ketolac", "bi-profenid", "alcofan", "mobic", "anticox", "feldene",
  "antiflam", "dolphin", "celebrex", "eurocox", "arcoxia", "ansacox", "dimra", "myofen", "mark-fast",
  "ديكلوفيناك", "ايبوبروفين", "بروفين", "كتافلام", "كتافاست", "فولتارين", "كيتوفان", "كيتولاك",
  "موبيك", "انتيكوكس", "دولفين", "سيليبريكس", "اركوكسيا", "ديمرا", "ميوفين"
];

const PENICILLIN_TOKENS = [
  "amoxicillin", "ampicillin", "flucloxacillin", "clavulan", "sulbactam", "piperacillin",
  "augmentin", "hibiotic", "curam", "megamox", "e-moxclav", "flumox", "unictam", "amoxil",
  "اموكسيسيلين", "امبيسيلين", "اوجمنتين", "هاي بيوتك", "هايبايوتك", "كيورام", "ميجاموكس", "فلوموكس", "يونيكتام"
];

const PPI_TOKENS = [
  "omeprazole", "esomeprazole", "pantoprazole", "lansoprazole", "rabeprazole", "dexlansoprazole", "vonoprazan",
  "nexium", "controloc", "pantoloc", "zurcal", "omez", "downoprazol", "esmopump", "dexilant", "pariet", "vonaspire",
  "اوميبرازول", "ايزوميبرازول", "بانتوبرازول", "نيكسيوم", "كنترولوك", "بانتولوك", "زوركال", "اوميز", "داونوبرازول"
];

const RULES: InteractionRule[] = [
  {
    id: "nsaid-nsaid",
    groupA: NSAID_TOKENS,
    groupB: NSAID_TOKENS,
    severity: "HIGH",
    titleAr: "ازدواجية مسكنات مضادة للالتهاب (Duplicate NSAIDs)",
    titleEn: "Duplicate NSAID Therapy",
    reasonAr: "الجمع بين أكثر من مسكن من عائلة NSAIDs يضاعف خطر قرحة ونزيف المعدة والقصور الكلوي الحاد دون زيادة الفاعلية المسكنة.",
    recommendationAr: "الاكتفاء بمسكن واحد فقط من عائلة NSAIDs، وعند الحاجة لتسكين إضافي يمكن إضافة الباراسيتامول (Panadol / Cetal).",
  },
  {
    id: "duplicate-penicillins",
    groupA: PENICILLIN_TOKENS,
    groupB: PENICILLIN_TOKENS,
    severity: "HIGH",
    titleAr: "تكرار مضادات حيوية من نفس العائلة (Duplicate Penicillins)",
    titleEn: "Duplicate Beta-Lactam Antibiotic",
    reasonAr: "وصف مضادين حيويين يحتويان على الأموكسيسيلين/البنسلين معاً يسبب جرعة زائدة وسمية كبدية ومعوية دون فائدة علاجية.",
    recommendationAr: "الاكتفاء بمضاد حيوي واحد فقط بالجرعة الصحيحة.",
  },
  {
    id: "duplicate-ppis",
    groupA: PPI_TOKENS,
    groupB: PPI_TOKENS,
    severity: "MODERATE",
    titleAr: "تكرار مثبطات حموضة المعدة (Duplicate PPIs)",
    titleEn: "Duplicate Proton Pump Inhibitor",
    reasonAr: "وصف دواءين من مثبطات مضخة البروتون (PPIs) في نفس الروشتة يعد ازدواجية علاجية غير مبررة.",
    recommendationAr: "الاكتفاء بدواء واحد فقط للمعدة (مثل Nexium أو Controloc بمفرده).",
  },
  {
    id: "warfarin-nsaids",
    groupA: [
      "warfarin", "marevan", "clopidogrel", "plavix", "clatex", "rivaroxaban", "xarelto", "rivarospire",
      "apixaban", "eliquis", "abanorm", "enoxaparin", "clexane", "ticagrelor", "brilinta",
      "وارفارين", "ماريفان", "بلافيكس", "زاريلتو", "زيلارتو", "اليكويس", "كلكسان", "كليكسان", "بريلينتا"
    ],
    groupB: [...NSAID_TOKENS, "aspirin", "aspocid", "jusprin", "ezacard", "اسبرين", "اسبوسيد", "جوسبرين"],
    severity: "CRITICAL",
    titleAr: "خطر نزيف حاد ومميت (Major Bleeding Hazard)",
    titleEn: "Severe Hemorrhage & GI Bleeding Risk",
    reasonAr: "الجمع بين أدوية السيولة ومضادات التجلط مع المسكنات (NSAIDs) أو الأسبرين يثبط الصفائح الدموية ويرفع خطر النزيف المعوي والداخلي الحاد.",
    recommendationAr: "تجنب المسكنات تماماً مع أدوية السيولة واستبدلها بالباراسيتامول (Panadol / Abimol / Cetal) عند اللزوم.",
  },
  {
    id: "sildenafil-nitrates",
    groupA: [
      "sildenafil", "viagra", "erecta", "tadalafil", "cialis", "vardenafil",
      "سيلدينافيل", "فياجرا", "تادالافيل", "سياليس"
    ],
    groupB: [
      "nitrate", "nitroglycerin", "isosorbide", "effox", "monoket", "angised", "nitromak", "nitroderm", "monomack",
      "نيتروجليسرين", "ايزوسوربيد", "ايفوكس", "مونوكيت", "نيتروماك", "انجسيد"
    ],
    severity: "CRITICAL",
    titleAr: "هبوط حاد وقاتل في ضغط الدم (Severe Hypotension Shock)",
    titleEn: "Life-Threatening Hypotension",
    reasonAr: "الجمع بين مثبطات PDE5 (فياجرا/سياليس) ومركبات النترات يسبب توسعاً وعائياً مفرطاً وهبوطاً حاداً قاتلاً في ضغط الدم.",
    recommendationAr: "ممنوع الجمع منعاً باتاً؛ يجب الفصل بينهما بـ 24 إلى 48 ساعة على الأقل.",
  },
  {
    id: "beta-blocker-ccb",
    groupA: [
      "bisoprolol", "concor", "bistol", "atenolol", "tenormin", "metoprolol", "betaloc", "carvedilol", "dilatrend", "nebivolol", "nebilet", "nevilob",
      "بيسوبرولول", "كونكور", "بيستول", "تينورمين", "بيتالوك", "نيبيليت", "نيفيلوب"
    ],
    groupB: ["verapamil", "isoptin", "diltiazem", "altiazem", "digoxin", "lanoxin", "فيراباميل", "ايزوبتين", "ديلتيازيم", "التازيم", "لانوكسين"],
    severity: "HIGH",
    titleAr: "هبوط شديد في نبضات القلب وإحصار قلبي (Severe Bradycardia)",
    titleEn: "Profound Bradycardia & AV Block",
    reasonAr: "تأثير تآزري سلبي على العقدة الأذينية البطينية وكهرباء القلب قد يؤدي لتباطؤ خطير في ضربات القلب أو هبوط قلبي.",
    recommendationAr: "تجنب الجمع أو استبدل مثبط الكالسيوم بـ Amlodipine (Norvasc / Alkapress) الآمن مع حاصرات بيتا.",
  },
  {
    id: "acei-potassium",
    groupA: [
      "captopril", "capoten", "ramipril", "tritace", "enalapril", "zestril", "perindopril", "coversyl",
      "losartan", "valsartan", "exforge", "alkapress plus", "candesartan", "olmesartan", "erastapex", "telmisartan", "twynsta",
      "كابتوبريل", "كابوتن", "راميبريل", "تريتاس", "كوفرسيل", "فالسارتان", "اكسفوردج", "ايراستابكس"
    ],
    groupB: ["spironolactone", "aldactone", "eplerenone", "inspra", "سبيرونولاكتون", "الداكتون", "انسبرا"],
    severity: "HIGH",
    titleAr: "ارتفاع خطير في بوتاسيوم الدم (Hyperkalemia Hazard)",
    titleEn: "Severe Hyperkalemia Risk",
    reasonAr: "الجمع بين أدوية الضغط (ACEi/ARBs) ومدرات البول الحافظة للبوتاسيوم يقلل إخراج البوتاسيوم ويرفع خطر اضطراب نظم القلب.",
    recommendationAr: "مراقبة مستوى البوتاسيوم ووظائف الكلى بدقة، أو استخدام مدر بول غير حافظ للبوتاسيوم.",
  },
  {
    id: "acei-nsaid-renal",
    groupA: [
      "captopril", "capoten", "ramipril", "tritace", "enalapril", "perindopril", "coversyl",
      "valsartan", "exforge", "olmesartan", "erastapex", "losartan", "candesartan",
      "كابوتن", "تريتاس", "كوفرسيل", "اكسفوردج", "ايراستابكس"
    ],
    groupB: NSAID_TOKENS,
    severity: "MODERATE",
    titleAr: "ضعف كفاءة دواء الضغط وخطر على الكلى (Renal & BP Interaction)",
    titleEn: "Attenuated Antihypertensive Effect & Nephrotoxicity",
    reasonAr: "المسكنات (NSAIDs) تعاكس مفعول أدوية الضغط وتقلل التروية الكلوية، مما قد يرفع ضغط الدم ويجهد الكلى خاصة مع مدرات البول.",
    recommendationAr: "يفضل استخدام الباراسيتامول (Panadol) لتسكين الألم لدى مرضى الضغط، أو تقليل مدة المسكن لأقصر فترة ممكنة.",
  },
  {
    id: "macrolide-statin",
    groupA: ["clarithromycin", "klacid", "erythromycin", "erythrocin", "كلاريثروميسين", "كلاسيد", "اريثرومايسين"],
    groupB: [
      "atorvastatin", "ator", "lipitor", "crestor", "simvastatin", "zocor", "rosuvastatin", "cholerose",
      "اتورفاستاتين", "اتور", "ليبيتور", "كريستور", "روزوفاستاتين", "كوليروز"
    ],
    severity: "HIGH",
    titleAr: "خطر تكسر العضلات واعتلال عضلي (Rhabdomyolysis Risk)",
    titleEn: "Severe Statin Myopathy",
    reasonAr: "المضاد الحيوي (Klacid / Erythromycin) يثبط إنزيم الكبد CYP3A4 المسؤول عن تكسير دواء الكوليسترول، مما يرفع تركيزه بالدم لمستويات سامة للعضلات.",
    recommendationAr: "إيقاف دواء الكوليسترول مؤقتاً خلال كورس المضاد الحيوي، أو استبدال المضاد بـ Azithromycin (Zithromax).",
  },
  {
    id: "quinolone-steroid",
    groupA: [
      "ciprofloxacin", "ciprobay", "ciprofar", "levofloxacin", "tavanic", "levoxin", "lee-flox", "moxifloxacin", "avelox", "moxiflox",
      "سيبروفلوكساسين", "سيبروباي", "سيبروفر", "ليفوفلوكساسين", "تافانيك", "ليفوكسين", "موكسيفلوكساسين", "افيلوكس"
    ],
    groupB: [
      "dexamethasone", "prednisolone", "solupred", "xilone", "methylprednisolone", "betamethasone", "diprofos", "kenacort",
      "ديكساميثازون", "بريدنيزولون", "سولوبريد", "زيلون", "بيتاميثازون"
    ],
    severity: "HIGH",
    titleAr: "خطر التهاب وتمزق الأوتار (Tendon Rupture Risk)",
    titleEn: "Fluoroquinolone-Corticosteroid Tendinitis",
    reasonAr: "الجمع بين مضادات الكينولون (Tavanic / Ciprobay) والكورتيزون يرفع بشدة خطر التهاب وتمزق وتر أكيلس (Achilles Tendon).",
    recommendationAr: "تجنب الجمع قدر الإمكان أو استبدل المضاد الحيوي بمجموعة أخرى (مثل السيفالوسبورين أو البنسلين) وإرشاد المريض للراحة.",
  },
  {
    id: "quinolone-minerals",
    groupA: [
      "ciprofloxacin", "ciprobay", "ciprofar", "levofloxacin", "tavanic", "levoxin", "moxifloxacin", "avelox", "doxycycline", "vibramycin", "doxycost",
      "سيبروباي", "سيبروفر", "تافانيك", "ليفوكسين", "افيلوكس", "فيبراميسين", "دوكسيسيكلين"
    ],
    groupB: [
      "maalox", "epicogel", "gaviscon", "osteocare", "caltrate", "feroglobin", "ferrotron", "pharafero", "calcium", "iron", "magnesium", "zinc",
      "مالوكس", "ابيكوجيل", "جافيسكون", "اوستيوكير", "كالترات", "فيروجلوبين", "فيروترون", "فارافيرو", "كالسيوم", "حديد"
    ],
    severity: "MODERATE",
    titleAr: "انخفاض شديد في امتصاص المضاد الحيوي (Reduced Absorption)",
    titleEn: "Chelation & Reduced Bioavailability",
    reasonAr: "الكالسيوم والحديد والماغنسيوم ومضادات الحموضة ترتبط بالمضاد الحيوي في المعدة وتمنع امتصاصه بنسبة تصل إلى 80% مما يسبب فشل العلاج.",
    recommendationAr: "الفصل الزمني الإلزامي: تناول المضاد الحيوي قبل الكالسيوم/الحديد/مضادات الحموضة بساعتين على الأقل أو بعدها بـ 4 ساعات.",
  },
  {
    id: "clopidogrel-omeprazole",
    groupA: ["clopidogrel", "plavix", "clatex", "كلوبيدوجريل", "بلافيكس", "كلاتكس"],
    groupB: ["omeprazole", "esomeprazole", "nexium", "omez", "downoprazol", "esmopump", "اوميبرازول", "ايزوميبرازول", "نيكسيوم", "اوميز", "داونوبرازول"],
    severity: "MODERATE",
    titleAr: "انخفاض فعالية بلافيكس المانعة للجلطات (Reduced Plavix Efficacy)",
    titleEn: "CYP2C19 Inhibition of Clopidogrel",
    reasonAr: "الأوميبرازول والإيزوميبرازول (Nexium / Omez) يثبطان إنزيم CYP2C19 المسؤول عن تنشيط بلافيكس داخل الكبد، مما يضعف حمايته للقلب.",
    recommendationAr: "استبدل دواء المعدة بـ Pantoprazole (Controloc / Pantoloc / Zurcal) أو Famotidine (Antodin) الآمنين تماماً مع بلافيكس.",
  },
  {
    id: "thyroid-minerals",
    groupA: ["levothyroxine", "eltroxin", "euthyrox", "ليفوثيروكسين", "التروكسين", "يوثيروكس"],
    groupB: [
      "osteocare", "caltrate", "feroglobin", "ferrotron", "pharafero", "maalox", "epicogel", "gaviscon", "calcium", "iron",
      "اوستيوكير", "كالترات", "فيروجلوبين", "فيروترون", "فارافيرو", "مالوكس", "جافيسكون"
    ],
    severity: "MODERATE",
    titleAr: "ضعف امتصاص هرمون الغدة الدرقية (Thyroid Absorption Block)",
    titleEn: "Reduced Levothyroxine Absorption",
    reasonAr: "مركبات الحديد والكالسيوم ومضادات الحموضة تمنع امتصاص هرمون الغدة الدرقية (Eltroxin / Euthyrox) من الأمعاء.",
    recommendationAr: "يؤخذ هرمون الغدة صباحاً على الريق، ويفصل عن الكالسيوم أو الحديد بـ 4 ساعات على الأقل.",
  },
  {
    id: "qt-prolongation",
    groupA: [
      "azithromycin", "zithromax", "zithrokan", "zisrocin", "xithrone", "clarithromycin", "klacid", "levofloxacin", "tavanic", "ciprofloxacin", "ciprobay", "moxifloxacin", "avelox",
      "ازيثروميسين", "زيثروماكس", "زيثروكان", "كلاسيد", "تافانيك", "سيبروباي", "افيلوكس"
    ],
    groupB: [
      "domperidone", "motilium", "ondansetron", "danset", "zofran", "escitalopram", "cipralex", "quetiapine", "seroquel",
      "دومبيريدون", "موتيليوم", "دانسيت", "زوفران", "سيبرالكس", "سيروكويل"
    ],
    severity: "HIGH",
    titleAr: "خطر اضطراب كهربية القلب (QT Interval Prolongation)",
    titleEn: "Additive QT Prolongation Risk",
    reasonAr: "كلا الدواءين يسببان إطالة فترة QT في تخطيط القلب، والجمع بينهما قد يسبب اضطراباً خطيراً في ضربات القلب.",
    recommendationAr: "تجنب الجمع خاصة في مرضى القلب أو كبار السن، أو استبدل مضاد القيء/المضاد الحيوي ببديل لا يؤثر على فترة QT.",
  },
  {
    id: "cns-sedation",
    groupA: ["pregabalin", "lyrica", "gabapentin", "neurontin", "alprazolam", "quetiapine", "seroquel", "tizanidine", "sirdalud", "cyclobenzaprine", "multi-relax", "ليريكا", "نيورونتين", "سيروكويل", "سيردالود", "مالتي ريلاكس"],
    groupB: ["cetirizine", "zyrtec", "levocetirizine", "levohistam", "diphenhydramine", "panadol night", "chlorpheniramine", "congestal", "1,2,3", "toplexil", "زيرتك", "ليفوهستام", "بنادول نايت", "كونجستال", "توبلكسيل"],
    severity: "MODERATE",
    titleAr: "تثبيط عصبي مضاعف ودوار شديد (Additive CNS Depression)",
    titleEn: "Additive Sedation & Drowsiness",
    reasonAr: "الجمع بين أدوية الأعصاب/باسطات العضلات ومضادات الهيستامين المسببة للنعاس يضاعف الخمول والدوار ويقلل التركيز.",
    recommendationAr: "استخدم مضاد حساسية لا يسبب النعاس (مثل Telfast 180mg أو Claritine) وحذّر المريض من القيادة.",
  }
];

function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Instant check if a candidate drug conflicts with any currently prescribed items
 */
export function checkInstantDrugConflict(
  candidate: { name?: string; nameAr?: string; activeIngredient?: string; activeIngredientAr?: string },
  currentItems: Array<{ drugName: string; activeIngredient?: string }>
): InteractionConflict | null {
  if (!candidate || (!candidate.name && !candidate.nameAr) || !currentItems || currentItems.length === 0) {
    return null;
  }

  const candText = normalizeText(
    `${candidate.name || ""} ${candidate.nameAr || ""} ${candidate.activeIngredient || ""} ${candidate.activeIngredientAr || ""}`
  );

  for (const item of currentItems) {
    if (!item.drugName) continue;
    const itemText = normalizeText(`${item.drugName} ${item.activeIngredient || ""}`);

    const candBase = (candidate.name || "").toLowerCase().split(/\s+/)[0];
    const itemBase = (item.drugName || "").toLowerCase().split(/\s+/)[0];
    if (candBase && itemBase && candBase === itemBase) continue;

    for (const rule of RULES) {
      const candInA = rule.groupA.some((t) => candText.includes(normalizeText(t)));
      const candInB = rule.groupB.some((t) => candText.includes(normalizeText(t)));
      const itemInA = rule.groupA.some((t) => itemText.includes(normalizeText(t)));
      const itemInB = rule.groupB.some((t) => itemText.includes(normalizeText(t)));

      if ((candInA && itemInB) || (candInB && itemInA)) {
        return {
          hasConflict: true,
          severity: rule.severity,
          titleAr: rule.titleAr,
          conflictingWith: item.drugName,
          reasonAr: rule.reasonAr,
          recommendationAr: rule.recommendationAr,
        };
      }
    }
  }

  return null;
}

/**
 * Comprehensive 0ms Local Prescription Analyzer (Drug-Drug + Drug-Allergy + Drug-Disease)
 */
export function analyzePrescriptionInteractionsLocally(
  items: Array<{ id?: string; drugName: string; activeIngredient?: string }>,
  patientAllergies = "",
  patientHistory = ""
): FullInteractionAlert[] {
  if (!items || items.length === 0) return [];

  const detected: FullInteractionAlert[] = [];
  const normAllergies = normalizeText(patientAllergies);
  const normHistory = normalizeText(patientHistory);
  const itemTexts = items.map((it) => normalizeText(`${it.drugName} ${it.activeIngredient || ""}`));

  // 1. Drug-to-Drug Interactions
  if (items.length >= 2) {
    for (const rule of RULES) {
      const groupAIndices: number[] = [];
      const groupBIndices: number[] = [];

      for (let i = 0; i < items.length; i++) {
        const txt = itemTexts[i];
        if (rule.groupA.some((t) => txt.includes(normalizeText(t)))) groupAIndices.push(i);
        if (rule.groupB.some((t) => txt.includes(normalizeText(t)))) groupBIndices.push(i);
      }

      const involvedSet = new Set<number>();
      let hasPair = false;
      for (const a of groupAIndices) {
        for (const b of groupBIndices) {
          if (a !== b) {
            hasPair = true;
            involvedSet.add(a);
            involvedSet.add(b);
          }
        }
      }

      if (hasPair) {
        const involvedDrugs = Array.from(involvedSet).map((idx) => items[idx].drugName);
        detected.push({
          id: `local-${rule.id}`,
          ruleId: rule.id,
          severity: rule.severity,
          titleAr: rule.titleAr,
          titleEn: rule.titleEn,
          mechanismAr: rule.reasonAr,
          recommendationAr: rule.recommendationAr,
          involvedDrugs: Array.from(new Set(involvedDrugs)),
        });
      }
    }
  }

  // 2. Patient Drug Allergies
  if (normAllergies) {
    for (let i = 0; i < items.length; i++) {
      const txt = itemTexts[i];
      const drugName = items[i].drugName;

      if (
        (normAllergies.includes("penicillin") || normAllergies.includes("بنسلين") || normAllergies.includes("اموكسيسيلين")) &&
        PENICILLIN_TOKENS.some((t) => txt.includes(normalizeText(t)))
      ) {
        detected.push({
          id: `allergy-pen-${i}`,
          ruleId: "allergy-penicillin",
          severity: "CRITICAL",
          titleAr: "⚠️ تعارض خطير مع حساسية البنسلين المسجلة للمريض!",
          titleEn: "Severe Penicillin Allergy Contraindication",
          mechanismAr: `المريض مسجل لديه حساسية للبنسلين، والدواء (${drugName}) ينتمي لمشتقات البنسلين وقد يسبب صدمة تحسسية خطيرة (Anaphylaxis).`,
          recommendationAr: "احذف هذا المضاد الحيوي فوراً واستبدله بمجموعة الماكروليد (مثل Zithromax / Zithrokan) أو الكينولون.",
          involvedDrugs: [drugName],
        });
      }

      if (
        (normAllergies.includes("sulfa") || normAllergies.includes("سلفا")) &&
        ["septrin", "sutrim", "sulfamethoxazole", "celecoxib", "celebrex", "eurocox", "سبترين", "سلفا", "سيليبريكس"].some((t) =>
          txt.includes(normalizeText(t))
        )
      ) {
        detected.push({
          id: `allergy-sulfa-${i}`,
          ruleId: "allergy-sulfa",
          severity: "CRITICAL",
          titleAr: "⚠️ تعارض مع حساسية السلفا المسجلة للمريض!",
          titleEn: "Sulfa Allergy Contraindication",
          mechanismAr: `المريض يعاني من حساسية السلفا، والدواء (${drugName}) يحتوي على مجموعة السلفوناميد.`,
          recommendationAr: "استبدل الدواء ببديل آمن خالٍ من مركبات السلفا.",
          involvedDrugs: [drugName],
        });
      }

      if (
        (normAllergies.includes("aspirin") || normAllergies.includes("nsaid") || normAllergies.includes("اسبرين") || normAllergies.includes("مسكنات")) &&
        [...NSAID_TOKENS, "aspirin", "aspocid", "jusprin"].some((t) => txt.includes(normalizeText(t)))
      ) {
        detected.push({
          id: `allergy-nsaid-${i}`,
          ruleId: "allergy-nsaid",
          severity: "CRITICAL",
          titleAr: "⚠️ تعارض مع حساسية المسكنات / الأسبرين لدى المريض!",
          titleEn: "NSAID / Aspirin Hypersensitivity",
          mechanismAr: `المريض مسجل لديه حساسية من المسكنات/الأسبرين، والدواء (${drugName}) قد يثير نوبة تحسس أو ضيق تنفس حاد.`,
          recommendationAr: "استخدم الباراسيتامول (Panadol / Cetal) كبديل آمن.",
          involvedDrugs: [drugName],
        });
      }
    }
  }

  // 3. Chronic Diseases & Medical History Contraindications
  if (normHistory) {
    for (let i = 0; i < items.length; i++) {
      const txt = itemTexts[i];
      const drugName = items[i].drugName;

      // Asthma + NSAIDs or Beta-blockers
      if (normHistory.includes("asthma") || normHistory.includes("ربو") || normHistory.includes("حساسيه صدر")) {
        if ([...NSAID_TOKENS, "aspirin", "aspocid"].some((t) => txt.includes(normalizeText(t)))) {
          detected.push({
            id: `history-asthma-nsaid-${i}`,
            ruleId: "asthma-nsaid",
            severity: "HIGH",
            titleAr: "⚠️ تحذير لمريض الربو وحساسية الصدر مع المسكنات (NSAIDs)",
            titleEn: "NSAID-Induced Bronchospasm Risk",
            mechanismAr: `الدواء (${drugName}) قد يحفز ضيق الشعب الهوائية ونوبة ربو حادة لدى مرضى حساسية الصدر.`,
            recommendationAr: "يفضل استبداله بالباراسيتامول (Panadol / Abimol) الآمن لمرضى الصدر.",
            involvedDrugs: [drugName],
          });
        }
      }

      // Peptic Ulcer + NSAIDs
      if (normHistory.includes("ulcer") || normHistory.includes("قرحه") || normHistory.includes("معده") || normHistory.includes("نزيف")) {
        if ([...NSAID_TOKENS, "aspirin", "aspocid"].some((t) => txt.includes(normalizeText(t)))) {
          detected.push({
            id: `history-ulcer-nsaid-${i}`,
            ruleId: "ulcer-nsaid",
            severity: "HIGH",
            titleAr: "⚠️ خطر تهيج أو نزيف قرحة المعدة بسبب المسكن",
            titleEn: "Peptic Ulcer Aggravation Risk",
            mechanismAr: `المريض لديه تاريخ مرضي لقرحة/التهاب المعدة، والدواء (${drugName}) يثبط البروستاجلاندين الحامي لجدار المعدة.`,
            recommendationAr: "استبدله بـ Paracetamol أو Celebrex مع إضافة واقي للمعدة (مثل Controloc 40mg).",
            involvedDrugs: [drugName],
          });
        }
      }

      // Renal Impairment + NSAIDs
      if (normHistory.includes("renal") || normHistory.includes("kidney") || normHistory.includes("كلي") || normHistory.includes("كلوي")) {
        if (NSAID_TOKENS.some((t) => txt.includes(normalizeText(t)))) {
          detected.push({
            id: `history-renal-nsaid-${i}`,
            ruleId: "renal-nsaid",
            severity: "CRITICAL",
            titleAr: "⚠️ خطر تدهور وظائف الكلى (Nephrotoxicity Alert)",
            titleEn: "NSAID Contraindication in Renal Impairment",
            mechanismAr: `المريض يعاني من قصور كلوي، ومضادات الالتهاب (${drugName}) تقلل التروية الدموية للكلى وترفع الكرياتينين.`,
            recommendationAr: "تجنب عائلة NSAIDs تماماً واستخدم Paracetamol لتسكين الألم.",
            involvedDrugs: [drugName],
          });
        }
      }
    }
  }

  return detected;
}
