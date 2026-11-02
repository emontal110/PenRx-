const { app, BrowserWindow, Menu, ipcMain, shell, nativeTheme, screen, session, clipboard, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const { execSync, fork, spawn } = require("child_process");

if (process.platform === "win32") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}

const EXTERNAL_HOST_ALLOWLIST = new Set([
  "github.com",
  "api.github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "wa.me",
  "api.whatsapp.com",
  "pen-rx.vercel.app",
]);

const EXTERNAL_SCHEME_ALLOWLIST = new Set(["whatsapp:", "mailto:"]);

function getAllowedExternalHosts() {
  const hosts = new Set(EXTERNAL_HOST_ALLOWLIST);
  for (const candidate of [process.env.PENRX_CLOUD_API_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      const raw = String(candidate || "").trim();
      if (!raw) continue;
      const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (parsed.protocol === "https:") hosts.add(parsed.hostname);
    } catch {}
  }
  return hosts;
}

function isSafeExternalUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (EXTERNAL_SCHEME_ALLOWLIST.has(parsed.protocol)) return true;
  if (parsed.protocol !== "https:") return false;
  return getAllowedExternalHosts().has(parsed.hostname.toLowerCase());
}

function isInternalAppUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
}

function openExternalSafely(rawUrl) {
  if (!isSafeExternalUrl(rawUrl)) {
    console.warn("[PenRX+ Security] Blocked external navigation to a non-allowlisted URL.");
    return false;
  }
  shell.openExternal(rawUrl).catch(() => {});
  return true;
}

function buildWindowWebPreferences(extra = {}) {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    allowRunningInsecureContent: false,
    sandbox: true,
    webviewTag: false,
    experimentalFeatures: false,
    spellcheck: false,
    ...extra,
  };
}

if (nativeTheme) {
  nativeTheme.themeSource = "dark";
}

let splashWindow = null;
let mainWindow = null;
let serverProcess = null;
let CACHED_HARDWARE_ID = null;
let activeServerUrl = null;

