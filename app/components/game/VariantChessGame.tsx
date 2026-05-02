"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import ChessBoard from "@/app/components/game/ChessBoard";
import PieceRenderer from "@/app/components/game/PieceRenderer";
import { getVisionSquares, isControlledBySeat, nextSwitchMove, pieceGlyphs, teleportOpponentPiece, type GameMode, type TeamSeat } from "@/app/lib/chess-platform";
import { getGameResult, getMovableSquares, getQueenThreat, makeMove, needsPromotion, START_FEN } from "@/app/lib/gameLogic";
import { supabase } from "@/app/lib/supabase";
import type { ChaosMateUser, Profile } from "@/app/lib/types";

type PromotionState = { from: Square; to: Square } | null;
type Outcome = "white_win" | "black_win" | "draw" | "resigned";

const modeCopy: Record<Exclude<GameMode, "classic-ai" | "online">, { title: string; subtitle: string; dbMode: string }> = {
  local: {
    title: "Local Multiplayer",
    subtitle: "Pass-and-play 1v1 on the same device.",
    dbMode: "local_multiplayer",
  },
  switch: {
    title: "Switch Places",
    subtitle: "Every 5-10 moves, the board flips and control swaps.",
    dbMode: "switch_places",
  },
  fog: {
    title: "Fog of War",
    subtitle: "Only your army vision is visible. Hidden pieces become mysteries.",
    dbMode: "fog_of_war",
  },
  chaos: {
    title: "Chaos Mode",
    subtitle: "Every sixth move teleports one opponent piece to a random square.",
    dbMode: "chaos_mode",
  },
  speed: {
    title: "Speed Chess",
    subtitle: "Bullet and blitz pressure with automatic timeout result.",
    dbMode: "speed_chess",
  },
  team: {
    title: "2v2 Team Chess",
    subtitle: "Seats split control of major and minor pieces on each side.",
    dbMode: "team_2v2",
  },
};

