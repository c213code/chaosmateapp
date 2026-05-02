"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { calculateElo, pieceGlyphs, type Difficulty } from "@/app/lib/chess-platform";
import { getGameResult, getMovableSquares, getQueenThreat, makeMove, needsPromotion, START_FEN } from "@/app/lib/gameLogic";
import { supabase } from "@/app/lib/supabase";
import type { ChaosMateUser, Profile } from "@/app/lib/types";
import ChessBoard from "@/app/components/game/ChessBoard";

type PromotionState = { from: Square; to: Square } | null;
type GameOutcome = "white_win" | "black_win" | "draw" | "resigned";

const aiEloByDifficulty: Record<Difficulty, number> = {
  Easy: 850,
  Medium: 1250,
  Hard: 1700,
};

const stockfishSkill: Record<Difficulty, number> = {
  Easy: 2,
  Medium: 9,
  Hard: 18,
};

const stockfishMoveTime: Record<Difficulty, number> = {
  Easy: 180,
  Medium: 560,
  Hard: 1200,
};

export default function ClassicVsAI({
  user,
  profile,
  setProfile,
}: {
  user: ChaosMateUser;
  profile: Profile;
  setProfile: (profile: Profile | null) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [gameId, setGameId] = useState<string | null>(null);
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionState>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Choose difficulty and start a new Classic vs AI game.");
  const [result, setResult] = useState<GameOutcome | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const engineRef = useRef<Worker | null>(null);
  const finalizedRef = useRef(false);
  const aiRequestFenRef = useRef<string | null>(null);

  const game = useMemo(() => new Chess(fen), [fen]);
  const legalTargets = selected ? game.moves({ square: selected, verbose: true }).map((move) => move.to) : [];
  const movableSquares = gameId && !aiThinking && !result && game.turn() === "w" ? getMovableSquares(game, "w") : [];
  const lastMove = history.at(-1);
  const queenThreat = getQueenThreat(game, "w");
  const gameStatus = result ? "finished" : game.isCheck() ? "check" : gameId ? "playing" : "idle";
  const capturedByWhite = history
    .filter((move) => move.color === "w" && move.captured)
    .map((move) => move.captured)
    .filter((piece): piece is PieceSymbol => Boolean(piece));
  const capturedByBlack = history
    .filter((move) => move.color === "b" && move.captured)
    .map((move) => move.captured)
    .filter((piece): piece is PieceSymbol => Boolean(piece));

  useEffect(() => {
    engineRef.current = new Worker("/stockfish/stockfish-18-lite-single.js");

    return () => {
      engineRef.current?.postMessage("quit");
      engineRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!gameId || game.turn() !== "b" || aiThinking || result) {
      return;
    }

    const worker = engineRef.current;
    if (!worker) {
      setMessage("Stockfish worker is not ready.");
      return;
    }

    const requestedFen = game.fen();
    aiRequestFenRef.current = requestedFen;
    setAiThinking(true);
    setMessage("Stockfish is thinking...");

    worker.onmessage = (event: MessageEvent<string>) => {
      if (!event.data.startsWith("bestmove")) {
        return;
      }

      const uci = event.data.split(" ")[1];

      if (aiRequestFenRef.current !== requestedFen || game.turn() !== "b" || result || finalizedRef.current) {
        return;
      }

      if (!uci || uci === "(none)") {
        setAiThinking(false);
        return;
      }

      const aiGame = new Chess(requestedFen);
      const moveResult = makeMove(
        aiGame,
        uci.slice(0, 2) as Square,
        uci.slice(2, 4) as Square,
        (uci.slice(4, 5) || "q") as PieceSymbol,
      );

      if (!moveResult) {
        setMessage(`Stockfish returned illegal move: ${uci}`);
        setAiThinking(false);
        return;
      }

      applyMoveResult(moveResult);
      setAiThinking(false);
    };

    worker.postMessage("uci");
    worker.postMessage(`setoption name Skill Level value ${stockfishSkill[difficulty]}`);
    worker.postMessage("isready");
    worker.postMessage(`position fen ${requestedFen}`);
    worker.postMessage(`go movetime ${stockfishMoveTime[difficulty]}`);
    // Stockfish must answer for the exact FEN that triggered this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiThinking, difficulty, fen, gameId, result]);

  async function startGame(nextDifficulty = difficulty) {
    const next = new Chess();
    finalizedRef.current = false;
    aiRequestFenRef.current = null;
    setAiThinking(false);
    setDifficulty(nextDifficulty);
    setFen(next.fen());
    setHistory([]);
    setSelected(null);
    setPromotion(null);
    setResult(null);
    setShowResult(false);
    setReviewMode(false);
    setMessage("Your move. You play White.");

    if (!supabase) {
      setGameId("local-classic");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: "classic",
        white_player_id: user.id,
        black_player_id: null,
        ai_difficulty: nextDifficulty,
        fen: next.fen(),
        moves_pgn: "",
        moves_san: "",
        result: null,
        status: "active",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      setGameId("local-classic");
      return;
    }

    setGameId(data.id);
  }

  function handleSquare(square: Square) {
    if (!gameId || aiThinking || result || game.turn() !== "w") {
      return;
    }

    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }

      const clickedPiece = game.get(square);
      if (clickedPiece?.color === "w") {
        setSelected(square);
        return;
      }

      if (needsPromotion(game.fen(), selected, square)) {
        setPromotion({ from: selected, to: square });
        return;
      }

      if (playPlayerMove(selected, square)) {
        return;
      }
    }

    const piece = game.get(square);
    setSelected(piece?.color === "w" ? square : null);
  }

  function playPlayerMove(from: Square, to: Square, promotionPiece: PieceSymbol = "q") {
    const moveResult = makeMove(game, from, to, promotionPiece);

    if (!moveResult) {
      setSelected(null);
      return false;
    }

    applyMoveResult(moveResult);
    return true;
  }

  function applyMoveResult(moveResult: NonNullable<ReturnType<typeof makeMove>>) {
    setFen(moveResult.newFen);
    setHistory(moveResult.history);
    setSelected(null);
    setPromotion(null);
    const threat = getQueenThreat(moveResult.game, "w");
    setMessage(
      moveResult.game.isGameOver()
        ? "Game over."
        : moveResult.game.isCheck()
          ? `CHECK! ${moveResult.game.turn() === "w" ? "White" : "Black"} king is under attack.`
        : threat
          ? `Careful: your queen is under attack on ${threat.queenSquare}.`
          : moveResult.game.turn() === "w"
            ? "Your move."
            : "Move sent.",
    );
    persistGame(moveResult.game, moveResult.history);

    const outcome = getGameResult(moveResult.game);
    if (outcome) {
      finalizeGame(outcome, moveResult.game, moveResult.history);
    }
  }

  async function persistGame(nextGame: Chess, nextHistory: Move[], status = "active", outcome?: GameOutcome) {
    if (!supabase || !gameId || gameId === "local-classic") {
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("games")
      .update({
        fen: nextGame.fen(),
        moves_pgn: nextGame.pgn(),
        moves_san: nextHistory.map((move) => move.san).join(" "),
        status,
        result: outcome || null,
        ended_at: status === "finished" ? new Date().toISOString() : null,
      })
      .eq("id", gameId)
      .eq("white_player_id", user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
    }
  }

  async function finalizeGame(outcome: GameOutcome, finalGame = game, finalHistory = history) {
    if (finalizedRef.current) {
      return;
    }

    finalizedRef.current = true;
    aiRequestFenRef.current = null;
    setResult(outcome);
    setShowResult(true);
    setReviewMode(false);

    const score = outcome === "white_win" ? 1 : outcome === "draw" ? 0.5 : 0;
    const currentClassic = Number(profile.elo?.classic ?? 1200);
    const nextClassic = calculateElo(currentClassic, aiEloByDifficulty[difficulty], score);
    const coinGain = outcome === "white_win" ? 10 : outcome === "draw" ? 5 : 3;
    const nextProfile = {
      ...profile,
      elo: { ...profile.elo, classic: nextClassic },
      coins: profile.coins + coinGain,
      wins: profile.wins + (outcome === "white_win" ? 1 : 0),
      losses: profile.losses + (outcome === "black_win" || outcome === "resigned" ? 1 : 0),
    };

    setProfile(nextProfile);
    setMessage(`${resultText(outcome)} +${coinGain} coins. ELO ${currentClassic} -> ${nextClassic}.`);
    await persistGame(finalGame, finalHistory, "finished", outcome);

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

  async function resign() {
    if (!gameId || result) {
      return;
    }

    await finalizeGame("resigned", game, history);
  }

  async function backHomeDuringGame() {
    if (!gameId || result) {
      return;
    }

    if (window.confirm("Resign this game and go back home?")) {
      await finalizeGame("resigned", game, history);
      window.location.href = "/";
    }
  }

  function reviewBoard() {
    setShowResult(false);
    setReviewMode(true);
    setSelected(null);
    setPromotion(null);
    setMessage("Review mode: final board is unlocked for inspection.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(320px,680px)_320px]">
      <div className="space-y-4">
        <div className="liquid-panel p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c9a227]">Classic vs AI</p>
              <h2 className="mt-1 text-2xl font-black text-white">Play Stockfish</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["Easy", "Medium", "Hard"] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => startGame(level)}
                  className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
                    difficulty === level
                      ? "border-[#c9a227] bg-[#c9a227]/20 text-[#f6d76b]"
                      : "border-white/10 bg-white/8 text-white/60 hover:text-white"
                  }`}
                >
                  {level}
                </button>
              ))}
              <button onClick={() => startGame()} className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-black text-black">
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

        <div className="relative">
          {(aiThinking || promotion) && (
            <div className="absolute inset-0 z-20 grid place-items-center rounded-[28px] bg-black/45 backdrop-blur-md">
              {promotion ? (
                <div className="liquid-panel p-5 text-center">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#c9a227]">Promote pawn</p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {(["q", "r", "b", "n"] as PieceSymbol[]).map((piece) => (
                      <button
                        key={piece}
                        onClick={() => playPlayerMove(promotion.from, promotion.to, piece)}
                        className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/10 text-4xl text-white hover:border-[#c9a227]"
                      >
                        {pieceGlyphs.w[piece]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
                  <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-[#f6d76b]">Stockfish thinking</p>
                </div>
              )}
            </div>
          )}
          <ChessBoard
            game={game}
            selected={selected}
            legalMoves={legalTargets}
            movableSquares={movableSquares}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
            threatSquares={queenThreat ? [queenThreat.queenSquare, ...queenThreat.attackers] : []}
            skin={profile.skin_equipped || "classic"}
            onSquare={handleSquare}
          />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="liquid-panel p-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c9a227]">State</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Turn" value={game.turn() === "w" ? "White" : "Black"} />
            <Stat label="AI" value={difficulty} />
            <Stat label="Moves" value={history.length} />
            <Stat label="Save" value={saving ? "Saving" : "Ready"} />
          </div>
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/65">{message}</p>
          {reviewMode && (
            <div className="mt-3 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-sm text-cyan-100">
              Review Board is active. Start a new game when you are ready.
            </div>
          )}
          {queenThreat && (
            <div className="mt-3 rounded-2xl border border-amber-300/35 bg-amber-300/12 p-3 text-sm text-amber-100">
              Queen threat: {queenThreat.attackers.join(", ")} attacking {queenThreat.queenSquare}.
            </div>
          )}
          {game.isCheck() && !result && (
            <div className="mt-3 rounded-2xl border border-red-400/35 bg-red-500/12 p-3 text-sm font-bold text-red-100">
              Check warning: {game.turn() === "w" ? "your" : "Stockfish"} king is under attack.
            </div>
          )}
          {!selected && movableSquares.length > 0 && (
            <p className="mt-3 text-xs leading-5 text-white/42">
              Подсвеченные фигуры могут ходить сейчас. Нажми на любую из них, чтобы увидеть конкретные клетки.
            </p>
          )}
          <button onClick={resign} className="mt-3 w-full rounded-md border border-red-400/35 px-4 py-3 font-black text-red-200 hover:bg-red-400/10">
            Resign
          </button>
        </div>

        <div className="liquid-panel p-4">
          <h3 className="font-bold text-white">Move history</h3>
          <div className="mt-3 max-h-60 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 font-mono text-sm text-white/72">
            {history.length ? (
              <div className="grid grid-cols-[44px_1fr_1fr] gap-y-2">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                  <MoveRow key={index} index={index} white={history[index * 2]?.san} black={history[index * 2 + 1]?.san} />
                ))}
              </div>
            ) : (
              <p className="font-sans text-white/45">Start a game to see moves.</p>
            )}
          </div>
        </div>

        <div className="liquid-panel p-4">
          <div className="grid grid-cols-2 gap-3">
            <CaptureTray label="You captured" pieces={capturedByWhite} color="b" />
            <CaptureTray label="AI captured" pieces={capturedByBlack} color="w" />
          </div>
        </div>
      </aside>

      {showResult && result && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="liquid-panel w-full max-w-md p-6 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#c9a227]">Game finished</p>
            <h2 className="mt-3 text-4xl font-black text-white">{resultText(result)}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => startGame()} className="rounded-md border border-white/10 px-5 py-3 font-black text-white/72 hover:text-white">
                Play Again
              </button>
              <button type="button" onClick={reviewBoard} className="rounded-md bg-[#c9a227] px-5 py-3 font-black text-black">
                Review Board
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}

function CaptureTray({ label, pieces, color }: { label: string; pieces: PieceSymbol[]; color: "w" | "b" }) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/36">{label}</p>
      <div className="mt-2 min-h-6 text-xl text-white/75">
        {pieces.map((piece, index) => (
          <span key={`${piece}-${index}`}>{pieceGlyphs[color][piece]}</span>
        ))}
      </div>
    </div>
  );
}

function resultText(result: GameOutcome) {
  if (result === "white_win") {
    return "You win!";
  }

  if (result === "black_win" || result === "resigned") {
    return "Stockfish wins.";
  }

  return "Draw.";
}
