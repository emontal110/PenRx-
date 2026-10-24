/**
 * PenRX+ Hardware Fingerprinting & Biometric Security Engine
 *
 * Priority chain for machine ID generation:
 *   1. Electron Desktop: Real hardware ID via synchronous preload arg or IPC (Motherboard Serial → Windows GUID → MAC → Hostname)
 *   2. Capacitor Mobile: Native Android hardware ID (SSAID) via synchronous MainActivity bridge / User-Agent or Capacitor Device plugin
 *   3. Web Browser:      Deterministic FNV-1a hash of screen + navigator + hardware + timezone attributes (zero random drift across reinstalls)
 *
 * The resulting ID is always in the format: PRX-XXXX-XXXX-XXXX
 * and is persisted in localStorage, cookies, and native storage.
 */

export interface DeviceInfo {
  machineId: string;
  platform: string;
  userAgent: string;
  screenResolution: string;
  hasBiometrics: boolean;
  isElectron: boolean;
}

const PRIMARY_STORAGE_KEY = "penrx_unique_machine_id";
const INITIAL_STORAGE_KEY = "penrx_initial_machine_id";
const LEGACY_MOBILE_KEY = "penrx_machine_id";
const COOKIE_KEY = "penrx_hw_mid";

function readCookieMachineId(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
    if (match && match[1]) {
      const val = decodeURIComponent(match[1]).trim().toUpperCase();
      if (val.startsWith("PRX-")) return val;
    }
  } catch {}
  return null;
}

function writeCookieMachineId(id: string): void {
  if (typeof document === "undefined" || !id || !id.startsWith("PRX-")) return;
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(id)}; path=/; max-age=315360000; SameSite=Lax`;
  } catch {}
}

/**
 * Synchronously extracts the native hardware ID if injected by Electron preload or Android MainActivity
 */
function getSynchronousNativeHardwareId(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as any;

  // 1. Electron Desktop synchronous preload argument
  if (w.penrxDesktop?.hardwareMachineId && String(w.penrxDesktop.hardwareMachineId).startsWith("PRX-")) {
    return String(w.penrxDesktop.hardwareMachineId).trim().toUpperCase();
  }

  // 2. Android APK synchronous JavascriptInterface (MainActivity.java)
  try {
    if (w.PenRxNative && typeof w.PenRxNative.getHardwareDeviceId === "function") {
      const nativeId = w.PenRxNative.getHardwareDeviceId();
      if (nativeId && String(nativeId).startsWith("PRX-")) {
        return String(nativeId).trim().toUpperCase();
      }
    }
  } catch {}

  // 3. Android APK User-Agent embedded hardware ID (PenRxHwId/PRX-ANDR-XXXX-XXXX)
  try {
    const ua = navigator.userAgent || "";
    const uaMatch = ua.match(/PenRxHwId\/(PRX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/i);
    if (uaMatch && uaMatch[1]) {
      return uaMatch[1].trim().toUpperCase();
    }
  } catch {}

  return null;
}

/**
 * Computes a 100% deterministic browser/device fingerprint without Math.random()
 * so clearing storage or reinstalling a WebApp on the same device produces the exact same ID.
 */
function computeDeterministicFallbackId(): string {
  const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`;
  const navInfo = `${navigator.userAgent}-${navigator.language}-${navigator.hardwareConcurrency || 4}-${(navigator as any).deviceMemory || 4}-${navigator.maxTouchPoints || 0}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
  const platformStr = `${navigator.platform || ""}`;

  let hash1 = 2166136261;
  const str1 = `${screenInfo}#${navInfo}#${timezone}`;
  for (let i = 0; i < str1.length; i++) {
    hash1 ^= str1.charCodeAt(i);
    hash1 += (hash1 << 1) + (hash1 << 4) + (hash1 << 7) + (hash1 << 8) + (hash1 << 24);
  }

  let hash2 = 2166136261;
  const str2 = `SALT2#${platformStr}#${timezone}#${screenInfo}#${navInfo.split("").reverse().join("")}`;
  for (let i = 0; i < str2.length; i++) {
    hash2 ^= str2.charCodeAt(i);
    hash2 += (hash2 << 1) + (hash2 << 4) + (hash2 << 7) + (hash2 << 8) + (hash2 << 24);
  }

  const hex1 = Math.abs(hash1 | 0).toString(16).toUpperCase().padStart(8, "0");
  const hex2 = Math.abs(hash2 | 0).toString(16).toUpperCase().padStart(4, "0");
  return `PRX-${hex1.substring(0, 4)}-${hex1.substring(4, 8)}-${hex2.substring(0, 4)}`;
}

