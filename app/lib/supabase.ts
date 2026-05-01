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
