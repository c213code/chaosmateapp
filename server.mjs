import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3010);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map();

function publicRoom(room) {
  return {
    id: room.id,
    code: room.code,
    gameMode: room.gameMode,
    difficulty: room.difficulty,
    maxPlayers: room.maxPlayers,
    currentPlayers: room.players.length,
    status: room.status,
    fen: room.fen,
    movesPgn: room.movesPgn,
    movesSan: room.movesSan,
    result: room.result,
    createdAt: room.createdAt,
  };
}

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return rooms.has(code) ? createCode() : code;
}

await app.prepare();

const httpServer = createServer((req, res) => handle(req, res));
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

function emitRooms() {
  io.emit(
    "rooms:list",
    [...rooms.values()].filter((room) => !room.isPrivate && room.status !== "finished").map(publicRoom),
  );
}

io.on("connection", (socket) => {
  socket.emit("rooms:list", [...rooms.values()].filter((room) => !room.isPrivate && room.status !== "finished").map(publicRoom));

  socket.on("rooms:create", (payload = {}, callback) => {
    const code = createCode();
    const gameMode = payload.gameMode || "classic";
    const room = {
      id: code,
      code,
      gameMode,
      difficulty: payload.difficulty || "Medium",
      isPrivate: Boolean(payload.isPrivate),
      maxPlayers: gameMode === "2v2" ? 4 : 2,
      players: [{ socketId: socket.id, userId: payload.userId || socket.id, seat: "white" }],
      status: "waiting",
      fen: null,
      movesPgn: "",
      movesSan: "",
      result: null,
      createdAt: new Date().toISOString(),
    };

    rooms.set(code, room);
    socket.join(code);
    callback?.({ room: publicRoom(room), seat: "white" });
    emitRooms();
  });

  socket.on("rooms:join", (payload = {}, callback) => {
    const code = String(payload.roomId || payload.code || "").toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    let player = room.players.find((item) => item.userId === payload.userId);
    if (!player) {
      if (room.players.length >= room.maxPlayers) {
        callback?.({ error: "Room is full" });
        return;
      }

      const seat = room.gameMode === "2v2" ? ["white_a", "white_b", "black_a", "black_b"][room.players.length] : room.players.length === 0 ? "white" : "black";
      player = { socketId: socket.id, userId: payload.userId || socket.id, seat };
      room.players.push(player);
    } else {
      player.socketId = socket.id;
    }

    room.status = room.players.length >= room.maxPlayers ? "playing" : "waiting";
    socket.join(code);
    callback?.({ room: publicRoom(room), seat: player.seat });
    io.to(code).emit("rooms:update", publicRoom(room));
    emitRooms();
  });

  socket.on("game:sync", (payload = {}) => {
    const room = rooms.get(String(payload.roomId || "").toUpperCase());
    if (room) {
      socket.emit("game:state", publicRoom(room));
    }
  });

  socket.on("game:move", (payload = {}) => {
    const room = rooms.get(String(payload.roomId || "").toUpperCase());
    if (!room) {
      return;
    }

    room.fen = payload.fen || room.fen;
    room.movesPgn = payload.movesPgn || room.movesPgn;
    room.movesSan = payload.movesSan || room.movesSan;
    room.result = payload.result || null;
    room.status = payload.status || room.status || "playing";
    io.to(room.code).emit("game:state", publicRoom(room));
    emitRooms();
  });
});

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use.`);
    console.error(`Stop the old server or run with another port: PORT=3011 npm run dev`);
    process.exit(1);
  }

  throw error;
});

httpServer.listen(port, hostname, () => {
  console.log(`ChaosMate ready on http://${hostname}:${port}`);
  console.log(`Backend WebSocket ready on ws://${hostname}:${port}/socket.io`);
});