function killServerProcessSync() {
  if (serverProcess && serverProcess.pid) {
    const pid = serverProcess.pid;
    serverProcess = null;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${pid} /T /F`, { windowsHide: true, stdio: "ignore" });
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch {}
  }
}

// Official differential auto-updater with Private Repo Token & Fast Delta Support
let autoUpdater = null;
let cachedUpdateInfo = null;
let lastUpdateCheckAt = 0;
let isUpdateDownloading = false;
let updateDownloadedSuccessfully = false;
let downloadedInstallerPath = null;
let isQuittingForInstall = false;

try {
  const electronUpdater = require("electron-updater");
  autoUpdater = electronUpdater.autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  // Support Private GitHub Repository Token if configured in environment
  const ghToken = (process.env.GH_TOKEN || process.env.GITHUB_RELEASE_TOKEN || process.env.RELEASE_TOKEN || "").trim();
  if (ghToken) {
    autoUpdater.requestHeaders = {
      Authorization: `token ${ghToken}`,
    };
  }

  try {
    const { Provider } = require("electron-updater/out/providers/Provider");
    const { newUrlFromBase } = require("electron-updater/out/util");
    const escapeRx = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (Provider && Provider.prototype && typeof Provider.prototype.getBlockMapFiles === "function") {
      Provider.prototype.getBlockMapFiles = function (baseUrl, oldVersion, newVersion, oldBlockMapFileBaseUrl = null) {
        const newBlockMapUrl = newUrlFromBase(`${baseUrl.pathname}.blockmap`, baseUrl);

        const oldVShort = String(oldVersion || "").replace(/\.0$/, "");
        const newVShort = String(newVersion || "").replace(/\.0$/, "");

        let oldPath = baseUrl.pathname;
        if (newVersion && oldPath.includes(`/v${newVersion}/`)) {
          oldPath = oldPath.replace(`/v${newVersion}/`, `/v${oldVShort}/`);
        } else if (newVShort && oldPath.includes(`/v${newVShort}/`)) {
          oldPath = oldPath.replace(`/v${newVShort}/`, `/v${oldVShort}/`);
        } else if (newVersion && oldPath.includes(newVersion)) {
          oldPath = oldPath.replace(new RegExp(escapeRx(newVersion), "g"), oldVShort);
        } else if (newVShort && oldPath.includes(newVShort)) {
          oldPath = oldPath.replace(new RegExp(escapeRx(newVShort), "g"), oldVShort);
        }

        const oldBlockMapUrl = newUrlFromBase(
          `${oldPath}.blockmap`,
          oldBlockMapFileBaseUrl ? new URL(oldBlockMapFileBaseUrl) : baseUrl
        );
        return [oldBlockMapUrl, newBlockMapUrl];
      };
    }

    if (typeof autoUpdater.downloadBlockMap === "function") {
      const origDownloadBlockMap = autoUpdater.downloadBlockMap.bind(autoUpdater);
      autoUpdater.downloadBlockMap = async function (url) {
        try {
          return await origDownloadBlockMap(url);
        } catch (err) {
          const href = url && url.href ? url.href : String(url);
          const candidates = [];
          if (/\/releases\/download\/v(\d+\.\d+)\//.test(href)) {
            candidates.push(href.replace(/\/releases\/download\/v(\d+\.\d+)\//, "/releases/download/v$1.0/"));
          } else if (/\/releases\/download\/v(\d+\.\d+)\.0\//.test(href)) {
            candidates.push(href.replace(/\/releases\/download\/v(\d+\.\d+)\.0\//, "/releases/download/v$1/"));
          }
          for (const altHref of candidates) {
            if (altHref && altHref !== href) {
              try {
                return await origDownloadBlockMap(new URL(altHref));
              } catch {}
            }
          }
          throw err;
        }
      };
    }
  } catch (patchErr) {
    console.warn("[PenRX+ AutoUpdater] Blockmap patch warning:", patchErr.message);
  }
} catch (e) {
  console.warn("[PenRX+ AutoUpdater] electron-updater not initialized:", e.message);
}

function performQuitAndInstall(customInstallerPath = null) {
  if (isQuittingForInstall) return;
  isQuittingForInstall = true;

  console.log("[PenRX+ AutoUpdater] Executing fast update installation & automatic restart...");

  try {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
  } catch {}

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners("close");
      mainWindow.destroy();
      mainWindow = null;
    }
  } catch {}

  killServerProcessSync();

  // Prefer native electronUpdater.quitAndInstall when differential update is ready (fastest delta patch)
  if (autoUpdater && updateDownloadedSuccessfully && !customInstallerPath) {
    try {
      autoUpdater.quitAndInstall(false, true);
      setTimeout(() => {
        try { app.exit(0); } catch {}
      }, 1200);
      return;
    } catch (err) {
      console.warn("[PenRX+ AutoUpdater] Native quitAndInstall notice, falling back to PS runner:", err.message);
    }
  }

  const targetExe = customInstallerPath || downloadedInstallerPath;
  if (targetExe && fs.existsSync(targetExe) && process.platform === "win32") {
    try {
      const appExePath = process.execPath;
      const currentPid = process.pid;
      const escapedInstaller = targetExe.replace(/'/g, "''");
      const escapedAppExe = appExePath.replace(/'/g, "''");

      const psScript = [
        `try { Wait-Process -Id ${currentPid} -Timeout 8 -ErrorAction SilentlyContinue } catch {}`,
        `Start-Sleep -Milliseconds 400`,
        `$installer = Start-Process -FilePath '${escapedInstaller}' -ArgumentList '--updated' -Wait -PassThru`,
        `Start-Sleep -Milliseconds 800`,
        `if (-not (Get-Process -Name 'PenRX+' -ErrorAction SilentlyContinue)) { if (Test-Path '${escapedAppExe}') { Start-Process -FilePath '${escapedAppExe}' } }`,
      ].join("; ");

      const runner = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", psScript],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }
      );
      runner.unref();
      app.exit(0);
      return;
    } catch (spawnErr) {
      console.warn("[PenRX+ AutoUpdater] Installer runner notice:", spawnErr.message);
    }
  }

  app.exit(0);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.focus();
  }
});

const processCwd = app.isPackaged
  ? (fs.existsSync(path.join(process.resourcesPath, "app.asar.unpacked"))
      ? path.join(process.resourcesPath, "app.asar.unpacked")
      : fs.existsSync(path.join(process.resourcesPath, "app"))
      ? path.join(process.resourcesPath, "app")
      : process.resourcesPath)
  : path.resolve(__dirname, "..");

function sanitizeHardwareToken(raw) {
  if (!raw) return "";
  const clean = String(raw).replace(/SerialNumber/i, "").trim();
  const lower = clean.toLowerCase();
  const isGeneric =
    lower.includes("o.e.m") ||
    lower.includes("fill") ||
    lower.includes("none") ||
    lower.includes("default") ||
    lower.replace(/[^a-z0-9]/g, "").length < 4 ||
    /^0+$/.test(lower.replace(/[^0-9]/g, ""));
  return isGeneric ? "" : clean;
}

function getPersistentHardwareIdFilePath() {
  try {
    const appDataDir = path.join(app.getPath("appData"), "PenRXPlus");
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }
    return path.join(appDataDir, "device-hardware-id.dat");
  } catch {
    return null;
  }
}

function readPersistedHardwareId() {
  const filePath = getPersistentHardwareIdFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const val = fs.readFileSync(filePath, "utf8").trim().toUpperCase();
      if (/^PRX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(val)) {
        return val;
      }
    } catch {}
  }

  if (process.platform === "win32") {
    try {
      const regOut = execSync("reg query HKCU\\Software\\PenRXPlus /v MachineId", {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1500,
      }).toString();
      const match = regOut.match(/MachineId\s+REG_SZ\s+(\S+)/i);
      if (match && match[1]) {
        const val = match[1].trim().toUpperCase();
        if (/^PRX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(val)) {
          return val;
        }
      }
    } catch {}
  }

  return null;
}

function savePersistedHardwareId(hwId) {
  if (!hwId || !hwId.startsWith("PRX-")) return;
  const filePath = getPersistentHardwareIdFilePath();
  if (filePath) {
    try {
      fs.writeFileSync(filePath, hwId, "utf8");
    } catch {}
  }
  if (process.platform === "win32") {
    try {
      execSync(`reg add HKCU\\Software\\PenRXPlus /v MachineId /t REG_SZ /d "${hwId}" /f`, {
        windowsHide: true,
        stdio: "ignore",
        timeout: 1500,
      });
    } catch {}
  }
}

function getHardwareMachineIdSync() {
  if (CACHED_HARDWARE_ID) return CACHED_HARDWARE_ID;

  const persisted = readPersistedHardwareId();
  if (persisted) {
    CACHED_HARDWARE_ID = persisted;
    savePersistedHardwareId(persisted);
    return CACHED_HARDWARE_ID;
  }

  let idSource = "";

  if (process.platform === "win32") {
    try {
      const out = execSync("wmic baseboard get serialnumber", {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000,
      }).toString();
      idSource = sanitizeHardwareToken(out);
    } catch {}

    if (!idSource) {
      try {
        const out2 = execSync(
          'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"',
          {
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 3000,
          }
        ).toString();
        idSource = sanitizeHardwareToken(out2);
      } catch {}
    }

    if (!idSource) {
      try {
        const guidOut = execSync(
          "reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid /reg:64",
          {
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
          }
        ).toString();
        const match = guidOut.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
        if (match && match[1]) {
          idSource = match[1].trim();
        }
      } catch {}
    }
  }

  if (!idSource) {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
          idSource = net.mac;
          break;
        }
      }
      if (idSource) break;
    }
  }

  if (!idSource) {
    idSource = os.hostname();
  }

  const hash = crypto
    .createHash("sha256")
    .update(idSource)
    .digest("hex")
    .substring(0, 12)
    .toUpperCase();

  CACHED_HARDWARE_ID = `PRX-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  savePersistedHardwareId(CACHED_HARDWARE_ID);
  return CACHED_HARDWARE_ID;
}

try {
  getHardwareMachineIdSync();
} catch {}

ipcMain.handle("get-hardware-machine-id", async () => {
  return getHardwareMachineIdSync();
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("open-external", async (_event, url) => {
  return openExternalSafely(url);
});

/**
 * Normalize Egyptian & International WhatsApp Phone Number (e.g., 01012345678 -> 201012345678)
 */
function normalizeEgyptWhatsAppDigits(rawPhone) {
  let digits = String(rawPhone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("01") && digits.length === 11) {
    return "2" + digits;
  }
  if (digits.startsWith("1") && digits.length === 10) {
    return "20" + digits;
  }
  return digits;
}

// IPC handler: Native Desktop WhatsApp Direct File Share (Image PNG or PDF)
// Opens the patient's conversation in the native WhatsApp Desktop App (NOT web),
// verifies WhatsApp window focus, attaches the Image/PDF from clipboard, and presses Enter to send automatically!
ipcMain.handle("share-whatsapp-desktop", async (_event, payload) => {
  try {
    const { base64Data, fileName, mimeType, cleanPhone } = payload || {};
    if (!base64Data || !cleanPhone) {
      return { success: false, error: "Missing file data or phone number" };
    }

    const digitsOnly = normalizeEgyptWhatsAppDigits(cleanPhone);
    if (!/^\d{8,20}$/.test(digitsOnly)) {
      return { success: false, error: "Invalid phone number" };
    }

    const rawB64 = String(base64Data).includes(",")
      ? String(base64Data).split(",")[1]
      : String(base64Data);
    if (rawB64.length > 40 * 1024 * 1024) {
      return { success: false, error: "Payload too large" };
    }
    const buffer = Buffer.from(rawB64, "base64");

    const fallbackName = mimeType === "application/pdf" ? "Prescription.pdf" : "Prescription.png";
    const safeName = String(fileName || fallbackName)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 80) || fallbackName;

    const tempDir = path.join(app.getPath("temp"), "PenRX_WhatsApp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.resolve(tempDir, safeName);
    if (path.dirname(filePath) !== tempDir) {
      return { success: false, error: "Invalid file name" };
    }
    fs.writeFileSync(filePath, buffer);

    const isPdf = mimeType === "application/pdf" || safeName.endsWith(".pdf");

    if (!isPdf) {
      // Put both nativeImage AND file drop list if possible so WhatsApp Desktop accepts Ctrl+V in all builds
      const img = nativeImage.createFromBuffer(buffer);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
      }
    } else if (process.platform === "win32") {
      const escapedPath = filePath.replace(/'/g, "''");
      try {
        execSync(
          `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetFileDropList([System.Collections.Specialized.StringCollection]@('${escapedPath}'))"`,
          { windowsHide: true, stdio: "ignore", timeout: 4000 }
        );
      } catch {
        try {
          execSync(
            `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Set-Clipboard -Path '${escapedPath}'"`,
            { windowsHide: true, stdio: "ignore", timeout: 3500 }
          );
        } catch {}
      }
    }

    // Launch native WhatsApp Desktop directly to the patient's phone number via whatsapp:// protocol
    const whatsappNativeUrl = `whatsapp://send?phone=${digitsOnly}&text=`;
    let openedNative = false;

    if (process.platform === "win32") {
      try {
        await shell.openExternal(whatsappNativeUrl);
        openedNative = true;
      } catch {
        try {
          execSync(
            `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Start-Process '${whatsappNativeUrl}'"`,
            { windowsHide: true, stdio: "ignore", timeout: 4000 }
          );
          openedNative = true;
        } catch {}
      }
    } else {
      openedNative = openExternalSafely(whatsappNativeUrl);
    }

    // Smart Focus-Aware Auto-Paste & Auto-Send in Native WhatsApp Desktop App
    if (process.platform === "win32") {
      const autoPasteAndSendScript = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$wshell = New-Object -ComObject WScript.Shell",
        // Poll up to 5 seconds until WhatsApp window exists and bring it to foreground
        "$focused = $false",
        "for ($i = 0; $i -lt 12; $i++) {",
        "  Start-Sleep -Milliseconds 400",
        "  if ($wshell.AppActivate('WhatsApp') -or $wshell.AppActivate('واتساب')) {",
        "    $focused = $true",
        "    break",
        "  }",
        "}",
        // Wait for WhatsApp chat conversation view for the target phone number to finish mounting
        "Start-Sleep -Milliseconds 1800",
        "$null = $wshell.AppActivate('WhatsApp')",
        "Start-Sleep -Milliseconds 250",
        // Paste the Prescription Image or PDF into the patient's chat
        "[System.Windows.Forms.SendKeys]::SendWait('^v')",
        // Wait for WhatsApp Desktop's attachment preview overlay to open and focus its Send button
        "Start-Sleep -Milliseconds 1900",
        "$null = $wshell.AppActivate('WhatsApp')",
        "Start-Sleep -Milliseconds 200",
        // Send the attached prescription automatically
        "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
      ].join("; ");

      try {
        const pasteRunner = spawn(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", autoPasteAndSendScript],
          { detached: true, stdio: "ignore", windowsHide: true }
        );
        pasteRunner.unref();
      } catch (sendErr) {
        console.warn("[PenRX+ WhatsApp] Auto-paste script warning:", sendErr.message);
      }
    }

    return { success: true, filePath, copiedToClipboard: true, openedNative };
  } catch (err) {
    console.error("[PenRX+ WhatsApp Desktop Share Error]:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("toggle-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isFull = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFull);
    return !isFull;
  }
  return false;
});

ipcMain.handle("is-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle("maximize-window", (_event, force) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (force === true) {
      if (!mainWindow.isMaximized()) mainWindow.maximize();
      return true;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  }
  return false;
});

