/**
 * PenRX+ Hardware Fingerprinting & Biometric Security Engine
 *
 * Priority chain for machine ID generation:
 *   1. Electron Desktop: Real hardware ID via synchronous preload arg or IPC (Motherboard Serial → Windows GUID → MAC → Hostname)
 *   2. Capacitor Mobile: Native Android hardware ID (SSAID) via synchronous MainActivity bridge / User-Agent or Capacitor Device plugin
 *   3. Web Browser:      Deterministic FNV-1a hash of hardware + screen + timezone attributes (immune to browser version updates or orientation changes)
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
export const BIOMETRIC_UNLOCKED_SESSION_KEY = "penrx_biometric_unlocked_session";

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
 * Formats an Android raw SSAID / hardware identifier into the canonical PRX-ANDR-XXXX-XXXX format.
 */
export function formatAndroidHardwareId(rawIdentifier: string): string {
  const normalized = String(rawIdentifier || "").trim();
  let hash = 2166136261;
  const str = `ANDROID-HW-${normalized}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash = hash | 0;
  }
  const hex = Math.abs(hash | 0).toString(16).toUpperCase().padStart(8, "0");
  const suffix = normalized.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "A");
  return `PRX-ANDR-${hex.substring(0, 4)}-${suffix}`;
}

/**
 * Synchronously extracts the native hardware ID if injected by Electron preload or Android MainActivity
 */
export function getSynchronousNativeHardwareId(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as any;

  // 1. Electron Desktop synchronous preload argument
  if (w.penrxDesktop?.hardwareMachineId && String(w.penrxDesktop.hardwareMachineId).startsWith("PRX-")) {
    return String(w.penrxDesktop.hardwareMachineId).trim().toUpperCase();
  }

  // 2. Android APK injected global variable from MainActivity
  if (w.__PENRX_NATIVE_HW_ID__ && String(w.__PENRX_NATIVE_HW_ID__).startsWith("PRX-")) {
    return String(w.__PENRX_NATIVE_HW_ID__).trim().toUpperCase();
  }

  // 3. Android APK synchronous JavascriptInterface (MainActivity.java)
  try {
    if (w.PenRxNative && typeof w.PenRxNative.getHardwareDeviceId === "function") {
      const nativeId = w.PenRxNative.getHardwareDeviceId();
      if (nativeId && String(nativeId).startsWith("PRX-")) {
        return String(nativeId).trim().toUpperCase();
      }
    }
  } catch {}

  // 4. Android APK User-Agent embedded hardware ID (PenRxHwId/PRX-ANDR-XXXX-XXXX)
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
 * Extracts a version-invariant hardware/model signature from User-Agent so WebView/Chrome
 * auto-updates or custom PenRxHwId suffixes never alter the deterministic device hash.
 */
function normalizeHardwareUserAgent(rawUa: string): string {
  return String(rawUa || "")
    .replace(/\s*PenRxHwId\/PRX-[A-Z0-9-]+/gi, "")
    .replace(/Chrome\/[\d.]+/gi, "Chrome")
    .replace(/Version\/[\d.]+/gi, "Version")
    .replace(/AppleWebKit\/[\d.]+/gi, "AppleWebKit")
    .replace(/Safari\/[\d.]+/gi, "Safari")
    .replace(/Edg[A-Za-z]*\/[\d.]+/gi, "Edge")
    .trim();
}

/**
 * Computes the legacy fallback ID (exact formula used in earlier versions) so devices that
 * registered a subscription before the native hardware ID bridge was synchronous are still
 * recognized automatically upon reinstall or upgrade.
 */
function computeLegacyFallbackIds(): string[] {
  if (typeof window === "undefined") return [];
  const results = new Set<string>();
  const rawUa = navigator.userAgent || "";
  const strippedUa = rawUa.replace(/\s*PenRxHwId\/PRX-[A-Z0-9-]+/gi, "");

  for (const uaCandidate of [strippedUa, rawUa]) {
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`;
    const navInfo = `${uaCandidate}-${navigator.language}-${navigator.hardwareConcurrency || 4}-${(navigator as any).deviceMemory || 4}-${navigator.maxTouchPoints || 0}`;
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
    results.add(`PRX-${hex1.substring(0, 4)}-${hex1.substring(4, 8)}-${hex2.substring(0, 4)}`);
  }

  return Array.from(results);
}

