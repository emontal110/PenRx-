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

  const STORAGE_KEY = "penrx_unique_machine_id";
  const w = window as any;

  // 1. Electron Desktop Native Hardware ID
  if (w.penrxDesktop?.isElectron && typeof w.penrxDesktop.getHardwareMachineId === "function") {
    try {
      const hwId: string = await w.penrxDesktop.getHardwareMachineId();
      if (hwId && hwId.startsWith("PRX-")) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== hwId) {
          localStorage.setItem(STORAGE_KEY, hwId);
          onUpdate(hwId);
        }
        return;
      }
    } catch (err) {
      console.warn("[DeviceSecurity] Electron hardware ID error:", err);
    }
  }

  // 2. Capacitor Mobile (Android APK) Native Hardware ID (SSAID)
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
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== androidId) {
          localStorage.setItem(STORAGE_KEY, androidId);
          onUpdate(androidId);
        }
      }
    }
  } catch (capErr) {}
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
 * Detect if strictly running inside the Native Android APK (Capacitor Native Android)
 * Excludes Desktop EXE, Desktop browsers, and regular mobile web browsers.
 */
export function isNativeAndroidApk(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  const ua = navigator.userAgent || "";

  // 1. Desktop EXE / Electron -> strictly false
  if (w.penrxDesktop?.isElectron || ua.includes("Electron")) {
    return false;
  }

  // 2. Desktop OS check -> strictly false
  if (/Windows NT|Macintosh|Linux x86_64/i.test(ua) && !/Android/i.test(ua)) {
    return false;
  }

  // 3. Capacitor native check
  if (w.Capacitor && typeof w.Capacitor.isNativePlatform === "function") {
    return w.Capacitor.isNativePlatform();
  }

  return false;
}

/**
 * Check if the biometric lock is enabled in settings / storage
 */
export function isBiometricLockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("penrx_biometric_enabled") === "true";
}

/**
 * Save biometric lock preference
 */
export function setBiometricLockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("penrx_biometric_enabled", enabled ? "true" : "false");
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
}

let _cachedBiometricAvailable: boolean | null = null;
let _biometricCheckInFlight: Promise<boolean> | null = null;

/**
 * Check if the current device supports biometric fingerprint / FaceID
 * Returns true on Native Android APK when hardware is present and enrolled.
 * Returns false on desktop/computer version.
 * Caches result in memory to avoid repeated/concurrent native IPC bridge calls.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const w = window as any;
  if (w.penrxDesktop?.isElectron) {
    return false;
  }

  if (_cachedBiometricAvailable !== null) {
    return _cachedBiometricAvailable;
  }

  if (_biometricCheckInFlight) {
    return _biometricCheckInFlight;
  }

  _biometricCheckInFlight = (async () => {
    try {
      // 1. Native Capacitor Android APK (@aparajita/capacitor-biometric-auth)
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
          const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
          const checkPromise = BiometricAuth.checkBiometry().catch(() => null);
          const timeoutPromise = new Promise<any>((resolve) =>
            setTimeout(() => resolve(null), 500)
          );
          const check = await Promise.race([checkPromise, timeoutPromise]);
          const result = Boolean(check && check.isAvailable);
          _cachedBiometricAvailable = result;
          return result;
        }
      } catch (err) {
        console.warn("[Biometrics] Native checkBiometry error:", err);
      }

      // 2. Mobile Browser Fallback (WebAuthn) with non-blocking 500ms watchdog
      if (!isMobileDevice() || !window.PublicKeyCredential) {
        _cachedBiometricAvailable = false;
        return false;
      }

      try {
        const webauthnPromise = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
        const webauthnTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500));
        const result = await Promise.race([webauthnPromise, webauthnTimeout]);
        _cachedBiometricAvailable = Boolean(result);
        return Boolean(result);
      } catch {
        _cachedBiometricAvailable = false;
        return false;
      }
    } finally {
      _biometricCheckInFlight = null;
    }
  })();

  return _biometricCheckInFlight;
}

/**
 * Register a new biometric fingerprint credential (Mobile Fingerprint Enrollment for Web)
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
 * Directly invokes native Android BiometricPrompt on Android APK.
 */
