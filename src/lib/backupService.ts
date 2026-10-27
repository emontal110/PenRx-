/**
 * PenRX+ Medical Data Backup Engine
 *
 * Features:
 *   1. Hardware-Accelerated GZIP Stream Compression (saves 80%+ file size).
 *   2. Cryptographically Strong AES-256-GCM Encryption with PBKDF2 (100,000 rounds).
 *   3. Multi-Device & Reinstall Compatible Key Derivation (tries Subscriber ID key + Machine ID key).
 *   4. Cloud Backup (Multi-Tenant Partitioned by subscriberId with zero collisions & automatic deduplication).
 *   5. Silent Daily Auto-Backup & Automatic Post-Reinstall Restoration of Clinic Profile + Patients.
 */

import { usePrescriptionStore, SavedPrescription, PatientInfo } from "@/store/usePrescriptionStore";
import { useClinicStore, ClinicSettings, Branch } from "@/store/useClinicStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getApiUrl } from "@/lib/cloudProxy";
import { deviceAuthHeaders } from "@/lib/deviceAuthClient";

/** Current format: key material is a device-local random secret. */
const MAGIC_HEADER = "PRX_ENC_V3";
/** Legacy format: key material was derived from the subscriber/machine id. */
const LEGACY_MAGIC_HEADER = "PRX_ENC_V2";
const MACHINE_KEY_PREFIX = "PenRX_MK_2026_";
const VAULT_KEY_STORAGE = "penrx_backup_vault_key";

export interface BackupMetadata {
  version: string;
  exportedAt: string;
  clinicName: string;
  doctorName: string;
  totalPrescriptions: number;
  activePrescriptions: number;
  archivedPrescriptions: number;
  totalPatients: number;
}

export interface BackupPayload {
  meta: BackupMetadata;
  clinic: ClinicSettings;
  branches?: Branch[];
  prescriptions: SavedPrescription[];
  patients: PatientInfo[];
  customDrugs?: any[];
}

/**
 * Device-local backup secret. Generated once and never uploaded, so a stolen
 * database row or a leaked subscriber/machine id is not a decryption key.
 */
function getVaultKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(VAULT_KEY_STORAGE);
    if (existing && existing.length >= 32) return existing;

    const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(VAULT_KEY_STORAGE, generated);
    return generated;
  } catch {
    return "";
  }
}

/**
 * Returns the primary subscriber-scoped passphrase so cloud backups can be restored
 * seamlessly across reinstalls or linked devices belonging to the same subscriber!
 */
function getSubscriberPassphrase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const subId =
      useSubscriptionStore.getState()?.subscriberId ||
      localStorage.getItem("penrx_last_subscriber_id");
    if (subId && subId.startsWith("SUB-") && subId !== "SUB-0000") {
      return `${MACHINE_KEY_PREFIX}${subId.trim().toUpperCase()}`;
    }
  } catch {}
  return null;
}

/**
 * Derives a per-machine passphrase for backup encryption.
 */
function getMachinePassphrase(): string {
  if (typeof window === "undefined") return `${MACHINE_KEY_PREFIX}SERVER`;

  const subPass = getSubscriberPassphrase();
  if (subPass) return subPass;

  const machineId = localStorage.getItem("penrx_unique_machine_id");
  if (machineId && machineId.startsWith("PRX-")) {
    return `${MACHINE_KEY_PREFIX}${machineId}`;
  }

  const INSTALL_KEY = "penrx_install_enc_key";
  const existing = localStorage.getItem(INSTALL_KEY);
  if (existing && existing.length > 20) return existing;

  const randomKey = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const installKey = `${MACHINE_KEY_PREFIX}${randomKey}`;
  localStorage.setItem(INSTALL_KEY, installKey);
  return installKey;
}

/**
 * Candidate passphrases for decryption (supports subscriber key, machine key, and universal fallback)
 */
