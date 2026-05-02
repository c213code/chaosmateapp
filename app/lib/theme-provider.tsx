"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("cm-light", theme === "light");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const saved = (window.localStorage.getItem("chaosmate-theme") || window.localStorage.getItem("theme")) as Theme | null;
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  useEffect(() => {
    applyDocumentTheme(theme);

    const syncInventoryTheme = (event: Event) => {
      const next = (event as CustomEvent<{ theme?: Theme }>).detail?.theme;
      if (next === "light" || next === "dark") {
        setThemeState(next);
        applyDocumentTheme(next);
        window.localStorage.setItem("chaosmate-theme", next);
      }
    };

    window.addEventListener("chaosmate-inventory-change", syncInventoryTheme);
    return () => window.removeEventListener("chaosmate-inventory-change", syncInventoryTheme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        setThemeState(nextTheme);
        window.localStorage.setItem("chaosmate-theme", nextTheme);
        window.localStorage.setItem("theme", nextTheme);
        applyDocumentTheme(nextTheme);
      },
      toggleTheme: () => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setThemeState(nextTheme);
        window.localStorage.setItem("chaosmate-theme", nextTheme);
        window.localStorage.setItem("theme", nextTheme);
        applyDocumentTheme(nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
