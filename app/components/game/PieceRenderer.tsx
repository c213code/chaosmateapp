"use client";

import type { Color, PieceSymbol } from "chess.js";

const labels: Record<PieceSymbol, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

export default function PieceRenderer({
  color,
  type,
  landed = false,
}: {
  color: Color;
  type: PieceSymbol;
  landed?: boolean;
}) {
  const gradientId = `${color}-${type}-piece-gradient`;
  const stroke = color === "w" ? "#7b6a48" : "#05070d";
  const fillTop = color === "w" ? "#ffffff" : "#4b5563";
  const fillBottom = color === "w" ? "#d9d9d9" : "#111827";
  const glow = color === "w" ? "rgba(255,255,255,0.46)" : "rgba(212,175,55,0.34)";

  return (
    <svg
      className={`piece-svg ${color === "w" ? "piece-svg-white" : "piece-svg-black"} ${landed ? "piece-landed" : ""}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${color === "w" ? "White" : "Black"} ${type}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor={fillBottom} />
        </linearGradient>
        <filter id={`${gradientId}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="rgba(0,0,0,0.52)" />
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={glow} />
        </filter>
      </defs>
      <ellipse cx="50" cy="84" rx="28" ry="8" fill="rgba(0,0,0,0.25)" />
      <text
        x="50"
        y="69"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="78"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill={`url(#${gradientId})`}
        stroke={stroke}
        strokeWidth="2.4"
        paintOrder="stroke fill"
        filter={`url(#${gradientId}-shadow)`}
      >
        {labels[type]}
      </text>
      <path d="M29 79 C39 85 61 85 71 79" fill="none" stroke={color === "w" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.16)"} strokeWidth="2" />
    </svg>
  );
}