ipcMain.handle("ensure-maximized", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
    return true;
  }
  return false;
});

if (autoUpdater) {
  autoUpdater.on("update-available", (info) => {
    cachedUpdateInfo = info || null;
    lastUpdateCheckAt = Date.now();
    const version = info ? info.version : "";
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update_available", {
        version,
        releaseNotes: info?.releaseNotes || "",
        releaseDate: info?.releaseDate || "",
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    lastUpdateCheckAt = Date.now();
  });

  autoUpdater.on("download-progress", (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const pct = Math.min(99, Math.max(1, Math.round(progressObj.percent || 0)));
      mainWindow.webContents.send("download_progress", pct);
      mainWindow.webContents.send("update-download-progress", {
        progress: pct,
        percent: pct,
        downloadedMB: ((progressObj.transferred || 0) / 1024 / 1024).toFixed(1),
        totalMB: ((progressObj.total || 0) / 1024 / 1024).toFixed(1),
        status: "downloading",
      });
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    isUpdateDownloading = false;
    updateDownloadedSuccessfully = true;
    if (info && info.downloadedFile) {
      downloadedInstallerPath = info.downloadedFile;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update_downloaded");
      mainWindow.webContents.send("update-download-progress", {
        progress: 100,
        percent: 100,
        completed: true,
        status: "completed",
        installing: true,
        message: "جارٍ تثبيت التحديث الآن...",
      });
    }
    setTimeout(() => {
      if (!isQuittingForInstall) {
        performQuitAndInstall();
      }
    }, 1000);
  });

  autoUpdater.on("error", (err) => {
    console.warn("[PenRX+ AutoUpdater] Notice/Error event:", err?.message || err);
    isUpdateDownloading = false;
  });
}

