const path = require("path");
const http = require("http");

// The packaged desktop runtime intentionally ships WITHOUT server-side secrets
// (database URL, Supabase service key, HMAC keys). Privileged API routes detect
// their absence and transparently proxy to the authoritative cloud deployment.
// Secret values are never embedded in the distributed installer.
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || "http://localhost:3000/admin/portal";
process.env.PENRX_CLOUD_API_URL = process.env.PENRX_CLOUD_API_URL || "https://pen-rx.vercel.app";
process.env.PENRX_DESKTOP_RUNTIME = "1";
process.env.NEXT_TELEMETRY_DISABLED = "1";

const appDir = path.resolve(__dirname, "..");
const port = parseInt(process.env.PORT, 10) || 3000;

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

console.log("[PenRX+ Server] Initializing production Next.js engine...");

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(`[PenRX+ Server] Ready on http://localhost:${port}`);
      if (process.send) {
        process.send({ status: "ready", port });
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`[PenRX+ Server] Port ${port} in use, picking available port...`);
        server.listen(0, "127.0.0.1", () => {
          const dynamicPort = server.address().port;
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
