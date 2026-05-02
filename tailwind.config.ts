import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gold: "#d4af37",
        "dark-bg": "#0a0e27",
        "dark-card": "#151b2a",
        "board-light": "#eeeed2",
        "board-dark": "#769656",
      },
    },
  },
};

export default config;