/**
 * Returns all known Machine IDs associated with this device installation
 * (primary hardware ID, initial pre-hydration browser ID, and legacy mobile ID).
 */
export function getKnownDeviceMachineIds(currentId?: string): string[] {
  const ids = new Set<string>();
  const add = (val?: string | null) => {
    const clean = (val || "").trim().toUpperCase();
    if (clean && clean.startsWith("PRX-") && clean !== "PRX-INIT-0000" && clean !== "PENRX-SERVER-INSTANCE") {
      ids.add(clean);
    }
  };

  add(currentId);
  add(getSynchronousNativeHardwareId());
  add(readCookieMachineId());
  if (typeof window !== "undefined") {
    try {
      add(localStorage.getItem(PRIMARY_STORAGE_KEY));
      add(localStorage.getItem(INITIAL_STORAGE_KEY));
      add(localStorage.getItem(LEGACY_MOBILE_KEY));
    } catch {}
  }
  return Array.from(ids);
}

/**
 * Generates or retrieves a stable, unique machine ID for the current installation.
 */
export async function getOrCreateMachineIdAsync(): Promise<string> {
  if (typeof window === "undefined") {
    return "PENRX-SERVER-INSTANCE";
  }

  const existing =
    localStorage.getItem(PRIMARY_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_MOBILE_KEY) ||
    readCookieMachineId();

  // 1. Check synchronous native hardware ID first (Electron preload or Android MainActivity)
  const syncNativeId = getSynchronousNativeHardwareId();
  if (syncNativeId) {
    if (existing && existing.startsWith("PRX-") && existing !== syncNativeId) {
      localStorage.setItem(INITIAL_STORAGE_KEY, existing);
    }
    localStorage.setItem(PRIMARY_STORAGE_KEY, syncNativeId);
    localStorage.setItem(LEGACY_MOBILE_KEY, syncNativeId);
    writeCookieMachineId(syncNativeId);
    return syncNativeId;
  }

  // 2. ELECTRON DESKTOP: Request real hardware ID from main process via IPC
  const w = window as any;
  if (w.penrxDesktop?.isElectron && typeof w.penrxDesktop.getHardwareMachineId === "function") {
    try {
      const hwId: string = await w.penrxDesktop.getHardwareMachineId();
      if (hwId && hwId.startsWith("PRX-")) {
        if (existing && existing.startsWith("PRX-") && existing !== hwId) {
          localStorage.setItem(INITIAL_STORAGE_KEY, existing);
        }
        localStorage.setItem(PRIMARY_STORAGE_KEY, hwId);
        localStorage.setItem(LEGACY_MOBILE_KEY, hwId);
        writeCookieMachineId(hwId);
        return hwId;
      }
    } catch (err) {
      console.warn("[DeviceSecurity] Electron hardware ID fetch failed, using fallback:", err);
    }
  }

  // 3. CAPACITOR MOBILE (Android APK): Request native device hardware ID (SSAID)
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
          hash = hash | 0;
        }
        const hex = Math.abs(hash | 0).toString(16).toUpperCase().padStart(8, "0");
        const suffix = idInfo.identifier.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "A");
        const androidId = `PRX-ANDR-${hex.substring(0, 4)}-${suffix}`;
        if (existing && existing.startsWith("PRX-") && existing !== androidId) {
          localStorage.setItem(INITIAL_STORAGE_KEY, existing);
        }
        localStorage.setItem(PRIMARY_STORAGE_KEY, androidId);
        localStorage.setItem(LEGACY_MOBILE_KEY, androidId);
        writeCookieMachineId(androidId);
        return androidId;
      }
    }
  } catch {}

  if (existing && existing.startsWith("PRX-")) {
    localStorage.setItem(PRIMARY_STORAGE_KEY, existing);
    localStorage.setItem(LEGACY_MOBILE_KEY, existing);
    writeCookieMachineId(existing);
    return existing;
  }

  const machineId = computeDeterministicFallbackId();
  localStorage.setItem(PRIMARY_STORAGE_KEY, machineId);
  localStorage.setItem(LEGACY_MOBILE_KEY, machineId);
  writeCookieMachineId(machineId);
  return machineId;
}