/**
 * Computes a 100% deterministic, orientation-invariant and browser-update-invariant
 * device fingerprint without Math.random() so clearing storage or reinstalling on the
 * same device always produces the exact same ID.
 */
function computeDeterministicFallbackId(): string {
  const minDim = Math.min(window.screen.width || 0, window.screen.height || 0);
  const maxDim = Math.max(window.screen.width || 0, window.screen.height || 0);
  const screenInfo = `${minDim}x${maxDim}x${window.screen.colorDepth}x${window.devicePixelRatio || 1}`;
  const cleanUa = normalizeHardwareUserAgent(navigator.userAgent || "");
  const navInfo = `${cleanUa}-${navigator.hardwareConcurrency || 4}-${(navigator as any).deviceMemory || 4}-${navigator.maxTouchPoints || 0}`;
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
 * Returns all known Machine IDs associated with this physical device installation
 * (primary native hardware ID, stored IDs, deterministic hardware spec ID, and legacy UA IDs).
 * This guarantees that even after a complete app uninstall & reinstall or version upgrade,
 * any subscription previously activated on this device is recognized immediately.
 */
export function getKnownDeviceMachineIds(currentId?: string): string[] {
  const ids = new Set<string>();
  const add = (val?: string | null) => {
    const clean = (val || "").trim().toUpperCase();
    if (clean && clean.startsWith("PRX-") && clean !== "PRX-INIT-0000" && clean !== "PENRX-SERVER-INSTANCE") {
      ids.add(clean);
    }
  };

  add(getSynchronousNativeHardwareId());
  add(currentId);
  add(readCookieMachineId());
  if (typeof window !== "undefined") {
    try {
      add(localStorage.getItem(PRIMARY_STORAGE_KEY));
      add(localStorage.getItem(INITIAL_STORAGE_KEY));
      add(localStorage.getItem(LEGACY_MOBILE_KEY));
    } catch {}
    try {
      add(computeDeterministicFallbackId());
      for (const legId of computeLegacyFallbackIds()) {
        add(legId);
      }
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
        const androidId = formatAndroidHardwareId(idInfo.identifier);
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

  const applyResolvedId = (resolvedId: string) => {
    const stored = localStorage.getItem(PRIMARY_STORAGE_KEY);
    if (stored && stored.startsWith("PRX-") && stored !== resolvedId) {
      try {
        localStorage.setItem(INITIAL_STORAGE_KEY, stored);
      } catch {}
    }
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, resolvedId);
      localStorage.setItem(LEGACY_MOBILE_KEY, resolvedId);
      writeCookieMachineId(resolvedId);
    } catch {}
    onUpdate(resolvedId);
  };

  // 0. Check synchronous native hardware ID first
  const syncNativeId = getSynchronousNativeHardwareId();
  if (syncNativeId) {
    applyResolvedId(syncNativeId);
    return;
  }

  const w = window as any;

  // 1. Electron Desktop Native Hardware ID
  if (w.penrxDesktop?.isElectron && typeof w.penrxDesktop.getHardwareMachineId === "function") {
    try {
      const hwId: string = await w.penrxDesktop.getHardwareMachineId();
      if (hwId && hwId.startsWith("PRX-")) {
        applyResolvedId(hwId);
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
        const androidId = formatAndroidHardwareId(idInfo.identifier);
        applyResolvedId(androidId);
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

/**
 * Checks whether the current app session has already been unlocked via biometrics.
 * Survives WebView page refreshes (sessionStorage + MainActivity session state),
 * and resets automatically when the app is closed and reopened.
 */
export function isBiometricUnlockedForSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as any;
    if (w.PenRxNative && typeof w.PenRxNative.isSessionUnlocked === "function") {
      if (w.PenRxNative.isSessionUnlocked()) {
        return true;
      }
    }
    return sessionStorage.getItem(BIOMETRIC_UNLOCKED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function markBiometricUnlockedForSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BIOMETRIC_UNLOCKED_SESSION_KEY, "true");
    const w = window as any;
    if (w.PenRxNative && typeof w.PenRxNative.setSessionUnlocked === "function") {
      w.PenRxNative.setSessionUnlocked(true);
    }
  } catch {}
}

export function isBiometricLockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("penrx_biometric_enabled");
    if (stored === "true") return true;
    if (stored === "false") return false;
    const w = window as any;
    if (w.PenRxNative && typeof w.PenRxNative.isBiometricEnabled === "function") {
      const nativeEnabled = Boolean(w.PenRxNative.isBiometricEnabled());
      if (nativeEnabled) {
        localStorage.setItem("penrx_biometric_enabled", "true");
        return true;
      }
    }
  } catch {}
  return false;
}

export function setBiometricLockEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("penrx_biometric_enabled", enabled ? "true" : "false");
    const w = window as any;
    if (w.PenRxNative && typeof w.PenRxNative.setBiometricEnabled === "function") {
      w.PenRxNative.setBiometricEnabled(enabled);
    }
    if (enabled) {
      // Mark current session as unlocked so enabling in Settings doesn't immediately lock the current screen
      markBiometricUnlockedForSession();
    }
  } catch {}
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

  if (_cachedBiometricAvailable === true) {
    return true;
  }

  // Native Android bridge synchronous hardware check
  try {
    if (w.PenRxNative && typeof w.PenRxNative.hasBiometricHardware === "function") {
      if (w.PenRxNative.hasBiometricHardware()) {
        _cachedBiometricAvailable = true;
        return true;
      }
    }
  } catch {}

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
            setTimeout(() => resolve(null), 2500)
          );
          const check = await Promise.race([checkPromise, timeoutPromise]);
          const result = Boolean(
            check &&
              (check.isAvailable ||
                check.strongBiometryIsAvailable ||
                check.weakBiometryIsAvailable ||
                check.deviceIsSecure ||
                (Array.isArray(check.biometryTypes) && check.biometryTypes.length > 0))
          );
          if (result) {
            _cachedBiometricAvailable = true;
            return true;
          }
          // On native Android APK, allow biometric prompt attempt even if checkBiometry reports weak/custom OEM sensor
          return true;
        }
      } catch (err) {
        console.warn("[Biometrics] Native checkBiometry notice:", err);
      }

      if (!isMobileDevice() || !window.PublicKeyCredential) {
        return isNativeAndroidApk();
      }

      try {
        const webauthnPromise = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
        const webauthnTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
        const result = await Promise.race([webauthnPromise, webauthnTimeout]);
        if (result) _cachedBiometricAvailable = true;
        return Boolean(result) || isNativeAndroidApk();
      } catch {
        return isNativeAndroidApk();
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
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const rpConfig: PublicKeyCredentialRpEntity = {
      name: "PenRX+",
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
      setBiometricLockEnabled(true);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("[Biometrics] Registration error:", err?.message || err);
    return false;
  }
}

