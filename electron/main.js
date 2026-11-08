const { app, BrowserWindow, shell, ipcMain, Menu, nativeTheme, session, clipboard, nativeImage, screen } = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { startInProcessServer, resolvePhysicalAppDir } = require("./start-server");

// Prevent any unhandled child_process or background exception from showing a native error dialog box
process.on("uncaughtException", (err) => {
  console.warn("[PenRX+ Main] Caught exception safely:", err && err.message ? err.message : err);
});

process.on("unhandledRejection", (reason) => {
  console.warn("[PenRX+ Main] Caught rejection safely:", reason && reason.message ? reason.message : reason);
});

/**
 * Resolves a 100% immutable Hardware Machine ID on Windows/Desktop so uninstalling,
 * clearing cache, or updating the EXE NEVER changes the device ID.
 */
let cachedHardwareMachineId = null;
function getHardwareMachineIdSync() {
  if (cachedHardwareMachineId) return cachedHardwareMachineId;

  const permanentDir = path.join(os.homedir(), ".penrx_plus");
  const permanentFile = path.join(permanentDir, "device_id.txt");

  try {
    if (fs.existsSync(permanentFile)) {
      const saved = fs.readFileSync(permanentFile, "utf8").trim().toUpperCase();
      if (/^PRX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(saved)) {
        cachedHardwareMachineId = saved;
        return saved;
      }
    }
  } catch {}

  let rawHardwareAnchor = "";

  if (process.platform === "win32") {
    try {
      const regOut = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: "utf8", timeout: 2500, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
      );
      const match = regOut.match(/MachineGuid\s+REG_SZ\s+([a-fA-F0-9-]+)/i);
      if (match && match[1]) {
        rawHardwareAnchor = match[1].trim().toLowerCase();
      }
    } catch {}

    if (!rawHardwareAnchor) {
      try {
        const wmicOut = execSync("wmic csproduct get uuid", {
          encoding: "utf8",
          timeout: 2500,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        });
        const lines = wmicOut
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !/^uuid$/i.test(l));
        if (lines[0]) {
          rawHardwareAnchor = lines[0].toLowerCase();
        }
      } catch {}
    }
  }

  if (!rawHardwareAnchor) {
    rawHardwareAnchor = [os.hostname(), os.platform(), os.arch(), os.cpus()?.[0]?.model || "cpu"]
      .join("|")
      .toLowerCase();
  }

  const digest = crypto.createHash("sha256").update(`penrx-hw-v1:${rawHardwareAnchor}`).digest("hex").toUpperCase();
  const formattedId = `PRX-${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
  cachedHardwareMachineId = formattedId;

  try {
    if (!fs.existsSync(permanentDir)) {
      fs.mkdirSync(permanentDir, { recursive: true });
    }
    fs.writeFileSync(permanentFile, formattedId, "utf8");
  } catch {}

  return formattedId;
}

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "whatsapp:", "mailto:"]);

const ALLOWED_UPDATE_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "codeload.github.com",
  "pen-rx.vercel.app",
]);

function openExternalSafely(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    console.warn(`[PenRX+ Security] Blocked shell.openExternal for disallowed protocol: ${parsed.protocol}`);
    return false;
  }
  shell.openExternal(parsed.toString()).catch((err) => {
    console.warn("[PenRX+ Security] shell.openExternal failed:", err.message);
  });
  return true;
}

function isAllowedUpdateUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_UPDATE_HOSTS.has(host)) return true;
  if (host.endsWith(".githubusercontent.com")) return true;
  return false;
}

function isInternalAppUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
  if (rawUrl.startsWith("data:text/html")) return true;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    return true;
  }
  const cloudRaw = process.env.PENRX_CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app";
  try {
    const cloudHost = new URL(cloudRaw).hostname.toLowerCase();
    if (parsed.protocol === "https:" && parsed.hostname.toLowerCase() === cloudHost) {
      return true;
    }
  } catch {}
  return false;
}

function buildWindowWebPreferences(extra = {}) {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    spellcheck: false,
    backgroundThrottling: false,
    ...extra,
  };
}

let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
} catch {
  console.warn("[PenRX+ Updater] electron-updater not loaded in dev mode.");
}

app.setName("PenRX+");
if (process.platform === "win32") {
  app.setAppUserModelId("com.penrxplus.app");
}

app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

let mainWindow = null;
let splashWindow = null;
let inProcessHttpServer = null;
let activeServerUrl = null;
let isQuittingForInstall = false;
let isUpdateDownloading = false;
let updateDownloadedSuccessfully = false;
let downloadedInstallerPath = null;

const processCwd =
  resolvePhysicalAppDir() ||
  (app.isPackaged && process.resourcesPath ? process.resourcesPath : path.join(__dirname, ".."));

function closeInProcessServerSync() {
  if (inProcessHttpServer) {
    try {
      inProcessHttpServer.close();
    } catch {}
    inProcessHttpServer = null;
  }
}

function performQuitAndInstall(installerExePath = null) {
  if (isQuittingForInstall) return;
  isQuittingForInstall = true;

  closeInProcessServerSync();

  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
  } catch {}
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  } catch {}

  if (installerExePath && fs.existsSync(installerExePath)) {
    try {
      const currentPid = process.pid;
      const escapedInstaller = installerExePath.replace(/'/g, "''");
      const appExePath = process.execPath;
      const escapedAppExe = appExePath.replace(/'/g, "''");

      // Fully hidden PowerShell worker that waits for PenRX+ to release file locks,
      // runs NSIS installer silently (/S) with zero console flicker, and restarts the app.
      const psScript = [
        `try { Wait-Process -Id ${currentPid} -Timeout 8 -ErrorAction SilentlyContinue } catch {}`,
        `Start-Sleep -Milliseconds 300`,
        `Get-Process -Name 'PenRX+' -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${currentPid} } | Stop-Process -Force -ErrorAction SilentlyContinue`,
        `Start-Sleep -Milliseconds 200`,
        `$installerProc = Start-Process -FilePath '${escapedInstaller}' -ArgumentList '/S','--updated','--force-run' -Wait -PassThru -WindowStyle Hidden`,
        `Start-Sleep -Milliseconds 400`,
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
      runner.on("error", (err) => {
        console.warn("[PenRX+ AutoUpdater] Installer runner error:", err.message);
      });
      runner.unref();
      app.quit();
      setTimeout(() => process.exit(0), 400);
      return;
    } catch (e) {
      console.error("[PenRX+ Updater] PowerShell runner spawn error:", e.message);
    }
  }

  if (autoUpdater && updateDownloadedSuccessfully) {
    try {
      autoUpdater.quitAndInstall(true, true);
      return;
    } catch (e) {
      console.error("[PenRX+ Updater] autoUpdater.quitAndInstall error:", e.message);
    }
  }

  app.quit();
  setTimeout(() => process.exit(0), 300);
}

const isSilentInstallArg = process.argv.some((arg) =>
  ["--updated", "--S", "/S", "--silent", "--squirrel-install", "--squirrel-updated", "--squirrel-obsolete", "--squirrel-uninstall"].includes(arg)
);

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  if (!isSilentInstallArg) {
    app.quit();
    process.exit(0);
  }
} else {
  app.on("second-instance", (_event, commandLine) => {
    const isUpdaterLaunching = commandLine.some((arg) =>
      ["--updated", "--S", "/S", "--silent", "--force-run"].includes(arg)
    );
    if (isUpdaterLaunching) {
      closeInProcessServerSync();
      app.quit();
      process.exit(0);
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.focus();
    }
  });
}

function normalizeEgyptWhatsAppDigits(rawPhone) {
  let digits = String(rawPhone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length >= 11) return digits;
  if (digits.startsWith("0")) return `2${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `20${digits}`;
  return `2${digits}`;
}

