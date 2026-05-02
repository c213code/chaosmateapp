import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";

export type GameMode =
  | "classic-ai"
  | "local"
  | "online"
  | "switch"
  | "fog"
  | "chaos"
  | "speed"
  | "team";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Skin = "classic" | "neon" | "gold" | "wood";
export type BoardTheme = "royal-wood" | "chesscom-green" | "midnight-glass" | "emerald-club" | "carbon-arena";

export type TeamSeat =
  | "white-major"
  | "white-minor"
  | "black-major"
  | "black-minor";

export type PlayerProfile = {
  id: string;
  username: string;
  city: string;
  elo: Record<string, number>;
  coins: number;
  skin: Skin;
  wins: number;
  losses: number;
};

export const modeMeta: Record<
  GameMode,
  {
    title: string;
    eyebrow: string;
    description: string;
    ranked: boolean;
    accent: string;
  }
> = {
  "classic-ai": {
    title: "Classic vs AI",
    eyebrow: "Stockfish worker",
    description: "Full chess rules, promotion, castling, en passant, and three AI levels.",
    ranked: false,
    accent: "from-[#c9a227] to-[#f4dc7a]",
  },
  local: {
    title: "Local Multiplayer",
    eyebrow: "Same screen",
    description: "Pass-and-play chess with timers, capture trays, and move history.",
    ranked: false,
    accent: "from-[#8fd7ff] to-[#5d7cff]",
  },
  online: {
    title: "Online by Link",
    eyebrow: "Realtime room",
    description: "Create a room, share the link, and sync moves over Supabase Realtime.",
    ranked: true,
    accent: "from-[#7df8c7] to-[#2bb673]",
  },
  switch: {
    title: "Switch Places",
    eyebrow: "Signature mode",
    description: "Every few moves the board erupts and players inherit the opposite color.",
    ranked: true,
    accent: "from-[#ffcc33] to-[#ff5f6d]",
  },
  fog: {
    title: "Fog of War",
    eyebrow: "Hidden information",
    description: "You only see pieces inside the legal vision of your army.",
    ranked: true,
    accent: "from-[#b9a7ff] to-[#6750a4]",
  },
  chaos: {
    title: "Chaos Mode",
    eyebrow: "Teleport events",
    description: "Every six moves one opponent piece is jolted onto a random empty square.",
    ranked: true,
    accent: "from-[#67e8f9] to-[#f97316]",
  },
  speed: {
    title: "Speed Chess",
    eyebrow: "Bullet / Blitz",
    description: "Fast chess with loud timers, pressure states, and timeout handling.",
    ranked: true,
    accent: "from-[#facc15] to-[#ef4444]",
  },
  team: {
    title: "2v2 Team Chess",
    eyebrow: "4 players",
    description: "Teams split command of pawns, rooks, queens, bishops, knights, and kings.",
    ranked: true,
    accent: "from-[#f0abfc] to-[#38bdf8]",
  },
};

export const kazakhstanCities = [
  "Almaty",
  "Astana",
  "Shymkent",
  "Karaganda",
  "Aktobe",
  "Taraz",
  "Pavlodar",
  "Oskemen",
  "Semey",
  "Atyrau",
];

export const starterProfile: PlayerProfile = {
  id: "demo-user",
  username: "NomadKnight",
  city: "Almaty",
  elo: {
    Classic: 1420,
    Switch: 1510,
    Fog: 1375,
    Chaos: 1462,
    Team: 1328,
  },
  coins: 640,
  skin: "neon",
  wins: 84,
  losses: 49,
};

export const pieceGlyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  },
  b: {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  },
};

export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function createGame() {
  return new Chess();
}

export function squareName(fileIndex: number, rankIndex: number): Square {
  return `${files[fileIndex]}${rankIndex + 1}` as Square;
}

export function getBoardSquares(orientation: Color) {
  const ranks = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const orderedFiles = orientation === "w" ? files : [...files].reverse();

  return ranks.flatMap((rankIndex) =>
    orderedFiles.map((file) => {
      const fileIndex = files.indexOf(file);
      return {
        square: `${file}${rankIndex + 1}` as Square,
        file,
        rank: rankIndex + 1,
        isLight: (fileIndex + rankIndex) % 2 === 1,
      };
    }),
  );
}

