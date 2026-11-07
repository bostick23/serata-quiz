import { config } from "dotenv";
// Local development only: in production the platform provides the environment.
if (process.env.NODE_ENV !== "production") config({ path: ".env.local" });

import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Last-resort safety net: log instead of letting a stray rejection take down every running game.
process.on("unhandledRejection", reason => {
  console.error("[Process] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", err => {
  console.error("[Process] Uncaught exception:", err);
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const { initSocketServer, getGameManager, shutdownSocketServer } = await import("./src/lib/socket/server");

  const httpServer = createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()), activeGames: getGameManager()?.activeGameCount() ?? 0 }));
      return;
    }
    handle(req, res);
  });

  // Socket.io attaches to httpServer and handles WebSocket upgrades
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Serata Quiz ready on http://localhost:${port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Process] ${signal} received: shutting down gracefully`);
    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();
    try {
      await shutdownSocketServer();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    } catch (err) {
      console.error("[Process] Error during shutdown:", err);
    }
    process.exit(0);
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
});
