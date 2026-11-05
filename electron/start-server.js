const path = require("path");
const fs = require("fs");
const http = require("http");

// The packaged desktop runtime intentionally ships WITHOUT server-side secrets
// (database URL, Supabase service key, HMAC keys). Privileged API routes detect
// their absence and transparently proxy to the authoritative cloud deployment.
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || "http://localhost:3000/admin/portal";
process.env.PENRX_CLOUD_API_URL = process.env.PENRX_CLOUD_API_URL || "https://pen-rx.vercel.app";
process.env.PENRX_DESKTOP_RUNTIME = "1";
process.env.NEXT_TELEMETRY_DISABLED = "1";

function resolveAppDir() {
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, "app.asar"));
    candidates.push(path.join(process.resourcesPath, "app.asar.unpacked"));
    candidates.push(path.join(process.resourcesPath, "app"));
  }
  candidates.push(path.resolve(__dirname, ".."));
  candidates.push(process.cwd());

  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(path.join(dir, ".next"))) {
        return dir;
      }
      const unpackedDir = String(dir || "").replace(/app\.asar([\\/]|$)/, "app.asar.unpacked$1");
      if (unpackedDir !== dir && fs.existsSync(path.join(unpackedDir, ".next"))) {
        return unpackedDir;
      }
    } catch {}
  }
  return path.resolve(__dirname, "..");
}

const appDir = resolveAppDir();
const preferredPort = parseInt(process.env.PORT, 10) || 3000;

if (process.resourcesPath) {
  const asarModules = path.join(process.resourcesPath, "app.asar", "node_modules");
  if (!module.paths.includes(asarModules)) {
    module.paths.unshift(asarModules);
  }
}

let next;
try {
  next = require("next");
} catch (e) {
  console.error("Failed to load next module:", e);
  process.exit(1);
}

const app = next({
  dev: false,
  dir: appDir,
});

const handle = app.getRequestHandler();

console.log(`[PenRX+ Server] Initializing production Next.js engine from ${appDir}...`);

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      if (req.url === "/__penrx_health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, app: "PenRX+" }));
        return;
      }
      handle(req, res);
    });

    server.listen(preferredPort, "127.0.0.1", () => {
      const actualPort = server.address().port || preferredPort;
      process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${actualPort}`;
      console.log(`[PenRX+ Server] Ready on http://localhost:${actualPort}`);
      if (process.send) {
        process.send({ status: "ready", port: actualPort });
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`[PenRX+ Server] Port ${preferredPort} in use, picking available port...`);
        server.listen(0, "127.0.0.1", () => {
          const dynamicPort = server.address().port;
          process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${dynamicPort}`;
          console.log(`[PenRX+ Server] Ready on dynamic port http://localhost:${dynamicPort}`);
          if (process.send) {
            process.send({ status: "ready", port: dynamicPort });
          }
        });
      } else {
        console.error("[PenRX+ Server] Fatal Server Error:", err);
        if (process.send) {
          process.send({ status: "error", error: err.message });
        }
      }
    });
  })
  .catch((err) => {
    console.error("[PenRX+ Server] Prepare Error:", err);
    if (process.send) {
      process.send({ status: "error", error: err.message });
    }
    process.exit(1);
  });
