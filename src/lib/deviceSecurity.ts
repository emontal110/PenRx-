/**
 * PenRX+ Hardware Fingerprinting & Biometric Security Engine
 * Generates an immutable, cross-platform Machine ID and manages Biometric authentication.
 */

export interface DeviceInfo {
  machineId: string;
  platform: string;
  userAgent: string;
  screenResolution: string;
  hasBiometrics: boolean;
}

/**
 * Generates or retrieves stable unique machine ID for current installation
 */
export function getOrCreateMachineId(): string {
  if (typeof window === "undefined") {
    return "PENRX-SERVER-INSTANCE";
  }

  const STORAGE_KEY = "penrx_unique_machine_id";
  let existingId = localStorage.getItem(STORAGE_KEY);

  if (existingId && existingId.startsWith("PRX-")) {
    return existingId;
  }

  // Construct stable hardware fingerprint hash from available platform attributes
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const navInfo = `${navigator.userAgent}-${navigator.language}-${navigator.hardwareConcurrency || 4}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";

  // Simple, deterministic FNV-1a 32-bit hash implementation
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
