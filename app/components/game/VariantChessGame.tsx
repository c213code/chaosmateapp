"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import ChessBoard from "@/app/components/game/ChessBoard";
import PieceRenderer from "@/app/components/game/PieceRenderer";
import { files, isControlledBySeat, pieceGlyphs, teleportOpponentPiece, type GameMode, type TeamSeat } from "@/app/lib/chess-platform";
import { calculateElo, getGameResult, getMovableSquares, getQueenThreat, makeMove, needsPromotion, START_FEN } from "@/app/lib/gameLogic";
import { ensureUserProfileForGames, isForeignKeyError, supabase } from "@/app/lib/supabase";
import type { ChaosMateUser, Profile } from "@/app/lib/types";
import { applyTheme, loadInventory, type InventoryState } from "@/app/lib/progression";
import { getRoomSocket, type SocketRoom } from "@/app/lib/socketRooms";

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

function randomSwitchCountdown() {
  return 5 + Math.floor(Math.random() * 6);
}

export default function VariantChessGame({
  mode,
  user,
  profile,
  setProfile,
  onlineRoomId,
  onlinePlayerColor,
  aiOpponent = false,
}: {
  mode: Exclude<GameMode, "classic-ai" | "online">;
  user: ChaosMateUser;
  profile: Profile;
  setProfile: (profile: Profile | null) => void;
  onlineRoomId?: string;
  onlinePlayerColor?: Color;
  aiOpponent?: boolean;
}) {
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionState>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState("Press New Game to start.");
  const [tableTalk, setTableTalk] = useState("Unlock more emotes in the shop.");
  const [inventory, setInventory] = useState<InventoryState>(() => loadInventory(profile.id));
  const [orientation, setOrientation] = useState<Color>("w");
  const [switchCountdown, setSwitchCountdown] = useState(() => randomSwitchCountdown());
  const [switching, setSwitching] = useState(0);
  const [switchControl, setSwitchControl] = useState<Color>("w");
  const [totalSwaps, setTotalSwaps] = useState(0);
  const [chaosEvent, setChaosEvent] = useState<{ from: Square; to: Square; piece: PieceSymbol } | null>(null);
  const [chaosHistory, setChaosHistory] = useState<Array<{ moveNumber: number; from: Square; to: Square; piece: PieceSymbol }>>([]);
  const [chaosCountdown, setChaosCountdown] = useState(6);
  const [speedPreset, setSpeedPreset] = useState<"bullet" | "blitz">("blitz");
  const [whiteMs, setWhiteMs] = useState(180000);
  const [blackMs, setBlackMs] = useState(180000);
  const [teamSeat, setTeamSeat] = useState<TeamSeat>("white-major");
  const [aiThinking, setAiThinking] = useState(false);
  const finalizedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const aiFenRef = useRef<string | null>(null);

  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();
  const legalTargets = selected ? game.moves({ square: selected, verbose: true }).map((move) => move.to) : [];
  const lastMove = history.at(-1);
  const queenThreat = getQueenThreat(game, turn);
  const hiddenSquares = mode === "fog" ? getHiddenSquares(game, turn) : [];
  const playerColor = mode === "switch" ? switchControl : "w";
  const controlledColor = onlinePlayerColor || playerColor;
  const mustControlSpecificColor = Boolean(onlinePlayerColor || aiOpponent || mode === "switch");
  const isPlayerTurn = onlinePlayerColor ? turn === onlinePlayerColor : !aiOpponent || turn === playerColor;
  const movableSquares =
    result || aiThinking || !isPlayerTurn ? [] : getMovableSquares(game, turn).filter((square) => canMoveSquare(game, square, mode, teamSeat));
  const gameStatus = result ? "finished" : game.isCheck() ? "check" : gameId ? "playing" : "idle";

  useEffect(() => {
    const syncInventory = () => {
      const next = loadInventory(profile.id);
      setInventory(next);
      applyTheme(next.theme);
    };

    syncInventory();
    window.addEventListener("chaosmate-inventory-change", syncInventory);
    return () => window.removeEventListener("chaosmate-inventory-change", syncInventory);
  }, [profile.id]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    const piece = game.get(selected);
    if (!piece || piece.color !== game.turn() || !canMoveSquare(game, selected, mode, teamSeat)) {
      setSelected(null);
    }
  }, [fen, game, mode, selected, teamSeat]);

  useEffect(() => {
    if (onlineRoomId) {
      setGameId(`online-${onlineRoomId}`);
      setMessage(onlinePlayerColor ? `Online room ready. You play ${onlinePlayerColor === "w" ? "White" : "Black"}.` : "Join the room to play.");
    }
  }, [onlinePlayerColor, onlineRoomId]);

  useEffect(() => {
    if (!onlineRoomId) {
      return;
    }

    const socket = getRoomSocket();
    const applySocketState = (room: SocketRoom) => {
      if ((room.code || room.id).toUpperCase() !== onlineRoomId.toUpperCase()) {
        return;
      }

      if (room.fen) {
        setFen(room.fen);
      }

      if (room.movesPgn) {
        const hydrated = new Chess();
        try {
          hydrated.loadPgn(room.movesPgn);
          setHistory(hydrated.history({ verbose: true }));
        } catch {
          setHistory([]);
        }
      }

      if (room.result && room.status === "finished") {
        setResult(room.result as Outcome);
        setShowResult(true);
      }
    };

    socket.on("game:state", applySocketState);
    socket.on("rooms:update", applySocketState);
    socket.emit("game:sync", { roomId: onlineRoomId });

    return () => {
      socket.off("game:state", applySocketState);
      socket.off("rooms:update", applySocketState);
    };
  }, [onlineRoomId]);

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

  useEffect(() => {
    if (!aiOpponent || !gameId || result || promotion || switching || aiThinking || game.turn() === playerColor || game.isGameOver()) {
      return;
    }

    const requestedFen = game.fen();
    aiFenRef.current = requestedFen;
    setAiThinking(true);
    setMessage("AI is thinking...");

    const timeout = window.setTimeout(() => {
      if (aiFenRef.current !== requestedFen || finalizedRef.current) {
        setAiThinking(false);
        return;
      }

      const aiGame = new Chess(requestedFen);
      const move = chooseAiMove(aiGame);

      if (!move) {
        setAiThinking(false);
        return;
      }

      playMove(move.from, move.to, (move.promotion || "q") as PieceSymbol, true);
      setAiThinking(false);
    }, 520);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpponent, fen, gameId, result, promotion, switching, aiThinking, playerColor]);

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
    setAiThinking(false);
    aiFenRef.current = null;
    setOrientation("w");
    setSwitchCountdown(randomSwitchCountdown());
    setSwitching(0);
    setSwitchControl("w");
    setTotalSwaps(0);
    setChaosEvent(null);
    setChaosHistory([]);
    setChaosCountdown(6);
    setTeamSeat("white-major");
    setWhiteMs(speedPreset === "bullet" ? 30000 : 180000);
    setBlackMs(speedPreset === "bullet" ? 30000 : 180000);
    setMessage(`${modeCopy[mode].title} started. ${aiOpponent ? "You play White, AI replies automatically." : "White to move."}`);

    if (onlineRoomId) {
      if (onlinePlayerColor && onlinePlayerColor !== "w") {
        setMessage("Only the room creator playing White can restart the online board.");
        return;
      }

      if (!onlinePlayerColor) {
        setMessage("Join the room before starting the online board.");
        return;
      }

      setGameId(`online-${onlineRoomId}`);
      setMessage(`${modeCopy[mode].title} online room started. White to move.`);
      getRoomSocket().emit("game:move", {
        roomId: onlineRoomId,
        fen: next.fen(),
        movesPgn: "",
        movesSan: "",
        result: null,
        status: "playing",
      });
      if (supabase) {
        await supabase
          .from("game_rooms")
          .update({
            fen: next.fen(),
            moves_pgn: "",
            moves_san: "",
            result: null,
            status: "playing",
            started_at: new Date().toISOString(),
            ended_at: null,
          })
          .eq("id", onlineRoomId);
      }
      return;
    }

    if (!supabase) {
      setGameId(`local-${mode}`);
      return;
    }

    await ensureUserProfileForGames(user);
    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: modeCopy[mode].dbMode,
        white_player_id: user.id,
        black_player_id: null,
        fen: next.fen(),
        moves_pgn: "",
        moves_san: "",
        status: "active",
        result: null,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(isForeignKeyError(error) ? "Database profile is not ready, so this game is running locally." : error.message);
      setGameId(`local-${mode}`);
      return;
    }

    setGameId(data.id);
  }

  function handleSquare(square: Square) {
    if (!gameId || result || switching || aiThinking || !isPlayerTurn) {
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

  function playMove(from: Square, to: Square, promotionPiece: PieceSymbol = "q", fromAI = false) {
    const piece = game.get(from);
    if (!piece || (!fromAI && !isPlayerTurn) || (!fromAI && mustControlSpecificColor && piece.color !== controlledColor) || (!fromAI && !canMoveSquare(game, from, mode, teamSeat))) {
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
    const nextTurn = nextGame.turn();
    let nextMessage = `${nextTurn === "w" ? "White" : "Black"} to move.`;
    let triggeredSwitch = false;

    if (mode === "chaos") {
      const nextChaosCountdown = chaosCountdown - 1;

      if (nextChaosCountdown <= 0) {
        const events = (["w", "b"] as Color[])
          .map((color) => teleportOpponentPiece(nextGame, color))
          .filter((event): event is NonNullable<typeof event> => Boolean(event));
        setChaosCountdown(6);

        if (events.length) {
          setChaosEvent(events[0]);
          setChaosHistory((current) => [
            ...current,
            ...events.map((event) => ({ moveNumber: nextHistory.length, from: event.from, to: event.to, piece: event.piece })),
          ]);
          window.setTimeout(() => setChaosEvent(null), 1200);
          nextFen = nextGame.fen();
          nextMessage = `Chaos strike: ${events
            .map((event) => `${event.color === "w" ? "White" : "Black"} ${pieceName(event.piece)} ${event.from} to ${event.to}`)
            .join("; ")}.`;
        } else {
          nextMessage = "Chaos tried to strike, but no non-king target was available.";
        }
      } else {
        setChaosCountdown(nextChaosCountdown);
      }
    }

    if (mode === "switch") {
      const nextCountdown = switchCountdown - 1;
      setSwitchCountdown(Math.max(0, nextCountdown));
      setSwitchControl(nextTurn);

      if (nextCountdown <= 0) {
        triggeredSwitch = true;
        setSwitching(3);
        setMessage("SWITCHING IN 3...");
        const countdown = window.setInterval(() => {
          setSwitching((value) => {
            if (value <= 1) {
              window.clearInterval(countdown);
              setOrientation(nextTurn);
              setSwitchControl(nextTurn);
              setTotalSwaps((current) => current + 1);
              setSwitchCountdown(randomSwitchCountdown());
              setMessage(`Sides swapped. You now play ${nextTurn === "w" ? "White" : "Black"}.`);
              return 0;
            }

            setMessage(`SWITCHING IN ${value - 1}...`);
            return value - 1;
          });
        }, 700);
        nextMessage = `Switch countdown started. ${nextTurn === "w" ? "White" : "Black"} will control the next move.`;
      }
    } else if (mode === "local") {
      setOrientation(nextTurn);
    }

    if (mode === "team") {
      const suggestedSeat = nextSeat(nextTurn);
      setTeamSeat(suggestedSeat);
      nextMessage = `${nextTurn === "w" ? "White" : "Black"} to move. Pick Player A or B, then move only that seat's pieces.`;
    }

    if (aiOpponent && !nextGame.isGameOver()) {
      const nextPlayerColor = mode === "switch" && triggeredSwitch ? (switchControl === "w" ? "b" : "w") : playerColor;
      nextMessage =
        nextGame.turn() === nextPlayerColor
          ? `Your turn as ${nextPlayerColor === "w" ? "White" : "Black"}.`
          : `AI to move as ${nextGame.turn() === "w" ? "White" : "Black"}.`;
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
    if (!gameId || gameId.startsWith("local-")) {
      return;
    }

    if (onlineRoomId) {
      getRoomSocket().emit("game:move", {
        roomId: onlineRoomId,
        fen: nextGame.fen(),
        movesPgn: nextGame.pgn(),
        movesSan: nextHistory.map((move) => move.san).join(" "),
        status: status === "finished" ? "finished" : "playing",
        result: outcome || null,
      });

      if (!supabase) {
        return;
      }

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

    if (!supabase) {
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
    aiFenRef.current = null;
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
    const opponentElo = 1200;
    const eloResult = calculateElo(current, opponentElo, outcome === "draw");
    const nextElo = outcome === "draw" ? eloResult.new_winner_elo : won ? eloResult.new_winner_elo : lost ? eloResult.new_loser_elo : current;
    const coinGain = won ? 10 : outcome === "draw" ? 5 : 3;
    const nextProfile = {
      ...profile,
      elo: { ...profile.elo, [key]: nextElo },
      coins: profile.coins + coinGain,
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
              <div className="mt-3 flex flex-wrap gap-2">
                {modeHelp(mode).map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-black/22 px-3 py-1 text-xs font-bold text-white/68">
                    {item}
                  </span>
                ))}
              </div>
              {aiOpponent && <p className="mt-2 text-sm font-bold text-[#86efac]">AI opponent active</p>}
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
              boardTheme={inventory.equippedBoard}
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
            {aiOpponent && <State label="Opponent" value={aiThinking ? "AI thinking" : "AI ready"} />}
            {aiOpponent && <State label="You control" value={playerColor === "w" ? "White" : "Black"} />}
            {mode === "switch" && <State label="Next swap" value={`${switchCountdown} moves`} />}
            {mode === "switch" && <State label="Control" value={switchControl === "w" ? "White" : "Black"} />}
            {mode === "switch" && <State label="Swaps" value={totalSwaps} />}
            {mode === "chaos" && <State label="Chaos" value={`${chaosCountdown} moves`} />}
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
          {aiOpponent && !isPlayerTurn && !result && <p className="mt-3 text-xs leading-5 text-[#86efac]">Сейчас ход AI. Доска заблокирована до ответа.</p>}
          {queenThreat && <p className="mt-3 rounded-md border border-amber-300/35 bg-amber-300/12 p-3 text-sm text-amber-100">Queen threat: {queenThreat.attackers.join(", ")} attacking {queenThreat.queenSquare}.</p>}
          <div className="mt-4 rounded-md border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/38">Table talk</p>
            <p className="mt-2 min-h-6 text-sm font-bold text-[#f7d96b]">{tableTalk}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {inventory.emotes.slice(0, 6).map((item) => (
                <button key={item} onClick={() => setTableTalk(item)} className="rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm font-bold text-white/70 hover:border-[#d4af37]/45 hover:text-white">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => finalizeGame("draw")} disabled={!gameId || Boolean(result)} className="rounded-md border border-[#d4af37]/45 px-3 py-2 font-bold text-[#f7d96b] disabled:opacity-40">
              Draw
            </button>
            <button onClick={() => finalizeGame(turn === "w" ? "black_win" : "white_win")} disabled={!gameId || Boolean(result)} className="rounded-md border border-red-400/35 px-3 py-2 font-bold text-red-200 disabled:opacity-40">
              Resign
            </button>
          </div>
        </div>

        <div className="move-history-pro">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">● Move History</p>
          </div>
          <div className="max-h-72 overflow-auto px-5 py-4 text-white/82">
            {history.length ? (
              <div>
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                  <MoveRow key={index} index={index} white={history[index * 2]?.san} black={history[index * 2 + 1]?.san} active={index === Math.ceil(history.length / 2) - 1} />
                ))}
              </div>
            ) : (
              <p className="font-sans text-white/45">No moves yet.</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/10 p-4">
            <button className="rounded-full border border-white/15 bg-white/8 px-4 py-3 font-black text-white/80">↞</button>
            <button className="rounded-full border border-white/15 bg-white/8 px-4 py-3 font-black text-white/80">◀</button>
            <button className="rounded-full border border-white/15 bg-white/8 px-4 py-3 font-black text-white/80">▶</button>
          </div>
        </div>

        <div className="cm-panel p-4">
          <h2 className="text-lg font-bold text-white">Mode Notes</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">{modeNote(mode)}</p>
          {mode === "chaos" && chaosHistory.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d4af37]">Chaos Events</p>
              {chaosHistory.slice(-4).map((event) => (
                <div key={`${event.moveNumber}-${event.from}-${event.to}`} className="rounded-md border border-cyan-300/20 bg-cyan-300/8 p-2 text-xs text-cyan-100">
                  Move {event.moveNumber}: {pieceName(event.piece)} {event.from} to {event.to}
                </div>
              ))}
            </div>
          )}
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

function chooseAiMove(game: Chess) {
  const moves = game.moves({ verbose: true });

  if (!moves.length) {
    return null;
  }

  const mates = moves.filter((move) => {
    const copy = new Chess(game.fen());
    copy.move(move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to });
    return copy.isCheckmate();
  });

  if (mates.length) {
    return mates[Math.floor(Math.random() * mates.length)];
  }

  const checks = moves.filter((move) => {
    const copy = new Chess(game.fen());
    copy.move(move.promotion ? { from: move.from, to: move.to, promotion: move.promotion } : { from: move.from, to: move.to });
    return copy.isCheck();
  });

  const captures = moves.filter((move) => move.captured);
  const tactical = [...checks, ...captures];

  if (tactical.length && Math.random() < 0.72) {
    return tactical[Math.floor(Math.random() * tactical.length)];
  }

  return moves[Math.floor(Math.random() * moves.length)];
}

function getHiddenSquares(game: Chess, color: Color) {
  const visible = getAdjacentVisionSquares(game, color);
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

function getAdjacentVisionSquares(game: Chess, color: Color) {
  const visible = new Set<Square>();

  game
    .board()
    .flat()
    .forEach((piece) => {
      if (!piece || piece.color !== color) {
        return;
      }

      visible.add(piece.square);
      const fileIndex = files.indexOf(piece.square[0] as (typeof files)[number]);
      const rankIndex = Number(piece.square[1]) - 1;

      for (let fileOffset = -1; fileOffset <= 1; fileOffset += 1) {
        for (let rankOffset = -1; rankOffset <= 1; rankOffset += 1) {
          const nextFile = files[fileIndex + fileOffset];
          const nextRank = rankIndex + rankOffset + 1;

          if (nextFile && nextRank >= 1 && nextRank <= 8) {
            visible.add(`${nextFile}${nextRank}` as Square);
          }
        }
      }
    });

  return visible;
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
    return "Fog hides every square outside a one-cell radius around the current side's pieces. Long-range bishops and rooks do not reveal lanes until pieces move closer.";
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

function modeHelp(mode: GameMode) {
  if (mode === "switch") {
    return ["Every 5-10 legal moves", "Board turns to next side", "Control follows Turn"];
  }

  if (mode === "fog") {
    return ["Only radius-1 vision", "Move closer to reveal", "Hidden pieces stay blurred"];
  }

  if (mode === "chaos") {
    return ["Countdown every move", "White and Black both teleport", "Kings stay safe"];
  }

  if (mode === "speed") {
    return ["Timer starts on first move", "Flag ends game", "No slow thinking"];
  }

  if (mode === "team") {
    return ["Pick the active seat", "A controls pawns/rooks/queen", "B controls knights/bishops/king"];
  }

  return ["White moves first", "Click piece, then green square", "All rules by chess.js"];
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

function MoveRow({ index, white, black, active = false }: { index: number; white?: string; black?: string; active?: boolean }) {
  return (
    <div className="move-history-row">
      <span className="text-white/35">{index + 1}.</span>
      <span className={active && white ? "move-chip-active" : ""}>{white || ""}</span>
      <span className={active && black ? "move-chip-active" : ""}>{black || ""}</span>
    </div>
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
