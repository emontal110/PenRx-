import type { CapacitorConfig } from "@capacitor/cli";
import * as fs from "fs";
import * as path from "path";

// 1. Live Vercel Production URL for mobile app
let liveUrl = "https://pen-rx.vercel.app";

try {
  const configPath = path.resolve(__dirname, "mobile-config.json");
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (raw.serverUrl && typeof raw.serverUrl === "string" && raw.serverUrl.trim()) {
      liveUrl = raw.serverUrl.trim();
    }
  }
} catch (e) {
  // Ignore read error
}

if (process.env.CAPACITOR_SERVER_URL) {
  liveUrl = process.env.CAPACITOR_SERVER_URL;
}

const config: CapacitorConfig = {
  appId: "com.penrxplus.app",
  appName: "PenRX+",
  webDir: "out",
  server: {
    url: liveUrl.startsWith("http") ? liveUrl : `https://${liveUrl}`,
    cleartext: true,
    androidScheme: "https",
    errorPath: "/error.html",
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
