"use client";

import type { Color, PieceSymbol } from "chess.js";
import type { Skin } from "@/app/lib/chess-platform";

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
  skin = "classic",
}: {
  color: Color;
  type: PieceSymbol;
  landed?: boolean;
  skin?: Skin;
}) {
  const gradientId = `${color}-${type}-piece-gradient`;
  const palette = piecePalette(skin, color);
  const stroke = palette.stroke;
  const fillTop = palette.top;
  const fillBottom = palette.bottom;
  const glow = palette.glow;

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

function piecePalette(skin: Skin, color: Color) {
  if (skin === "neon") {
    return color === "w"
      ? { top: "#a7f3d0", bottom: "#22d3ee", stroke: "#083344", glow: "rgba(34,211,238,0.75)" }
      : { top: "#f0abfc", bottom: "#7c3aed", stroke: "#1e0638", glow: "rgba(217,70,239,0.75)" };
  }

  if (skin === "gold") {
    return color === "w"
      ? { top: "#fff7ad", bottom: "#d4af37", stroke: "#6b4e00", glow: "rgba(250,204,21,0.72)" }
      : { top: "#f59e0b", bottom: "#451a03", stroke: "#0c0a09", glow: "rgba(245,158,11,0.62)" };
  }

  if (skin === "wood") {
    return color === "w"
      ? { top: "#fde7c7", bottom: "#b77945", stroke: "#633b20", glow: "rgba(251,191,36,0.38)" }
      : { top: "#7c4a2d", bottom: "#27150c", stroke: "#0c0a09", glow: "rgba(120,53,15,0.58)" };
  }

  if (skin === "tengri") {
    return color === "w"
      ? { top: "#ecfeff", bottom: "#22d3ee", stroke: "#075985", glow: "rgba(34,211,238,0.68)" }
      : { top: "#0ea5e9", bottom: "#082f49", stroke: "#020617", glow: "rgba(56,189,248,0.58)" };
  }

  if (skin === "steppe") {
    return color === "w"
      ? { top: "#fef3c7", bottom: "#d6a84f", stroke: "#7c4a03", glow: "rgba(245,158,11,0.5)" }
      : { top: "#78716c", bottom: "#1c1917", stroke: "#030712", glow: "rgba(180,83,9,0.54)" };
  }

  if (skin === "yurt") {
    return color === "w"
      ? { top: "#fff7ed", bottom: "#e7c79b", stroke: "#854d0e", glow: "rgba(253,186,116,0.52)" }
      : { top: "#991b1b", bottom: "#260909", stroke: "#030712", glow: "rgba(220,38,38,0.56)" };
  }

  return color === "w"
    ? { top: "#ffffff", bottom: "#d9d9d9", stroke: "#7b6a48", glow: "rgba(255,255,255,0.46)" }
    : { top: "#4b5563", bottom: "#111827", stroke: "#05070d", glow: "rgba(212,175,55,0.34)" };
}
