const { app, BrowserWindow, Menu, ipcMain, shell, nativeTheme, screen, session } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const http = require("http");
const { exec, fork } = require("child_process");

// Force native Windows theme to dark so the top title bar and frame match the dark aesthetic of PenRX+
if (nativeTheme) {
  nativeTheme.themeSource = "dark";
}

let mainWindow = null;
let serverProcess = null;
let CACHED_HARDWARE_ID = null;
let activeServerUrl = null;

// Official differential auto-updater (Classico-style)
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Explicitly enable differential (delta) downloads so only changes are fetched
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.logger = console;
} catch (e) {
  console.warn("[PenRX+ AutoUpdater] electron-updater not initialized:", e.message);
}

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log("[PenRX+ Electron] Another instance is already running. Quitting duplicate instance.");
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Real OS working directory for child processes (never an .asar file path)
const processCwd = app.isPackaged
  ? process.resourcesPath
  : path.resolve(__dirname, "..");

// --- HARDWARE FINGERPRINTING ENGINE (mirrors Classico's getMid()) ---
function getMotherboardSerial() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve("");

    function sanitize(raw) {
      if (!raw) return "";
      const clean = raw.replace(/SerialNumber/i, "").trim();
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

    exec("wmic baseboard get serialnumber", { windowsHide: true }, (e, out) => {
      const serial = sanitize(out);
      if (serial) return resolve(serial);

      // Windows 11 fallback when wmic is deprecated/removed
      exec(
        'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"',
        { windowsHide: true },
        (e2, out2) => {
          const psSerial = sanitize(out2);
          resolve(psSerial);
        }
      );
    });
  });
}

function getWindowsGuid() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve("");
    exec(
      "reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid",
      { windowsHide: true },
      (e, out) => {
        if (out) {
          const match = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
          if (match && match[1]) return resolve(match[1].trim());
        }
        resolve("");
      }
    );
  });
}

function getNetworkMac() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
        return net.mac;
      }
    }
  }
  return "";
}

async function getHardwareMachineId() {
  if (CACHED_HARDWARE_ID) return CACHED_HARDWARE_ID;

  let idSource = await getMotherboardSerial();
  if (!idSource) idSource = await getWindowsGuid();
  if (!idSource) idSource = getNetworkMac();
  if (!idSource) idSource = os.hostname();

  // SHA-256 for deterministic, unique 12-char ID
  const hash = crypto
    .createHash("sha256")
    .update(idSource)
    .digest("hex")
    .substring(0, 12)
    .toUpperCase();

  CACHED_HARDWARE_ID = `PRX-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  return CACHED_HARDWARE_ID;
}

// IPC handler: renderer requests hardware machine ID
ipcMain.handle("get-hardware-machine-id", async () => {
  return await getHardwareMachineId();
});

// IPC handler: return current packaged electron app version
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// IPC handler: open external URL safely in default system browser
ipcMain.handle("open-external", async (event, url) => {
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
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

// Differential Auto-Updater Events & IPC Handlers (matches Classico implementation)
if (autoUpdater) {
  autoUpdater.on("update-available", (info) => {
    const version = info ? info.version : "";
    console.log(`[PenRX+ AutoUpdater] Differential update available: v${version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update_available", version);
    }
  });

  autoUpdater.on("download-progress", (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("download_progress", progressObj.percent);
      mainWindow.webContents.send("update-download-progress", {
        progress: Math.round(progressObj.percent),
        downloadedMB: ((progressObj.transferred || 0) / 1024 / 1024).toFixed(1),
        totalMB: ((progressObj.total || 0) / 1024 / 1024).toFixed(1),
        status: "downloading",
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[PenRX+ AutoUpdater] Differential update downloaded successfully!");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("update_downloaded");
      mainWindow.webContents.send("update-download-progress", {
        progress: 100,
        status: "completed",
      });
    }
  });
}

ipcMain.handle("check-differential-update", async () => {
  if (autoUpdater) {
    try {
      const res = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: res?.updateInfo };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "AutoUpdater not available" };
});

