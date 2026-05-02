"use client";

import type { BoardTheme, Skin } from "@/app/lib/chess-platform";

export type InventoryState = {
  skins: Skin[];
  boardThemes: BoardTheme[];
  emotes: string[];
  hasPass: boolean;
  elo1300Claimed: boolean;
  equippedSkin: Skin;
  equippedBoard: BoardTheme;
  theme: "dark" | "light";
};

const defaultInventory: InventoryState = {
  skins: ["classic"],
  boardThemes: ["royal-wood"],
  emotes: ["GG", "Nice move", "🔥"],
  hasPass: false,
  elo1300Claimed: false,
  equippedSkin: "classic",
  equippedBoard: "royal-wood",
  theme: "dark",
};

export function inventoryKey(userId: string) {
  return `chaosmate-inventory-${userId}`;
}

export function loadInventory(userId?: string): InventoryState {
  if (typeof window === "undefined" || !userId) {
    return defaultInventory;
  }

  const raw = window.localStorage.getItem(inventoryKey(userId));
  if (!raw) {
    return defaultInventory;
  }

  try {
    return { ...defaultInventory, ...JSON.parse(raw) } as InventoryState;
  } catch {
    return defaultInventory;
  }
}

export function saveInventory(userId: string, next: InventoryState) {
  window.localStorage.setItem(inventoryKey(userId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("chaosmate-inventory-change", { detail: next }));
}

export function applyTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("cm-light", theme === "light");
  window.localStorage.setItem("chaosmate-theme", theme);
  window.localStorage.setItem("theme", theme);
}
