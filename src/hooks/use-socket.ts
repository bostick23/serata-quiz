"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types/socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io({
      path: "/api/socketio",
      transports: ["websocket"],
    });
  }
  return globalSocket;
}

export function useSocket() {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // If already connected (e.g. hot reload)
    if (s.connected) {
      setIsConnected(true);
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  return { socket, isConnected };
}
