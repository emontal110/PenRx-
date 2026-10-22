/**
 * Instant Client-Side Clinical Drug Interaction Checker (0.01ms Latency)
 * ────────────────────────────────────────────────────────────────────────
 * Evaluates candidate drugs in real-time against already prescribed items.
 * Provides early visual warnings without blocking clinical workflow.
 */

export interface InteractionConflict {
  hasConflict: boolean;
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  conflictingWith: string;
  reasonAr: string;
}

interface InteractionRule {
  id: string;
  groupA: string[];
  groupB: string[]; // For same-class duplicate rules (e.g. nsaid-nsaid), groupB equals groupA
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  reasonAr: string;
}

const NSAID_TOKENS = ["diclofenac", "ibuprofen", "ketoprofen", "cataflam", "voltaren", "brufen", "ketofan", "mobic", "feldene", "antiflam", "dolphin", "meloxicam", "piroxicam", "naproxen"];

const RULES: InteractionRule[] = [
  {
    id: "nsaid-nsaid",
    groupA: NSAID_TOKENS,
    groupB: NSAID_TOKENS,
    severity: "HIGH",
    titleAr: "ازدواجية مسكنات (NSAIDs Duplicate)",
    reasonAr: "جمع أكثر من مسكن NSAID يضاعف خطر تقرح المعدة والفشل الكلوي دون فائدة تسكين إضافية.",
  },
  {
    id: "warfarin-nsaids",
    groupA: ["warfarin", "marevan", "clopidogrel", "plavix", "rivaroxaban", "xarelto", "apixaban", "eliquis"],
    groupB: [...NSAID_TOKENS, "aspirin", "aspocid"],
    severity: "CRITICAL",
    titleAr: "خطر نزيف حاد (Major Bleeding Risk)",
    reasonAr: "الجمع بين مضادات التخثر والمسكنات يرفع خطر النزيف الهضمي الحاد.",
  },
  {
    id: "sildenafil-nitrates",
    groupA: ["sildenafil", "viagra", "erecta", "tadalafil", "cialis", "vardenafil"],
    groupB: ["nitrate", "nitroglycerin", "isosorbide", "effox", "monoket", "angised", "nitromak", "nitroderm"],
    severity: "CRITICAL",
    titleAr: "هبوط حاد في ضغط الدم (Hypotension Shock)",
    reasonAr: "ممنوع الجمع نهائياً لتسببه في هبوط دوري حاد وقاتل.",
  },
  {
    id: "beta-blocker-ccb",
    groupA: ["bisoprolol", "concor", "atenolol", "tenormin", "metoprolol", "betaloc", "carvedilol", "dilatrend"],
    groupB: ["verapamil", "isoptin", "diltiazem", "altiazem"],
    severity: "HIGH",
    titleAr: "هبوط نبضات القلب (Severe Bradycardia)",
    reasonAr: "تأثير تآزري سلبي على كهرباء وانقباض القلب.",
  },
  {
    id: "acei-potassium",
    groupA: ["captopril", "capoten", "ramipril", "tritace", "enalapril", "zestril", "perindopril", "coversyl", "losartan", "valsartan", "exforge", "candesartan"],
    groupB: ["spironolactone", "aldactone", "eplerenone", "inspra"],
    severity: "HIGH",
    titleAr: "ارتفاع بوتاسيوم الدم (Hyperkalemia Hazard)",
    reasonAr: "خطر اضطراب نظم كهربية القلب نتيجة احتباس البوتاسيوم.",
  },
  {
    id: "macrolide-statin",
    groupA: ["clarithromycin", "klacid", "erythromycin", "erythrocin"],
    groupB: ["atorvastatin", "ator", "lipitor", "crestor", "simvastatin", "zocor", "rosuvastatin"],
    severity: "HIGH",
    titleAr: "تكسر العضلات (Rhabdomyolysis Risk)",
    reasonAr: "تثبيط إنزيم الكبد يرفع تركيز الستاتين ويسبب تسمم عضلي.",
  },
  {
    id: "quinolone-steroid",
    groupA: ["ciprofloxacin", "ciprobay", "ciprofar", "levofloxacin", "tavanic", "moxifloxacin", "avelox"],
    groupB: ["dexamethasone", "prednisolone", "solupred", "methylprednisolone", "betamethasone"],
    severity: "MODERATE",
    titleAr: "خطر التهاب وتمزق الأوتار (Tendon Rupture)",
    reasonAr: "الكينولون مع الكورتيزون يرفع احتمال تمزق وتر العرقوب (Achilles).",
  },
];

function normalizeText(text: string): string {
  return (text || "").toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, " ").trim();
}

/**
 * Check if candidate drug conflicts with any currently selected prescription items
 */
export function checkInstantDrugConflict(
  candidate: { name?: string; activeIngredient?: string },
  currentItems: Array<{ drugName: string; activeIngredient?: string }>
): InteractionConflict | null {
  if (!candidate || !candidate.name || !currentItems || currentItems.length === 0) return null;

  const candText = normalizeText(`${candidate.name} ${candidate.activeIngredient || ""}`);

  for (const item of currentItems) {
    if (!item.drugName) continue;
    const itemText = normalizeText(`${item.drugName} ${item.activeIngredient || ""}`);

    // Exclude self-matching exact same drug name
    const candBase = (candidate.name || "").toLowerCase().split(/\s+/)[0];
    const itemBase = (item.drugName || "").toLowerCase().split(/\s+/)[0];
    if (candBase && itemBase && candBase === itemBase) continue;

    for (const rule of RULES) {
      const candInA = rule.groupA.some((t) => candText.includes(t));
      const candInB = rule.groupB.some((t) => candText.includes(t));
      const itemInA = rule.groupA.some((t) => itemText.includes(t));
      const itemInB = rule.groupB.some((t) => itemText.includes(t));

      if ((candInA && itemInB) || (candInB && itemInA)) {
        return {
          hasConflict: true,
          severity: rule.severity,
          titleAr: rule.titleAr,
          conflictingWith: item.drugName,
          reasonAr: rule.reasonAr,
        };
      }
    }
  }

  return null;
}
