"use client";

import { io, type Socket } from "socket.io-client";

export type SocketRoom = {
  id: string;
  code: string;
  gameMode: string;
  difficulty: string;
  maxPlayers: number;
  currentPlayers: number;
  players?: Array<{
    userId: string;
    seat: string;
  }>;
  status: "waiting" | "playing" | "finished";
  fen?: string | null;
  movesPgn?: string | null;
  movesSan?: string | null;
  result?: string | null;
  createdAt: string;
};

let socket: Socket | null = null;

export function getRoomSocket() {
  if (socket) {
    return socket;
  }

  const url = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window === "undefined" ? "http://localhost:3010" : window.location.origin);
  socket = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  return socket;
}

export function normalizeRoomCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
