const { app, BrowserWindow, Menu, ipcMain, shell, nativeTheme, screen, session, clipboard, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const { exec, execSync, fork, spawn } = require("child_process");

// Force native Windows theme to dark so the top title bar and frame match the dark aesthetic of PenRX+
if (nativeTheme) {
  nativeTheme.themeSource = "dark";
}

let splashWindow = null;
let mainWindow = null;
let serverProcess = null;
let CACHED_HARDWARE_ID = null;
let activeServerUrl = null;

//Synchronously terminate the embedded Next.js server process so no PenRX+.exe child holds file locks during NSIS updates
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

// Official differential auto-updater (Classico-style)
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
  // Keep the actual installer visible on Windows so the user sees the real install progress bar.
  // We still cleanly stop the app and server first, then launch the installer explicitly.
  autoUpdater.autoInstallOnAppQuit = false;
  // Explicitly enable differential (delta) downloads so only changed blocks are fetched
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;
  // Bypass Windows Authenticode code-signature enforcement for automated GitHub releases
  // to ensure differential blockmap updates are NEVER discarded due to missing code signing certificates
  autoUpdater.verifyUpdateCodeSignature = () => Promise.resolve(null);

  // Patch Provider.prototype.getBlockMapFiles to seamlessly handle both 2-part (v1.45) and 3-part (v1.45.0) GitHub release tags
  // and URL-encoded '+' (%2B) in PenRX+-Setup.exe.blockmap
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
      console.log("[PenRX+ AutoUpdater] Differential blockmap tag resolver patch applied successfully.");
    }

    // Also patch downloadBlockMap on autoUpdater instance so 2-part (v1.45) <-> 3-part (v1.45.0) tags automatically fallback
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
                console.log("[PenRX+ AutoUpdater] Retrying blockmap with alternate tag format:", altHref);
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

// Centralized, mutex-protected silent installation & auto-relaunch handler
function performQuitAndInstall(customInstallerPath = null) {
  if (isQuittingForInstall) return;
  isQuittingForInstall = true;

  console.log("[PenRX+ AutoUpdater] Executing silent update installation & automatic restart...");

  // 1. Destroy windows cleanly first so no pending requests fail with connection reset
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

  // 2. Synchronously terminate the child Next.js server process so PenRX+.exe & app.asar have zero file locks
  killServerProcessSync();

  // 3. Preferred path: launch the real installer visibly on Windows so the user sees the installer UI/progress
  const targetExe = customInstallerPath || downloadedInstallerPath;
  if (targetExe && fs.existsSync(targetExe) && process.platform === "win32") {
    try {
      const appExePath = process.execPath;
      const currentPid = process.pid;
      const escapedInstaller = targetExe.replace(/'/g, "''");
      const escapedAppExe = appExePath.replace(/'/g, "''");

      // Important: do not pass /S or quiet flags here because the requirement is a visible installer progress bar.
      const psScript = [
        `try { Wait-Process -Id ${currentPid} -Timeout 10 -ErrorAction SilentlyContinue } catch {}`,
        `Start-Sleep -Milliseconds 600`,
        `$installer = Start-Process -FilePath '${escapedInstaller}' -Wait -PassThru`,
        `Start-Sleep -Milliseconds 700`,
        `if (Test-Path '${escapedAppExe}') { Start-Process -FilePath '${escapedAppExe}' }`,
        `if ($installer -and $installer.ExitCode -ne 0) { exit $installer.ExitCode }`,
      ].join("; ");

      const runner = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", psScript],
        {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        }
      );
      runner.unref();
      app.exit(0);
      return;
    } catch (spawnErr) {
      console.warn("[PenRX+ AutoUpdater] Visible installer runner notice:", spawnErr.message);
    }
  }

  // 4. Final fallback for native electron-updater if no installer file is on disk yet.
  if (autoUpdater && updateDownloadedSuccessfully) {
    try {
      console.log("[PenRX+ AutoUpdater] Fallback: native update installer requested...");
      autoUpdater.quitAndInstall(true, true);
      setTimeout(() => {
        try {
          app.exit(0);
        } catch {}
      }, 1500);
      return;
    } catch (err) {
      console.error("[PenRX+ AutoUpdater] quitAndInstall fallback error:", err);
    }
  }

  app.exit(0);
}

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[PenRX+ Electron] Another instance is already running. Quitting duplicate instance.");
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

// Real OS working directory for child processes (never an .asar file path)
const processCwd = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, "..");

