const path = require("path");
const http = require("http");

// Inject production defaults for standalone Electron desktop runtime
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:3060630@db.qspaigplwyvpqbmszpgc.supabase.co:5432/postgres";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qspaigplwyvpqbmszpgc.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTA1NDMsImV4cCI6MjEwNTE2NjU0M30.um74vP21e9C7lXeInvY4AsUCWsjyzlwSogLXP7b_Fkc";
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || "http://localhost:3000/admin/portal";
process.env.PENRX_SECRET_KEY = process.env.PENRX_SECRET_KEY || "d1132b51b81d261f94fc6fa2edb1292b534a75bdc8ce10ec8d0e3c00efe843b4";
process.env.PENRX_ADMIN_SECRET = process.env.PENRX_ADMIN_SECRET || "e9cd3b8092032e1bd922701017d04496314298dde190bac6244e0f9f99d60e92";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MDU0MywiZXhwIjoyMTA1MTY2NTQzfQ.gJ9ArhmjkAf2tQmqZbvA88hJmDaz6EYgf2RdJfl6RCE";
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
