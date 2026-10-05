import { PatientInfo, SavedPrescription } from "@/store/usePrescriptionStore";

/**
 * Standardize and normalize Arabic text for patient names.
 * - Unifies Alef variations (أ, إ, آ, ٱ, ء) -> ا
 * - Unifies Ta Marbuta (ة) -> ه
 * - Unifies Ya and Alef Maksura (ى, ي) -> ي
 * - Unifies Waw variations (ؤ) -> و
 * - Unifies Ya with Hamza (ئ) -> ي
 * - Strips all Arabic Tashkeel (diacritics: tanween, shaddah, etc.)
 * - Strips Arabic Tatweel (ـ)
 * - Collapses spaces and converts to lowercase
 */
export function normalizePatientName(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Remove Tashkeel and Tatweel
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // Punctuation to space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize phone numbers: converts Eastern/Arabic numerals to Western digits, strips formatting
 */
export function normalizePhoneDigits(phone: string): string {
  if (!phone) return "";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const normalized = phone.replace(/[٠-٩]/g, (d) => {
    const idx = arabicDigits.indexOf(d);
    return idx >= 0 ? String(idx) : d;
  });
  return normalized.replace(/[^0-9]/g, "");
}

/**
 * Enriched patient record with clinical history metrics
 */
export interface UnifiedPatientRecord extends PatientInfo {
  id: string;
  lastDiagnosis?: string;
  lastVisitDate?: string;
  prescriptionCount: number;
  lastBranchName?: string;
}

/**
 * Consolidates saved patients and historical prescriptions into a unified, deduplicated patient catalog
 */
export function extractUnifiedPatients(
  savedPatients: PatientInfo[] = [],
  savedPrescriptions: SavedPrescription[] = []
): UnifiedPatientRecord[] {
  const patientMap = new Map<string, UnifiedPatientRecord>();

  // Helper to generate a lookup key
  const getKeys = (p: Partial<PatientInfo>): string[] => {
    const keys: string[] = [];
    if (p.id) keys.push(`id:${p.id}`);
    const cleanPhone = normalizePhoneDigits(p.phone || "");
    if (cleanPhone && cleanPhone.length >= 7) keys.push(`phone:${cleanPhone}`);
    const normName = normalizePatientName(p.name || "");
    if (normName && normName.length >= 2) keys.push(`name:${normName}`);
    return keys;
  };

  // Helper to find an existing record in map
  const findExisting = (p: Partial<PatientInfo>): UnifiedPatientRecord | undefined => {
    for (const key of getKeys(p)) {
      if (patientMap.has(key)) return patientMap.get(key);
    }
    return undefined;
  };

  // 1. Process explicit savedPatients first
  for (const p of savedPatients) {
    if (!p.name || !p.name.trim()) continue;
    const stableId = p.id || `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const record: UnifiedPatientRecord = {
      id: stableId,
      name: p.name.trim(),
      phone: p.phone || "",
      age: p.age || "",
      gender: p.gender || "MALE",
      height: p.height || "",
      weight: p.weight || "",
      bloodType: p.bloodType || "",
      allergyNotes: p.allergyNotes || "",
      medicalHistory: p.medicalHistory || "",
      prescriptionCount: 0,
    };

    const existing = findExisting(record);
    if (!existing) {
      for (const k of getKeys(record)) {
        patientMap.set(k, record);
      }
    }
  }

  // 2. Sort prescriptions chronologically (newest first) to enrich with latest diagnosis & visit info
  const sortedRx = [...savedPrescriptions].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  for (const rx of sortedRx) {
    if (!rx.patient || !rx.patient.name || !rx.patient.name.trim()) continue;

    const existing = findExisting(rx.patient);
    if (existing) {
      existing.prescriptionCount = (existing.prescriptionCount || 0) + 1;
      if (!existing.lastDiagnosis && rx.diagnosis && rx.diagnosis.trim()) {
        existing.lastDiagnosis = rx.diagnosis.trim();
      }
      if (!existing.lastVisitDate && rx.createdAt) {
        existing.lastVisitDate = rx.createdAt;
      }
      if (!existing.lastBranchName && rx.branchName) {
        existing.lastBranchName = rx.branchName;
      }

      // Merge missing fields
      if (!existing.phone && rx.patient.phone) existing.phone = rx.patient.phone;
      if (!existing.age && rx.patient.age) existing.age = rx.patient.age;
      if (!existing.gender && rx.patient.gender) existing.gender = rx.patient.gender;
      if (!existing.height && rx.patient.height) existing.height = rx.patient.height;
      if (!existing.weight && rx.patient.weight) existing.weight = rx.patient.weight;
      if (!existing.bloodType && rx.patient.bloodType) existing.bloodType = rx.patient.bloodType;
      if (!existing.allergyNotes && rx.patient.allergyNotes) existing.allergyNotes = rx.patient.allergyNotes;
      if (!existing.medicalHistory && rx.patient.medicalHistory) existing.medicalHistory = rx.patient.medicalHistory;

      // Re-index keys
      for (const k of getKeys(existing)) {
        patientMap.set(k, existing);
      }
    } else {
      const stableId = rx.patient.id || `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newRecord: UnifiedPatientRecord = {
        id: stableId,
        name: rx.patient.name.trim(),
        phone: rx.patient.phone || "",
        age: rx.patient.age || "",
        gender: rx.patient.gender || "MALE",
        height: rx.patient.height || "",
        weight: rx.patient.weight || "",
        bloodType: rx.patient.bloodType || "",
        allergyNotes: rx.patient.allergyNotes || "",
        medicalHistory: rx.patient.medicalHistory || "",
        lastDiagnosis: rx.diagnosis?.trim() || "",
        lastVisitDate: rx.createdAt || "",
        lastBranchName: rx.branchName || "",
        prescriptionCount: 1,
      };

      for (const k of getKeys(newRecord)) {
        patientMap.set(k, newRecord);
      }
    }
  }

  // De-duplicate unique records
  const uniqueRecords = Array.from(new Set(patientMap.values()));

  // Sort by prescription count descending, then by last visit date
  uniqueRecords.sort((a, b) => {
    if ((b.prescriptionCount || 0) !== (a.prescriptionCount || 0)) {
      return (b.prescriptionCount || 0) - (a.prescriptionCount || 0);
    }
    const dateA = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
    const dateB = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
    return dateB - dateA;
  });

  return uniqueRecords;
}