export default function VariantChessGame({
  mode,
  user,
  profile,
  setProfile,
  onlineRoomId,
}: {
  mode: Exclude<GameMode, "classic-ai" | "online">;
  user: ChaosMateUser;
  profile: Profile;
  setProfile: (profile: Profile | null) => void;
  onlineRoomId?: string;
}) {
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionState>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState("Press New Game to start.");
  const [orientation, setOrientation] = useState<Color>("w");
  const [switchAt, setSwitchAt] = useState(() => nextSwitchMove(0));
  const [switching, setSwitching] = useState(0);
  const [chaosEvent, setChaosEvent] = useState<{ from: Square; to: Square; piece: PieceSymbol } | null>(null);
  const [speedPreset, setSpeedPreset] = useState<"bullet" | "blitz">("blitz");
  const [whiteMs, setWhiteMs] = useState(180000);
  const [blackMs, setBlackMs] = useState(180000);
  const [teamSeat, setTeamSeat] = useState<TeamSeat>("white-major");
  const finalizedRef = useRef(false);
  const timerStartedRef = useRef(false);

  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();
  const legalTargets = selected ? game.moves({ square: selected, verbose: true }).map((move) => move.to) : [];
  const lastMove = history.at(-1);
  const queenThreat = getQueenThreat(game, turn);
  const hiddenSquares = mode === "fog" ? getHiddenSquares(game, turn) : [];
  const movableSquares = result ? [] : getMovableSquares(game, turn).filter((square) => canMoveSquare(game, square, mode, teamSeat));
  const gameStatus = result ? "finished" : game.isCheck() ? "check" : gameId ? "playing" : "idle";

  useEffect(() => {
    const client = supabase;

    if (!onlineRoomId || !client) {
      return;
    }

    const activeClient = client;
    let alive = true;

    async function loadOnlineState() {
      const { data } = await activeClient.from("game_rooms").select("fen,moves_pgn,moves_san,result,status").eq("id", onlineRoomId).maybeSingle();

      if (!alive || !data) {
        return;
      }

      if (data.fen) {
        setFen(data.fen);
      }

      if (data.moves_pgn) {
        const hydrated = new Chess();
        try {
          hydrated.loadPgn(data.moves_pgn);
          setHistory(hydrated.history({ verbose: true }));
        } catch {
          setHistory([]);
        }
      }

      if (data.result && data.status === "finished") {
        setResult(data.result as Outcome);
        setShowResult(true);
      }
    }

    loadOnlineState();

    const channel = activeClient
      .channel(`game-room-state-${onlineRoomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${onlineRoomId}` }, () => loadOnlineState())
      .subscribe();

    return () => {
      alive = false;
      activeClient.removeChannel(channel);
    };
  }, [onlineRoomId]);

  useEffect(() => {
    if (mode !== "speed" || result || !timerStartedRef.current) {
      return;
    }

    const timer = window.setInterval(() => {
      if (game.turn() === "w") {
        setWhiteMs((value) => Math.max(0, value - 1000));
      } else {
        setBlackMs((value) => Math.max(0, value - 1000));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [fen, game, mode, result]);

  useEffect(() => {
    if (mode !== "speed" || result) {
      return;
    }

    if (whiteMs <= 0) {
      finalizeGame("black_win", game, history, "White flagged.");
    }

    if (blackMs <= 0) {
      finalizeGame("white_win", game, history, "Black flagged.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteMs, blackMs, mode, result]);

  async function startGame() {
    const next = new Chess();
    finalizedRef.current = false;
    timerStartedRef.current = false;
    setFen(next.fen());
    setHistory([]);
    setSelected(null);
    setPromotion(null);
    setResult(null);
    setShowResult(false);
    setOrientation("w");
    setSwitchAt(nextSwitchMove(0));
    setSwitching(0);
    setChaosEvent(null);
    setTeamSeat("white-major");
    setWhiteMs(speedPreset === "bullet" ? 30000 : 180000);
    setBlackMs(speedPreset === "bullet" ? 30000 : 180000);
    setMessage(`${modeCopy[mode].title} started. White to move.`);

    if (onlineRoomId) {
      setGameId(`online-${onlineRoomId}`);
      setMessage(`${modeCopy[mode].title} online room started. White to move.`);
      return;
    }

    if (!supabase) {
      setGameId(`local-${mode}`);
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: modeCopy[mode].dbMode,
        white_player_id: user.id,
        black_player_id: null,
        ai_opponent: false,
        fen: next.fen(),
        moves_pgn: "",
        moves_san: "",
        status: "active",
        result: null,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      setGameId(`local-${mode}`);
      return;
    }

    setGameId(data.id);
  }

  function handleSquare(square: Square) {
    if (!gameId || result || switching) {
      return;
    }

    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }

      const clicked = game.get(square);
      if (clicked?.color === turn && canMoveSquare(game, square, mode, teamSeat)) {
        setSelected(square);
        return;
      }

      if (needsPromotion(game.fen(), selected, square)) {
        setPromotion({ from: selected, to: square });
        return;
      }

      if (playMove(selected, square)) {
        return;
      }
    }

    const piece = game.get(square);
    setSelected(piece?.color === turn && canMoveSquare(game, square, mode, teamSeat) ? square : null);
  }

  function playMove(from: Square, to: Square, promotionPiece: PieceSymbol = "q") {
    const piece = game.get(from);
    if (!piece || !canMoveSquare(game, from, mode, teamSeat)) {
      setSelected(null);
      return false;
    }

    const moveResult = makeMove(game, from, to, promotionPiece);
    if (!moveResult) {
      setSelected(null);
      return false;
    }

    timerStartedRef.current = true;

    let nextGame = moveResult.game;
    let nextFen = moveResult.newFen;
    let nextHistory = moveResult.history;
    let nextMessage = `${nextGame.turn() === "w" ? "White" : "Black"} to move.`;
    let triggeredSwitch = false;

    if (mode === "chaos" && nextHistory.length > 0 && nextHistory.length % 6 === 0) {
      const opponent = nextGame.turn();
      const event = teleportOpponentPiece(nextGame, opponent);
      if (event) {
        setChaosEvent(event);
        window.setTimeout(() => setChaosEvent(null), 1200);
        nextFen = nextGame.fen();
        nextMessage = `Chaos strike: ${pieceName(event.piece)} teleported ${event.from} -> ${event.to}.`;
      }
    }

    if (mode === "switch" && nextHistory.length === switchAt) {
      triggeredSwitch = true;
      setSwitching(3);
      setMessage("SWITCHING IN 3...");
      const countdown = window.setInterval(() => {
        setSwitching((value) => {
          if (value <= 1) {
            window.clearInterval(countdown);
            setOrientation((current) => (current === "w" ? "b" : "w"));
            setSwitchAt(nextSwitchMove(nextHistory.length));
            setMessage("Sides swapped. Keep playing from the new perspective.");
            return 0;
          }

          setMessage(`SWITCHING IN ${value - 1}...`);
          return value - 1;
        });
      }, 700);
      nextMessage = "Switch countdown started.";
    } else if (mode === "local") {
      setOrientation(nextGame.turn());
    }

    if (mode === "team") {
      const suggestedSeat = nextSeat(nextGame.turn());
      setTeamSeat(suggestedSeat);
      nextMessage = `${nextGame.turn() === "w" ? "White" : "Black"} to move. Pick Player A or B, then move only that seat's pieces.`;
    }

    if (nextGame.isCheck()) {
      nextMessage = `CHECK! ${nextGame.turn() === "w" ? "White" : "Black"} king is under attack.`;
    }

    const threat = getQueenThreat(nextGame, nextGame.turn());
    if (threat) {
      nextMessage = `${nextMessage} Queen threat on ${threat.queenSquare}.`;
    }

    setFen(nextFen);
    setHistory(nextHistory);
    setSelected(null);
    setPromotion(null);
    if (!triggeredSwitch) {
      setMessage(nextMessage);
    }
    persistGame(nextGame, nextHistory, "active");

    const outcome = getGameResult(nextGame);
    if (outcome) {
      finalizeGame(outcome, nextGame, nextHistory);
    }

    return true;
  }

  async function persistGame(nextGame: Chess, nextHistory: Move[], status = "active", outcome?: Outcome) {
    if (!supabase || !gameId || gameId.startsWith("local-")) {
      return;
    }

    if (onlineRoomId) {
      await supabase
        .from("game_rooms")
        .update({
          fen: nextGame.fen(),
          moves_pgn: nextGame.pgn(),
          moves_san: nextHistory.map((move) => move.san).join(" "),
          status: status === "finished" ? "finished" : "playing",
          result: outcome || null,
          ended_at: status === "finished" ? new Date().toISOString() : null,
        })
        .eq("id", onlineRoomId);
      return;
    }

    await supabase
      .from("games")
      .update({
        fen: nextGame.fen(),
        moves_pgn: nextGame.pgn(),
        moves_san: nextHistory.map((move) => move.san).join(" "),
        status,
        result: outcome || null,
        ended_at: status === "finished" ? new Date().toISOString() : null,
      })
      .eq("id", gameId);
  }

  async function finalizeGame(outcome: Outcome, finalGame = game, finalHistory = history, customMessage?: string) {
    if (finalizedRef.current) {
      return;
    }

    finalizedRef.current = true;
    setResult(outcome);
    setShowResult(true);
    setSelected(null);
    setPromotion(null);
    setMessage(customMessage || resultText(outcome));
    await persistGame(finalGame, finalHistory, "finished", outcome);
    await rewardProfile(outcome);
  }

  async function backHomeDuringGame() {
    if (!gameId || result) {
      return;
    }

    if (window.confirm("Resign this game and go back home?")) {
      await finalizeGame(turn === "w" ? "black_win" : "white_win", game, history, "Game resigned before returning home.");
      window.location.href = "/";
    }
  }

  async function rewardProfile(outcome: Outcome) {
    const key = mode === "local" ? "classic" : mode;
    const current = Number(profile.elo?.[key] ?? 1200);
    const won = outcome === "white_win";
    const lost = outcome === "black_win" || outcome === "resigned";
    const nextElo = outcome === "draw" ? current : won ? current + 14 : lost ? Math.max(100, current - 14) : current;
    const nextProfile = {
      ...profile,
      elo: { ...profile.elo, [key]: nextElo },
      coins: profile.coins + (won ? 10 : outcome === "draw" ? 5 : 3),
      wins: profile.wins + (won ? 1 : 0),
      losses: profile.losses + (lost ? 1 : 0),
    };

    setProfile(nextProfile);

    if (supabase) {
      await supabase
        .from("users")
        .update({
          elo: nextProfile.elo,
          coins: nextProfile.coins,
          wins: nextProfile.wins,
          losses: nextProfile.losses,
        })
        .eq("id", profile.id);
    }
  }

  const copy = modeCopy[mode];

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(320px,760px)_360px]">
      <div className="space-y-4">
        <div className="cm-panel p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d4af37]">{copy.title}</p>
              <h1 className="mt-1 text-2xl font-black text-white">{copy.subtitle}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === "speed" && (
                <select
                  value={speedPreset}
                  onChange={(event) => setSpeedPreset(event.target.value as "bullet" | "blitz")}
                  className="rounded-md border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white"
                >
                  <option value="bullet">Bullet 30s</option>
                  <option value="blitz">Blitz 3m</option>
                </select>
              )}
              {mode === "team" && (
                <select
                  value={teamSeat}
                  onChange={(event) => setTeamSeat(event.target.value as TeamSeat)}
                  className="rounded-md border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white"
                >
                  <option value="white-major">White A: pawns/rooks/queen</option>
                  <option value="white-minor">White B: knights/bishops/king</option>
                  <option value="black-major">Black A: pawns/rooks/queen</option>
                  <option value="black-minor">Black B: knights/bishops/king</option>
                </select>
              )}
              <button onClick={startGame} className="cm-button px-4 py-2 text-sm font-black">
                New Game
              </button>
              {gameStatus === "playing" || gameStatus === "check" ? (
                <button onClick={backHomeDuringGame} className="rounded-md border border-red-400/35 px-4 py-2 text-sm font-black text-red-200 hover:bg-red-400/10">
                  Back Home
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {gameStatus === "check" && (
          <div className="rounded-md border border-red-400/45 bg-red-500/18 p-4 text-center text-xl font-black text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.18)]">
            CHECK!
          </div>
        )}

        {mode === "team" && <TeamGuide currentColor={turn} selectedSeat={teamSeat} onSeat={setTeamSeat} />}

        <div className="relative mx-auto w-[min(92vw,760px)]">
          {switching > 0 && (
            <div className="absolute inset-0 z-30 grid place-items-center rounded-[28px] bg-black/65 backdrop-blur-md">
              <div className="switch-pulse text-center">
                <p className="text-6xl font-black text-[#d4af37]">{switching}</p>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-white">Switching sides</p>
              </div>
            </div>
          )}
          {chaosEvent && (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
              <div className="lightning text-7xl">ϟ</div>
            </div>
          )}
          {promotion && (
            <div className="absolute inset-0 z-30 grid place-items-center rounded-[28px] bg-black/55 backdrop-blur-sm">
              <div className="cm-panel p-5 text-center">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d4af37]">Promote pawn</p>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {(["q", "r", "b", "n"] as PieceSymbol[]).map((piece) => (
                    <button key={piece} onClick={() => playMove(promotion.from, promotion.to, piece)} className="grid h-16 w-16 place-items-center rounded-md border border-white/10 bg-white/8 hover:border-[#d4af37]">
                      <PieceRenderer color={turn} type={piece} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className={mode === "switch" && switching ? "local-board-flipping" : ""}>
            <ChessBoard
              game={game}
              orientation={orientation}
              selected={selected}
              legalMoves={legalTargets}
              movableSquares={movableSquares}
              lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
              threatSquares={queenThreat ? [queenThreat.queenSquare, ...queenThreat.attackers] : []}
              hiddenSquares={hiddenSquares}
              skin={profile.skin_equipped || "classic"}
              onSquare={handleSquare}
            />
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="cm-panel p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d4af37]">Game State</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <State label="Turn" value={turn === "w" ? "White" : "Black"} />
            <State label="Moves" value={history.length} />
            {mode === "switch" && <State label="Next swap" value={`${Math.max(0, switchAt - history.length)} moves`} />}
            {mode === "chaos" && <State label="Chaos" value={`${6 - (history.length % 6 || 0)} moves`} />}
            {mode === "speed" && (
              <>
                <State label="White time" value={formatMs(whiteMs)} danger={whiteMs < 10000} />
                <State label="Black time" value={formatMs(blackMs)} danger={blackMs < 10000} />
              </>
            )}
            {mode === "team" && <State label="Seat" value={seatLabel(teamSeat)} />}
            {mode === "fog" && <State label="Fog" value={`${hiddenSquares.length} hidden`} />}
          </div>
          <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/70">{message}</p>
          {!selected && movableSquares.length > 0 && <p className="mt-3 text-xs leading-5 text-white/50">Подсвеченные фигуры могут ходить. Нажми на фигуру, потом на зеленую клетку.</p>}
          {queenThreat && <p className="mt-3 rounded-md border border-amber-300/35 bg-amber-300/12 p-3 text-sm text-amber-100">Queen threat: {queenThreat.attackers.join(", ")} attacking {queenThreat.queenSquare}.</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => finalizeGame("draw")} disabled={!gameId || Boolean(result)} className="rounded-md border border-[#d4af37]/45 px-3 py-2 font-bold text-[#f7d96b] disabled:opacity-40">
              Draw
            </button>
            <button onClick={() => finalizeGame(turn === "w" ? "black_win" : "white_win")} disabled={!gameId || Boolean(result)} className="rounded-md border border-red-400/35 px-3 py-2 font-bold text-red-200 disabled:opacity-40">
              Resign
            </button>
          </div>
        </div>

        <div className="cm-panel p-4">
          <h2 className="text-lg font-bold text-white">Move History</h2>
          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-white/10 bg-black/20 p-3 font-mono text-sm text-white/75">
            {history.length ? (
              <div className="grid grid-cols-[44px_1fr_1fr] gap-y-2">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                  <MoveRow key={index} index={index} white={history[index * 2]?.san} black={history[index * 2 + 1]?.san} />
                ))}
              </div>
            ) : (
              <p className="font-sans text-white/45">No moves yet.</p>
            )}
          </div>
        </div>

        <div className="cm-panel p-4">
          <h2 className="text-lg font-bold text-white">Mode Notes</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">{modeNote(mode)}</p>
        </div>
      </aside>

      {showResult && result && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="cm-panel w-full max-w-md p-6 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#d4af37]">Game finished</p>
            <h2 className="mt-3 text-4xl font-black text-white">{resultText(result)}</h2>
            <p className="mt-3 text-sm text-white/60">Saved with final FEN, PGN, SAN move list, ELO and coins.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={startGame} className="rounded-md border border-white/10 px-4 py-3 font-black text-white/72 hover:text-white">
                Play Again
              </button>
              <button type="button" onClick={() => setShowResult(false)} className="cm-button px-4 py-3 font-black">
                Review Board
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function canMoveSquare(game: Chess, square: Square, mode: GameMode, teamSeat: TeamSeat) {
  const piece = game.get(square);

  if (!piece) {
    return false;
  }

  if (mode !== "team") {
    return true;
  }

  return isControlledBySeat(piece.type, piece.color, teamSeat);
}

function getHiddenSquares(game: Chess, color: Color) {
  const visible = getVisionSquares(game, color);
  const hidden: Square[] = [];

  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const square = `${file}${rank}` as Square;
      if (!visible.has(square)) {
        hidden.push(square);
      }
    }
  }

  return hidden;
}

function nextSeat(color: Color): TeamSeat {
  return color === "w" ? "white-major" : "black-major";
}

function seatLabel(seat: TeamSeat) {
  return {
    "white-major": "White A",
    "white-minor": "White B",
    "black-major": "Black A",
    "black-minor": "Black B",
  }[seat];
}

function formatMs(value: number) {
  const total = Math.ceil(value / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pieceName(piece: PieceSymbol) {
  return { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" }[piece];
}

function modeNote(mode: GameMode) {
  if (mode === "switch") {
    return "Switch Places is pass-and-play here: every random interval the orientation flips and players inherit the opposite perspective.";
  }
  if (mode === "fog") {
    return "Fog hides opponent pieces outside your current legal vision. Your own pieces and legal targets stay readable.";
  }
  if (mode === "chaos") {
    return "Every sixth move, one non-king opponent piece teleports to a random empty square.";
  }
  if (mode === "speed") {
    return "Timer starts after the first move. Flagging ends the game immediately.";
  }
  if (mode === "team") {
    return "Use the seat selector to play as the teammate who controls the current piece group.";
  }
  return "Standard local chess with full chess.js validation.";
}

function resultText(result: Outcome) {
  if (result === "white_win") {
    return "White wins!";
  }
  if (result === "black_win" || result === "resigned") {
    return "Black wins!";
  }
  return "Draw.";
}

function State({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${danger ? "border-red-400/45 bg-red-500/15" : "border-white/10 bg-white/8"}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}

function MoveRow({ index, white, black }: { index: number; white?: string; black?: string }) {
  return (
    <>
      <span className="text-white/35">{index + 1}.</span>
      <span>{white || ""}</span>
      <span>{black || ""}</span>
    </>
  );
}

function TeamGuide({
  currentColor,
  selectedSeat,
  onSeat,
}: {
  currentColor: Color;
  selectedSeat: TeamSeat;
  onSeat: (seat: TeamSeat) => void;
}) {
  const seats: Array<{ seat: TeamSeat; team: Color; title: string; pieces: string; controls: string }> = [
    { seat: "white-major", team: "w", title: "White A", pieces: "♙ ♖ ♕", controls: "Pawns, Rooks, Queen" },
    { seat: "white-minor", team: "w", title: "White B", pieces: "♘ ♗ ♔", controls: "Knights, Bishops, King" },
    { seat: "black-major", team: "b", title: "Black A", pieces: "♟ ♜ ♛", controls: "Pawns, Rooks, Queen" },
    { seat: "black-minor", team: "b", title: "Black B", pieces: "♞ ♝ ♚", controls: "Knights, Bishops, King" },
  ];

  return (
    <div className="cm-panel p-4">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">2v2 Team Control</p>
        <p className="mt-1 text-sm text-white/55">
          Current side: {currentColor === "w" ? "White" : "Black"}. Choose Player A or B for that side, then move only the highlighted pieces.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {seats.map((item) => {
          const active = item.team === currentColor && item.seat === selectedSeat;
          const available = item.team === currentColor;

          return (
            <button
              key={item.seat}
              onClick={() => onSeat(item.seat)}
              disabled={!available}
              className={`rounded-md border p-3 text-left transition ${
                active
                  ? "border-[#d4af37] bg-[#d4af37]/18"
                  : available
                    ? "border-white/14 bg-white/8 hover:border-[#d4af37]/60"
                    : "cursor-not-allowed border-white/8 bg-black/20 opacity-45"
              }`}
            >
              <p className="font-black text-white">{item.title}</p>
              <p className="mt-1 text-2xl text-[#d4af37]">{item.pieces}</p>
              <p className="mt-1 text-xs text-white/50">{item.controls}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
