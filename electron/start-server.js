const path = require("path");
const fs = require("fs");
const http = require("http");
const { parse } = require("url");

function resolvePhysicalAppDir(explicitDir) {
  if (explicitDir && !String(explicitDir).includes(".asar") && fs.existsSync(path.join(explicitDir, ".next", "BUILD_ID"))) {
    return explicitDir;
  }

  const candidates = [
    path.join(__dirname, ".."),
    process.resourcesPath ? path.join(process.resourcesPath, "app") : "",
    process.resourcesPath ? path.join(process.resourcesPath, "app.asar.unpacked") : "",
  ].filter(Boolean);

  for (const dir of candidates) {
    if (!dir.includes(".asar") || dir.includes(".asar.unpacked")) {
      if (fs.existsSync(path.join(dir, ".next", "BUILD_ID"))) {
        return dir;
      }
    }
  }
  return null;
}

/**
 * Starts the Next.js production server in-process without spawning any child processes
 * (preventing `spawn PenRX+.exe ENOENT` on Windows) and only resolves once Next.js
 * is 100% prepared (preventing the 503 black screen).
 */
function startInProcessServer(options = {}) {
  const port = parseInt(options.port || process.env.PORT || "3000", 10);
  const appDir = resolvePhysicalAppDir(options.appDir);

  if (!appDir) {
    return Promise.reject(new Error("Physical .next build directory not found on disk"));
  }

  return new Promise((resolve, reject) => {
    let server = null;
    let isNextReady = false;
    let handle = null;

    try {
      const next = require("next");
      const nextApp = next({
        dev: false,
        dir: appDir,
        hostname: "127.0.0.1",
        port,
      });

      const preparePromise = nextApp.prepare().then(() => {
        handle = nextApp.getRequestHandler();
        isNextReady = true;
      });

      server = http.createServer(async (req, res) => {
        try {
          if (req.url === "/__penrx_health") {
            if (isNextReady && handle) {
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("OK");
            } else {
              res.writeHead(503, { "Content-Type": "text/plain" });
              res.end("STARTING");
            }
            return;
          }

          if (!isNextReady || !handle) {
            await preparePromise;
          }

          const parsedUrl = parse(req.url, true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error("[PenRX+ Server] Request error:", err);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Internal Server Error");
          }
        }
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve({ port, url: `http://localhost:${port}`, server: null });
          return;
        }
        reject(err);
      });

      preparePromise
        .then(() => {
          server.listen(port, "127.0.0.1", () => {
            if (typeof process.send === "function") {
              try {
                process.send({ status: "ready", port });
              } catch {}
            }
            resolve({ port, url: `http://localhost:${port}`, server });
          });
        })
        .catch((err) => {
          try {
            if (server) server.close();
          } catch {}
          reject(err);
        });
    } catch (err) {
      try {
        if (server) server.close();
      } catch {}
      reject(err);
    }
  });
}

if (require.main === module) {
  startInProcessServer().catch((err) => {
    console.error("[PenRX+ Server] Standalone startup failed:", err.message);
    process.exit(1);
  });
}

module.exports = {
  startInProcessServer,
  resolvePhysicalAppDir,
};