ipcMain.handle("check-differential-update", async () => {
  if (autoUpdater && app.isPackaged) {
    try {
      const res = await autoUpdater.checkForUpdates();
      if (res?.updateInfo) {
        cachedUpdateInfo = res.updateInfo;
        lastUpdateCheckAt = Date.now();
      }
      return { success: true, updateInfo: res?.updateInfo };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "AutoUpdater not available" };
});

ipcMain.handle("download-differential-update", async () => {
  if (updateDownloadedSuccessfully) {
    setTimeout(() => performQuitAndInstall(), 300);
    return { success: true, alreadyDownloaded: true };
  }
  if (isUpdateDownloading) {
    return { success: true, message: "Download already in progress" };
  }
  if (autoUpdater && app.isPackaged) {
    try {
      isUpdateDownloading = true;
      if (!cachedUpdateInfo || Date.now() - lastUpdateCheckAt > 5 * 60 * 1000) {
        const checkRes = await autoUpdater.checkForUpdates();
        cachedUpdateInfo = checkRes?.updateInfo || null;
        lastUpdateCheckAt = Date.now();
      }
      if (!cachedUpdateInfo) {
        isUpdateDownloading = false;
        return { success: false, error: "لا يوجد تحديث متاح حالياً" };
      }
      await autoUpdater.downloadUpdate();
      if (autoUpdater.downloadedUpdateFile) {
        downloadedInstallerPath = autoUpdater.downloadedUpdateFile;
      }
      updateDownloadedSuccessfully = true;
      isUpdateDownloading = false;

      setTimeout(() => {
        if (!isQuittingForInstall) {
          performQuitAndInstall();
        }
      }, 900);

      return { success: true, updateInfo: cachedUpdateInfo };
    } catch (err) {
      isUpdateDownloading = false;
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "AutoUpdater not available" };
});

ipcMain.on("restart_app", () => {
  performQuitAndInstall();
});

ipcMain.handle("quit-and-install-update", async () => {
  if (updateDownloadedSuccessfully || downloadedInstallerPath) {
    performQuitAndInstall();
    return true;
  }
  return false;
});

const ALLOWED_UPDATE_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
  "pen-rx.vercel.app",
]);

function isAllowedUpdateUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const allowedHosts = new Set(ALLOWED_UPDATE_HOSTS);
    for (const envUrl of [process.env.PENRX_CLOUD_API_URL, process.env.NEXT_PUBLIC_APP_URL]) {
      try {
        if (envUrl) allowedHosts.add(new URL(envUrl).hostname);
      } catch {}
    }
    return allowedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function downloadFileWithRedirects(url, destPath, onProgress, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("تم تجاوز الحد الأقصى لإعادة التوجيه"));
    }

    if (!isAllowedUpdateUrl(url)) {
      return reject(new Error("رابط التحديث مرفوض أمنياً"));
    }

    const isHttps = url.startsWith("https://");
    const client = isHttps ? require("https") : require("http");
    const ghToken = (process.env.GH_TOKEN || process.env.GITHUB_RELEASE_TOKEN || process.env.RELEASE_TOKEN || "").trim();

    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PenRX-Desktop-Updater",
          Accept: "*/*",
          ...(ghToken && url.includes("github.com") ? { Authorization: `Bearer ${ghToken}` } : {}),
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const redirectUrl = new URL(res.headers.location, url).toString();
          return downloadFileWithRedirects(redirectUrl, destPath, onProgress, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`فشل تحميل الملف من السيرفر (كود الحالة: ${res.statusCode})`));
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        res.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress) {
            const percent = totalBytes > 0 ? Math.min(Math.round((downloadedBytes / totalBytes) * 100), 99) : 0;
            const downloadedMB = parseFloat((downloadedBytes / (1024 * 1024)).toFixed(1));
            const totalMB = totalBytes > 0 ? parseFloat((totalBytes / (1024 * 1024)).toFixed(1)) : 0;
            onProgress({
              percent,
              progress: percent,
              downloadedMB,
              totalMB,
              downloadedBytes,
              totalBytes,
              status: "downloading",
            });
          }
        });

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close(() => {
            if (onProgress) {
              const finalMB = parseFloat((downloadedBytes / (1024 * 1024)).toFixed(1));
              onProgress({
                percent: 100,
                progress: 100,
                downloadedMB: finalMB,
                totalMB: finalMB,
                completed: true,
                status: "completed",
              });
            }
            resolve(destPath);
          });
        });

        fileStream.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }
    );

    request.on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.setTimeout(120000, () => {
      request.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error("انتهت مهلة الاتصال أثناء تحميل التحديث"));
    });
  });
}