ipcMain.handle("download-differential-update", async () => {
  if (autoUpdater) {
    try {
      console.log("[PenRX+ AutoUpdater] Checking for differential updates before download...");
      const checkRes = await autoUpdater.checkForUpdates();
      if (!checkRes || !checkRes.updateInfo) {
        console.warn("[PenRX+ AutoUpdater] No update info returned from checkForUpdates.");
        return { success: false, error: "لا يوجد تحديث متاح حالياً" };
      }
      console.log(`[PenRX+ AutoUpdater] Downloading differential update v${checkRes.updateInfo.version}...`);
      await autoUpdater.downloadUpdate();
      return { success: true, updateInfo: checkRes.updateInfo };
    } catch (err) {
      console.error("[PenRX+ AutoUpdater] Differential update failed:", err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "AutoUpdater not available" };
});

ipcMain.on("restart_app", () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});

ipcMain.handle("quit-and-install-update", async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.session.clearCache();
    } catch {}
  }
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
    return true;
  }
  return false;
});

// Only official GitHub release artifacts may be downloaded and executed.
// Blocks compromised update metadata from pointing the installer at arbitrary hosts.
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
        // Handle 3xx Redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // consume response data to free up memory
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
            onProgress({ percent, downloadedMB, totalMB, downloadedBytes, totalBytes });
          }
        });

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close(() => {
            if (onProgress) {
              const finalMB = parseFloat((downloadedBytes / (1024 * 1024)).toFixed(1));
              onProgress({ percent: 100, downloadedMB: finalMB, totalMB: finalMB, completed: true });
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

// IPC handler: download new setup .exe, spawn installer, and quit current app cleanly
ipcMain.handle("download-and-install-update", async (event, downloadUrl) => {
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

    console.log(`[PenRX+ AutoUpdate] Download completed to ${tempPath}. Preparing silent installation & auto-restart...`);

    // Kill background next server process immediately so port 3000 and all file locks are released
    if (serverProcess && serverProcess.pid) {
      try {
        if (process.platform === "win32") {
          exec(`taskkill /pid ${serverProcess.pid} /T /F`, { windowsHide: true });
        } else {
          serverProcess.kill("SIGKILL");
        }
      } catch {}
      serverProcess = null;
    }

    // Launch updater silently using PowerShell with WindowStyle Hidden & windowsHide: true
    // This executes completely invisibly without any batch files or CMD black console flashes!
    const { spawn } = require("child_process");
    const updateCmd = `Start-Sleep -Milliseconds 800; Start-Process -FilePath '${tempPath}' -ArgumentList '/S' -Wait; Remove-Item -Path '${tempPath}' -Force -ErrorAction SilentlyContinue`;

    const runner = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", updateCmd],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }
    );
    runner.unref();

    // Exit Electron cleanly to release all files for the installer
    setTimeout(() => {
      app.exit(0);
    }, 400);

    return { success: true };
  } catch (err) {
    console.error("[PenRX+ AutoUpdate Error]:", err);
    return { success: false, error: err.message || "حدث خطأ أثناء تحميل وتثبيت التحديث" };
  }
});

// Check if a URL responds to HTTP requests
function pingUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
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

  // 1. Check if localhost:3000 is already active (development convenience only —
  // the packaged app must never adopt an unrelated server that happens to listen
  // on port 3000)
  if (!app.isPackaged) {
    const is3000Up = await pingUrl("http://localhost:3000");
    if (is3000Up) {
      activeServerUrl = "http://localhost:3000";
      return activeServerUrl;
    }
  }

  // 2. Spawn the embedded server
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

    // Poll until ready as a reliable fallback
    const pollInterval = setInterval(async () => {
      const isUp = await pingUrl(`http://localhost:${targetPort}`);
      if (isUp) {
        clearInterval(pollInterval);
        activeServerUrl = `http://localhost:${targetPort}`;
        resolve(activeServerUrl);
      }
    }, 400);

    // Timeout safety
    setTimeout(() => {
      clearInterval(pollInterval);
      if (!activeServerUrl) {
        activeServerUrl = `http://localhost:${targetPort}`;
        resolve(activeServerUrl);
      }
    }, 15000);
  });
}