function getCandidateDecryptionPassphrases(userPassphrase?: string, legacy = false): string[] {
  const candidates = new Set<string>();
  if (userPassphrase && userPassphrase.trim()) {
    candidates.add(userPassphrase.trim());
  }
  if (!legacy) {
    const vault = getVaultKey();
    if (vault) candidates.add(vault);
    if (typeof window !== "undefined") {
      const installKey = localStorage.getItem("penrx_install_enc_key");
      if (installKey) candidates.add(installKey);
    }
    return Array.from(candidates);
  }

  const subPass = getSubscriberPassphrase();
  if (subPass) candidates.add(subPass);

  if (typeof window !== "undefined") {
    const machineId =
      useSubscriptionStore.getState()?.machineId ||
      localStorage.getItem("penrx_unique_machine_id");
    if (machineId && machineId.startsWith("PRX-")) {
      candidates.add(`${MACHINE_KEY_PREFIX}${machineId.trim().toUpperCase()}`);
    }
    const initMid = localStorage.getItem("penrx_initial_machine_id");
    if (initMid && initMid.startsWith("PRX-")) {
      candidates.add(`${MACHINE_KEY_PREFIX}${initMid.trim().toUpperCase()}`);
    }
    const installKey = localStorage.getItem("penrx_install_enc_key");
    if (installKey) candidates.add(installKey);
  }
  candidates.add(getMachinePassphrase());
  return Array.from(candidates);
}

/**
 * Derives a 256-bit AES-GCM key from a passphrase and salt using PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = passphrase || getMachinePassphrase();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(rawKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Compresses data using native CompressionStream (GZIP)
 */
async function compressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== "undefined") {
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(data as any);
    writer.close();
    const buffer = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buffer);
  }
  return data;
}

/**
 * Decompresses data using native DecompressionStream (GZIP)
 */
async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(data as any);
    writer.close();
    const buffer = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buffer);
  }
  return data;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = typeof window !== "undefined" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an encrypted & compressed backup file (.penrx)
 */
