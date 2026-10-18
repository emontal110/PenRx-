/**
 * Clinical Pharmacology Smart Auto-Fill Engine (PenRX+)
 * ─────────────────────────────────────────────────────────────
 * Automatically infers optimal dosage, formulation, frequency, duration,
 * and clinical instructions based on drug category, active ingredient,
 * and dosage form.
 */

export interface SmartDosageRecommendation {
  doseQuantity: string;
  doseForm: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/**
 * Extracts and cleans the pure English name of a medication,
 * ensuring that prescriptions are strictly written in professional medical English.
 */
export function getCleanEnglishDrugName(name?: string, nameAr?: string): string {
  if (!name || !name.trim()) {
    return nameAr?.trim() || "";
  }

  let clean = name.trim();

  // If the name has Arabic characters mixed in parentheses e.g. "Panadol Extra (بنادول)"
  clean = clean.replace(/\([\u0600-\u06FF\s0-9\-_./+]+\)/g, "").trim();

  // If the name starts with or has trailing Arabic text
  clean = clean.replace(/[\u0600-\u06FF]+/g, "").trim();

  // Remove redundant multiple spaces
  clean = clean.replace(/\s+/g, " ").trim();

  // If after stripping Arabic the English name is too short or empty, fallback to original name without parentheses
  if (clean.length < 2) {
    return name.replace(/\([\u0600-\u06FF\s0-9\-_./+]+\)/g, "").trim() || name;
  }

  return clean;
}

/**
 * Generates evidence-based clinical defaults for any prescribed drug
 */
export function getSmartDrugDosage(drug: {
  name?: string;
  nameAr?: string;
  dosageForm?: string;
  category?: string;
  activeIngredient?: string;
  activeIngredientAr?: string;
}): SmartDosageRecommendation {
  const nameLower = (drug.name || "").toLowerCase();
  const nameAr = drug.nameAr || "";
  const formLower = (drug.dosageForm || "").toLowerCase();
  const catLower = (drug.category || "").toLowerCase();
  const activeLower = (drug.activeIngredient || "").toLowerCase();

  // ── 1. OPHTHALMIC (Eye Drops & Eye Ointments) ─────────────────────────────
  if (
    formLower.includes("eye drop") ||
    formLower.includes("قطرة للعين") ||
    catLower.includes("ophthalm") ||
    nameLower.includes("eye drops")
  ) {
    return {
      doseQuantity: "1-2 نقطة",
      doseForm: "Drops (قطرة)",
      frequency: "كل 6 إلى 8 ساعات بالعين المصابة",
      duration: "لمدة 7 أيام (أسبوع)",
      instructions: "غسل اليدين جيداً وعدم ملامسة طرف القطارة للعين لتجنب التلوث",
    };
  }

  if (
    formLower.includes("eye oint") ||
    formLower.includes("مرهم للعين") ||
    nameLower.includes("eye ointment")
  ) {
    return {
      doseQuantity: "طبقة رقيقة",
      doseForm: "Ointment (مرهم)",
      frequency: "مرة واحدة مساءً قبل النوم مباشرة داخل الجفن السفلي",
      duration: "لمدة 5 أيام",
      instructions: "توضع داخل الجفن السفلي قبل النوم مباشرة نظراً لتشويش الرؤية المؤقت",
    };
  }

  // ── 2. OTIC (Ear Drops) ───────────────────────────────────────────────────
  if (formLower.includes("ear drop") || formLower.includes("قطرة للأذن") || nameLower.includes("ear drops")) {
    return {
      doseQuantity: "3-4 نقط",
      doseForm: "Drops (قطرة)",
      frequency: "كل 8 ساعات بالأذن المصابة مع إمالة الرأس",
      duration: "لمدة 5 إلى 7 أيام",
      instructions: "تدفئة الزجاجة بين راحتي اليدين قبل التقطير وإبقاء الرأس مائلاً لمدة 3 دقائق",
    };
  }

  // ── 3. NASAL DECONGESTANTS & SPRAYS ──────────────────────────────────────
  if (
    formLower.includes("nasal") ||
    formLower.includes("بخاخ للأنف") ||
    formLower.includes("spray") ||
    nameLower.includes("nasal spray") ||
    nameLower.includes("otrivin")
  ) {
    return {
      doseQuantity: "بخة واحدة",
      doseForm: "Spray (بخاخ)",
      frequency: "مرتان يومياً (صباحاً ومساءً)",
      duration: "لمدة 5 أيام كحد أقصى",
      instructions: "تنظيف الأنف قبل الاستخدام وعدم تجاوز 5 أيام تجنباً للاحتقان الارتدادي",
    };
  }

  // ── 4. PULMONARY INHALERS ────────────────────────────────────────────────
  if (
    formLower.includes("inhaler") ||
    formLower.includes("بخاخ") ||
    nameLower.includes("ventolin") ||
    nameLower.includes("inhaler")
  ) {
    return {
      doseQuantity: "بختان",
      doseForm: "Inhaler (بخاخ)",
      frequency: "عند ضيق التنفس أو نوبة الأزمة",
      duration: "عند اللزوم فقط (PRN)",
      instructions: "أخذ نفس عميق مع حبس النفس 10 ثوان، والمضمضة بالماء بعد الاستخدام",
    };
  }

  // ── 5. TOPICALS (Creams, Ointments, Gels) ────────────────────────────────
  if (
    formLower.includes("cream") ||
    formLower.includes("ointment") ||
    formLower.includes("gel") ||
    formLower.includes("مرهم") ||
    formLower.includes("كريم") ||
    formLower.includes("دهان") ||
    catLower.includes("topical") ||
    catLower.includes("dermatology")
  ) {
    const isGel = formLower.includes("gel") || nameLower.includes("gel");
    const isOint = formLower.includes("ointment") || nameLower.includes("ointment");
    return {
      doseQuantity: "طبقة رقيقة",
      doseForm: isGel ? "Gel (جل)" : isOint ? "Ointment (مرهم)" : "Cream (كريم)",
      frequency: "دهان موضعي مرتان إلى 3 مرات يومياً",
      duration: "لمدة أسبوع أو حتى تمام الشفاء",
      instructions: "تنظيف وتجفيف الجلد المصاب برفق قبل الدهان مع التدليك اللطيف حتى الامتصاص",
    };
  }

  // ── 6. SUPPOSITORIES (أقماع ولبوس) ───────────────────────────────────────
  if (
    formLower.includes("suppositor") ||
    formLower.includes("لبوس") ||
    formLower.includes("أقماع") ||
    nameLower.includes("supp")
  ) {
    return {
      doseQuantity: "1 قمع",
      doseForm: "Suppository (لبوس)",
      frequency: "قمع شرجي كل 12 ساعة أو عند ارتفاع الحرارة",
      duration: "لمدة 3 أيام عند اللزوم",
      instructions: "يحفظ في مكان بارد أو الثلاجة قبل الاستخدام لضمان التماسك",
    };
  }

  // ── 7. INJECTIONS (Ampoules / Vials) ─────────────────────────────────────
  if (
    formLower.includes("ampoule") ||
    formLower.includes("أمبول") ||
    formLower.includes("حقنة") ||
    nameLower.includes("ampoule")
  ) {
    return {
      doseQuantity: "1 أمبول",
      doseForm: "Ampoule (أمبول/حقنة)",
      frequency: "حقنة عضلية عميقة مرة يومياً أو عند الألم الشديد",
      duration: "لمدة 3 أيام",
      instructions: "حقن عضلي بطيء وعميق تحت إشراف تمريضي",
    };
  }

  if (formLower.includes("vial") || formLower.includes("فيال") || nameLower.includes("vial")) {
    return {
      doseQuantity: "1 فيال",
      doseForm: "Vial (حقنة وريدية)",
      frequency: "حقنة وريدية بطيئة أو محلول كل 12 ساعة",
      duration: "لمدة 5 أيام",
      instructions: "حقن وريدي بطيء بعد إجراء اختبار حساسية للدواء",
    };
  }

  // ── 8. LIQUIDS & SYRUPS (أشربة ومعلقات أطفال) ────────────────────────────
  if (
    formLower.includes("syrup") ||
    formLower.includes("suspension") ||
    formLower.includes("شراب") ||
    formLower.includes("معلق") ||
    nameLower.includes("syrup") ||
    nameLower.includes("susp")
  ) {
    const isSusp = formLower.includes("suspension") || formLower.includes("معلق");
    const isAnti = catLower.includes("antibiotic") || nameLower.includes("aug") || nameLower.includes("amox");
    return {
      doseQuantity: "5 مل (ملعقة صغيرة)",
      doseForm: isSusp ? "Suspension (معلق)" : "Syrup (شراب)",
      frequency: isAnti ? "كل 12 ساعة بعد الأكل بانتظام" : "كل 8 ساعات بعد الأكل (3 مرات يومياً)",
      duration: isAnti ? "لمدة 7 أيام (أسبوع)" : "لمدة 5 أيام",
      instructions: isSusp
        ? "ترج الزجاجة جيداً قبل كل جرعة وتحفظ في باب الثلاجة بعد التحضير"
        : "ترج الزجاجة قبل الاستخدام مع تناول كميات كافية من السوائل",
    };
  }

  // ── 9. MOUTHWASH (مضمضة وغرغرة) ──────────────────────────────────────────
  if (formLower.includes("mouthwash") || formLower.includes("مضمضة") || nameLower.includes("gargle")) {
    return {
      doseQuantity: "15 مل (غطاء)",
      doseForm: "Mouthwash (مضمضة)",
      frequency: "مضمضة وغرغرة لمدة دقيقة 3 مرات يومياً بعد الوجبات",
      duration: "لمدة أسبوع كامل",
      instructions: "لا تبلع وتجنب الأكل أو الشرب لمدة نصف ساعة بعد المضمضة",
    };
  }

  // ── 10. EFFERVESCENT (فوار) ──────────────────────────────────────────────
  if (formLower.includes("effervescent") || formLower.includes("فوار") || formLower.includes("sachet")) {
    return {
      doseQuantity: "كيس واحد",
      doseForm: "Effervescent (فوار)",
      frequency: "يذاب في نصف كوب ماء بعد الأكل 3 مرات يومياً",
      duration: "لمدة 5 أيام",
      instructions: "يشرب فور انتهاء الفوران مباشرة",
    };
  }

  // ── 11. PHARMACOLOGY-BASED AUTOFILL (Tablets / Capsules) ─────────────────

  // A) Proton Pump Inhibitors (PPIs) & Peptic Ulcer
  if (
    activeLower.includes("prazole") ||
    nameLower.includes("nexium") ||
    nameLower.includes("pantoloc") ||
    nameLower.includes("controloc") ||
    nameLower.includes("omeprazole") ||
    nameLower.includes("esomeprazole") ||
    nameLower.includes("pariet") ||
    catLower.includes("ppi")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "مرة واحدة يومياً صباحاً على الريق قبل الفطور بنصف ساعة",
      duration: "لمدة شهر كامل (30 يوماً)",
      instructions: "يبلع كاملاً قبل الإفطار بنصف ساعة بدون مضغ أو كسر",
    };
  }