ipcMain.handle("download-and-install-update", async (_event, downloadUrl) => {
  if (updateDownloadedSuccessfully || isUpdateDownloading) {
    if (downloadedInstallerPath) {
      setTimeout(() => {
        if (!isQuittingForInstall) {
          performQuitAndInstall(downloadedInstallerPath);
        }
      }, 300);
    }
    return { success: true, alreadyHandled: true };
  }

  const targetUrl =
    downloadUrl || "https://github.com/emontal110/PenRx-/releases/latest/download/PenRX+-Setup.exe";

  if (!isAllowedUpdateUrl(targetUrl)) {
    return {
      success: false,
      error: "رابط التحديث مرفوض أمنياً",
    };
  }

  const tempPath = path.join(app.getPath("temp"), "PenRX+-Setup-Latest.exe");

  try {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }

    await downloadFileWithRedirects(targetUrl, tempPath, (progressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-download-progress", progressData);
      }
    });

    downloadedInstallerPath = tempPath;
    updateDownloadedSuccessfully = true;

    setTimeout(() => {
      performQuitAndInstall(tempPath);
    }, 500);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "حدث خطأ أثناء تحميل وتثبيت التحديث" };
  }
});

function pingPenrxHealth(url) {
  return new Promise((resolve) => {
    const req = http.get(`${url}/__penrx_health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServerRunning() {
  if (process.env.ELECTRON_START_URL) {
    activeServerUrl = process.env.ELECTRON_START_URL;
    return activeServerUrl;
  }

  if (!app.isPackaged) {
    const is3000Up = await pingPenrxHealth("http://localhost:3000");
    if (is3000Up) {
      activeServerUrl = "http://localhost:3000";
      return activeServerUrl;
    }
  }

  return new Promise((resolve) => {
    const unpackedScript = path.join(process.resourcesPath, "app.asar.unpacked", "electron", "start-server.js");
    const appFolderScript = path.join(process.resourcesPath, "app", "electron", "start-server.js");
    const serverScript =
      app.isPackaged && fs.existsSync(unpackedScript)
        ? unpackedScript
        : app.isPackaged && fs.existsSync(appFolderScript)
        ? appFolderScript
        : path.join(__dirname, "start-server.js");

    const targetPort = 3000;
    const fallbackCloudUrl = process.env.PENRX_CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app";

    serverProcess = fork(serverScript, [], {
      cwd: processCwd,
      env: {
        ...process.env,
        PORT: String(targetPort),
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });

    let resolved = false;
    const finish = (url) => {
      if (resolved) return;
      resolved = true;
      activeServerUrl = url;
      resolve(url);
    };

    serverProcess.on("message", (msg) => {
      if (msg && msg.status === "ready") {
        finish(`http://localhost:${msg.port || targetPort}`);
      }
    });

    const pollInterval = setInterval(async () => {
      if (resolved) {
        clearInterval(pollInterval);
        return;
      }
      const isUp = await pingPenrxHealth(`http://localhost:${targetPort}`);
      if (isUp) {
        clearInterval(pollInterval);
        finish(`http://localhost:${targetPort}`);
      }
    }, 300);

    setTimeout(() => {
      clearInterval(pollInterval);
      if (!resolved) {
        finish(fallbackCloudUrl);
      }
    }, 12000);
  });
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, "../public/icon.ico"),
    path.join(processCwd, "public/icon.ico"),
    path.join(__dirname, "../public/icon-512.png"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

function getLogoBase64() {
  const candidates = [
    path.join(__dirname, "../public/logo-penrx.jpg"),
    path.join(processCwd, "public/logo-penrx.jpg"),
    path.join(__dirname, "../public/icon-512.png"),
    path.join(process.resourcesPath, "public/logo-penrx.jpg"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return `data:image/jpeg;base64,${fs.readFileSync(c).toString("base64")}`;
      }
    } catch {}
  }
  return "";
}

