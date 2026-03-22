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
    // Skip Socket.io paths — they are handled by Socket.io's own listener
    if (req.url?.startsWith("/api/socketio")) {
      return;
    }
    handle(req, res);
  });

  // Socket.io attaches its own request listener to httpServer
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Serata Quiz ready on http://localhost:${port}`);
  });
});