  // B) Azithromycin (3-day antibiotic protocol)
  if (activeLower.includes("azithromycin") || nameLower.includes("zithro")) {
    return {
      doseQuantity: "1",
      doseForm: "Capsule (كبسولة)",
      frequency: "مرة واحدة يومياً قبل الأكل بساعة أو بعده بساعتين",
      duration: "لمدة 3 أيام متتالية",
      instructions: "تؤخذ الجرعة في نفس الميعاد يومياً لمدة 3 أيام متتالية",
    };
  }

  // C) Standard Antibiotics (Augmentin, Hibiotic, Amoxicillin, Cipro, etc.)
  if (
    catLower.includes("antibiotic") ||
    activeLower.includes("amoxicillin") ||
    activeLower.includes("clavulan") ||
    activeLower.includes("ciprofloxacin") ||
    activeLower.includes("cefixime") ||
    nameLower.includes("augmentin") ||
    nameLower.includes("hibiotic") ||
    nameLower.includes("curam") ||
    nameLower.includes("megamox")
  ) {
    return {
      doseQuantity: "1",
      doseForm: formLower.includes("cap") ? "Capsule (كبسولة)" : "Tablet (قرص)",
      frequency: "كل 12 ساعة بعد الأكل بانتظام (مرتان يومياً)",
      duration: "لمدة 7 أيام (أسبوع)",
      instructions: "يجب إكمال الكورس العلاجي بالكامل حتى لو تحسنت الأعراض منعاً لمقاومة البكتيريا",
    };
  }