function buildSplashHtml(logoBase64) {
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="splash-logo" alt="PenRX+" />`
    : `<div class="splash-logo-fallback"><span>PenRX<b>+</b></span></div>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>PenRX+ Medical Suite</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden; background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
      user-select: none; display: flex; align-items: center; justify-content: center; padding: 12px;
    }
    .splash-card {
      width: 100%; height: 100%;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0b1329 80%);
      border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 28px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 45px rgba(16, 185, 129, 0.18);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 24px 32px; text-align: center; position: relative; overflow: hidden;
    }
    .splash-logo {
      width: 88px; height: 88px; border-radius: 22px; object-fit: cover;
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4); border: 2px solid rgba(16, 185, 129, 0.6);
      margin-bottom: 14px;
    }
    .splash-logo-fallback {
      width: 88px; height: 88px; background: #0f172a; border: 2px solid rgba(16, 185, 129, 0.6);
      border-radius: 22px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 26px; font-weight: 900; margin-bottom: 14px;
    }
    .splash-logo-fallback b { color: #10b981; }
    .brand-title { font-size: 24px; font-weight: 900; color: #f8fafc; margin-bottom: 4px; }
    .brand-title span { color: #10b981; }
    .brand-subtitle { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 20px; }
    .progress-track {
      width: 280px; height: 6px; background: rgba(255, 255, 255, 0.08);
      border-radius: 999px; overflow: hidden; position: relative; margin-bottom: 12px;
    }
    .progress-bar {
      height: 100%; width: 45%; background: linear-gradient(90deg, #10b981, #06b6d4);
      border-radius: 999px; position: absolute; animation: sweep 1.3s ease-in-out infinite;
    }
    @keyframes sweep { 0% { left: -45%; } 100% { left: 100%; } }
    .status-text { font-size: 11px; font-weight: 600; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="splash-card">
    ${logoHtml}
    <div class="brand-title">منظومة <span>PenRX+</span> الطبية</div>
    <div class="brand-subtitle">الإدارة الذكية للروشتات والعيادات التخصصية</div>
    <div class="progress-track"><div class="progress-bar"></div></div>
    <div class="status-text">جاري فتح العيادة الذكية ومحرك الأدوية...</div>
  </div>
</body>
</html>`)}`;
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.focus();
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 520,
    height: 380,
    resizable: false,
    movable: true,
    center: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: getAppIconPath(),
    backgroundColor: "#00000000",
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: buildWindowWebPreferences(),
  });

  splashWindow.loadURL(buildSplashHtml(getLogoBase64()));
  splashWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splashWindow.webContents.on("will-navigate", (event) => event.preventDefault());

  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
      splashWindow.focus();
    }
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  return splashWindow;
}

function createMainWindow(targetUrl) {
  const iconPath = getAppIconPath();
  const isWindows = process.platform === "win32";
  const hwId = getHardwareMachineIdSync();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    minWidth: 1024,
    minHeight: 700,
    title: "PenRX+ | منظومة إدارة الروشتات والعيادات الطبية الذكية",
    icon: iconPath,
    backgroundColor: "#0b1329",
    show: false,
    paintWhenInitiallyHidden: true,
    ...(isWindows
      ? {
          titleBarStyle: "hidden",
          titleBarOverlay: {
            color: "#0b1329",
            symbolColor: "#cbd5e1",
            height: 36,
          },
        }
      : {}),
    webPreferences: buildWindowWebPreferences({
      preload: path.join(__dirname, "preload.js"),
      additionalArguments: hwId ? [`--penrx-hw-id=${hwId}`] : [],
    }),
  });

  Menu.setApplicationMenu(null);

  let hasRevealed = false;
  const revealMainWindow = () => {
    if (hasRevealed) return;
    hasRevealed = true;

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
    }

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 180);
  };

  mainWindow.webContents.once("did-finish-load", revealMainWindow);
  ipcMain.once("app-ready", revealMainWindow);
  setTimeout(revealMainWindow, 9000);

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F11") {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (
        (!app.isPackaged || process.env.PENRX_DEBUG === "1") &&
        (input.key === "F12" || (input.control && input.shift && input.key && input.key.toLowerCase() === "i"))
      ) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if ((input.control && input.key && input.key.toLowerCase() === "r") || input.key === "F5") {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternalAppUrl(url)) return;
    event.preventDefault();
    openExternalSafely(url);
  });

  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  let localhostFailCount = 0;
  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes("localhost")) {
      localhostFailCount++;
      if (localhostFailCount <= 3) {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed() && activeServerUrl) {
            mainWindow.loadURL(`${activeServerUrl}/`);
          }
        }, 1000);
      } else {
        const cloudFallback = process.env.PENRX_CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app";
        mainWindow.loadURL(`${cloudFallback}/`);
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (targetUrl) {
    mainWindow.loadURL(targetUrl);
  }

  return mainWindow;
}

