"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { getBoardSquares, pieceGlyphs, type Skin } from "@/app/lib/chess-platform";
import {
  calculateElo,
  getGameResult,
  getMovableSquares,
  getQueenThreat,
  makeMove,
  needsPromotion,
  START_FEN,
} from "@/app/lib/gameLogic";
import {
  finishLocalGame,
  getLocalMultiplayerGame,
  joinLocalMultiplayerGame,
  offerLocalDraw,
  supabase,
  updateLocalGameMove,
  type LocalGameResult,
  type LocalGameRow,
} from "@/app/lib/supabase";

type Profile = {
  id: string;
  username: string;
  elo: Record<string, number>;
  coins: number;
  skin_equipped: Skin;
  wins: number;
  losses: number;
};

type PromotionState = { from: Square; to: Square } | null;
type DrawOffer = "w" | "b" | null;

export default function LocalMultiplayerGame({ gameId }: { gameId: string }) {
  const [row, setRow] = useState<LocalGameRow | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionState>(null);
  const [orientation, setOrientation] = useState<Color>("w");
  const [status, setStatus] = useState<LocalGameRow["status"]>("waiting_for_opponent");
  const [result, setResult] = useState<LocalGameResult | null>(null);
  const [drawOffer, setDrawOffer] = useState<DrawOffer>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading local game...");
  const [joinCountdown, setJoinCountdown] = useState(5);
  const [showResult, setShowResult] = useState(false);
  const finalizedRef = useRef(false);

  const game = useMemo(() => new Chess(fen), [fen]);
  const turn = game.turn();
  const legalTargets = selected ? game.moves({ square: selected, verbose: true }).map((move) => move.to) : [];
  const movableSquares = status === "active" && !result && !saving ? getMovableSquares(game, turn) : [];
  const lastMove = history.at(-1);
  const queenThreat = getQueenThreat(game, turn);
  const capturedByWhite = history
    .filter((move) => move.color === "w" && move.captured)
    .map((move) => move.captured)
    .filter((piece): piece is PieceSymbol => Boolean(piece));
  const capturedByBlack = history
    .filter((move) => move.color === "b" && move.captured)
    .map((move) => move.captured)
    .filter((piece): piece is PieceSymbol => Boolean(piece));

  const loadGame = useCallback(async () => {
    const { game: loaded, error } = await getLocalMultiplayerGame(gameId);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!loaded) {
      setMessage("Game not found.");
      return;
    }

    setRow(loaded);
    setStatus(loaded.status);
    setResult(loaded.result);
    setFen(loaded.fen && loaded.fen !== "start" ? loaded.fen : START_FEN);
    setDrawOffer(loaded.draw_offered_by ? "w" : null);
    setShowResult(loaded.status === "finished");

    const loadedGame = hydrateGame(loaded);
    setHistory(loadedGame.history({ verbose: true }));
    setOrientation(loadedGame.turn());
    setMessage(loaded.status === "waiting_for_opponent" ? "Waiting for second player..." : "Game ready.");
  }, [gameId]);

  const loadProfile = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      return;
    }

    const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadGame();
  }, [loadGame, loadProfile]);

  const joinAsBlack = useCallback(async () => {
    setSaving(true);
    const { error } = await joinLocalMultiplayerGame(gameId);
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setStatus("active");
    setMessage("Board ready. White moves first.");
    setRow((current) => (current ? { ...current, status: "active" } : current));
  }, [gameId]);

  useEffect(() => {
    if (status !== "waiting_for_opponent") {
      return;
    }

    if (joinCountdown <= 0) {
      joinAsBlack();
      return;
    }

    const timeout = window.setTimeout(() => setJoinCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [joinAsBlack, joinCountdown, status]);

  function handleSquare(square: Square) {
    if (status !== "active" || result || saving) {
      return;
    }

    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }

      const clickedPiece = game.get(square);
      if (clickedPiece?.color === turn) {
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
    setSelected(piece?.color === turn ? square : null);
  }

  function playMove(from: Square, to: Square, promotionPiece: PieceSymbol = "q") {
    const moveResult = makeMove(game, from, to, promotionPiece);

    if (!moveResult) {
      setSelected(null);
      return false;
    }

    setFen(moveResult.newFen);
    setHistory(moveResult.history);
    setSelected(null);
    setPromotion(null);
    setDrawOffer(null);
    setIsFlipping(true);
    setOrientation(moveResult.game.turn());
    window.setTimeout(() => setIsFlipping(false), 650);
    const threat = getQueenThreat(moveResult.game, moveResult.game.turn());
    setMessage(
      threat
        ? `${moveResult.game.turn() === "w" ? "White" : "Black"}'s turn. Queen threat on ${threat.queenSquare}.`
        : `${moveResult.game.turn() === "w" ? "White" : "Black"}'s turn.`,
    );
    persistMove(moveResult.newFen, moveResult.movesSan, moveResult.newPgn);

    const nextResult = getGameResult(moveResult.game);
    if (nextResult) {
      finalizeGame(nextResult, moveResult.game);
    }

    return true;
  }

  async function persistMove(newFen: string, movesSan: string, newPgn: string) {
    setSaving(true);
    const { error } = await updateLocalGameMove(gameId, newFen, movesSan, newPgn);
    setSaving(false);

    if (error) {
      setMessage(error.message);
    }
  }

  async function handleDraw() {
    if (status !== "active" || result) {
      return;
    }

    if (drawOffer && drawOffer !== turn) {
      await finalizeGame("draw", game);
      return;
    }

    setDrawOffer(turn);
    setMessage(`${turn === "w" ? "White" : "Black"} offered a draw. ${turn === "w" ? "Black" : "White"} can accept on their turn.`);

    if (row?.white_player_id) {
      await offerLocalDraw(gameId, row.white_player_id);
    }
  }

  async function resign() {
    if (status !== "active" || result) {
      return;
    }

    await finalizeGame(turn === "w" ? "black_win" : "white_win", game);
  }

  async function finalizeGame(nextResult: LocalGameResult, finalGame: Chess) {
    if (finalizedRef.current) {
      return;
    }

    finalizedRef.current = true;
    setResult(nextResult);
    setStatus("finished");
    setShowResult(true);
    setMessage(resultText(nextResult));
    setSaving(true);

    await finishLocalGame(gameId, nextResult);
    await updateProfileRewards(nextResult);

    setSaving(false);
  }

  async function updateProfileRewards(nextResult: LocalGameResult) {
    if (!supabase || !profile) {
      return;
    }

    const classic = Number(profile.elo?.classic ?? 1200);
    const opponentElo = classic;
    const draw = nextResult === "draw";
    const whiteWon = nextResult === "white_win";
    const whiteLost = nextResult === "black_win" || nextResult === "resigned";
    const eloResult = whiteWon
      ? calculateElo(classic, opponentElo)
      : whiteLost
        ? calculateElo(opponentElo, classic)
        : calculateElo(classic, opponentElo, true);
    const nextClassic = whiteLost ? eloResult.new_loser_elo : eloResult.new_winner_elo;
    const nextCoins = profile.coins + (draw ? 5 : whiteWon ? 10 : 5);
    const nextProfile = {
      ...profile,
      elo: { ...profile.elo, classic: nextClassic },
      coins: nextCoins,
      wins: profile.wins + (whiteWon ? 1 : 0),
      losses: profile.losses + (whiteLost ? 1 : 0),
    };

    setProfile(nextProfile);
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

  const waiting = status === "waiting_for_opponent";
  const skin = profile?.skin_equipped || "classic";

  return (
    <main className="liquid-bg min-h-screen overflow-hidden text-[#f5f2e9]">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#0f0f0f]/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-[#c9a227]/50 bg-[#c9a227]/15 text-xl text-[#f6d76b]">
              ♛
            </span>
            <div>
              <p className="text-lg font-black tracking-[0.18em] text-white">CHAOSMATE</p>
              <p className="text-xs text-white/45">Local multiplayer</p>
            </div>
          </a>
          <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
            Game {gameId.slice(0, 8)}
          </span>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(320px,760px)_360px] lg:px-8">
        <div className="space-y-4">
          <TurnBanner turn={turn} waiting={waiting} />

          <div className="relative mx-auto w-[min(90vw,760px)]">
            {waiting && (
              <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-[#0f0f0f]/72 backdrop-blur-md">
                <div className="max-w-sm rounded-xl border border-[#c9a227]/35 bg-[#111]/95 p-6 text-center shadow-2xl">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#c9a227]">Waiting for second player</p>
                  <p className="mt-3 text-white/65">Join as Black on this device to begin. Auto-joining in {joinCountdown}s.</p>
                  <button
                    onClick={joinAsBlack}
                    disabled={saving}
                    className="mt-5 w-full rounded-md bg-[#c9a227] px-4 py-3 font-black text-[#111] disabled:opacity-55"
                  >
                    Join as Black
                  </button>
                </div>
              </div>
            )}

            {promotion && (
              <div className="absolute inset-0 z-30 grid place-items-center rounded-xl bg-[#0f0f0f]/55 backdrop-blur-sm">
                <div className="rounded-xl border border-[#c9a227]/40 bg-[#111]/95 p-5 text-center shadow-2xl">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#c9a227]">Promote pawn</p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {(["q", "r", "b", "n"] as PieceSymbol[]).map((piece) => (
                      <button
                        key={piece}
                        onClick={() => playMove(promotion.from, promotion.to, piece)}
                        className="grid h-16 w-16 place-items-center rounded-md border border-white/10 bg-white/8 text-4xl text-white hover:border-[#c9a227]"
                      >
                        {pieceGlyphs[turn][piece]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className={`transition-transform duration-[600ms] ease-in-out ${isFlipping ? "local-board-flipping" : ""}`}>
              <ChessBoard
                game={game}
                orientation={orientation}
                selected={selected}
                legalMoves={legalTargets}
                movableSquares={movableSquares}
                lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
                threatSquares={queenThreat ? [queenThreat.queenSquare, ...queenThreat.attackers] : []}
                skin={skin}
                onSquare={handleSquare}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <GlassPanel>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#c9a227]">Controls</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button onClick={handleDraw} className="rounded-md border border-[#c9a227]/50 px-4 py-3 font-black text-[#f6d76b] hover:bg-[#c9a227]/10">
                {drawOffer && drawOffer !== turn ? "Accept Draw" : "Offer Draw"}
              </button>
              <button onClick={resign} className="rounded-md border border-red-400/35 px-4 py-3 font-black text-red-200 hover:bg-red-400/10">
                Resign
              </button>
            </div>
            <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/65">{message}</p>
            {queenThreat && (
              <div className="mt-3 rounded-2xl border border-amber-300/35 bg-amber-300/12 p-3 text-sm text-amber-100">
                Queen threat: {queenThreat.attackers.join(", ")} attacking {queenThreat.queenSquare}.
              </div>
            )}
            {!selected && movableSquares.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-white/42">
                Подсвеченные фигуры могут ходить сейчас. Нажми на фигуру, чтобы увидеть клетки.
              </p>
            )}
            {saving && <p className="mt-3 text-sm text-white/45">Saving game...</p>}
          </GlassPanel>

          <GlassPanel>
            <h2 className="text-lg font-bold text-white">Move history</h2>
            <div className="mt-3 max-h-64 overflow-auto rounded-md border border-white/10 bg-black/20 p-3 font-mono text-sm text-white/72">
              {history.length ? (
                <div className="grid grid-cols-[44px_1fr_1fr] gap-y-2">
                  {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                    <MoveRow key={index} index={index} white={history[index * 2]?.san} black={history[index * 2 + 1]?.san} />
                  ))}
                </div>
              ) : (
                <p className="font-sans text-white/45">Moves appear here after White starts.</p>
              )}
            </div>
          </GlassPanel>

          <GlassPanel>
            <div className="grid grid-cols-2 gap-3">
              <CaptureTray label="White captured" pieces={capturedByWhite} color="b" />
              <CaptureTray label="Black captured" pieces={capturedByBlack} color="w" />
            </div>
          </GlassPanel>
        </aside>
      </section>

      {showResult && result && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#c9a227]/35 bg-[#101010] p-6 text-center shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#c9a227]">Game finished</p>
            <h2 className="mt-3 text-4xl font-black text-white">{resultText(result)}</h2>
            <p className="mt-3 text-sm leading-6 text-white/58">Result saved to Supabase with final FEN, PGN, SAN move list, and end timestamp.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href="/" className="rounded-md border border-white/10 px-4 py-3 font-black text-white/72 hover:text-white">
                Home
              </a>
              <button type="button" onClick={() => setShowResult(false)} className="rounded-md bg-[#c9a227] px-4 py-3 font-black text-[#111]">
                Review Board
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TurnBanner({ turn, waiting }: { turn: Color; waiting: boolean }) {
  if (waiting) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 text-center backdrop-blur-xl">
        <p className="text-xl font-black text-white">Waiting for second player...</p>
      </div>
    );
  }

  const whiteTurn = turn === "w";

  return (
    <div
      className={`rounded-xl border p-4 text-center shadow-2xl transition-colors duration-300 ${
        whiteTurn
          ? "border-[#c9a227]/45 bg-[#c9a227]/18 text-[#f6d76b]"
          : "border-slate-400/25 bg-slate-600/30 text-slate-100"
      }`}
    >
      <p className="text-2xl font-black">{whiteTurn ? "White's Turn" : "Black's Turn"}</p>
    </div>
  );
}

function ChessBoard({
  game,
  orientation,
  selected,
  legalMoves,
  movableSquares,
  lastMove,
  threatSquares,
  skin,
  onSquare,
}: {
  game: Chess;
  orientation: Color;
  selected: Square | null;
  legalMoves: Square[];
  movableSquares?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  threatSquares?: Square[];
  skin: Skin;
  onSquare: (square: Square) => void;
}) {
  const legal = new Set(legalMoves);
  const movable = new Set(movableSquares || []);
  const threats = new Set(threatSquares || []);

  return (
    <div className="board-shell rounded-xl border border-white/10 p-2 shadow-2xl shadow-black/50">
      <div className="board-grid grid aspect-square w-full grid-cols-8 overflow-hidden rounded-[22px]">
        {getBoardSquares(orientation).map(({ square, isLight, file, rank }) => {
          const piece = game.get(square);
          const isSelected = selected === square;
          const isLegal = legal.has(square);
          const isMovable = movable.has(square);
          const isLastMove = lastMove?.from === square || lastMove?.to === square;
          const isLanding = lastMove?.to === square;
          const isThreat = threats.has(square);
          const edgeRank = orientation === "w" ? 1 : 8;
          const edgeFile = orientation === "w" ? "a" : "h";

          return (
            <button
              key={square}
              onClick={() => onSquare(square)}
              className={`chess-square relative grid aspect-square place-items-center text-[clamp(1.7rem,7vw,4.4rem)] transition duration-300 ${
                isLight ? "light-square" : "dark-square"
              } ${isSelected ? "ring-4 ring-inset ring-[#f6d76b]" : ""} ${isMovable && !isSelected ? "movable-square" : ""} ${isLastMove ? "last-move-square" : ""} ${
                isThreat ? "threat-square" : ""
              }`}
              aria-label={square}
            >
              {rank === edgeRank && <span className="absolute bottom-1 right-1 text-[10px] font-bold uppercase text-black/45">{file}</span>}
              {file === edgeFile && <span className="absolute left-1 top-1 text-[10px] font-bold text-black/45">{rank}</span>}
              {isLegal && <span className="absolute h-4 w-4 rounded-full bg-[#c9a227]/85 shadow-[0_0_18px_rgba(201,162,39,0.8)]" />}
              {isMovable && !selected && <span className="movable-piece-halo" />}
              {piece && (
                <span className={`piece-token ${piece.color === "w" ? "token-white" : "token-black"} ${isLanding ? "piece-landed" : ""}`}>
                  <span className={`piece piece-${skin} ${piece.color === "w" ? "piece-white" : "piece-black"}`}>
                    {pieceGlyphs[piece.color][piece.type]}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PremiumBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 opacity-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(201,162,39,0.22),transparent_26%),radial-gradient(circle_at_80%_16%,rgba(26,26,46,0.92),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.045)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.035)_50%,rgba(255,255,255,0.035)_75%,transparent_75%)] bg-[length:auto,auto,88px_88px]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0f0f0f] to-transparent" />
    </div>
  );
}

function GlassPanel({ children }: { children: React.ReactNode }) {
  return <div className="liquid-panel p-5">{children}</div>;
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

function CaptureTray({ label, pieces, color }: { label: string; pieces: PieceSymbol[]; color: Color }) {
  return (
    <div className="rounded-md bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/36">{label}</p>
      <div className="mt-2 min-h-6 text-xl text-white/75">
        {pieces.map((piece, index) => (
          <span key={`${piece}-${index}`}>{pieceGlyphs[color][piece]}</span>
        ))}
      </div>
    </div>
  );
}

function resultText(result: LocalGameResult) {
  if (result === "white_win") {
    return "White wins!";
  }

  if (result === "black_win") {
    return "Black wins!";
  }

  if (result === "resigned") {
    return "Game resigned";
  }

  return "Draw";
}

function hydrateGame(row: LocalGameRow) {
  if (row.moves_pgn) {
    const game = new Chess();
    try {
      game.loadPgn(row.moves_pgn);
      return game;
    } catch {
      return new Chess(row.fen && row.fen !== "start" ? row.fen : START_FEN);
    }
  }

  return new Chess(row.fen && row.fen !== "start" ? row.fen : START_FEN);
}
