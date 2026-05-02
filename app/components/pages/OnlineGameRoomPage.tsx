"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";
import VariantChessGame from "@/app/components/game/VariantChessGame";
import { getOnlineRoom, joinOnlineRoom, supabase, type OnlineRoom, type RoomPlayer } from "@/app/lib/supabase";
import type { GameMode } from "@/app/lib/chess-platform";

const routeModeByRoomMode: Record<string, Exclude<GameMode, "classic-ai" | "online">> = {
  classic: "local",
  switch_places: "switch",
  "2v2": "team",
  fog_of_war: "fog",
  chaos_mode: "chaos",
  speed_chess: "speed",
};

export default function OnlineGameRoomPage({ roomId }: { roomId: string }) {
  const { user, profile, setProfile, loading } = useAuthProfile();
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [message, setMessage] = useState("Loading room...");

  const shareUrl = useMemo(() => (typeof window === "undefined" ? "" : window.location.href), []);

  useEffect(() => {
    let alive = true;

    async function loadRoom() {
      const { room, players, error } = await getOnlineRoom(roomId);
      if (!alive) {
        return;
      }

      if (error) {
        setMessage(error.message);
      }

      setRoom(room);
      setPlayers(players);
      setMessage(room ? "Room ready." : "Room not found.");
    }

    loadRoom();

    const client = supabase;

    if (!client) {
      return () => {
        alive = false;
      };
    }

    const channel = client
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` }, () => loadRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, () => loadRoom())
      .subscribe();

    return () => {
      alive = false;
      client.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading online game...</main>;
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!profile) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading profile...</main>;
  }

  async function joinRoom() {
    if (!user || !room) {
      return;
    }

    const { error } = await joinOnlineRoom(room.id, user.id, room.game_mode === "2v2" ? nextTeamSeat(players.length) : "black");
    setMessage(error ? error.message : "Joined room.");
  }

  const variantMode = routeModeByRoomMode[room?.game_mode || "classic"] || "local";
  const currentSeat = players.find((player) => player.user_id === user.id)?.team || (room?.created_by === user.id ? "white" : null);
  const playerColor = currentSeat?.startsWith("black") ? "b" : currentSeat?.startsWith("white") || room?.created_by === user.id ? "w" : null;
  const joined = Boolean(currentSeat);
  const full = Number(room?.current_players || players.length) >= Number(room?.max_players || 2);

  return (
    <main className="cm-page min-h-screen text-white">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e27]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/game/rooms" className="font-black tracking-[0.18em]">
            ♛ ONLINE ROOM
          </a>
          <button
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="rounded-md border border-[#d4af37]/35 bg-[#d4af37]/10 px-3 py-2 text-sm font-bold text-[#f7d96b]"
          >
            Copy Link
          </button>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="cm-panel mb-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">Realtime room</p>
              <h1 className="mt-2 text-3xl font-black">{room?.game_mode?.replace(/_/g, " ").toUpperCase() || "Online Game"}</h1>
              <p className="mt-2 text-sm text-white/55">{message}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/65">
                {room?.current_players || players.length}/{room?.max_players || 2} players
              </span>
              <button onClick={joinRoom} disabled={joined || full} className="cm-button px-4 py-2 font-black disabled:opacity-45">
                {joined ? `You are ${playerColor === "w" ? "White" : "Black"}` : full ? "Room full" : "Join Room"}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {(room?.game_mode === "2v2" ? ["white_a", "white_b", "black_a", "black_b"] : ["white", "black"]).map((seat, index) => (
              <div key={seat} className="rounded-md border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-white/36">{seat.replace("_", " ")}</p>
                <p className="mt-1 truncate font-bold">{players[index]?.user_id ? `Player ${index + 1}` : "Waiting..."}</p>
              </div>
            ))}
          </div>
        </section>

        <VariantChessGame mode={variantMode} user={user} profile={profile} setProfile={setProfile} onlineRoomId={roomId} onlinePlayerColor={playerColor || undefined} />
      </div>
    </main>
  );
}

function nextTeamSeat(count: number) {
  return ["white_a", "white_b", "black_a", "black_b"][Math.min(count, 3)];
}
