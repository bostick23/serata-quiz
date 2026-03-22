import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./game-manager";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io;

  // Attach Socket.io to httpServer (this creates the engine)
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socketio",
    addTrailingSlash: false,
    transports: ["websocket"],
    serveClient: false,
  });

  // Socket.io hijacks ALL upgrade events by default, killing Next.js HMR.
  // Remove its upgrade listener and replace with a selective one.
  const upgradeListeners = httpServer.listeners("upgrade");
  httpServer.removeAllListeners("upgrade");
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/socketio")) {
      // Let Socket.io handle its own upgrades
      io!.engine.handleUpgrade(req, socket, head);
    } else {
      // Let Next.js HMR and other upgrades through
      for (const listener of upgradeListeners) {
        listener.call(httpServer, req, socket, head);
      }
    }
  });

  setupSocketHandlers(io as unknown as Server);
  console.log("Socket.io server initialized");
  return io;
}

export function getIO() {
  return io;
}
