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
 * Detect if the current runtime is a mobile app / mobile device
 * Strictly returns false for Electron desktop application and PC browsers.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as any;
  const ua = navigator.userAgent || "";

  // 1. Electron Desktop App check -> strictly false (Computer version)
  if (w.penrxDesktop?.isElectron || ua.includes("Electron")) {
    return false;
  }

  // 2. PC / Desktop operating system checks -> strictly false
  if (/Windows NT|Macintosh|Linux x86_64/i.test(ua) && !/Android/i.test(ua)) {
    return false;
  }

  // 3. Capacitor native mobile app check -> true
  if (w.Capacitor?.isNativePlatform?.() || w.Capacitor?.getPlatform?.() === "android") {
    return true;
  }

  // 4. Mobile OS user agents
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  if (mobileRegex.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Check if the current mobile device supports biometric fingerprint / FaceID
 * Returns false on desktop/computer version.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !isMobileDevice()) {
    return false;
  }

  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Register a new biometric fingerprint credential (Mobile Fingerprint Enrollment)
 */
export async function registerBiometricCredential(
  username = "doctor@penrx.app"
): Promise<boolean> {
  if (typeof window === "undefined" || !isMobileDevice() || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const isAvail = await isBiometricAvailable();
    if (!isAvail) return false;

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const rpConfig: PublicKeyCredentialRpEntity = {
      name: "PenRX+ Mobile",
    };
    if (
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      !window.location.hostname.includes("127.0.0.1")
    ) {
      rpConfig.id = window.location.hostname;
    }

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: rpConfig,
        user: {
          id: userId,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Native mobile fingerprint / FaceID
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.id) {
      localStorage.setItem("penrx_biometric_credential_id", credential.id);
      localStorage.setItem("penrx_biometric_enabled", "true");
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("[Biometrics] Registration error:", err?.message || err);
    return false;
  }
}

/**
 * Authenticate with biometric fingerprint or device FaceID / PIN on mobile
 */
export async function authenticateWithBiometrics(
  username = "doctor@penrx.app"
): Promise<boolean> {
  if (typeof window === "undefined" || !isMobileDevice() || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const isAvail = await isBiometricAvailable();
    if (!isAvail) return false;

    const existingCredId = localStorage.getItem("penrx_biometric_credential_id");

    // If no credential enrolled yet, enroll directly via create
    if (!existingCredId) {
      return await registerBiometricCredential(username);
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const getPublicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
    };

    if (
      window.location.hostname &&
      window.location.hostname !== "localhost" &&
      !window.location.hostname.includes("127.0.0.1")
    ) {
      getPublicKey.rpId = window.location.hostname;
    }

    const credential = await navigator.credentials.get({
      publicKey: getPublicKey,
    });

    if (credential) {
      return true;
    }

    // Fallback: re-register if get didn't match
    return await registerBiometricCredential(username);
  } catch (err: any) {
    // If get failed because credential was not found or re-enrollment required, attempt registration
    if (err?.name === "NotAllowedError" || err?.name === "InvalidStateError") {
      try {
        return await registerBiometricCredential(username);
      } catch {}
    }
    console.warn("[Biometrics] Verification error:", err?.message || err);
    return false;
  }
}
