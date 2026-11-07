import type { Server as HttpServer, IncomingMessage } from "http";
import type { Duplex } from "stream";
import { Server } from "socket.io";
import { createGameManager, type GameIO, type GameManager } from "./game-manager";
import { authenticateFromCookie } from "./auth";
import { firestoreGameStore } from "./firestore-game-store";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/types/socket-events";

let io: GameIO | null = null;
let manager: GameManager | null = null;

const SOCKET_PATH = "/api/socketio";

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io;

  io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    path: SOCKET_PATH,
    addTrailingSlash: false,
    // WebSocket first, long-polling as fallback for networks that block WebSockets (single instance: no sticky sessions needed).
    transports: ["websocket", "polling"],
    serveClient: false,
    // Faster detection of dead connections than the 25s + 20s defaults.
    pingInterval: 10_000,
    pingTimeout: 10_000,
    // Brief disconnections (screen lock, Wi-Fi <-> 4G) restore rooms, socket.data and missed events.
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: true },
    // Team photos are ~10 KB; nothing legitimate comes close to this.
    maxHttpBufferSize: 200_000,
    // No CORS: the app and the socket are served from the same origin.
  });

  // Socket.io hijacks ALL upgrade events by default, killing Next.js HMR.
  // Remove its upgrade listener and replace with a selective one.
  const upgradeListeners = httpServer.listeners("upgrade") as Array<(req: IncomingMessage, socket: Duplex, head: Buffer) => void>;
  httpServer.removeAllListeners("upgrade");
  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (req.url?.startsWith(SOCKET_PATH)) {
      io!.engine.handleUpgrade(req as Parameters<GameIO["engine"]["handleUpgrade"]>[0], socket, head);
    } else {
      for (const listener of upgradeListeners) {
        listener.call(httpServer, req, socket, head);
      }
    }
  });

  manager = createGameManager(io, { store: firestoreGameStore, authenticate: authenticateFromCookie });
  console.log("Socket.io server initialized");
  return io;
}

export function getGameManager() {
  return manager;
}

/** Notifies connected clients, flushes pending writes and closes Socket.io. */
export async function shutdownSocketServer() {
  if (!io) return;
  io.emit("error", { message: "Il server si sta riavviando: la partita riprenderà tra pochi secondi." });
  await manager?.shutdown();
  await new Promise<void>(resolve => io!.close(() => resolve()));
  io = null;
  manager = null;
}
