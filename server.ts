import { config } from "dotenv";
config({ path: ".env.local" });

import { createServer } from "http";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const { initSocketServer } = await import("./src/lib/socket/server");

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  // Socket.io attaches to httpServer and handles WebSocket upgrades
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Serata Quiz ready on http://localhost:${port}`);
  });
});
