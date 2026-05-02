"use client";

import { useEffect, useState } from "react";
import AuthPage from "@/app/components/pages/AuthPage";
import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import { createOnlineRoom, getOnlineRooms, joinOnlineRoom, supabase, type OnlineRoom } from "@/app/lib/supabase";
import { getRoomSocket, normalizeRoomCode, type SocketRoom } from "@/app/lib/socketRooms";

const onlineModes = [
  { value: "classic", label: "Classic" },
  { value: "switch_places", label: "Switch Places" },
  { value: "2v2", label: "2v2 Team" },
  { value: "fog_of_war", label: "Fog of War" },
  { value: "chaos_mode", label: "Chaos Mode" },
  { value: "speed_chess", label: "Speed Chess" },
];

type DisplayRoom = OnlineRoom | SocketRoom;

export default function OnlineRoomsPage() {
  const { user, profile, loading } = useAuthProfile();
  const [rooms, setRooms] = useState<DisplayRoom[]>([]);
  const [mode, setMode] = useState("classic");
  const [difficulty, setDifficulty] = useState("Medium");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [socketState, setSocketState] = useState("Connecting backend WebSocket...");

  useEffect(() => {
    let alive = true;

    async function loadRooms() {
      const { rooms, error } = await getOnlineRooms();
      if (!alive) {
        return;
      }
      setRooms(rooms);
      if (error) {
        setError("Rooms table is not ready in Supabase yet, showing a local demo room.");
      }
    }

    loadRooms();

    const socket = getRoomSocket();
    const handleConnect = () => setSocketState("Backend WebSocket connected.");
    const handleDisconnect = () => setSocketState("Backend WebSocket offline, Supabase fallback is still available.");
    const handleRooms = (socketRooms: SocketRoom[]) => {
      setRooms(socketRooms);
      setError("");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("rooms:list", handleRooms);
    socket.emit("rooms:list");

    const client = supabase;

    if (!client) {
      return () => {
        alive = false;
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("rooms:list", handleRooms);
      };
    }

    const channel = client
      .channel("public-game-rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms" }, () => loadRooms())
      .subscribe();

    return () => {
      alive = false;
      client.removeChannel(channel);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("rooms:list", handleRooms);
    };
  }, []);

  if (loading) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading rooms...</main>;
  }

  if (!user) {
    return <AuthPage />;
  }

  async function handleCreateRoom() {
    if (!user) {
      return;
    }

    setBusy(true);
    setError("");
    const socket = getRoomSocket();

    if (socket.connected) {
      const response = await new Promise<{ room?: SocketRoom; seat?: string; error?: string }>((resolve) => {
        socket.timeout(3500).emit(
          "rooms:create",
          {
            userId: user.id,
            gameMode: mode,
            difficulty,
            isPrivate,
          },
          (err: Error | null, value: { room?: SocketRoom; seat?: string; error?: string }) => resolve(err ? { error: err.message } : value),
        );
      });
      setBusy(false);

      if (response.error || !response.room) {
        setError(response.error || "Backend WebSocket room was not created.");
        return;
      }

      window.location.href = `/game/online/${response.room.code}`;
      return;
    }

    const { roomId, error } = await createOnlineRoom({ userId: user.id, user, gameMode: mode, difficulty, isPrivate, password });
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = `/game/online/${roomId}`;
  }

  async function handleJoin(room: DisplayRoom) {
    if (!user) {
      return;
    }

    setBusy(true);
    setError("");
    const code = "code" in room ? room.code : room.id;
    const gameMode = "gameMode" in room ? room.gameMode : room.game_mode;
    const socket = getRoomSocket();

    if (socket.connected && "code" in room) {
      const response = await new Promise<{ room?: SocketRoom; seat?: string; error?: string }>((resolve) => {
        socket.timeout(3500).emit("rooms:join", { roomId: code, userId: user.id }, (err: Error | null, value: { room?: SocketRoom; seat?: string; error?: string }) => resolve(err ? { error: err.message } : value));
      });
      setBusy(false);

      if (response.error) {
        setError(response.error);
        return;
      }

      window.location.href = `/game/online/${code}`;
      return;
    }

    const { error } = await joinOnlineRoom(room.id, user.id, gameMode === "2v2" ? "white_b" : "black");
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = `/game/online/${room.id}`;
  }

  async function joinByCode() {
    if (!user) {
      return;
    }

    const code = normalizeRoomCode(joinCode);
    if (!code) {
      setError("Enter a room code first.");
      return;
    }

    setBusy(true);
    const socket = getRoomSocket();
    const response = await new Promise<{ room?: SocketRoom; seat?: string; error?: string }>((resolve) => {
      socket.timeout(3500).emit("rooms:join", { roomId: code, userId: user.id }, (err: Error | null, value: { room?: SocketRoom; seat?: string; error?: string }) => resolve(err ? { error: err.message } : value));
    });
    setBusy(false);

    if (response.error) {
      setError(response.error);
      return;
    }

    window.location.href = `/game/online/${code}`;
  }

  return (
    <main className="cm-page min-h-screen p-4 text-white">
      <div className="mx-auto max-w-7xl">
        <nav className="cm-panel mb-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="font-black tracking-[0.18em]">♛ CHAOSMATE</a>
          <div className="flex items-center gap-3 text-sm text-white/60">
            <span>{profile?.username || "Player"}</span>
            <a href="/" className="rounded-md border border-white/10 px-3 py-2 hover:text-white">
              Home
            </a>
          </div>
        </nav>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="cm-panel h-fit p-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">Online</p>
            <h1 className="mt-2 text-3xl font-black">Create Room</h1>
            <p className="mt-2 text-sm text-[#86efac]">{socketState}</p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm text-white/55">Mode</span>
                <select value={mode} onChange={(event) => setMode(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-[#0f172a] px-3 py-3 text-white">
                  {onlineModes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-white/55">Difficulty / pace</span>
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-[#0f172a] px-3 py-3 text-white">
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Bullet 30s</option>
                  <option>Blitz 3m</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 p-3">
                <input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} />
                <span>Private room</span>
              </label>
              {isPrivate && (
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Room password"
                  className="w-full rounded-md border border-white/10 bg-[#0f172a] px-3 py-3 text-white placeholder:text-white/35"
                />
              )}
              <button onClick={handleCreateRoom} disabled={busy} className="cm-button w-full px-4 py-3 font-black disabled:opacity-50">
                {busy ? "Working..." : "+ Create Backend Room"}
              </button>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Join by code</p>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="3MSWM9" className="rounded-md border border-white/10 bg-[#0f172a] px-3 py-3 font-mono text-white placeholder:text-white/25" />
                  <button onClick={joinByCode} disabled={busy} className="rounded-md bg-[#b8ff38] px-4 py-3 font-black text-black disabled:opacity-45">
                    Join
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Available Rooms</h2>
                <p className="mt-1 text-sm text-white/48">Create a room, share the link, or join a waiting player.</p>
              </div>
            </div>
            {error && <p className="mb-4 rounded-md border border-amber-300/35 bg-amber-300/12 p-3 text-sm text-amber-100">{error}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={() => handleJoin(room)} busy={busy} />
              ))}
              {!rooms.length && <div className="cm-panel p-6 text-white/56">No public rooms yet. Create the first one.</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RoomCard({ room, onJoin, busy }: { room: DisplayRoom; onJoin: () => void; busy: boolean }) {
  const currentPlayers = "currentPlayers" in room ? room.currentPlayers : room.current_players;
  const maxPlayers = "maxPlayers" in room ? room.maxPlayers : room.max_players;
  const gameMode = "gameMode" in room ? room.gameMode : room.game_mode;
  const difficulty = room.difficulty || "Any";
  const full = currentPlayers >= maxPlayers;

  return (
    <div className="cm-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-[#d4af37]">{gameMode.replace(/_/g, " ").toUpperCase()}</h3>
          <p className="mt-1 text-sm text-white/42">Room {("code" in room ? room.code : room.id.slice(0, 8)).toUpperCase()}</p>
        </div>
        {"is_private" in room && room.is_private && <span className="rounded bg-red-500/20 px-2 py-1 text-xs font-bold text-red-100">PRIVATE</span>}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <Info label="Players" value={`${currentPlayers}/${maxPlayers}`} />
        <Info label="Pace" value={difficulty || "Any"} />
        <Info label="Status" value={room.status} />
      </div>
      <button onClick={onJoin} disabled={busy || full || room.status !== "waiting"} className="cm-button mt-5 w-full px-4 py-3 font-black disabled:opacity-45">
        {full ? "Full" : "Join"}
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 truncate font-bold text-white">{value}</p>
    </div>
  );
}
