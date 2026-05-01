"use client";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { getBoardSquares, pieceGlyphs, type Skin } from "@/app/lib/chess-platform";

export default function ChessBoard({
  game,
  orientation = "w",
  selected,
  legalMoves,
  movableSquares,
  lastMove,
  threatSquares,
  skin = "classic",
  onSquare,
}: {
  game: Chess;
  orientation?: Color;
  selected?: Square | null;
  legalMoves?: Square[];
  movableSquares?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  threatSquares?: Square[];
  skin?: Skin;
  onSquare?: (square: Square) => void;
}) {
  const legal = new Set(legalMoves || []);
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
              onClick={() => onSquare?.(square)}
              className={`chess-square relative grid aspect-square place-items-center text-[clamp(1.4rem,6vw,4rem)] transition duration-300 ${
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
                    {pieceGlyphs[piece.color][piece.type as PieceSymbol]}
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
