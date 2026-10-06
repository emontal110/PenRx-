const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");

let mainWindow;
let CACHED_HARDWARE_ID = null;

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

  // SHA-256 instead of MD5 (MD5 is cryptographically broken)
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "PenRX+ | منظومة إدارة الروشتات والعيادات الطبية",
    icon: fs.existsSync(path.join(__dirname, "../public/icon.ico"))
      ? path.join(__dirname, "../public/icon.ico")
      : path.join(__dirname, "../public/icon-512.png"),
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove default menu bar for clean modern appearance
  Menu.setApplicationMenu(null);

  // Open external links (such as WhatsApp web/desktop) directly in the default system browser or WhatsApp app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("whatsapp:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Load Subscriptions Portal (portal.html) by default
  const localPortal = path.join(__dirname, "../portal.html");
  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (fs.existsSync(localPortal)) {
    mainWindow.loadFile(localPortal);
  } else {
    mainWindow.loadURL("https://emontal110.github.io/PenRx-/portal.html");
  }

  // Fallback to cloud portal if loading fails
  mainWindow.webContents.on("did-fail-load", () => {
    const localPortalFallback = path.join(__dirname, "../portal.html");
    if (fs.existsSync(localPortalFallback)) {
      mainWindow.loadFile(localPortalFallback);
    } else {
      mainWindow.loadURL("https://emontal110.github.io/PenRx-/portal.html");
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
