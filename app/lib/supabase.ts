import { createClient } from "@supabase/supabase-js";
import { START_FEN } from "@/app/lib/gameLogic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export function getRoomUrl(roomId: string) {
  if (typeof window === "undefined") {
    return `/game/${roomId}`;
  }

  return `${window.location.origin}?room=${roomId}`;
}

export type LocalGameResult = "white_win" | "black_win" | "draw" | "resigned";

export type LocalGameRow = {
  id: string;
  mode: "local_multiplayer";
  white_player_id: string | null;
  black_player_id: string | null;
  fen: string;
  moves_pgn: string;
  moves_san: string;
  result: LocalGameResult | null;
  status: "waiting_for_opponent" | "active" | "finished" | "abandoned";
  draw_offered_by: string | null;
  started_at: string;
  ended_at: string | null;
};

export type OnlineRoom = {
  id: string;
  created_by: string;
  game_mode: string;
  difficulty: string | null;
  is_private: boolean;
  password?: string | null;
  max_players: number;
  current_players: number;
  status: "waiting" | "playing" | "finished";
  fen?: string | null;
  moves_pgn?: string | null;
  moves_san?: string | null;
  result?: string | null;
  created_at: string;
  started_at?: string | null;
  ended_at?: string | null;
  creator?: { username?: string } | null;
};

export type RoomPlayer = {
  id: string;
  room_id: string;
  user_id: string;
  team: string | null;
  joined_at: string;
};

export async function getOnlineRooms() {
  if (!supabase) {
    return {
      rooms: demoRooms(),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("status", "waiting")
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (error) {
    return { rooms: demoRooms(), error };
  }

  return { rooms: (data || []) as OnlineRoom[], error: null };
}

export async function createOnlineRoom({
  userId,
  gameMode,
  difficulty,
  isPrivate,
  password,
}: {
  userId: string;
  gameMode: string;
  difficulty?: string;
  isPrivate: boolean;
  password?: string;
}) {
  const roomId = crypto.randomUUID();
  const maxPlayers = gameMode === "2v2" ? 4 : 2;

  if (!supabase) {
    return { roomId, room: null, error: null };
  }

  const { data, error } = await supabase
    .from("game_rooms")
    .insert({
      id: roomId,
      created_by: userId,
      game_mode: gameMode,
      difficulty: difficulty || null,
      is_private: isPrivate,
      password: isPrivate ? password || null : null,
      max_players: maxPlayers,
      current_players: 1,
      status: "waiting",
    })
    .select("*")
    .single();

  if (error) {
    return { roomId, room: null, error };
  }

  await supabase.from("room_players").insert({
    room_id: data.id,
    user_id: userId,
    team: gameMode === "2v2" ? "white_a" : "white",
  });

  return { roomId: data.id as string, room: data as OnlineRoom, error: null };
}

export async function joinOnlineRoom(roomId: string, userId: string, team = "black") {
  if (!supabase) {
    return { error: null };
  }

  const { data: room, error: loadError } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();

  if (loadError) {
    return { error: loadError };
  }

  if (!room) {
    return { error: new Error("Room not found") };
  }

  if (room.current_players >= room.max_players) {
    return { error: new Error("Room is full") };
  }

  const { error: playerError } = await supabase.from("room_players").upsert(
    {
      room_id: roomId,
      user_id: userId,
      team,
    },
    { onConflict: "room_id,user_id" },
  );

  if (playerError) {
    return { error: playerError };
  }

  const nextCount = Math.min(Number(room.current_players || 1) + 1, Number(room.max_players || 2));
  const { error } = await supabase
    .from("game_rooms")
    .update({
      current_players: nextCount,
      status: nextCount >= Number(room.max_players || 2) ? "playing" : "waiting",
      started_at: nextCount >= Number(room.max_players || 2) ? new Date().toISOString() : room.started_at,
    })
    .eq("id", roomId);

  return { error };
}

export async function getOnlineRoom(roomId: string) {
  if (!supabase) {
    return { room: demoRooms().find((room) => room.id === roomId) || demoRooms()[0], players: [], error: null };
  }

  const { data: room, error } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();
  const { data: players } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("joined_at", { ascending: true });

  return { room: room as OnlineRoom | null, players: (players || []) as RoomPlayer[], error };
}

function demoRooms(): OnlineRoom[] {
  return [
    {
      id: "demo-classic-room",
      created_by: "demo",
      game_mode: "classic",
      difficulty: "Medium",
      is_private: false,
      max_players: 2,
      current_players: 1,
      status: "waiting",
      created_at: new Date().toISOString(),
    },
  ];
}

export async function createLocalMultiplayerGame(userId: string) {
  if (!supabase) {
    return { gameId: crypto.randomUUID(), game: null, error: null };
  }

  const { data, error } = await supabase
    .from("games")
    .insert({
      mode: "local_multiplayer",
      white_player_id: userId,
      black_player_id: null,
      ai_opponent: false,
      fen: START_FEN,
      moves_pgn: "",
      moves_san: "",
      status: "waiting_for_opponent",
      result: null,
      draw_offered_by: null,
    })
    .select("*")
    .single();

  return {
    gameId: data?.id as string | undefined,
    game: data as LocalGameRow | null,
    error,
  };
}

export async function joinLocalMultiplayerGame(gameId: string) {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase
    .from("games")
    .update({
      status: "active",
      fen: START_FEN,
    })
    .eq("id", gameId);

  return { error };
}

export async function getLocalMultiplayerGame(gameId: string) {
  if (!supabase) {
    return { game: null, error: null };
  }

  const { data, error } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();

  return {
    game: data as LocalGameRow | null,
    error,
  };
}

export async function updateLocalGameMove(gameId: string, newFen: string, movesSan: string, newPgn: string) {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase
    .from("games")
    .update({
      fen: newFen,
      moves_pgn: newPgn,
      moves_san: movesSan,
      status: "active",
      draw_offered_by: null,
    })
    .eq("id", gameId);

  return { error };
}

export async function offerLocalDraw(gameId: string, userId: string) {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase.from("games").update({ draw_offered_by: userId }).eq("id", gameId);
  return { error };
}

export async function finishLocalGame(gameId: string, result: LocalGameResult) {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase
    .from("games")
    .update({
      result,
      status: "finished",
      ended_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  return { error };
}
