import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./game-manager";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initSocketServer(httpServer: HttpServer) {
  if (io) return io;

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socketio",
    serveClient: false,
  });

  setupSocketHandlers(io as unknown as Server);
  console.log("Socket.io server initialized");
  return io;
}

export function getIO() {
  return io;
}