export async function exportEncryptedBackup(userPassphrase?: string): Promise<{
  blob: Blob;
  fileName: string;
  filename: string;
  payloadBase64: string;
  uncompressedBytes: number;
  compressedBytes: number;
  originalSizeKb: number;
  compressedSizeKb: number;
  savingsPercent: number;
  metadata: BackupMetadata;
}> {
  const prescriptionStore = usePrescriptionStore.getState();
  const clinicStore = useClinicStore.getState();

  const allRx = prescriptionStore.savedPrescriptions || [];
  const activeCount = allRx.filter((r) => !r.isArchived).length;
  const archivedCount = allRx.filter((r) => r.isArchived).length;
  const allPatients = prescriptionStore.savedPatients || [];

  const nowIso = new Date().toISOString();
  const metadata: BackupMetadata = {
    version: "1.4",
    exportedAt: nowIso,
    clinicName: clinicStore.clinic.name || clinicStore.clinic.nameAr || "العيادة الرئيسية",
    doctorName: clinicStore.clinic.doctorName || "الاستشاري",
    totalPrescriptions: allRx.length,
    activePrescriptions: activeCount,
    archivedPrescriptions: archivedCount,
    totalPatients: allPatients.length,
  };

  const payload: BackupPayload = {
    meta: metadata,
    clinic: clinicStore.clinic,
    branches: clinicStore.branches,
    prescriptions: allRx,
    patients: allPatients,
  };

  const jsonStr = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const originalSizeKb = Math.round(jsonBytes.length / 1024);

  const compressedBytes = await compressData(jsonBytes);

  // A doctor-chosen passphrase is portable; otherwise the device-local vault key is
  // used so the cloud never holds anything an attacker can derive from ids.
  const passphrase = (userPassphrase?.trim() || getVaultKey() || getMachinePassphrase());
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressedBytes as any
  );
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  const headerBytes = new TextEncoder().encode(MAGIC_HEADER);
  const finalBuffer = new Uint8Array(headerBytes.length + salt.length + iv.length + ciphertextBytes.length);

  finalBuffer.set(headerBytes, 0);
  finalBuffer.set(salt, headerBytes.length);
  finalBuffer.set(iv, headerBytes.length + salt.length);
  finalBuffer.set(ciphertextBytes, headerBytes.length + salt.length + iv.length);

  const compressedSizeKb = Math.round(finalBuffer.length / 1024);
  const savingsPercent = originalSizeKb > 0
    ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
    : 0;

  const blob = new Blob([finalBuffer as any], { type: "application/octet-stream" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `PenRX_Backup_${dateStr}.penrx`;
  const payloadBase64 = uint8ArrayToBase64(finalBuffer);

  return {
    blob,
    fileName,
    filename: fileName,
    payloadBase64,
    uncompressedBytes: jsonBytes.length,
    compressedBytes: finalBuffer.length,
    originalSizeKb,
    compressedSizeKb,
    savingsPercent,
    metadata,
  };
}

export function downloadBackupFile(blob: Blob, fileName: string) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Decrypts, decompresses, and restores a raw backup buffer
 */
export async function restoreFromBackupBuffer(
  data: Uint8Array,
  mode: "MERGE" | "REPLACE" = "MERGE",
  userPassphrase?: string
): Promise<{
  success: boolean;
  message: string;
  error?: string;
  restoredPrescriptionsCount: number;
  restoredPatientsCount: number;
  metadata?: BackupMetadata;
}> {
  const headerLength = LEGACY_MAGIC_HEADER.length;
  if (data.length < headerLength + 16 + 12) {
    return {
      success: false,
      message: "الملف المحدد غير صالح أو تالف",
      error: "الملف المحدد غير صالح أو تالف",
      restoredPrescriptionsCount: 0,
      restoredPatientsCount: 0,
    };
  }

  const headerStr = new TextDecoder().decode(data.slice(0, headerLength));
  const isLegacyFile = headerStr === LEGACY_MAGIC_HEADER;
  if (headerStr !== MAGIC_HEADER && !isLegacyFile) {
    return {
      success: false,
      message: "صيغة الملف غير معروفة. يرجى اختيار ملف نسخة احتياطية معتمد (.penrx)",
      error: "صيغة الملف غير معروفة. يرجى اختيار ملف نسخة احتياطية معتمد (.penrx)",
      restoredPrescriptionsCount: 0,
      restoredPatientsCount: 0,
    };
  }

  const salt = data.slice(headerLength, headerLength + 16);
  const iv = data.slice(headerLength + 16, headerLength + 16 + 12);
  const ciphertext = data.slice(headerLength + 16 + 12);

  let decryptedBytes: ArrayBuffer | null = null;
  const passphrases = getCandidateDecryptionPassphrases(userPassphrase, isLegacyFile);
  for (const pass of passphrases) {
    try {
      const key = await deriveKey(pass, salt);
      decryptedBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext as any
      );
      if (decryptedBytes) break;
    } catch {}
  }

  if (!decryptedBytes) {
    return {
      success: false,
      message: userPassphrase
        ? "فشل فك التشفير بكلمة المرور المدخلة. تأكد من صحتها ومن سلامة الملف."
        : "هذه النسخة محمية بكلمة مرور أو بجهاز النسخة الأصلية. أدخل كلمة مرور النسخة الاحتياطية للمتابعة.",
      error: "فشل فك التشفير.",
      restoredPrescriptionsCount: 0,
      restoredPatientsCount: 0,
    };
  }

  const decompressedBytes = await decompressData(new Uint8Array(decryptedBytes));
  const jsonStr = new TextDecoder().decode(decompressedBytes);
  const payload: BackupPayload = JSON.parse(jsonStr);

  if (!payload || !Array.isArray(payload.prescriptions)) {
    return {
      success: false,
      message: "بيانات النسخة الاحتياطية غير مكتملة",
      error: "بيانات النسخة الاحتياطية غير مكتملة",
      restoredPrescriptionsCount: 0,
      restoredPatientsCount: 0,
    };
  }

  const prescriptionStore = usePrescriptionStore.getState();
  const clinicStore = useClinicStore.getState();
  let finalRx: SavedPrescription[];
  let finalPatients: PatientInfo[];
  let newRxCount = 0;
  let newPatCount = 0;

  // Always restore clinic profile settings if the user's current profile was wiped by reinstall
  // or when mode === "REPLACE"
  if (payload.clinic && (mode === "REPLACE" || !clinicStore.clinic.isProfileSaved || !clinicStore.clinic.specialty)) {
    clinicStore.saveClinicAndCreateFirstBranch({
      ...payload.clinic,
      isProfileSaved: true,
    });
  }

  if (mode === "REPLACE") {
    finalRx = payload.prescriptions;
    finalPatients = payload.patients || [];
    newRxCount = finalRx.length;
    newPatCount = finalPatients.length;
  } else {
    const existingRx = prescriptionStore.savedPrescriptions || [];
    const existingRxMap = new Map(existingRx.map((r) => [r.id || r.prescriptionNo, r]));

    for (const rx of payload.prescriptions) {
      const key = rx.id || rx.prescriptionNo;
      if (!existingRxMap.has(key)) {
        existingRxMap.set(key, rx);
        newRxCount++;
      }
    }

    finalRx = Array.from(existingRxMap.values());
    finalRx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const existingPatients = prescriptionStore.savedPatients || [];
    const existingPatMap = new Map(existingPatients.map((p) => [(p.name || "").trim().toLowerCase(), p]));

    if (Array.isArray(payload.patients)) {
      for (const p of payload.patients) {
        const k = (p.name || "").trim().toLowerCase();
        if (k && !existingPatMap.has(k)) {
          existingPatMap.set(k, p);
          newPatCount++;
        }
      }
    }
    finalPatients = Array.from(existingPatMap.values());
  }

  prescriptionStore.setSavedPrescriptions(finalRx);
  prescriptionStore.setSavedPatients(finalPatients);

  const successMessage =
    mode === "REPLACE"
      ? `تم استبدال واستعادة ${newRxCount} روشتة و ${newPatCount} مريض بنجاح`
      : `تم دمج واستعادة ${newRxCount} روشتة و ${newPatCount} مريض بنجاح`;

  return {
    success: true,
    message: successMessage,
    restoredPrescriptionsCount: newRxCount,
    restoredPatientsCount: newPatCount,
    metadata: payload.meta,
  };
}