// HTML Splash Screen to display seamlessly within the main window while Next.js boots
const SPLASH_HTML = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>PenRX+ Medical Suite</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background-color: #0b1329;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .logo-box {
      width: 80px;
      height: 80px;
      background: #0f172a;
      border: 2px solid rgba(16, 185, 129, 0.5);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.35);
      margin-bottom: 20px;
    }
    .logo-box span {
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -1px;
    }
    .logo-box span b {
      color: #10b981;
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      color: #f1f5f9;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #94a3b8;
      margin: 0 0 32px 0;
      font-weight: 600;
    }
    .loader-track {
      width: 280px;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }
    .loader-bar {
      height: 100%;
      width: 45%;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      border-radius: 999px;
      position: absolute;
      animation: sweep 1.5s ease-in-out infinite;
    }
    @keyframes sweep {
      0% { left: -45%; width: 45%; }
      50% { left: 35%; width: 65%; }
      100% { left: 100%; width: 45%; }
    }
  </style>
</head>
<body>
  <div class="logo-box">
    <span>PenRX<b>+</b></span>
  </div>
  <h1 class="title">منظومة PenRX+ الطبية</h1>
  <p class="subtitle">جاري تشغيل محرك النظام وقاعدة البيانات الطبية...</p>
  <div class="loader-track">
    <div class="loader-bar"></div>
  </div>
</body>
</html>`;

function createMainWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, "../public/icon.ico"))
    ? path.join(__dirname, "../public/icon.ico")
    : path.join(__dirname, "../public/icon-512.png");

  const isWindows = process.platform === "win32";

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
    ...(isWindows
      ? {
          titleBarStyle: "hidden",
          titleBarOverlay: {
            color: "#0b1329", // كحلي داكن راقي يطابق ثيم البرنامج
            symbolColor: "#cbd5e1", // أزرار تحكم فضية متناسقة
            height: 36,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  // Load the Splash Screen immediately
  mainWindow.loadURL(SPLASH_HTML);

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isMaximized()) {
        mainWindow.maximize();
      }
    }
  });

  // Support F11 keyboard shortcut to toggle borderless full screen mode anytime
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("whatsapp:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL && validatedURL.includes("localhost")) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && activeServerUrl) {
          mainWindow.loadURL(`${activeServerUrl}/`);
        }
      }, 1000);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  if (nativeTheme) {
    nativeTheme.themeSource = "dark";
  }

  // Auto clean cache on version update to ensure fresh UI and assets
  try {
    const lastVersionFile = path.join(app.getPath("userData"), "last-version.txt");
    let lastVersion = "";
    if (fs.existsSync(lastVersionFile)) {
      lastVersion = fs.readFileSync(lastVersionFile, "utf8").trim();
    }
    const currentVersion = app.getVersion();
    if (lastVersion && lastVersion !== currentVersion) {
      console.log(`[PenRX+ Electron] App updated from v${lastVersion} to v${currentVersion}. Cleaning cache...`);
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

  // Open the main window directly (maximized with splash) without any intermediate small windows
  createMainWindow();

  ensureServerRunning().then((baseUrl) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const targetUrl = `${baseUrl}/`;
      console.log(`[PenRX+ Electron] Server ready, navigating main window to: ${targetUrl}`);
      mainWindow.loadURL(targetUrl);
      if (!mainWindow.isMaximized()) {
        mainWindow.maximize();
      }
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      if (activeServerUrl) {
        mainWindow.loadURL(`${activeServerUrl}/`);
      } else {
        ensureServerRunning().then((baseUrl) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(`${baseUrl}/`);
          }
        });
      }
    }
  });
});

app.on("before-quit", () => {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === "win32") {
        exec(`taskkill /pid ${serverProcess.pid} /T /F`, { windowsHide: true });
      } else {
        serverProcess.kill("SIGKILL");
      }
    } catch {}
    serverProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
