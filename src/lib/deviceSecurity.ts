/**
 * PenRX+ Hardware Fingerprinting & Biometric Security Engine
 *
 * Priority chain for machine ID generation:
 *   1. Electron Desktop: Real hardware ID via IPC (Motherboard Serial → Windows GUID → MAC → Hostname)
 *   2. Web Browser:      Stable FNV-1a hash of screen + navigator + timezone attributes
 *
 * The resulting ID is always in the format: PRX-XXXX-XXXX-XXXX
 * and is persisted in localStorage under "penrx_unique_machine_id".
 */

export interface DeviceInfo {
  machineId: string;
  platform: string;
  userAgent: string;
  screenResolution: string;
  hasBiometrics: boolean;
  isElectron: boolean;
}

/**
 * Generates or retrieves a stable, unique machine ID for the current installation.
 * In Electron desktop mode, this calls the main process for true hardware fingerprinting.
 * In browser/web mode, falls back to a deterministic FNV-1a hash.
 */
export async function getOrCreateMachineIdAsync(): Promise<string> {
  if (typeof window === "undefined") {
    return "PENRX-SERVER-INSTANCE";
  }

  const STORAGE_KEY = "penrx_unique_machine_id";
  const existing = localStorage.getItem(STORAGE_KEY);

  // Return if already have a valid ID
  if (existing && existing.startsWith("PRX-")) {
    return existing;
  }

  // --- ELECTRON DESKTOP: Request real hardware ID from main process ---
  const w = window as any;
  if (w.penrxDesktop?.isElectron && typeof w.penrxDesktop.getHardwareMachineId === "function") {
    try {
      const hwId: string = await w.penrxDesktop.getHardwareMachineId();
      if (hwId && hwId.startsWith("PRX-")) {
        localStorage.setItem(STORAGE_KEY, hwId);
        return hwId;
      }
    } catch (err) {
      console.warn("[DeviceSecurity] Electron hardware ID fetch failed, using browser fallback:", err);
    }
  }

  // --- CAPACITOR MOBILE (Android APK): Request native device hardware ID (SSAID) ---
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
      const { Device } = await import("@capacitor/device");
      const idInfo = await Device.getId();
      if (idInfo && idInfo.identifier) {
        let hash = 2166136261;
        const str = `ANDROID-HW-${idInfo.identifier}`;
        for (let i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
        const suffix = idInfo.identifier.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "A");
        const androidId = `PRX-ANDR-${hex.substring(0, 4)}-${suffix}`;
        localStorage.setItem(STORAGE_KEY, androidId);
        return androidId;
      }
    }
  } catch (capErr) {
    // Not in Capacitor or mobile runtime
  }

  // --- BROWSER / WEB FALLBACK: Deterministic FNV-1a 32-bit hash ---
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const navInfo = `${navigator.userAgent}-${navigator.language}-${navigator.hardwareConcurrency || 4}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";

  // FNV-1a 32-bit: stable, fast, deterministic
  let hash = 2166136261;
  const str = `${screenInfo}#${navInfo}#${timezone}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const machineId = `PRX-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${randomSuffix}`;

  localStorage.setItem(STORAGE_KEY, machineId);
  return machineId;
}

/**
 * Synchronous version: returns cached ID from localStorage immediately.
 * Used on initial store hydration (SSR-safe).
 */
export function getOrCreateMachineId(): string {
  if (typeof window === "undefined") {
    return "PENRX-SERVER-INSTANCE";
  }

  const STORAGE_KEY = "penrx_unique_machine_id";
  const existing = localStorage.getItem(STORAGE_KEY);

  if (existing && existing.startsWith("PRX-")) {
    return existing;
  }

  // Generate a temporary browser-based ID synchronously
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const navInfo = `${navigator.userAgent}-${navigator.language}-${navigator.hardwareConcurrency || 4}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";

  let hash = 2166136261;
  const str = `${screenInfo}#${navInfo}#${timezone}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const machineId = `PRX-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${randomSuffix}`;

  localStorage.setItem(STORAGE_KEY, machineId);
  return machineId;
}

/**
 * Initializes the hardware machine ID in Electron mode and updates the store if needed.
 * Call this once on app mount, after the store is ready.
 */
export async function initializeHardwareMachineId(
  onUpdate: (newId: string) => void
): Promise<void> {
  if (typeof window === "undefined") return;

  const w = window as any;
  if (!w.penrxDesktop?.isElectron) return;

  try {
    const hwId: string = await getOrCreateMachineIdAsync();
    const stored = localStorage.getItem("penrx_unique_machine_id");
    if (hwId !== stored) {
      localStorage.setItem("penrx_unique_machine_id", hwId);
      onUpdate(hwId);
    }
  } catch (err) {
    console.warn("[DeviceSecurity] Hardware ID initialization error:", err);
  }
}

/**
 * Check if the current device/browser supports WebAuthn / Biometrics (Fingerprint / FaceID)
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Authenticate with biometric fingerprint or device PIN/FaceID
 */
export async function authenticateWithBiometrics(username = "doctor@penrx.app"): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) return false;

    // Challenge buffer
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname || "localhost",
      },
    });

    return !!credential;
  } catch (err: any) {
    // If not enrolled or user cancelled
    console.warn("Biometric verification info:", err.message || err);
    return false;
  }
}
