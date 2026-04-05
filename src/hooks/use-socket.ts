"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

/**
 * Estimated offset = serverTime - clientTime.
 * Add this to Date.now() to approximate the server's clock.
 * Shared across all hook consumers.
 */
let serverOffset = 0;

function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io({
      path: "/api/socketio",
      transports: ["websocket"],
    });
  }
  return globalSocket;
}

/** Convert a server-side deadline to local clock */
export function toLocalDeadline(serverDeadline: number): number {
  return serverDeadline - serverOffset;
}

export function useSocket() {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const samplesRef = useRef<number[]>([]);

  const doSync = useCallback((s: TypedSocket) => {
    (s as Socket).emit("time:sync", { clientTime: Date.now() });
  }, []);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    function onConnect() {
      setIsConnected(true);
      // Start time sync: send 3 pings quickly, then once every 30s
      samplesRef.current = [];
      doSync(s);
      let quickCount = 0;
      const quickInterval = setInterval(() => {
        quickCount++;
        doSync(s);
        if (quickCount >= 2) clearInterval(quickInterval);
      }, 500);

      syncInterval.current = setInterval(() => doSync(s), 30_000);
    }

    function onDisconnect() {
      setIsConnected(false);
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
        syncInterval.current = null;
      }
    }

    // Listen for sync responses
    (s as Socket).on("time:sync", ({ clientTime, serverTime }: { clientTime: number; serverTime: number }) => {
      const now = Date.now();
      const rtt = now - clientTime;
      // Estimate: server's clock at the time it processed = serverTime
      // The message took roughly rtt/2 to go and rtt/2 to come back
      // So at clientTime + rtt/2, the server said serverTime
      // offset = serverTime - (clientTime + rtt/2)
      const offset = serverTime - (clientTime + rtt / 2);
      samplesRef.current.push(offset);
      // Keep last 5 samples, use median for stability
      if (samplesRef.current.length > 5) samplesRef.current.shift();
      const sorted = [...samplesRef.current].sort((a, b) => a - b);
      serverOffset = sorted[Math.floor(sorted.length / 2)];
    });

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // If already connected (e.g. hot reload)
    if (s.connected) {
      setIsConnected(true);
      doSync(s);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      (s as Socket).off("time:sync");
      if (syncInterval.current) {
        clearInterval(syncInterval.current);
        syncInterval.current = null;
      }
    };
  }, [doSync]);

  return { socket, isConnected };
}