export function getVisionSquares(game: Chess, color: Color) {
  const visible = new Set<Square>();
  const board = game.board();

  board.flat().forEach((piece) => {
    if (!piece || piece.color !== color) {
      return;
    }

    visible.add(piece.square);
    game.moves({ square: piece.square, verbose: true }).forEach((move) => {
      visible.add(move.to);
    });
  });

  return visible;
}

export function isControlledBySeat(piece: PieceSymbol, color: Color, seat: TeamSeat) {
  const major = piece === "p" || piece === "r" || piece === "q";
  const minor = piece === "n" || piece === "b" || piece === "k";

  if (color === "w") {
    return seat === "white-major" ? major : seat === "white-minor" ? minor : false;
  }

  return seat === "black-major" ? major : seat === "black-minor" ? minor : false;
}

export function nextSwitchMove(currentMove: number) {
  return currentMove + 5 + Math.floor(Math.random() * 6);
}

export function calculateElo(player: number, opponent: number, score: 0 | 0.5 | 1, k = 32) {
  const expected = 1 / (1 + 10 ** ((opponent - player) / 400));
  return Math.round(player + k * (score - expected));
}

export function teleportOpponentPiece(game: Chess, opponent: Color) {
  const board = game.board().flat();
  const movablePieces = board.filter(
    (piece): piece is NonNullable<typeof piece> =>
      Boolean(piece && piece.color === opponent && piece.type !== "k"),
  );

  if (!movablePieces.length) {
    return null;
  }

  const piece = movablePieces[Math.floor(Math.random() * movablePieces.length)];
  const empties: Square[] = [];

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = squareName(file, rank);
      if (!game.get(square)) {
        empties.push(square);
      }
    }
  }

  if (!piece || !empties.length) {
    return null;
  }

  const target = empties[Math.floor(Math.random() * empties.length)];
  game.remove(piece.square);
  game.put({ type: piece.type, color: piece.color }, target);

  return {
    from: piece.square,
    to: target,
    piece: piece.type,
    color: piece.color,
  };
}

export function moveToSan(move: Move | string) {
  return typeof move === "string" ? move : move.san;
}

export function getResultLabel(game: Chess) {
  if (game.isCheckmate()) {
    return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  }

  if (game.isStalemate()) {
    return "Draw by stalemate";
  }

  if (game.isDraw()) {
    return "Draw";
  }

  return null;
}

export const leaderboard = [
  { username: "AlemQueen", city: "Astana", classic: 2190, switch: 2260, badge: "Crown I" },
  { username: "SteppeRook", city: "Almaty", classic: 2114, switch: 2188, badge: "Crown II" },
  { username: "KhanFork", city: "Shymkent", classic: 2051, switch: 2142, badge: "Crown III" },
  { username: "KaragandaKing", city: "Karaganda", classic: 1985, switch: 2040, badge: "Diamond" },
  { username: "AtyrauAttack", city: "Atyrau", classic: 1921, switch: 1997, badge: "Gold" },
];

export const shopItems = [
  { name: "Neon Skin Pack", type: "Piece skin", priceCoins: 450, priceUsd: null },
  { name: "Gold Skin Pack", type: "Piece skin", priceCoins: 900, priceUsd: null },
  { name: "Cyberpunk Board", type: "Board theme", priceCoins: 1200, priceUsd: null },
  { name: "ChaosMate Pro", type: "Subscription", priceCoins: null, priceUsd: 9 },
];

export const aiCoachReport = {
  rating: "Sharp tactical play, 82/100",
  mistakes: [
    "Move 8: You released central tension too early and gave Black a clean knight outpost.",
    "Move 14: The queen trade was safe, but Qh5+ would have forced king movement.",
    "Move 21: You missed a rook lift that wins the h-pawn with tempo.",
  ],
  bestMissed: ["14. Qh5+", "21. Re3", "25. Bxf7+"],
};