export async function authenticateWithBiometrics(
  reason = "المس البصمة للدخول"
): Promise<BiometricAuthResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "البيئة الحالية غير مدعومة" };
  }

  const w = window as any;
  if (w.penrxDesktop?.isElectron) {
    return { success: false, error: "البصمة غير مدعومة على أجهزة الكمبيوتر" };
  }

  // 1. Native Android Capacitor BiometricPrompt (supports both Class 2 WEAK and Class 3 STRONG sensors + Device Credential across all Android OEMs)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor && typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform()) {
      const { BiometricAuth, AndroidBiometryStrength } = await import("@aparajita/capacitor-biometric-auth");

      const weakStrength = AndroidBiometryStrength?.weak ?? 0;
      const strongStrength = AndroidBiometryStrength?.strong ?? 1;

      const authAction = async (): Promise<BiometricAuthResult> => {
        try {
          // Tier 1: Weak + Strong Biometry with Device Credential fallback (widest compatibility across Samsung, Xiaomi, Oppo, Vivo, Realme, Huawei, Infinix)
          await BiometricAuth.authenticate({
            reason,
            cancelTitle: "إلغاء",
            allowDeviceCredential: true,
            androidTitle: "PenRX+",
            androidSubtitle: "المس مستشعر البصمة للدخول",
            androidConfirmationRequired: false,
            androidBiometryStrength: weakStrength,
          });
          return { success: true };
        } catch (firstErr: any) {
          const code = String(firstErr?.code || "");
          if (code === "userCancel" || code === "appCancel" || code === "biometryLockout") {
            throw firstErr;
          }

          try {
            // Tier 2: Weak + Strong Biometry without Device Credential (for Android 9/10 ROMs that disallow negative button + device credential together)
            await BiometricAuth.authenticate({
              reason,
              cancelTitle: "إلغاء",
              allowDeviceCredential: false,
              androidTitle: "PenRX+",
              androidSubtitle: "المس مستشعر البصمة للدخول",
              androidConfirmationRequired: false,
              androidBiometryStrength: weakStrength,
            });
            return { success: true };
          } catch (secondErr: any) {
            const code2 = String(secondErr?.code || "");
            if (code2 === "userCancel" || code2 === "appCancel" || code2 === "biometryLockout") {
              throw secondErr;
            }

            // Tier 3: Strong Biometry only
            await BiometricAuth.authenticate({
              reason,
              cancelTitle: "إلغاء",
              allowDeviceCredential: false,
              androidTitle: "PenRX+",
              androidSubtitle: "المس مستشعر البصمة للدخول",
              androidConfirmationRequired: false,
              androidBiometryStrength: strongStrength,
            });
            return { success: true };
          }
        }
      };

      const timeoutPromise = new Promise<BiometricAuthResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error("انتهت مهلة قراءة البصمة"));
        }, 30000);
      });

      return await Promise.race([authAction(), timeoutPromise]);
    }
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "userCancel" || code === "appCancel") {
      return { success: false, error: "تم إلغاء عملية البصمة" };
    }
    if (code === "biometryLockout") {
      return { success: false, error: "تم إيقاف البصمة مؤقتاً. استخدم رمز العيادة." };
    }
    if (code === "biometryNotEnrolled") {
      return { success: false, error: "لا توجد بصمة مسجلة في إعدادات الهاتف" };
    }
    // If not cancelled by user, fall through to WebAuthn platform authenticator if available
    if (!window.PublicKeyCredential) {
      return { success: false, error: err?.message || "تعذر التحقق من البصمة" };
    }
  }

  // 2. WebAuthn Platform Authenticator (for PWA / Mobile Browsers & WebView fallback)
  if ((isMobileDevice() || isNativeAndroidApk()) && window.PublicKeyCredential) {
    try {
      const existingCredId = localStorage.getItem("penrx_biometric_credential_id");
      if (!existingCredId) {
        const enrolled = await registerBiometricCredential();
        return { success: enrolled, error: enrolled ? undefined : "تعذر تفعيل البصمة على هذا الجهاز" };
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const getPublicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 30000,
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
    } catch {
      // If stored credential became invalid after domain/system change, try re-enrolling once
      try {
        const reEnrolled = await registerBiometricCredential();
        if (reEnrolled) return { success: true };
      } catch {}
      return { success: false, error: "لم يتم التحقق من البصمة" };
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
