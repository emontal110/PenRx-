// Lightweight Prescription Frequency Tracker (runs on client or server without importing drug catalogs)
const DRUG_USAGE_FREQUENCY = new Map<string, number>();

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
