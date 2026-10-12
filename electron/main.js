const { app, BrowserWindow, Menu, ipcMain, shell, nativeTheme } = require("electron");
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

// Determine app root directory
const appDir = app.isPackaged
  ? path.join(process.resourcesPath, "app")
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

    exec("wmic baseboard get serialnumber", (e, out) => {
      const serial = sanitize(out);
      if (serial) return resolve(serial);

      // Windows 11 fallback when wmic is deprecated/removed
      exec('powershell -NoProfile -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"', (e2, out2) => {
        const psSerial = sanitize(out2);
        resolve(psSerial);
      });
    });
  });
}

function getWindowsGuid() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve("");
    exec(
      "reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid",
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

ipcMain.handle("maximize-window", () => {
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

// Stream file download with 301/302/307 redirect support
function downloadFileWithRedirects(url, destPath, onProgress, maxRedirects = 6) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("تم تجاوز الحد الأقصى لإعادة التوجيه (Too many redirects)"));
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
          return downloadFileWithRedirects(res.headers.location, destPath, onProgress, maxRedirects - 1)
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

    const currentExe = process.execPath;
    const runnerPath = path.join(app.getPath("temp"), "penrx-update-runner.bat");

    // Batch runner that waits for file locks to clear, installs silently via /S, and relaunches the app
    const runnerScript = `@echo off
chcp 65001 >nul
timeout /t 2 /nobreak >nul
start /wait "" "${tempPath}" /S
timeout /t 1 /nobreak >nul
if exist "${currentExe}" (
    start "" "${currentExe}"
)
del "${tempPath}" 2>nul
(goto) 2>nul & del "%~f0"
`;

    fs.writeFileSync(runnerPath, runnerScript, "utf8");

    // Kill background next server process immediately so port 3000 and all file locks are released
    if (serverProcess && serverProcess.pid) {
      try {
        if (process.platform === "win32") {
          exec(`taskkill /pid ${serverProcess.pid} /T /F`);
        } else {
          serverProcess.kill("SIGKILL");
        }
      } catch {}
      serverProcess = null;
    }

    // Launch runner detached in background
    const { spawn } = require("child_process");
    const runner = spawn("cmd.exe", ["/c", runnerPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
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

  // 1. Check if localhost:3000 is already active
  const is3000Up = await pingUrl("http://localhost:3000");
  if (is3000Up) {
    activeServerUrl = "http://localhost:3000";
    return activeServerUrl;
  }

  // 2. Spawn the embedded server
  return new Promise((resolve) => {
    const serverScript = path.join(__dirname, "start-server.js");
    const targetPort = 3000;

    console.log(`[PenRX+ Electron] Spawning background Next.js server via ${serverScript}...`);

    serverProcess = fork(serverScript, [], {
      cwd: appDir,
      env: {
        ...process.env,
        PORT: String(targetPort),
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
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

// HTML Splash Screen to eliminate any black screen
const SPLASH_HTML = `data:text/html;charset=utf-8,<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>PenRX+ Medical Suite</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background-color: #020617;
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
      width: 72px;
      height: 72px;
      background: #0f172a;
      border: 2px solid rgba(16, 185, 129, 0.5);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.35);
    }
    .logo-box span {
      font-size: 26px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -1px;
    }
    .logo-box span b {
      color: #10b981;
    }
    .title {
      font-size: 20px;
      font-weight: 900;
      color: #f1f5f9;
      margin: 0 0 6px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin: 0 0 32px 0;
      font-weight: 600;
    }
    .loader-track {
      width: 260px;
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
  <p class="subtitle">جاري تشغيل محرك النظام وإعداد قاعدة البيانات...</p>
  <div class="loader-track">
    <div class="loader-bar"></div>
  </div>
</body>
</html>`;

let splashWindow = null;

function createSplashWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, "../public/icon.ico"))
    ? path.join(__dirname, "../public/icon.ico")
    : path.join(__dirname, "../public/icon-512.png");

  splashWindow = new BrowserWindow({
    width: 440,
    height: 480,
    frame: false,
    transparent: false,
    backgroundColor: "#020617",
    resizable: false,
    center: true,
    alwaysOnTop: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadURL(SPLASH_HTML);
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
}

function createMainWindow(baseUrl) {
  const iconPath = fs.existsSync(path.join(__dirname, "../public/icon.ico"))
    ? path.join(__dirname, "../public/icon.ico")
    : path.join(__dirname, "../public/icon-512.png");

  const isWindows = process.platform === "win32";

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
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

  // Default to Full Screen / Maximized window on application launch
  mainWindow.maximize();

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

  const targetUrl = `${baseUrl}/`;
  console.log(`[PenRX+ Electron] Navigating to: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);

  let hasTransitioned = false;
  const transitionToMain = () => {
    if (hasTransitioned) return;
    hasTransitioned = true;
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.destroy();
        splashWindow = null;
      }
    }, 400);
  };

  mainWindow.webContents.once("did-finish-load", transitionToMain);
  setTimeout(transitionToMain, 7000);

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
}

app.whenReady().then(() => {
  if (nativeTheme) {
    nativeTheme.themeSource = "dark";
  }
  createSplashWindow();

  ensureServerRunning().then((baseUrl) => {
    createMainWindow(baseUrl);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (activeServerUrl) {
        createMainWindow(activeServerUrl);
      } else {
        ensureServerRunning().then((baseUrl) => createMainWindow(baseUrl));
      }
    }
  });
});

app.on("before-quit", () => {
  if (serverProcess && serverProcess.pid) {
    try {
      if (process.platform === "win32") {
        exec(`taskkill /pid ${serverProcess.pid} /T /F`);
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