/**
 * Synchronous version: returns native hardware ID or cached ID immediately.
 */
export function getOrCreateMachineId(): string {
  if (typeof window === "undefined") {
    return "PENRX-SERVER-INSTANCE";
  }

  const existing =
    localStorage.getItem(PRIMARY_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_MOBILE_KEY) ||
    readCookieMachineId();

  // Always prefer synchronous native hardware ID (Electron preload or Android MainActivity)
  const syncNativeId = getSynchronousNativeHardwareId();
  if (syncNativeId) {
    if (existing && existing.startsWith("PRX-") && existing !== syncNativeId) {
      try {
        localStorage.setItem(INITIAL_STORAGE_KEY, existing);
      } catch {}
    }
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, syncNativeId);
      localStorage.setItem(LEGACY_MOBILE_KEY, syncNativeId);
      writeCookieMachineId(syncNativeId);
    } catch {}
    return syncNativeId;
  }

  if (existing && existing.startsWith("PRX-")) {
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, existing);
      localStorage.setItem(LEGACY_MOBILE_KEY, existing);
      writeCookieMachineId(existing);
    } catch {}
    return existing;
  }

  const machineId = computeDeterministicFallbackId();
  try {
    localStorage.setItem(PRIMARY_STORAGE_KEY, machineId);
    localStorage.setItem(INITIAL_STORAGE_KEY, machineId);
    localStorage.setItem(LEGACY_MOBILE_KEY, machineId);
    writeCookieMachineId(machineId);
  } catch {}
  return machineId;
}

/**
 * Initializes the hardware machine ID in Electron or Capacitor mode and updates the store.
 */
