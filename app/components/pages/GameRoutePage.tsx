"use client";

import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";
import ClassicVsAI from "@/app/components/game/ClassicVsAI";
import VariantChessGame from "@/app/components/game/VariantChessGame";
import ThemeToggle from "@/app/components/ThemeToggle";
import type { GameMode } from "@/app/lib/chess-platform";

export default function GameRoutePage({ mode }: { mode: GameMode }) {
  const { user, profile, setProfile, loading, profileReady } = useAuthProfile();

  if (loading) {
    return (
      <main className="cm-page grid min-h-screen place-items-center text-white">
        <div className="text-center">
          <div className="mb-4 text-4xl text-[#d4af37]">♛</div>
          <p>Loading ChaosMate...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!profile || !profileReady) {
    return (
      <main className="cm-page grid min-h-screen place-items-center text-white">
        <div className="cm-panel w-full max-w-sm p-6">
          <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-10 w-52 animate-pulse rounded bg-white/10" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-16 animate-pulse rounded-xl bg-white/10" />
            <div className="h-16 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cm-page min-h-screen text-white">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e27]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-[#d4af37]/50 bg-[#d4af37]/15 text-xl text-[#f7d96b]">♛</span>
            <div>
              <p className="text-lg font-black tracking-[0.18em] text-white">CHAOSMATE</p>
              <p className="text-xs text-white/45">Dedicated game page</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 sm:inline">
              ELO {Number(profile.elo?.classic ?? 1200)}
            </span>
            <span className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-sm font-bold text-[#f7d96b]">{profile.coins} coins</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {mode === "classic-ai" ? (
          <ClassicVsAI user={user} profile={profile} setProfile={setProfile} />
        ) : mode === "online" ? (
          <VariantChessGame mode="local" user={user} profile={profile} setProfile={setProfile} aiOpponent={false} />
        ) : (
          <VariantChessGame
            mode={mode}
            user={user}
            profile={profile}
            setProfile={setProfile}
            aiOpponent={false}
          />
        )}
      </div>
    </main>
  );
}
