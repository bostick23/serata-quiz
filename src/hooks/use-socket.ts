"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

/**
 * Estimated offset = serverTime - clientTime.
 * Add this to Date.now() to approximate the server's clock.
 * Shared across all hook consumers.
 */
let serverOffset = 0;
const offsetSamples: number[] = [];

function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io({
      path: "/api/socketio",
      // WebSocket first; fall back to long-polling on networks that block WebSockets.
      transports: ["websocket", "polling"],
      tryAllTransports: true,
    });
  }
  return globalSocket;
}

/** Convert a server-side deadline to local clock */
export function toLocalDeadline(serverDeadline: number): number {
  return serverDeadline - serverOffset;
}

function onTimeSync({ clientTime, serverTime }: { clientTime: number; serverTime: number }) {
  const rtt = Date.now() - clientTime;
  // The server answered roughly rtt/2 after the ping left: offset = serverTime - (clientTime + rtt/2)
  offsetSamples.push(serverTime - (clientTime + rtt / 2));
  // Keep last 5 samples, use median for stability
  if (offsetSamples.length > 5) offsetSamples.shift();
  const sorted = [...offsetSamples].sort((a, b) => a - b);
  serverOffset = sorted[Math.floor(sorted.length / 2)];
}

export function useSocket() {
  const [socket] = useState<TypedSocket | null>(() => (typeof window === "undefined" ? null : getSocket()));
  const [isConnected, setIsConnected] = useState(() => socket?.connected ?? false);

  useEffect(() => {
    if (!socket) return;
    const timers: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> = [];
    const sync = () => socket.emit("time:sync", { clientTime: Date.now() });

    function startSync() {
      // 3 quick pings, then one every 30s
      sync();
      timers.push(setTimeout(sync, 500), setTimeout(sync, 1000), setInterval(sync, 30_000));
    }
    function stopSync() {
      for (const t of timers.splice(0)) clearTimeout(t);
    }
    function onConnect() {
      setIsConnected(true);
      stopSync();
      startSync();
    }
    function onDisconnect() {
      setIsConnected(false);
      stopSync();
    }

    socket.on("time:sync", onTimeSync);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off("time:sync", onTimeSync);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      stopSync();
    };
  }, [socket]);

  return { socket, isConnected };
}