/**
 * Searches the patient catalog with intelligent Arabic ranking & phone matching
 */
export function searchPatientCatalog(
  rawQuery: string,
  catalog: UnifiedPatientRecord[],
  limit = 6
): UnifiedPatientRecord[] {
  if (!rawQuery || !rawQuery.trim()) return [];

  const normQuery = normalizePatientName(rawQuery);
  const phoneQuery = normalizePhoneDigits(rawQuery);
  const queryTokens = normQuery.split(" ").filter((t) => t.length > 0);

  if (!normQuery && !phoneQuery) return [];

  const scored: { patient: UnifiedPatientRecord; score: number }[] = [];

  for (const patient of catalog) {
    let score = 0;
    const normName = normalizePatientName(patient.name || "");
    const cleanPhone = normalizePhoneDigits(patient.phone || "");

    // 1. Exact name match
    if (normName === normQuery) {
      score += 150;
    }
    // 2. Name starts with query
    else if (normName.startsWith(normQuery)) {
      score += 90;
    }
    // 3. Name contains query phrase
    else if (normName.includes(normQuery)) {
      score += 60;
    }

    // 4. Token matches (e.g. searching "محمود" matches "أحمد محمود سالم")
    if (queryTokens.length > 0) {
      let matchedTokens = 0;
      for (const token of queryTokens) {
        if (normName.includes(token)) {
          matchedTokens++;
        }
      }
      if (matchedTokens === queryTokens.length) {
        score += 50;
      } else if (matchedTokens > 0) {
        score += 20 * matchedTokens;
      }
    }

    // 5. Phone matching
    if (phoneQuery.length >= 3 && cleanPhone.includes(phoneQuery)) {
      if (cleanPhone === phoneQuery) {
        score += 140; // Exact phone match
      } else if (cleanPhone.startsWith(phoneQuery) || cleanPhone.endsWith(phoneQuery)) {
        score += 80;
      } else {
        score += 40;
      }
    }

    // Small boost for patient visit frequency (up to 10 points)
    if (score > 0 && patient.prescriptionCount) {
      score += Math.min(patient.prescriptionCount * 2, 10);
    }

    if (score > 0) {
      scored.push({ patient, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.patient);
}
