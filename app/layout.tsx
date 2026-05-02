import type { Metadata } from "next";
import type { ReactNode } from "react";
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
