"use client";

import { useTheme } from "@/app/lib/theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-md border border-white/10 bg-white/8 px-3 py-2 text-sm font-black text-white/70 transition hover:border-[#d4af37]/50 hover:text-white"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