// --- HARDWARE FINGERPRINTING ENGINE (Immutable across uninstalls/reinstalls) ---
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
  // 1. Check persistent file in %APPDATA%\PenRXPlus (not deleted by NSIS uninstaller)
  const filePath = getPersistentHardwareIdFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const val = fs.readFileSync(filePath, "utf8").trim().toUpperCase();
      if (/^PRX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(val)) {
        return val;
      }
    } catch {}
  }

  // 2. Check Windows Registry HKCU\Software\PenRXPlus\MachineId (survives uninstalls)
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

  // Check if already persisted in %APPDATA% or HKCU Registry from previous install
  const persisted = readPersistedHardwareId();
  if (persisted) {
    CACHED_HARDWARE_ID = persisted;
    savePersistedHardwareId(persisted);
    return CACHED_HARDWARE_ID;
  }

  let idSource = "";

  if (process.platform === "win32") {
    // 1. Try Motherboard Serial via wmic or PowerShell CIM
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

    // 2. Fallback to Windows OS Cryptography MachineGuid (64-bit registry view)
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

  // 3. Fallback to physical MAC address
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

  // 4. Final fallback to OS hostname
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

async function getHardwareMachineId() {
  return getHardwareMachineIdSync();
}

// Pre-compute Hardware Machine ID immediately on startup
try {
  getHardwareMachineIdSync();
} catch {}

// IPC handler: renderer requests hardware machine ID
ipcMain.handle("get-hardware-machine-id", async () => {
  return getHardwareMachineIdSync();
});

// IPC handler: return current packaged electron app version
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// IPC handler: open external URL safely in default system browser
ipcMain.handle("open-external", async (_event, url) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("whatsapp://"))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC handler: Native Desktop WhatsApp Direct File Share (Image PNG or PDF)
// Strategy: Write file to disk → copy to clipboard → launch WhatsApp Desktop app
//           via whatsapp:// URI protocol (opens native app, NOT browser/web) →
//           PowerShell auto-pastes the file and sends it after WhatsApp focuses.
ipcMain.handle("share-whatsapp-desktop", async (_event, payload) => {
  try {
    const { base64Data, fileName, mimeType, cleanPhone } = payload || {};
    if (!base64Data || !cleanPhone) {
      return { success: false, error: "Missing file data or phone number" };
    }

    const rawB64 = String(base64Data).includes(",")
      ? String(base64Data).split(",")[1]
      : String(base64Data);
    const buffer = Buffer.from(rawB64, "base64");

    const safeName = (fileName || (mimeType === "application/pdf" ? "Prescription.pdf" : "Prescription.png"))
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const tempDir = path.join(app.getPath("temp"), "PenRX_WhatsApp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, safeName);
    fs.writeFileSync(filePath, buffer);

    const isPdf = mimeType === "application/pdf" || safeName.endsWith(".pdf");

    if (!isPdf) {
      // For images: put nativeImage into clipboard so WhatsApp Desktop picks it up on Ctrl+V
      const img = nativeImage.createFromBuffer(buffer);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
      }
    } else {
      // For PDF: put the actual file object (CF_HDROP) into the Windows Clipboard
      // so Ctrl+V in WhatsApp Desktop attaches the PDF file directly
      if (process.platform === "win32") {
        const escapedPath = filePath.replace(/'/g, "''");
        try {
          execSync(
            `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetFileDropList([System.Collections.Specialized.StringCollection]@('${escapedPath}'))"`,
            { windowsHide: true, stdio: "ignore", timeout: 4000 }
          );
        } catch {
          // Fallback: use Set-Clipboard -Path
          const escapedPath2 = filePath.replace(/'/g, "''");
          try {
            execSync(
              `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "Set-Clipboard -Path '${escapedPath2}'"`,
              { windowsHide: true, stdio: "ignore", timeout: 3500 }
            );
          } catch {}
        }
      }
    }

    // ── OPEN NATIVE WHATSAPP DESKTOP APP (NOT WEB) ──
    // Priority 1: whatsapp:// URI scheme → opens WhatsApp Desktop app directly to patient chat
    // Priority 2: Fallback to api.whatsapp.com if app is not installed (opens browser)
    const whatsappNativeUrl = `whatsapp://send?phone=${encodeURIComponent(cleanPhone)}&text=`;
    const whatsappWebFallback = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}`;

    let openedNative = false;
    if (process.platform === "win32") {
      // On Windows: try launching WhatsApp Desktop directly via URI protocol
      try {
        const uriScript = `Start-Process "${whatsappNativeUrl}"`;
        execSync(
          `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "${uriScript}"`,
          { windowsHide: true, stdio: "ignore", timeout: 4000 }
        );
        openedNative = true;
        console.log("[PenRX+ WhatsApp] Opened native WhatsApp Desktop via whatsapp:// URI");
      } catch (uriErr) {
        console.log("[PenRX+ WhatsApp] whatsapp:// URI not available, falling back to web URL");
      }
    }

    if (!openedNative) {
      await shell.openExternal(whatsappNativeUrl).catch(() => shell.openExternal(whatsappWebFallback));
    }

    // ── AUTO-PASTE & AUTO-SEND via PowerShell SendKeys ──
    // Waits for WhatsApp window to focus, then injects Ctrl+V (paste) + Enter (send)
    // This works for both WhatsApp Desktop (Win32 app) and WhatsApp Web in browser
    if (process.platform === "win32") {
      const autoPasteScript = [
        "Add-Type -AssemblyName System.Windows.Forms",
        // Wait for WhatsApp to open and gain focus (3.5 seconds for UWP/Desktop app)
        "Start-Sleep -Milliseconds 3500",
        // Paste the file/image from clipboard
        "[System.Windows.Forms.SendKeys]::SendWait('^v')",
        // Small pause for WhatsApp to process the attachment
        "Start-Sleep -Milliseconds 1200",
        // Press Enter to send
        "[System.Windows.Forms.SendKeys]::SendWait('~')",
      ].join("; ");
      try {
        const pasteRunner = spawn(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", autoPasteScript],
          { detached: true, stdio: "ignore", windowsHide: true }
        );
        pasteRunner.unref();
        console.log("[PenRX+ WhatsApp] Auto-paste & auto-send script launched successfully");
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

// IPC handlers: window full screen and maximize control
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

// Differential Auto-Updater Events & IPC Handlers
if (autoUpdater) {
  autoUpdater.on("update-available", (info) => {
    cachedUpdateInfo = info || null;
    lastUpdateCheckAt = Date.now();
    const version = info ? info.version : "";
    console.log(`[PenRX+ AutoUpdater] Update available: v${version}`);
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
    console.log("[PenRX+ AutoUpdater] Update package downloaded & verified:", info?.downloadedFile || "");
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
    // Launch the real Windows installer to show the genuine install progress UI.
    setTimeout(() => {
      if (!isQuittingForInstall) {
        performQuitAndInstall(downloadedInstallerPath);
      }
    }, 1500);
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
    setTimeout(() => performQuitAndInstall(downloadedInstallerPath), 300);
    return { success: true, alreadyDownloaded: true };
  }
  if (isUpdateDownloading) {
    return { success: true, message: "Download already in progress" };
  }
  if (autoUpdater && app.isPackaged) {
    try {
      isUpdateDownloading = true;
      // Reuse recent checkForUpdates result if checked within the last 5 minutes to avoid duplicate update_available events
      if (!cachedUpdateInfo || Date.now() - lastUpdateCheckAt > 5 * 60 * 1000) {
        console.log("[PenRX+ AutoUpdater] Checking for differential updates before download...");
        const checkRes = await autoUpdater.checkForUpdates();
        cachedUpdateInfo = checkRes?.updateInfo || null;
        lastUpdateCheckAt = Date.now();
      }
      if (!cachedUpdateInfo) {
        isUpdateDownloading = false;
        return { success: false, error: "لا يوجد تحديث متاح حالياً" };
      }
      console.log(`[PenRX+ AutoUpdater] Downloading differential update v${cachedUpdateInfo.version}...`);
      await autoUpdater.downloadUpdate();

      // In some GitHub release cases electron-updater resolves the Promise before the
      // final update-downloaded event is emitted or before the installer path is stored.
      // Mark it as downloaded immediately so the fallback full installer path cannot start.
      if (autoUpdater.downloadedUpdateFile) {
        downloadedInstallerPath = autoUpdater.downloadedUpdateFile;
      }
      updateDownloadedSuccessfully = true;
      isUpdateDownloading = false;

      setTimeout(() => {
        if (!isQuittingForInstall) {
          performQuitAndInstall(downloadedInstallerPath);
        }
      }, 1200);

      return { success: true, updateInfo: cachedUpdateInfo };
    } catch (err) {
      isUpdateDownloading = false;
      console.error("[PenRX+ AutoUpdater] Differential update failed:", err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "AutoUpdater not available" };
});

ipcMain.on("restart_app", () => {
  performQuitAndInstall(downloadedInstallerPath);
});

ipcMain.handle("quit-and-install-update", async () => {
  if (updateDownloadedSuccessfully || downloadedInstallerPath) {
    performQuitAndInstall(downloadedInstallerPath);
    return true;
  }
  return false;
});

// Only official GitHub release artifacts may be downloaded and executed.
const ALLOWED_UPDATE_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
]);

function isAllowedUpdateUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (!ALLOWED_UPDATE_HOSTS.has(parsed.hostname)) return false;
    if (parsed.hostname === "github.com" || parsed.hostname === "codeload.github.com") {
      return /^\/emontal110\/PenRx-\//.test(parsed.pathname);
    }
    return true;
  } catch {
    return false;
  }
}

// Stream file download with 301/302/307 redirect support
function downloadFileWithRedirects(url, destPath, onProgress, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("تم تجاوز الحد الأقصى لإعادة التوجيه (Too many redirects)"));
    }

    if (!isAllowedUpdateUrl(url)) {
      return reject(new Error("رابط التحديث مرفوض أمنياً: يُسمح فقط بروابط الإصدارات الرسمية على GitHub"));
    }

    const isHttps = url.startsWith("https://");
    const client = isHttps ? require("https") : require("http");

    const request = client.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PenRX-Desktop-Updater",
          Accept: "*/*",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const redirectUrl = new URL(res.headers.location, url).toString();
          if (!isAllowedUpdateUrl(redirectUrl)) {
            return reject(new Error("رابط إعادة التوجيه للتحديث مرفوض أمنياً"));
          }
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

// IPC handler: fallback direct download & silent install
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
    console.error("[PenRX+ AutoUpdate] Blocked disallowed download URL:", targetUrl);
    return {
      success: false,
      error: "رابط التحديث مرفوض أمنياً: يُسمح فقط بروابط الإصدارات الرسمية على GitHub",
    };
  }

  const tempPath = path.join(app.getPath("temp"), "PenRX+-Setup-Latest.exe");

  try {
    console.log(`[PenRX+ AutoUpdate] Starting native download from: ${targetUrl}`);
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }

    await downloadFileWithRedirects(targetUrl, tempPath, (progressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("update-download-progress", progressData);
      }
    });

    console.log(`[PenRX+ AutoUpdate] Download completed to ${tempPath}. Executing silent install...`);
    downloadedInstallerPath = tempPath;
    updateDownloadedSuccessfully = true;

    setTimeout(() => {
      performQuitAndInstall(tempPath);
    }, 600);

    return { success: true };
  } catch (err) {
    console.error("[PenRX+ AutoUpdate Error]:", err);
    return { success: false, error: err.message || "حدث خطأ أثناء تحميل وتثبيت التحديث" };
  }
});

// Check if a URL responds to HTTP requests
function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, () => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start Next.js server in the background
async function ensureServerRunning() {
  if (process.env.ELECTRON_START_URL) {
    activeServerUrl = process.env.ELECTRON_START_URL;
    return activeServerUrl;
  }

  if (!app.isPackaged) {
    const is3000Up = await pingUrl("http://localhost:3000");
    if (is3000Up) {
      activeServerUrl = "http://localhost:3000";
      return activeServerUrl;
    }
  }

  return new Promise((resolve) => {
    const serverScript = path.join(__dirname, "start-server.js");
    const targetPort = 3000;

    console.log(`[PenRX+ Electron] Spawning background Next.js server via ${serverScript}...`);

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

    serverProcess.on("error", (err) => {
      console.error("[PenRX+ Electron] Failed to spawn Next.js server:", err);
    });

    serverProcess.stdout.on("data", (d) => {
      console.log(`[Next.js Server stdout]: ${d.toString().trim()}`);
    });
    serverProcess.stderr.on("data", (d) => {
      console.error(`[Next.js Server stderr]: ${d.toString().trim()}`);
    });

    serverProcess.on("message", (msg) => {
      if (msg && msg.status === "ready") {
        activeServerUrl = `http://localhost:${msg.port || targetPort}`;
        resolve(activeServerUrl);
      }
    });

    const pollInterval = setInterval(async () => {
      const isUp = await pingUrl(`http://localhost:${targetPort}`);
      if (isUp) {
        clearInterval(pollInterval);
        activeServerUrl = `http://localhost:${targetPort}`;
        resolve(activeServerUrl);
      }
    }, 300);

    setTimeout(() => {
      clearInterval(pollInterval);
      if (!activeServerUrl) {
        activeServerUrl = `http://localhost:${targetPort}`;
        resolve(activeServerUrl);
      }
    }, 15000);
  });
}