/**
 * Native Windows Desktop WhatsApp Attachment & Direct Chat Dispatcher:
 * 1. Writes the PNG or PDF file to %TEMP%\PenRX_WhatsApp\<safeName>.
 * 2. Copies BOTH the file drop list (via PowerShell -Sta StringCollection) and image bitmap (if PNG)
 *    onto the Windows system clipboard so Ctrl+V attaches either PDF or PNG inside WhatsApp Desktop / Web.
 * 3. Opens the patient's direct conversation via whatsapp://send?phone=...&text=...
 *    (providing the caption in text= so WhatsApp automatically focuses the chat message input box).
 * 4. Runs a background PowerShell -Sta automation script using Win32 SetForegroundWindow + SendKeys('^v')
 *    so the Image or PDF is attached automatically into the patient's chat.
 */
ipcMain.handle("share-whatsapp-desktop", async (_event, payload) => {
  try {
    const { base64Data, fileName, mimeType, cleanPhone, caption } = payload || {};
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
    const safeName =
      String(fileName || fallbackName)
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

    const isPdf = mimeType === "application/pdf" || safeName.toLowerCase().endsWith(".pdf");

    // 1. Place image bitmap on clipboard immediately if PNG
    if (!isPdf) {
      try {
        const img = nativeImage.createFromBuffer(buffer);
        if (!img.isEmpty()) {
          clipboard.writeImage(img);
        }
      } catch {}
    }

    // 2. On Windows, place the file (PDF or PNG) on the Windows Clipboard in STA mode
    let wasWhatsAppRunning = false;
    if (process.platform === "win32") {
      const escapedPath = filePath.replace(/'/g, "''");
      const clipCmd = isPdf
        ? [
            "Add-Type -AssemblyName System.Windows.Forms",
            "$sc = New-Object System.Collections.Specialized.StringCollection",
            `[void]$sc.Add('${escapedPath}')`,
            "[System.Windows.Forms.Clipboard]::SetFileDropList($sc)",
          ].join("; ")
        : [
            "Add-Type -AssemblyName System.Windows.Forms",
            "Add-Type -AssemblyName System.Drawing",
            "$sc = New-Object System.Collections.Specialized.StringCollection",
            `[void]$sc.Add('${escapedPath}')`,
            `$img = [System.Drawing.Image]::FromFile('${escapedPath}')`,
            "$do = New-Object System.Windows.Forms.DataObject",
            "$do.SetFileDropList($sc)",
            "$do.SetImage($img)",
            "[System.Windows.Forms.Clipboard]::SetDataObject($do, $true)",
            "$img.Dispose()",
          ].join("; ");

      try {
        execSync(
          `powershell.exe -Sta -NoProfile -NonInteractive -WindowStyle Hidden -Command "${clipCmd}"`,
          { windowsHide: true, stdio: "ignore", timeout: 4500 }
        );
      } catch (clipErr) {
        console.warn("[PenRX+ WhatsApp] STA Clipboard notice:", clipErr.message);
      }

      try {
        const procOut = execSync(
          `powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "(Get-Process -Name 'WhatsApp*' -ErrorAction SilentlyContinue | Measure-Object).Count"`,
          { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }
        );
        wasWhatsAppRunning = parseInt(String(procOut || "0").trim(), 10) > 0;
      } catch {}
    }

    // 3. Open the patient's chat in WhatsApp with caption in text= so WhatsApp focuses the message input box
    const safeCaption = String(caption || "📋 الروشتة الطبية").trim();
    const whatsappNativeUrl = `whatsapp://send?phone=${digitsOnly}&text=${encodeURIComponent(safeCaption)}`;
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

    // 4. Automatically focus WhatsApp window, paste the attached file (Ctrl+V), and send
    if (process.platform === "win32") {
      const initialWaitMs = wasWhatsAppRunning ? 2600 : 4500;
      const escapedPath = filePath.replace(/'/g, "''");
      const reEnsureClipCmd = isPdf
        ? `$sc = New-Object System.Collections.Specialized.StringCollection; [void]$sc.Add('${escapedPath}'); [System.Windows.Forms.Clipboard]::SetFileDropList($sc)`
        : "";

      const autoPasteAndSendScript = [
        "Add-Type -AssemblyName System.Windows.Forms",
        `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PenRxWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@`,
        "$wshell = New-Object -ComObject WScript.Shell",
        reEnsureClipCmd,
        "for ($i = 0; $i -lt 20; $i++) {",
        "  Start-Sleep -Milliseconds 350",
        "  $procs = Get-Process -Name 'WhatsApp*' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }",
        "  if ($procs) {",
        "    foreach ($p in $procs) { [void][PenRxWin32]::ShowWindow($p.MainWindowHandle, 9); [void][PenRxWin32]::SetForegroundWindow($p.MainWindowHandle) }",
        "    break",
        "  }",
        "  if ($wshell.AppActivate('WhatsApp') -or $wshell.AppActivate('واتساب')) { break }",
        "}",
        `Start-Sleep -Milliseconds ${initialWaitMs}`,
        "$procs = Get-Process -Name 'WhatsApp*' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }",
        "if ($procs) { foreach ($p in $procs) { [void][PenRxWin32]::SetForegroundWindow($p.MainWindowHandle) } }",
        "$null = $wshell.AppActivate('WhatsApp'); $null = $wshell.AppActivate('واتساب')",
        "Start-Sleep -Milliseconds 300",
        "[System.Windows.Forms.SendKeys]::SendWait('^v')",
        "Start-Sleep -Milliseconds 1800",
        "$null = $wshell.AppActivate('WhatsApp'); $null = $wshell.AppActivate('واتساب')",
        "Start-Sleep -Milliseconds 250",
        "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
      ]
        .filter(Boolean)
        .join("; ");

      try {
        const pasteRunner = spawn(
          "powershell.exe",
          ["-Sta", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", autoPasteAndSendScript],
          { detached: true, stdio: "ignore", windowsHide: true }
        );
        pasteRunner.on("error", (err) => {
          console.warn("[PenRX+ WhatsApp] Auto-paste runner error:", err.message);
        });
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

ipcMain.handle("window-minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
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

ipcMain.handle("window-close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-hardware-id", () => {
  return getHardwareMachineIdSync();
});

ipcMain.handle("open-external-url", (_event, url) => {
  return openExternalSafely(url);
});

if (autoUpdater) {
  autoUpdater.on("checking-for-update", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-status", { status: "checking" });
    }
  });

  autoUpdater.on("update-available", (info) => {
    isUpdateDownloading = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-status", {
        status: "available",
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    isUpdateDownloading = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-status", {
        status: "not-available",
        version: info.version,
      });
    }
  });

  autoUpdater.on("download-progress", (progressObj) => {
    isUpdateDownloading = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      const percent = Math.min(Math.round(progressObj.percent || 0), 99);
      const downloadedMB = parseFloat(((progressObj.transferred || 0) / (1024 * 1024)).toFixed(1));
      const totalMB = parseFloat(((progressObj.total || 0) / (1024 * 1024)).toFixed(1));
      const speedKB = Math.round((progressObj.bytesPerSecond || 0) / 1024);

      const payload = {
        percent,
        progress: percent,
        downloadedMB,
        totalMB,
        speedKB,
        transferred: progressObj.transferred,
        total: progressObj.total,
        status: "downloading",
      };

      mainWindow.webContents.send("update-download-progress", payload);
      mainWindow.webContents.send("updater-status", payload);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    isUpdateDownloading = false;
    updateDownloadedSuccessfully = true;
    downloadedInstallerPath = info.downloadedFile || null;

    if (mainWindow && !mainWindow.isDestroyed()) {
      const payload = {
        percent: 100,
        progress: 100,
        completed: true,
        status: "downloaded",
        version: info.version,
      };
      mainWindow.webContents.send("update-download-progress", payload);
      mainWindow.webContents.send("updater-status", payload);
    }
  });

  autoUpdater.on("error", (err) => {
    isUpdateDownloading = false;
    console.warn("[PenRX+ Updater] Differential update error:", err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater-status", {
        status: "error",
        error: err.message,
      });
    }
  });
}

ipcMain.handle("check-for-native-updates", async () => {
  if (!autoUpdater || !app.isPackaged) {
    return { available: false, reason: "dev-mode" };
  }
  try {
    const res = await autoUpdater.checkForUpdates();
    return {
      available: Boolean(res && res.updateInfo),
      version: res?.updateInfo?.version || app.getVersion(),
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

ipcMain.handle("quit-and-install-update", () => {
  performQuitAndInstall(downloadedInstallerPath);
  return { success: true };
});

function downloadFileWithRedirects(fileUrl, destPath, onProgress, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error("عدد كبير جداً من عمليات إعادة التوجيه (Redirects)"));
    }

    if (!isAllowedUpdateUrl(fileUrl)) {
      return reject(new Error("رابط التحديث غير مصرح به أمنياً"));
    }

    const request = https.get(
      fileUrl,
      {
        headers: {
          "User-Agent": "PenRX-Desktop-Updater/2.0",
          Accept: "*/*",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, fileUrl).toString();
          res.resume();
          return downloadFileWithRedirects(redirectUrl, destPath, onProgress, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`فشل التحميل من الخادم (كود HTTP ${res.statusCode})`));
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
      try {
        fs.unlinkSync(tempPath);
      } catch {}
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
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensures the application URL is ready without ever spawning a child process via fork()
 * (eliminating `spawn PenRX+.exe ENOENT` completely) and falling back cleanly to the
 * cloud URL if local Next.js is unavailable.
 */
async function ensureServerRunning() {
  if (process.env.ELECTRON_START_URL) {
    activeServerUrl = process.env.ELECTRON_START_URL;
    return activeServerUrl;
  }

  const is3000Up = await pingPenrxHealth("http://localhost:3000");
  if (is3000Up) {
    activeServerUrl = "http://localhost:3000";
    return activeServerUrl;
  }

  const fallbackCloudUrl =
    process.env.PENRX_CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app";

  const physicalAppDir = resolvePhysicalAppDir();
  if (!physicalAppDir) {
    activeServerUrl = fallbackCloudUrl;
    return activeServerUrl;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (url) => {
      if (resolved) return;
      resolved = true;
      activeServerUrl = url;
      resolve(url);
    };

    const timeoutId = setTimeout(() => {
      finish(fallbackCloudUrl);
    }, 5000);

    startInProcessServer({ port: 3000, appDir: physicalAppDir })
      .then((res) => {
        clearTimeout(timeoutId);
        if (res && res.server) {
          inProcessHttpServer = res.server;
        }
        finish(res.url || "http://localhost:3000");
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.warn("[PenRX+ Server] Local in-process server skipped, using cloud:", err.message);
        finish(fallbackCloudUrl);
      });
  });
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, "../public/icon.ico"),
    process.resourcesPath ? path.join(process.resourcesPath, "app/public/icon.ico") : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar/public/icon.ico") : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked/public/icon.ico") : "",
    path.join(processCwd, "public/icon.ico"),
    path.join(__dirname, "../public/icon-512.png"),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return undefined;
}

function getLogoBase64() {
  const candidates = [
    path.join(__dirname, "../public/logo-penrx.jpg"),
    process.resourcesPath ? path.join(process.resourcesPath, "app/public/logo-penrx.jpg") : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar/public/logo-penrx.jpg") : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked/public/logo-penrx.jpg") : "",
    path.join(processCwd, "public/logo-penrx.jpg"),
    path.join(__dirname, "../public/icon-512.png"),
  ].filter(Boolean);
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
      border-radius: 999px; position: absolute; animation: sweep 1.1s ease-in-out infinite;
    }
    @keyframes sweep { 0% { left: -45%; } 100% { left: 100%; } }
    .status-text { font-size: 11px; font-weight: 600; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="splash-card">
    ${logoHtml}
    <div class="brand-title">منظومة <span>PenRX+</span> الطبية</div>
    <div class="brand-subtitle">الإدارة الذكية للروشتات والعيادات</div>
    <div class="progress-track"><div class="progress-bar"></div></div>
    <div class="status-text">جاري فتح العيادة الذكية...</div>
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
  const cloudFallback =
    process.env.PENRX_CLOUD_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pen-rx.vercel.app";

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

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  };

  mainWindow.webContents.once("did-finish-load", revealMainWindow);
  ipcMain.once("app-ready", revealMainWindow);
  setTimeout(revealMainWindow, 4000);

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

  let switchedToCloud = false;
  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes("localhost") && !switchedToCloud) {
      switchedToCloud = true;
      activeServerUrl = cloudFallback;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`${cloudFallback}/`);
      }
    }
  });

  mainWindow.webContents.on("did-navigate", (_event, url, httpResponseCode) => {
    if (url && url.includes("localhost") && httpResponseCode >= 500 && !switchedToCloud) {
      switchedToCloud = true;
      activeServerUrl = cloudFallback;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`${cloudFallback}/`);
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (targetUrl) {
    mainWindow.loadURL(targetUrl).catch(() => {
      if (!switchedToCloud && mainWindow && !mainWindow.isDestroyed()) {
        switchedToCloud = true;
        mainWindow.loadURL(`${cloudFallback}/`).catch(() => {});
      }
    });
  }

  return mainWindow;
}

app.whenReady().then(() => {
  if (nativeTheme) {
    nativeTheme.themeSource = "dark";
  }

  createSplashWindow();

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
        session.defaultSession
          .clearStorageData({
            storages: ["appcache", "serviceworkers", "cachestorage"],
          })
          .catch(() => {});
      }
    }
    fs.writeFileSync(lastVersionFile, currentVersion, "utf8");
  } catch {}

  ensureServerRunning().then((baseUrl) => {
    const targetUrl = `${baseUrl}/`;
    createMainWindow(targetUrl);

    if (autoUpdater && app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
      }, 2000);

      setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isUpdateDownloading && !updateDownloadedSuccessfully) {
          autoUpdater.checkForUpdates().catch(() => {});
        }
      }, 15 * 60 * 1000);
    }
  });
});

app.on("before-quit", () => {
  closeInProcessServerSync();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !isQuittingForInstall) {
    app.quit();
  }
});
