"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("socket-client can only be used on client");
  }
  if (!socket) {
    socket = io({
      autoConnect: true,
      transports: ["websocket", "polling"]
    });
  }
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
