const path = require("path");
const http = require("http");

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