export async function authenticateWithBiometrics(
  reason = "المس مستشعر البصمة لفتح منظومة PenRX+"
): Promise<BiometricAuthResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "البيئة الحالية غير مدعومة" };
  }

  const w = window as any;
  if (w.penrxDesktop?.isElectron) {
    return { success: false, error: "البصمة غير مدعومة على أجهزة الكمبيوتر" };
  }

  // 1. Native Capacitor Android APK (@aparajita/capacitor-biometric-auth)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
      const { BiometricAuth, AndroidBiometryStrength } = await import("@aparajita/capacitor-biometric-auth");

      const check = await BiometricAuth.checkBiometry().catch(() => null);
      if (!check || !check.isAvailable) {
        return {
          success: false,
          error: check?.reason || "البصمة غير متوفرة أو لم يتم تعيين بصمة في إعدادات الهاتف",
        };
      }

      // Strong strength required on Android 11+ (API 30+) when combined with allowDeviceCredential
      const biometryStrength = AndroidBiometryStrength?.strong ?? 1;

      const authAction = async (): Promise<BiometricAuthResult> => {
        try {
          // Attempt 1: Native biometrics with system device credentials (PIN/pattern fallback)
          await BiometricAuth.authenticate({
            reason,
            cancelTitle: "إلغاء",
            allowDeviceCredential: true,
            androidTitle: "التحقق من الهوية - PenRX+",
            androidSubtitle: "استخدم بصمة الإصبع أو رمز حماية الهاتف للدخول",
            androidBiometryStrength: biometryStrength,
          });
          return { success: true };
        } catch (firstErr: any) {
          console.warn("[Biometrics] Attempt 1 failed:", firstErr);
          const code = firstErr?.code || "";
          if (code === "userCancel" || code === "appCancel" || code === "biometryLockout") {
            throw firstErr;
          }

          // Attempt 2: Direct biometric without device credential fallback
          try {
            await BiometricAuth.authenticate({
              reason,
              cancelTitle: "إلغاء",
              allowDeviceCredential: false,
              androidTitle: "التحقق من الهوية - PenRX+",
              androidSubtitle: "المس مستشعر البصمة للفتح",
              androidBiometryStrength: biometryStrength,
            });
            return { success: true };
          } catch (secondErr) {
            throw secondErr;
          }
        }
      };

      // Watchdog timeout: 20 seconds maximum to prevent UI freezing
      const timeoutPromise = new Promise<BiometricAuthResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error("انتهت مهلة انتظار مستشعر البصمة"));
        }, 20000);
      });

      return await Promise.race([authAction(), timeoutPromise]);
    }
  } catch (err: any) {
    console.warn("[Biometrics] Native authenticate error:", err);
    const code = err?.code || "";
    let message = "فشل التحقق من البصمة";
    if (code === "userCancel" || code === "appCancel") {
      message = "تم إلغاء عملية البصمة";
    } else if (code === "biometryLockout") {
      message = "تم قفل البصمة مؤقتاً لتكرار المحاولات الخاطئة. يرجى استخدام رمز العيادة.";
    } else if (code === "biometryNotEnrolled") {
      message = "لم يتم تسجيل بصمة في إعدادات الهاتف بعد.";
    } else if (err?.message) {
      message = err.message;
    }
    return { success: false, error: message };
  }

  // 2. Mobile Browser WebAuthn Fallback
  if (isMobileDevice() && window.PublicKeyCredential) {
    try {
      const isAvail = await isBiometricAvailable();
      if (!isAvail) return { success: false, error: "البصمة غير متوفرة" };

      const existingCredId = localStorage.getItem("penrx_biometric_credential_id");
      if (!existingCredId) {
        const enrolled = await registerBiometricCredential();
        return { success: enrolled, error: enrolled ? undefined : "فشل تسجيل البصمة" };
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
        return { success: true };
      }
      return { success: false, error: "لم يتم التعرف على البصمة" };
    } catch (err: any) {
      return { success: false, error: err?.message || "فشل التحقق من البصمة" };
    }
  }

  return { success: false, error: "الجهاز لا يدعم المصادقة بالبصمة" };
}

// ===== CLOCK TAMPERING & SERVER TIME DEFENSE =====
const LAST_SERVER_TIME_KEY = "penrx_last_verified_server_time";

/**
 * Persists the latest verified authoritative server time.
 * Only moves forward to prevent clock rollback exploits.
 */
export function recordServerTime(serverTimestampMs: number): void {
  if (typeof window === "undefined" || !serverTimestampMs || isNaN(serverTimestampMs)) return;
  try {
    const currentRecorded = getRecordedServerTime();
    if (serverTimestampMs > currentRecorded) {
      localStorage.setItem(LAST_SERVER_TIME_KEY, String(serverTimestampMs));
    }
  } catch {}
}

/**
 * Retrieves the highest recorded authoritative server timestamp.
 */
export function getRecordedServerTime(): number {
  if (typeof window === "undefined") return 0;
  try {
    const val = localStorage.getItem(LAST_SERVER_TIME_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Validates local device clock against authoritative server time records.
 * Returns true if the device time was manipulated/rolled backwards.
 */
export function detectClockTampering(knownServerTime?: number): { tampered: boolean; reason?: string } {
  if (typeof window === "undefined") return { tampered: false };
  const now = Date.now();
  const recorded = Math.max(getRecordedServerTime(), knownServerTime || 0);

  // If local device time is more than 30 minutes behind the last recorded server time:
  // User has rolled back their clock to bypass subscription expiry!
  if (recorded > 0 && now < (recorded - 30 * 60 * 1000)) {
    return {
      tampered: true,
      reason: "تم رصد تقديم أو إرجاع في ساعة الجهاز. يرجى ضبط توقيت الهاتف/الكمبيوتر على الوضع التلقائي للمتابعة.",
    };
  }
  return { tampered: false };
}

