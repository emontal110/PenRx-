import type { CapacitorConfig } from "@capacitor/cli";
import * as fs from "fs";
import * as path from "path";

// 1. Read live Vercel URL from environment or mobile-config.json
let liveUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "";

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

const isRemote = Boolean(liveUrl && !liveUrl.includes("localhost"));

const config: CapacitorConfig = {
  appId: "com.penrxplus.app",
  appName: "PenRX+",
  webDir: "out",
  server: isRemote
    ? {
        url: liveUrl.startsWith("http") ? liveUrl : `https://${liveUrl}`,
        cleartext: true,
        androidScheme: "https",
        errorPath: "/error.html",
      }
    : {
        androidScheme: "https",
        cleartext: true,
      },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