app.whenReady().then(() => {
  if (nativeTheme) {
    nativeTheme.themeSource = "dark";
  }

  const GRANTED_PERMISSIONS = new Set(["notifications", "clipboard-sanitized-write"]);
  try {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(GRANTED_PERMISSIONS.has(permission));
    });
    ses.setPermissionCheckHandler((_webContents, permission) => GRANTED_PERMISSIONS.has(permission));
  } catch {}

  try {
    const lastVersionFile = path.join(app.getPath("userData"), "last-version.txt");
    let lastVersion = "";
    if (fs.existsSync(lastVersionFile)) {
      lastVersion = fs.readFileSync(lastVersionFile, "utf8").trim();
    }
    const currentVersion = app.getVersion();
    if (lastVersion && lastVersion !== currentVersion) {
      if (session.defaultSession) {
        session.defaultSession.clearCache().catch(() => {});
        session.defaultSession.clearStorageData({
          storages: ["appcache", "serviceworkers", "cachestorage"],
        }).catch(() => {});
      }
    }
    fs.writeFileSync(lastVersionFile, currentVersion, "utf8");
  } catch {}

  createSplashWindow();

  ensureServerRunning().then((baseUrl) => {
    const targetUrl = `${baseUrl}/`;
    createMainWindow(targetUrl);

    if (autoUpdater && app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 2500);

      setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isUpdateDownloading) {
          autoUpdater.checkForUpdates().catch(() => {});
        }
      }, 15 * 60 * 1000);
    }
  });
});

app.on("before-quit", () => {
  killServerProcessSync();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
