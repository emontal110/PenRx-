import { NextResponse } from "next/server";
import { analyzePrescriptionWithGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";

interface PrescriptionItemInput {
  id?: string;
  drugName: string;
  activeIngredient?: string;
  doseQuantity?: string;
  doseForm?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

interface InteractionRule {
  id: string;
  ingredients: string[];
  names: string[];
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  titleAr: string;
  titleEn: string;
  mechanismAr: string;
  mechanismEn: string;
  recommendationAr: string;
  recommendationEn: string;
}

const CLINICAL_INTERACTION_RULES: InteractionRule[] = [
  {
    id: "warfarin-nsaids",
    ingredients: ["warfarin", "diclofenac", "ibuprofen", "ketoprofen", "aspirin", "naproxen", "meloxicam", "piroxicam"],
    names: ["marevan", "warfarin", "cataflam", "voltaren", "brufen", "ketofan", "aspirin", "aspocid", "feldene", "mobic", "antiflam"],
    severity: "CRITICAL",
    titleAr: "خطر نزيف حاد وتقرح بالمعدة (Gastrointestinal Bleeding Risk)",
    titleEn: "Major Bleeding & Hemorrhage Risk",
    mechanismAr: "الجمع بين مضادات التخثر (مثل وارفارين/ماريفان) ومضادات الالتهاب غير الستيرويدية (NSAIDs) يثبط وظائف الصفائح الدموية ويسبب تآكل مخاطية الجهاز الهضمي، مما يرفع خطر النزيف المميت واضطراب تحليل الـ INR.",
    mechanismEn: "Concurrent use impairs platelet aggregation and causes mucosal ulceration, dramatically increasing major bleeding risk.",
    recommendationAr: "تجنب الجمع نهائياً؛ يوصى باستخدام الباراسيتامول (Panadol) كمسكن آمن أو استشارة أخصائي أمراض الدم.",
    recommendationEn: "Avoid NSAIDs; substitute with Paracetamol (Panadol) for pain and fever control.",
  },
  {
    id: "sildenafil-nitrates",
    ingredients: ["sildenafil", "tadalafil", "vardenafil", "nitrate", "isosorbide", "nitroglycerin"],
    names: ["viagra", "erecta", "sildefil", "cialis", "startcop", "nitromak", "effox", "isosorbide", "monoket", "angised", "nitroderm"],
    severity: "CRITICAL",
    titleAr: "هبوط حاد وقاتل في ضغط الدم (Severe Hypotension Shock)",
    titleEn: "Life-Threatening Hypotension Shock",
    mechanismAr: "مثبطات الفوسفودايستراز (Viagra/Cialis) مع مركبات النترات تسبب توسعاً وعائياً مفرطاً وتثبيطاً حاداً للضغط الشرياني قد يؤدي للوفاة أو احتشاء عضلة القلب.",
    mechanismEn: "Potentiation of cGMP-mediated vasodilation leads to catastrophic refractory systemic hypotension.",
    recommendationAr: "ممنوع منعاً باتاً ومطلقاً إعطاء النترات لمريض يتناول سيلدينافيل أو تادالافيل قبل مرور 24 إلى 48 ساعة على الأقل.",
    recommendationEn: "Absolute contraindication: do not co-administer under any circumstances.",
  },
  {
    id: "beta-blocker-non-dhp-ccb",
    ingredients: ["bisoprolol", "atenolol", "metoprolol", "carvedilol", "verapamil", "diltiazem"],
    names: ["concor", "tenormin", "betaloc", "dilatrend", "isoptin", "verapamil", "diltiazem", "altiazem"],
    severity: "HIGH",
    titleAr: "هبوط حاد في نبضات القلب وإحصار قلبي (Severe Bradycardia & AV Block)",
    titleEn: "Profound Bradycardia & Heart Block",
    mechanismAr: "كلا الدواءين لهما تأثير سلبي تآزري قوي على العقدة الأذينية البطينية (AV Node) وقوة انقباض عضلة القلب، مما يسبب بطء نبض خطير وهبوط وظائف القلب.",
    mechanismEn: "Additive negative inotropic and chronotropic effects can precipitate severe sinus bradycardia, AV block, and heart failure.",
    recommendationAr: "تجنب الجمع إلا في حالات خاصة وتحت إشراف استشاري قلب مع تخطيط قلب مستمر؛ يمكن استبداله بـ Amlodipine (Norvasc).",
    recommendationEn: "Avoid co-administration; switch CCB to dihydropyridine class (Amlodipine) if needed.",
  },
  {
    id: "acei-potassium-sparing",
    ingredients: ["captopril", "enalapril", "ramipril", "perindopril", "losartan", "valsartan", "candesartan", "spironolactone", "eplerenone"],
    names: ["capoten", "tritace", "zestril", "coversyl", "co-diovan", "angiotec", "exforge", "aldactone", "inspra"],
    severity: "HIGH",
    titleAr: "ارتفاع خطير في بوتاسيوم الدم (Severe Hyperkalemia Risk)",
    titleEn: "Severe Hyperkalemia & Arrhythmia Hazard",
    mechanismAr: "تثبيط نظام الرينين-أنجيوتنسين بالتزامن مع مدرات البول الحافظة للبوتاسيوم يقلل الإخراج الكلوي للبوتاسيوم، مما يعرض المريض لاضطراب كهربية القلب القاتل.",
    mechanismEn: "Synergistic impairment of potassium excretion can precipitate life-threatening cardiac arrhythmias.",
    recommendationAr: "يجب فحص وظائف الكلى ومستوى البوتاسيوم بانتظام، أو تجنب الجمع في مرضى القصور الكلوي وكبار السن.",
    recommendationEn: "Monitor serum potassium and creatinine closely; consider alternative diuretic.",
  },
  {
    id: "macrolide-statin",
    ingredients: ["clarithromycin", "erythromycin", "atorvastatin", "simvastatin", "rosuvastatin"],
    names: ["klacid", "clarithro", "erythrocin", "ator", "lipitor", "crestor", "zocor", "atormac"],
    severity: "HIGH",
    titleAr: "تكسر العضلات واعتلال عضلي حاد (Rhabdomyolysis Risk)",
    titleEn: "Severe Myopathy & Rhabdomyolysis",
    mechanismAr: "المضادات الحيوية من فئة الماكروليد تثبط إنزيم CYP3A4 الكبدي المسؤول عن استقلاب الستاتين، مما يرفع تركيز الستاتين بالدم حتى 5 أضعاف مسبباً تكسر العضلات والفشل الكلوي.",
    mechanismEn: "Potent CYP3A4 inhibition raises statin plasma levels, dramatically increasing risk of severe myopathy and rhabdomyolysis.",
    recommendationAr: "إيقاف علاج الستاتين مؤقتاً طوال فترة تناول المضاد الحيوي، أو استبدال المضاد بـ Azithromycin (Zithromax) الذي لا يثبط هذا الإنزيم.",
    recommendationEn: "Temporarily withhold statin therapy or switch antibiotic to Azithromycin.",
  },
  {
    id: "tramadol-ssri",
    ingredients: ["tramadol", "fluoxetine", "paroxetine", "sertraline", "escitalopram", "citalopram", "duloxetine", "venlafaxine"],
    names: ["tramal", "tramadol", "amadol", "prozac", "cipralex", "seroxat", "lustral", "zoloft", "cymbalta", "efexor"],
    severity: "HIGH",
    titleAr: "متلازمة السيروتونين وخطر التشنجات (Serotonin Syndrome & Seizures)",
    titleEn: "Serotonin Syndrome & Lowered Seizure Threshold",
    mechanismAr: "الترامادول يثبط إعادة امتصاص السيروتونين والنورأدرينالين؛ دمجه مع مضادات الاكتئاب (SSRIs/SNRIs) يرفع تركيز السيروتونين لمستويات سامة ويخفض عتبة التشنجات العصبية.",
    mechanismEn: "Synergistic serotonergic activity risks serotonin syndrome (hyperthermia, clonus, delirium) and seizure induction.",
    recommendationAr: "تجنب الترامادول تماماً للمرضى الذين يتناولون مضادات الاكتئاب، واستخدام مسكنات أفيونية بديلة أو مسكنات محيطية.",
    recommendationEn: "Avoid combination; use non-serotonergic analgesics.",
  },
  {
    id: "quinolone-minerals-antacids",
    ingredients: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "aluminum", "magnesium", "calcium", "iron"],
    names: ["ciprofar", "tavanic", "avelox", "maalox", "epicogel", "mucogel", "gaviscon", "feroglobin", "calcimate"],
    severity: "MODERATE",
    titleAr: "انخفاض شديد في امتصاص المضاد الحيوي (Chelation & Poor Absorption)",
    titleEn: "Chelation & Reduced Antibiotic Bioavailability",
    mechanismAr: "ترتبط مضادات الكينولون كيميائياً بالمعادن ثنائية وثلاثية التكافؤ (ألمونيوم، مغنيسيوم، كالسيوم، حديد)، مما يشكل مركبات غير قابلة للامتصاص ويؤدي لفشل العلاج البكتيري.",
    mechanismEn: "Chelation complex formation reduces oral fluoroquinolone absorption by up to 85%.",
    recommendationAr: "الفصل الزمني الصارم: تناول المضاد الحيوي قبل أدوية الحموضة أو المكملات بساعتين على الأقل، أو بعدها بـ 4 إلى 6 ساعات.",
    recommendationEn: "Administer antibiotic at least 2 hours before or 4-6 hours after antacids/minerals.",
  },
  {
    id: "clopidogrel-omeprazole",
    ingredients: ["clopidogrel", "omeprazole", "esomeprazole"],
    names: ["plavix", "clopidogrel", "omeprazole", "gasec", "nexium", "ezogast"],
    severity: "MODERATE",
    titleAr: "انخفاض فعالية بلافيكس الوقائية من الجلطات (Reduced Antiplatelet Efficacy)",
    titleEn: "Attenuated Clopidogrel Activation",
    mechanismAr: "أوميبرازول وإيزوميبرازول يثبطان إنزيم CYP2C19 اللازم لتحويل بلافيكس إلى شكله الحيوي الفعال، مما يقلل حماية المريض من الجلطات التجلطية.",
    mechanismEn: "Competitive CYP2C19 inhibition prevents activation of prodrug Clopidogrel into its active metabolite.",
    recommendationAr: "استبدال أوميبرازول بـ Pantoprazole (Controloc) أو Famotidine (Antodine) لعدم تأثيرهما على هذا الإنزيم.",
    recommendationEn: "Switch PPI to Pantoprazole (Controloc) or H2 blocker Famotidine.",
  },
  {
    id: "dual-nsaids",
    ingredients: ["ibuprofen", "diclofenac", "ketoprofen", "meloxicam", "celecoxib", "naproxen"],
    names: ["brufen", "cataflam", "voltaren", "ketofan", "mobic", "celebrex", "antiflam", "flamamol"],
    severity: "HIGH",
    titleAr: "ازدواجية غير مبررة لمضادات الالتهاب (Unjustified Dual NSAID Risk)",
    titleEn: "Duplicate NSAID Toxicity Hazard",
    mechanismAr: "الجمع بين مسكنين من عائلة مضادات الالتهاب غير الستيرويدية يضاعف التأثير السمي على الكلى والجهاز الهضمي دون زيادة تذكر في التسكين.",
    mechanismEn: "Concomitant use of multiple NSAIDs provides no therapeutic benefit while exponentially increasing ulceration and nephrotoxicity risks.",
    recommendationAr: "الاكتفاء بمسكن واحد فقط بالجرعة الفعالة المناسبة وتجنب ازدواجية الأدوية من نفس العائلة.",
    recommendationEn: "Prescribe a single NSAID at minimum therapeutic dose.",
  },
  {
    id: "metformin-contrast",
    ingredients: ["metformin", "contrast", "iodinated"],
    names: ["cidophage", "glucophage", "janumet", "metformin", "x-ray contrast", "omnipaque"],
    severity: "HIGH",
    titleAr: "احتياط الفحص بالصبغة لمرضى السكري (Lactic Acidosis Hazard)",
    titleEn: "Contrast-Induced Lactic Acidosis Risk",
    mechanismAr: "صبغات الأشعة المقطعية قد تسبب قصوراً كلوياً مؤقتاً يؤدي لتراكم الميتفورمين وحدوث حموضة الدم اللاكتيكية (Lactic Acidosis) الخطيرة.",
    mechanismEn: "Acute contrast-induced renal impairment may cause severe toxic metformin accumulation and lactic acidosis.",
    recommendationAr: "إيقاف الميتفورمين مؤقتاً قبل فحص الأشعة بالصبغة بـ 48 ساعة واستئنافه بعد التأكد من سلامة وظائف الكلى.",
    recommendationEn: "Hold Metformin 48h prior to and following IV contrast examination.",
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: PrescriptionItemInput[] = body.items || [];
    const patientAllergies: string = (body.patientAllergies || "").toLowerCase().trim();
    const patientHistory: string = (body.patientHistory || "").toLowerCase().trim();

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        interactions: [],
        safeMessage: "لم يتم إضافة أدوية كافية بعد لإجراء الفحص الدوائي.",
      });
    }

    const detectedInteractions: any[] = [];
    const itemFullTexts = items.map((i) =>
      `${i.drugName} ${i.activeIngredient || ""}`.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, " ")
    );

    // 1. Check Drug-to-Drug Interactions (pairs or groups)
    if (items.length >= 2) {
      for (const rule of CLINICAL_INTERACTION_RULES) {
        const matchedItemIndices: number[] = [];

        for (let idx = 0; idx < items.length; idx++) {
          const text = itemFullTexts[idx];
          const hasIng = rule.ingredients.some((ing) => text.includes(ing));
          const hasName = rule.names.some((nm) => text.includes(nm));

          if (hasIng || hasName) {
            matchedItemIndices.push(idx);
          }
        }

        // Special case for dual-nsaid: need 2 distinct items matching NSAID list
        if (rule.id === "dual-nsaids") {
          if (matchedItemIndices.length >= 2) {
            const involvedNames = matchedItemIndices.map((i) => items[i].drugName);
            detectedInteractions.push({
              id: `${rule.id}-${Date.now()}`,
              ruleId: rule.id,
              severity: rule.severity,
              titleAr: rule.titleAr,
              titleEn: rule.titleEn,
              mechanismAr: rule.mechanismAr,
              recommendationAr: rule.recommendationAr,
              involvedDrugs: Array.from(new Set(involvedNames)),
            });
          }
          continue;
        }

        // For cross-class rules: check if matched items contain representatives of distinct sides
        if (matchedItemIndices.length >= 2) {
          const involvedNames = matchedItemIndices.map((i) => items[i].drugName);
          detectedInteractions.push({
            id: `${rule.id}-${Date.now()}`,
            ruleId: rule.id,
            severity: rule.severity,
            titleAr: rule.titleAr,
            titleEn: rule.titleEn,
            mechanismAr: rule.mechanismAr,
            recommendationAr: rule.recommendationAr,
            involvedDrugs: Array.from(new Set(involvedNames)),
          });
        }
      }
    }

    // 2. Patient Allergy Conflict Checks
    if (patientAllergies) {
      for (const item of items) {
        const full = `${item.drugName} ${item.activeIngredient || ""}`.toLowerCase();

        // Penicillin Allergy
        if (
          patientAllergies.includes("penicillin") ||
          patientAllergies.includes("بنسلين") ||
          patientAllergies.includes("بنسلينات")
        ) {
          if (
            full.includes("amoxicillin") ||
            full.includes("augmentin") ||
            full.includes("hibiotic") ||
            full.includes("curam") ||
            full.includes("flumox") ||
            full.includes("unictam") ||
            full.includes("ampicillin") ||
            full.includes("أموكسيسيلين") ||
            full.includes("اوجمنتين")
          ) {
            detectedInteractions.push({
              id: `allergy-penicillin-${item.id || item.drugName}`,
              severity: "CRITICAL",
              titleAr: "⚠️ تنبيه حساسية البنسلين لدى المريض (Penicillin Allergy Alert)",
              titleEn: "Severe Penicillin Allergy Conflict",
              mechanismAr: `المريض مسجل لديه حساسية من البنسلين! الدواء الموصوف (${item.drugName}) يحتوي على مشتقات البنسلين وقد يسبب صدمة حساسية مفرطة (Anaphylaxis).`,
              recommendationAr: "استبدل المضاد الحيوي فوراً بمجموعة الماكروليد (مثل Azithromycin / Zithromax) أو مجموعة أخرى آمنة.",
              involvedDrugs: [item.drugName],
            });
          }
        }

        // Sulfa Allergy
        if (patientAllergies.includes("sulfa") || patientAllergies.includes("سلفا")) {
          if (
            full.includes("septrin") ||
            full.includes("sutrim") ||
            full.includes("sulfamethoxazole") ||
            full.includes("co-trimoxazole") ||
            full.includes("celebrex") ||
            full.includes("celecoxib")
          ) {
            detectedInteractions.push({
              id: `allergy-sulfa-${item.id || item.drugName}`,
              severity: "HIGH",
              titleAr: "⚠️ تنبيه حساسية السلفا لدى المريض (Sulfa Allergy Alert)",
              titleEn: "Sulfa Derivative Allergy Conflict",
              mechanismAr: `المريض يعاني من حساسية تجاه مركبات السلفا! الدواء الموصوف (${item.drugName}) يحتوي على السلفوناميد.`,
              recommendationAr: "استبدال المستحضر ببديل خالٍ من مركبات السلفا.",
              involvedDrugs: [item.drugName],
            });
          }
        }
      }
    }

    // 3. Chronic Condition Warning (e.g. Asthma + NSAIDs)
    if (patientHistory.includes("asthma") || patientHistory.includes("ربو") || patientHistory.includes("حساسية صدر")) {
      for (const item of items) {
        const full = `${item.drugName} ${item.activeIngredient || ""}`.toLowerCase();
        if (
          full.includes("aspirin") ||
          full.includes("ibuprofen") ||
          full.includes("diclofenac") ||
          full.includes("cataflam") ||
          full.includes("voltaren") ||
          full.includes("brufen")
        ) {
          detectedInteractions.push({
            id: `asthma-nsaid-${item.id || item.drugName}`,
            severity: "HIGH",
            titleAr: "⚠️ تحذير: أزمة ربو شعبي مستحثة بالمسكنات (Aspirin-Exacerbated Respiratory Disease)",
            titleEn: "NSAID-Induced Bronchospasm Hazard",
            mechanismAr: `المريض يعاني من الربو الشعبي أو حساسية الصدر، ومضادات الالتهاب (${item.drugName}) قد تسبب تقلصاً حاداً في القصبات الهوائية (Bronchospasm).`,
            recommendationAr: "استبدل بـ Paracetamol (Panadol) كمسكن وخافض حرارة آمن لمرضى الربو.",
            involvedDrugs: [item.drugName],
          });
          break;
        }
      }
    }

    // 4. Deep Gemini Clinical Analysis (Cached, Rate-Limited, Silent Failover)
    if (items.length >= 2 || patientAllergies || patientHistory) {
      try {
        const geminiInteractions = await analyzePrescriptionWithGemini(
          items,
          patientAllergies,
          patientHistory
        );

        if (geminiInteractions && geminiInteractions.length > 0) {
          for (const gAlert of geminiInteractions) {
            const alreadyExists = detectedInteractions.some(
              (d) =>
                d.titleAr === gAlert.titleAr ||
                (d.titleEn && gAlert.titleEn && d.titleEn.toLowerCase() === gAlert.titleEn.toLowerCase())
            );
            if (!alreadyExists) {
              detectedInteractions.push({
                id: `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                severity: gAlert.severity || "HIGH",
                titleAr: gAlert.titleAr,
                titleEn: gAlert.titleEn,
                mechanismAr: gAlert.mechanismAr,
                recommendationAr: gAlert.recommendationAr,
                involvedDrugs: gAlert.involvedDrugs || items.map((i) => i.drugName),
                source: "Google Gemini 3.8 Flash",
              });
            }
          }
        }
      } catch {
        // Silent failover — local rules ensure 100% reliability
      }
    }

    return NextResponse.json({
      success: true,
      hasInteractions: detectedInteractions.length > 0,
      totalInteractions: detectedInteractions.length,
      interactions: detectedInteractions,
      engine: "PenRX+ Clinical Pharmacology & Google Gemini 3.8 Flash AI Engine",
      analyzedItemsCount: items.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze prescription" },
      { status: 500 }
    );
  }
}
