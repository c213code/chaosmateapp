import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/app/lib/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChaosMate | Chess. Reimagined.",
  description:
    "A premium dark-themed chess platform with AI, realtime rooms, Switch Places, Fog of War, Chaos Mode, 2v2 teams, ELO, coins, and Kazakhstan leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('chaosmate-theme')||localStorage.getItem('theme')||'dark';document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.classList.toggle('cm-light',t==='light');}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