  // D) Antihistamines & Allergy
  if (
    catLower.includes("antihistamine") ||
    catLower.includes("allergy") ||
    activeLower.includes("cetirizine") ||
    activeLower.includes("fexofenadine") ||
    activeLower.includes("loratadine") ||
    nameLower.includes("zyrtec") ||
    nameLower.includes("telfast") ||
    nameLower.includes("claritine")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "مرة واحدة يومياً مساءً قبل النوم",
      duration: "لمدة أسبوعين (14 يوماً)",
      instructions: "يفضل تناوله مساءً قبل النوم لتفادي أي شعور بالنعاس أثناء النهار",
    };
  }

  // E) Cardiovascular & Hypertension (Beta-blockers, ACEi, ARBs, CCBs)
  if (
    catLower.includes("cardiovascular") ||
    catLower.includes("beta blocker") ||
    catLower.includes("hypertension") ||
    activeLower.includes("bisoprolol") ||
    activeLower.includes("amlodipine") ||
    activeLower.includes("valsartan") ||
    nameLower.includes("concor") ||
    nameLower.includes("norvasc") ||
    nameLower.includes("exforge")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "مرة واحدة يومياً صباحاً بانتظام بعد الإفطار",
      duration: "لمدة شهر كامل (30 يوماً)",
      instructions: "يؤخذ يومياً في نفس التوقيت مع قياس ضغط الدم دورياً وعدم التوقف المفاجئ",
    };
  }

  // F) Antidiabetics (Metformin / Glucophage)
  if (
    catLower.includes("antidiabetic") ||
    activeLower.includes("metformin") ||
    nameLower.includes("glucophage") ||
    nameLower.includes("januvia")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "مرتان يومياً وسط الوجبات الرئيسية (الإفطار والغداء)",
      duration: "لمدة شهر كامل (30 يوماً)",
      instructions: "يؤخذ وسط الطعام مباشرة لتقليل أي اضطراب معوي",
    };
  }

  // G) Statins & Cholesterol
  if (
    catLower.includes("statin") ||
    catLower.includes("lipid") ||
    activeLower.includes("atorvastatin") ||
    activeLower.includes("rosuvastatin") ||
    nameLower.includes("lipitor") ||
    nameLower.includes("crestor") ||
    nameLower.includes("ator")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "مرة واحدة يومياً مساءً بعد العشاء وقبل النوم",
      duration: "لمدة شهر كامل (30 يوماً)",
      instructions: "يفضل أخذه ليلاً لزيادة فاعليته مع إنزيمات تصنيع الكوليسترول الكبدية",
    };
  }

  // H) Antispasmodics & IBS (Duspatalin, Buscopan, Colona)
  if (
    catLower.includes("antispasmodic") ||
    catLower.includes("ibs") ||
    activeLower.includes("mebeverine") ||
    nameLower.includes("duspatalin") ||
    nameLower.includes("colona") ||
    nameLower.includes("spasmomen")
  ) {
    return {
      doseQuantity: "1",
      doseForm: formLower.includes("cap") ? "Capsule (كبسولة)" : "Tablet (قرص)",
      frequency: "قبل الأكل بـ 20 دقيقة (3 مرات يومياً)",
      duration: "لمدة أسبوعين (14 يوماً)",
      instructions: "يؤخذ قبل الوجبات بثلث ساعة للحد من المغص والتقلصات المعوية",
    };
  }

  // I) NSAIDs & Analgesics (Cataflam, Voltaren, Brufen, Ketofan)
  if (
    catLower.includes("nsaid") ||
    catLower.includes("analgesic") ||
    activeLower.includes("diclofenac") ||
    activeLower.includes("ibuprofen") ||
    activeLower.includes("ketoprofen") ||
    nameLower.includes("cataflam") ||
    nameLower.includes("voltaren") ||
    nameLower.includes("brufen") ||
    nameLower.includes("ketofan")
  ) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "كل 8 ساعات بعد الأكل مباشرة عند اللزوم",
      duration: "لمدة 5 أيام عند اللزوم",
      instructions: "يؤخذ بعد الأكل مباشرة مع كوب ماء وفير وتجنب تناوله على معدة فارغة",
    };
  }

  // J) Pure Paracetamol
  if (activeLower.includes("paracetamol") || nameLower.includes("panadol") || nameLower.includes("adol")) {
    return {
      doseQuantity: "1",
      doseForm: "Tablet (قرص)",
      frequency: "كل 8 ساعات بعد الأكل عند اللزوم أو ارتفاع الحرارة",
      duration: "لمدة 5 أيام عند اللزوم",
      instructions: "يؤخذ عند الشعور بالألم أو الصداع بحد أقصى 4 جرامات يومياً",
    };
  }

  // ── 12. GENERAL CLEAN FALLBACK FOR ANY TABLET / CAPSULE ──────────────────
  const isCapsule = formLower.includes("capsule") || formLower.includes("كبسول");
  return {
    doseQuantity: "1",
    doseForm: isCapsule ? "Capsule (كبسولة)" : "Tablet (قرص)",
    frequency: "كل 8 ساعات بعد الأكل (3 مرات يومياً)",
    duration: "لمدة 5 أيام",
    instructions: "حسب تعليمات الطبيب المعالج والالتزام بمواعيد الجرعات",
  };
}