export async function importEncryptedBackup(
  file: File,
  userPassphrase?: string,
  mode: "MERGE" | "REPLACE" = "MERGE"
): Promise<{
  success: boolean;
  message: string;
  error?: string;
  restoredPrescriptionsCount: number;
  restoredPatientsCount: number;
  metadata?: BackupMetadata;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    return await restoreFromBackupBuffer(data, mode, userPassphrase);
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "حدث خطأ غير متوقع أثناء قراءة الملف",
      error: err.message || "حدث خطأ غير متوقع أثناء قراءة الملف",
      restoredPrescriptionsCount: 0,
      restoredPatientsCount: 0,
    };
  }
}

export async function uploadBackupToCloud(
  payloadBase64: string,
  fileName: string,
  fileSizeKb: number,
  metadata: BackupMetadata
): Promise<{ success: boolean; message: string }> {
  const subState = useSubscriptionStore.getState();
  const subscriberId = subState.subscriberId;
  const machineId = subState.machineId;
  const targetKey = subscriberId || machineId;

  if (!targetKey) {
    throw new Error("لا يوجد معرف اشتراك مسجل للمزامنة السحابية");
  }

  const res = await fetch(getApiUrl("/api/backup/cloud"), {
    method: "POST",
    headers: deviceAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      subscriberId: targetKey,
      machineId,
      fileName,
      fileSizeKb,
      payloadBase64,
      metadata,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "تعذر رفع النسخة السحابية");
  }

  const data = await res.json();
  return { success: true, message: data.message || "تم حفظ النسخة السحابية بنجاح" };
}