export async function initializeHardwareMachineId(
  onUpdate: (newId: string) => void
): Promise<void> {
  if (typeof window === "undefined") return;

  // 0. Check synchronous native hardware ID first
  const syncNativeId = getSynchronousNativeHardwareId();
  if (syncNativeId) {
    const stored = localStorage.getItem(PRIMARY_STORAGE_KEY);
    if (stored && stored.startsWith("PRX-") && stored !== syncNativeId) {
      localStorage.setItem(INITIAL_STORAGE_KEY, stored);
    }
    localStorage.setItem(PRIMARY_STORAGE_KEY, syncNativeId);
    localStorage.setItem(LEGACY_MOBILE_KEY, syncNativeId);
    writeCookieMachineId(syncNativeId);
    onUpdate(syncNativeId);
    return;
  }

  const w = window as any;

  // 1. Electron Desktop Native Hardware ID
  if (w.penrxDesktop?.isElectron && typeof w.penrxDesktop.getHardwareMachineId === "function") {
    try {
      const hwId: string = await w.penrxDesktop.getHardwareMachineId();
      if (hwId && hwId.startsWith("PRX-")) {
        const stored = localStorage.getItem(PRIMARY_STORAGE_KEY);
        if (stored && stored.startsWith("PRX-") && stored !== hwId) {
          localStorage.setItem(INITIAL_STORAGE_KEY, stored);
        }
        localStorage.setItem(PRIMARY_STORAGE_KEY, hwId);
        localStorage.setItem(LEGACY_MOBILE_KEY, hwId);
        writeCookieMachineId(hwId);
        onUpdate(hwId);
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
          hash = hash | 0;
        }
        const hex = Math.abs(hash | 0).toString(16).toUpperCase().padStart(8, "0");
        const suffix = idInfo.identifier.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "A");
        const androidId = `PRX-ANDR-${hex.substring(0, 4)}-${suffix}`;
        const stored = localStorage.getItem(PRIMARY_STORAGE_KEY);
        if (stored && stored.startsWith("PRX-") && stored !== androidId) {
          localStorage.setItem(INITIAL_STORAGE_KEY, stored);
        }
        localStorage.setItem(PRIMARY_STORAGE_KEY, androidId);
        localStorage.setItem(LEGACY_MOBILE_KEY, androidId);
        writeCookieMachineId(androidId);
        onUpdate(androidId);
        return;
      }
    }
  } catch {}

  const fallbackStored =
    localStorage.getItem(PRIMARY_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_MOBILE_KEY) ||
    readCookieMachineId();
  if (fallbackStored && fallbackStored.startsWith("PRX-")) {
    onUpdate(fallbackStored);
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

  if (w.penrxDesktop?.isElectron || ua.includes("Electron")) {
    return false;
  }

  if (/Windows NT|Macintosh|Linux x86_64/i.test(ua) && !/Android/i.test(ua)) {
    return false;
  }

  if (w.Capacitor?.isNativePlatform?.() || w.Capacitor?.getPlatform?.() === "android") {
    return true;
  }

  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  if (mobileRegex.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Detect if strictly running inside the Native Android APK (Capacitor Native Android)
 */
export function isNativeAndroidApk(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  const ua = navigator.userAgent || "";

  if (w.penrxDesktop?.isElectron || ua.includes("Electron")) {
    return false;
  }

  if (/Windows NT|Macintosh|Linux x86_64/i.test(ua) && !/Android/i.test(ua)) {
    return false;
  }

  if (w.PenRxNative || ua.includes("PenRxHwId/")) {
    return true;
  }

  if (w.Capacitor && typeof w.Capacitor.isNativePlatform === "function") {
    return w.Capacitor.isNativePlatform();
  }

  return false;
}

export function isBiometricLockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("penrx_biometric_enabled") === "true";
}

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
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
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

      const biometryStrength = AndroidBiometryStrength?.strong ?? 1;

      const authAction = async (): Promise<BiometricAuthResult> => {
        try {
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
          const code = firstErr?.code || "";
          if (code === "userCancel" || code === "appCancel" || code === "biometryLockout") {
            throw firstErr;
          }

          await BiometricAuth.authenticate({
            reason,
            cancelTitle: "إلغاء",
            allowDeviceCredential: false,
            androidTitle: "التحقق من الهوية - PenRX+",
            androidSubtitle: "المس مستشعر البصمة للفتح",
            androidBiometryStrength: biometryStrength,
          });
          return { success: true };
        }
      };

      const timeoutPromise = new Promise<BiometricAuthResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error("انتهت مهلة انتظار مستشعر البصمة"));
        }, 20000);
      });

      return await Promise.race([authAction(), timeoutPromise]);
    }
  } catch (err: any) {
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

export function recordServerTime(serverTimestampMs: number): void {
  if (typeof window === "undefined" || !serverTimestampMs || isNaN(serverTimestampMs)) return;
  try {
    const currentRecorded = getRecordedServerTime();
    if (serverTimestampMs > currentRecorded) {
      localStorage.setItem(LAST_SERVER_TIME_KEY, String(serverTimestampMs));
    }
  } catch {}
}

export function getRecordedServerTime(): number {
  if (typeof window === "undefined") return 0;
  try {
    const val = localStorage.getItem(LAST_SERVER_TIME_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function detectClockTampering(knownServerTime?: number): { tampered: boolean; reason?: string } {
  if (typeof window === "undefined") return { tampered: false };
  const now = Date.now();
  const recorded = Math.max(getRecordedServerTime(), knownServerTime || 0);

  if (recorded > 0 && now < (recorded - 30 * 60 * 1000)) {
    return {
      tampered: true,
      reason: "تم رصد تقديم أو إرجاع في ساعة الجهاز. يرجى ضبط توقيت الهاتف/الكمبيوتر على الوضع التلقائي للمتابعة.",
    };
  }
  return { tampered: false };
}
