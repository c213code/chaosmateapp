import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { calculateElo as calculateSingleElo } from "@/app/lib/chess-platform";

export const START_FEN = new Chess().fen();

export type MoveResult = {
  game: Chess;
  move: Move;
  newFen: string;
  newSan: string;
  newPgn: string;
  movesSan: string;
  history: Move[];
};

export function validateMove(fen: string, from: Square, to: Square, promotion: PieceSymbol = "q") {
  const game = new Chess(fen);
  return Boolean(game.move({ from, to, promotion }));
}

export function makeMove(game: Chess, from: Square, to: Square, promotion: PieceSymbol = "q"): MoveResult | null {
  const next = new Chess(game.fen());
  const move = next.move({ from, to, promotion });

  if (!move) {
    return null;
  }

  const history = next.history({ verbose: true });

  return {
    game: next,
    move,
    newFen: next.fen(),
    newSan: move.san,
    newPgn: next.pgn(),
    movesSan: history.map((item) => item.san).join(" "),
    history,
  };
}

export function isCheckmate(game: Chess) {
  return game.isCheckmate();
}

export function isStalemate(game: Chess) {
  return game.isStalemate();
}

export function calculateElo(winnerElo: number, loserElo: number, draw = false) {
  if (draw) {
    return {
      new_winner_elo: calculateSingleElo(winnerElo, loserElo, 0.5),
      new_loser_elo: calculateSingleElo(loserElo, winnerElo, 0.5),
    };
  }

  return {
    new_winner_elo: calculateSingleElo(winnerElo, loserElo, 1),
    new_loser_elo: calculateSingleElo(loserElo, winnerElo, 0),
  };
}

export function getGameResult(game: Chess): "white_win" | "black_win" | "draw" | null {
  if (game.isCheckmate()) {
    return game.turn() === "b" ? "white_win" : "black_win";
  }

  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    return "draw";
  }

  return null;
}

export function needsPromotion(fen: string, from: Square, to: Square) {
  const game = new Chess(fen);
  const piece = game.get(from);

  if (!piece || piece.type !== "p") {
    return false;
  }

  return game.moves({ square: from, verbose: true }).some((move) => move.to === to && move.promotion);
}

export function getQueenThreat(game: Chess, color: Color) {
  const queen = game
    .board()
    .flat()
    .find((piece) => piece?.color === color && piece.type === "q");

  if (!queen) {
    return null;
  }

  const opponent = color === "w" ? "b" : "w";
  const attackers = game.attackers(queen.square, opponent);

  if (!attackers.length) {
    return null;
  }

  return {
    queenSquare: queen.square,
    attackers,
    message: `${color === "w" ? "White" : "Black"} queen is under attack on ${queen.square}.`,
  };
}

export function getMovableSquares(game: Chess, color: Color) {
  return game
    .board()
    .flat()
    .filter((piece): piece is NonNullable<typeof piece> => Boolean(piece && piece.color === color))
    .filter((piece) => game.moves({ square: piece.square, verbose: true }).length > 0)
    .map((piece) => piece.square);
}