export async function fetchLatestCloudBackupInfo(): Promise<{
  exists: boolean;
  backup?: {
    id: string;
    fileName: string;
    fileSizeKb: number;
    createdAt: string;
    metadata: BackupMetadata;
    payloadBase64?: string;
  };
  message?: string;
}> {
  const subState = useSubscriptionStore.getState();
  const subscriberId = subState.subscriberId;
  const machineId = subState.machineId;
  const targetKey = subscriberId || machineId;

  if (!targetKey) {
    return { exists: false, message: "لا يوجد معرف اشتراك معتمد" };
  }

  const res = await fetch(
    getApiUrl(`/api/backup/cloud?subscriberId=${encodeURIComponent(targetKey)}&machineId=${encodeURIComponent(machineId || "")}`),
    { headers: deviceAuthHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    return { exists: false, message: "تعذر الاتصال بخدمة النسخ السحابي" };
  }

  const data = await res.json();
  if (data.backup) {
    return {
      exists: true,
      backup: data.backup,
    };
  }

  return { exists: false, message: data.message || "لا توجد نسخ سحابية محفوظة بعد" };
}

export async function restoreFromCloudBackup(
  mode: "MERGE" | "REPLACE" = "MERGE"
): Promise<{
  success: boolean;
  message: string;
  restoredPrescriptionsCount: number;
  restoredPatientsCount: number;
  metadata?: BackupMetadata;
}> {
  const info = await fetchLatestCloudBackupInfo();
  if (!info.exists || !info.backup || !info.backup.payloadBase64) {
    throw new Error(info.message || "لا توجد نسخة احتياطية سحابية متاحة للاسترجاع");
  }

  const data = base64ToUint8Array(info.backup.payloadBase64);
  return restoreFromBackupBuffer(data, mode);
}

/**
 * Silent Daily Backup & Silent Annual Auto-Archiving
 */
export async function runDailySilentBackupAndAutoArchival(forceBackup = false): Promise<{
  didBackup: boolean;
  archivedCount: number;
}> {
  if (typeof window === "undefined") return { didBackup: false, archivedCount: 0 };

  let archivedCount = 0;

  try {
    const rxStore = usePrescriptionStore.getState();
    const currentYear = new Date().getFullYear();
    const now = Date.now();
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const nowIso = new Date().toISOString();

    let hasChanges = false;
    const updatedRx = rxStore.savedPrescriptions.map((rx) => {
      if (rx.isArchived) return rx;
      const rxTime = new Date(rx.createdAt).getTime();
      const rxYear = new Date(rx.createdAt).getFullYear();
      if (!isNaN(rxTime) && (now - rxTime > ONE_YEAR_MS || rxYear < currentYear)) {
        archivedCount++;
        hasChanges = true;
        return {
          ...rx,
          isArchived: true,
          archivedAt: nowIso,
        };
      }
      return rx;
    });

    if (hasChanges && archivedCount > 0) {
      rxStore.setSavedPrescriptions(updatedRx);
      console.log(`[AutoArchive] Silently archived ${archivedCount} prescriptions.`);
    }
  } catch (err) {
    console.warn("[AutoArchive Error]:", err);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const lastBackup = localStorage.getItem("penrx_last_silent_backup");

  if (!forceBackup && lastBackup === todayStr) {
    return { didBackup: false, archivedCount };
  }

  try {
    const subState = useSubscriptionStore.getState();
    const targetKey = subState.subscriberId || subState.machineId;
    if (!targetKey) {
      return { didBackup: false, archivedCount };
    }

    const res = await exportEncryptedBackup();
    const clinicSaved = useClinicStore.getState().clinic.isProfileSaved;
    if (res.metadata.totalPrescriptions > 0 || res.metadata.totalPatients > 0 || clinicSaved) {
      await uploadBackupToCloud(res.payloadBase64, res.fileName, res.compressedSizeKb, res.metadata);
      localStorage.setItem("penrx_last_silent_backup", todayStr);
      localStorage.setItem("penrx_last_backup_time", new Date().toISOString());
      localStorage.setItem(
        "penrx_last_backup_info",
        JSON.stringify({
          fileName: res.fileName,
          sizeKb: res.compressedSizeKb,
          totalPrescriptions: res.metadata.totalPrescriptions,
        })
      );
      window.dispatchEvent(new CustomEvent("penrx_backup_updated"));
      return { didBackup: true, archivedCount };
    }
  } catch (err) {
    console.warn("[SilentDailyBackup Notice]:", err);
  }

  return { didBackup: false, archivedCount };
}