function getAppIconPath() {
  const ico = path.join(__dirname, "../public/icon.ico");
  if (fs.existsSync(ico)) return ico;
  const png = path.join(__dirname, "../public/icon-512.png");
  if (fs.existsSync(png)) return png;
  return undefined;
}

function getLogoBase64() {
  const candidates = [
    path.join(__dirname, "../public/logo-penrx.jpg"),
    path.join(__dirname, "../public/icon-512.png"),
    path.join(process.resourcesPath, "public/logo-penrx.jpg"),
    path.join(process.resourcesPath, "public/icon-512.png"),
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
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
    .splash-card {
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0b1329 80%);
      border: 1px solid rgba(16, 185, 129, 0.4);
      border-radius: 28px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 45px rgba(16, 185, 129, 0.18);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .ambient-glow {
      position: absolute;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 70%);
      top: -70px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
    }
    .logo-container {
      position: relative;
      margin-bottom: 16px;
      z-index: 1;
    }
    .splash-logo {
      width: 90px;
      height: 90px;
      border-radius: 22px;
      object-fit: cover;
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
      border: 2px solid rgba(16, 185, 129, 0.6);
      animation: floatBreath 3s ease-in-out infinite;
    }
    .splash-logo-fallback {
      width: 90px;
      height: 90px;
      background: #0f172a;
      border: 2px solid rgba(16, 185, 129, 0.6);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 30px rgba(16, 185, 129, 0.4);
      color: #fff;
      font-size: 26px;
      font-weight: 900;
    }
    .splash-logo-fallback b { color: #10b981; }
    @keyframes floatBreath {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-4px) scale(1.02); }
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      color: #f8fafc;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
      z-index: 1;
    }
    .brand-title span {
      color: #10b981;
    }
    .brand-subtitle {
      font-size: 13px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 22px;
      z-index: 1;
    }
    .progress-track {
      width: 290px;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
      margin-bottom: 12px;
      z-index: 1;
    }
    .progress-bar {
      height: 100%;
      width: 45%;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      border-radius: 999px;
      position: absolute;
      animation: sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes sweep {
      0% { left: -45%; width: 45%; }
      50% { left: 35%; width: 65%; }
      100% { left: 100%; width: 45%; }
    }
    .status-text {
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
      letter-spacing: -0.2px;
      z-index: 1;
    }
    .footer-meta {
      position: absolute;
      bottom: 12px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 0 28px;
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="splash-card">
    <div class="ambient-glow"></div>
    <div class="logo-container">
      ${logoHtml}
    </div>
    <div class="brand-title">منظومة <span>PenRX+</span> الطبية</div>
    <div class="brand-subtitle">الإدارة الذكية للروشتات والعيادات التخصصية</div>
    <div class="progress-track">
      <div class="progress-bar"></div>
    </div>
    <div class="status-text">جاري تشغيل محرك النظام وقاعدة البيانات الطبية...</div>
    <div class="footer-meta">
      <span>PENRX+ ENTERPRISE</span>
      <span>محمي ومُشفر © 2026</span>
    </div>
  </div>
</body>
</html>`)}`;
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.focus();
    return splashWindow;
  }

  const iconPath = getAppIconPath();
  const logoBase64 = getLogoBase64();

  splashWindow = new BrowserWindow({
    width: 540,
    height: 400,
    resizable: false,
    movable: true,
    center: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: iconPath,
    backgroundColor: "#00000000",
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadURL(buildSplashHtml(logoBase64));

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

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: hwId ? [`--penrx-hw-id=${hwId}`] : [],
    },
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
    }, 220);
  };

  ipcMain.once("app-ready", revealMainWindow);
  setTimeout(revealMainWindow, 4500);

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F11") {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      } else if (input.key === "F12" || (input.control && input.shift && input.key && input.key.toLowerCase() === "i")) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      } else if ((input.control && input.key && input.key.toLowerCase() === "r") || input.key === "F5") {
        mainWindow.webContents.reload();
        event.preventDefault();
      }
    }
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.warn(`[PenRX+ Renderer ${level === 3 ? "ERROR" : "WARN"}]: ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("whatsapp:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes("localhost")) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && activeServerUrl) {
          mainWindow.loadURL(`${activeServerUrl}/`);
        }
      }, 800);
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

  // Auto clean HTTP/ServiceWorker cache (preserving localStorage) on version upgrade
  try {
    const lastVersionFile = path.join(app.getPath("userData"), "last-version.txt");
    let lastVersion = "";
    if (fs.existsSync(lastVersionFile)) {
      lastVersion = fs.readFileSync(lastVersionFile, "utf8").trim();
    }
    const currentVersion = app.getVersion();
    if (lastVersion && lastVersion !== currentVersion) {
      console.log(`[PenRX+ Electron] App updated from v${lastVersion} to v${currentVersion}. Cleaning HTTP cache...`);
      if (session.defaultSession) {
        session.defaultSession.clearCache().catch(() => {});
        session.defaultSession.clearStorageData({
          storages: ["appcache", "serviceworkers", "cachestorage"],
        }).catch(() => {});
      }
    }
    fs.writeFileSync(lastVersionFile, currentVersion, "utf8");
  } catch (err) {
    console.warn("[PenRX+ Electron] Notice during update cache check:", err.message);
  }

  createSplashWindow();

  ensureServerRunning().then((baseUrl) => {
    const targetUrl = `${baseUrl}/`;
    console.log(`[PenRX+ Electron] Server ready, navigating main window to: ${targetUrl}`);
    createMainWindow(targetUrl);

    // Unified Startup Update Check: 2.5 seconds after window loads, then every 15 minutes
    if (autoUpdater && app.isPackaged) {
      setTimeout(() => {
        console.log("[PenRX+ AutoUpdater] Triggering startup differential update check...");
        autoUpdater.checkForUpdates().catch((err) => {
          console.warn("[PenRX+ AutoUpdater] Startup check notice:", err.message);
        });
      }, 2500);

      setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isUpdateDownloading) {
          autoUpdater.checkForUpdates().catch(() => {});
        }
      }, 15 * 60 * 1000);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (activeServerUrl) {
        createMainWindow(`${activeServerUrl}/`);
        if (mainWindow) {
          mainWindow.show();
          mainWindow.maximize();
        }
      } else {
        createSplashWindow();
        ensureServerRunning().then((baseUrl) => {
          createMainWindow(`${baseUrl}/`);
        });
      }
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
