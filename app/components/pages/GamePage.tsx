"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { leaderboard } from "@/app/lib/chess-platform";
import { createLocalMultiplayerGame, supabase } from "@/app/lib/supabase";
import type { ChaosMateUser, Profile } from "@/app/lib/types";
import ChessBoard from "@/app/components/game/ChessBoard";
import ClassicVsAI from "@/app/components/game/ClassicVsAI";

type GamePageProps = {
  user: ChaosMateUser;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

export default function GamePage({ user, profile, setProfile }: GamePageProps) {
  const [gameMode, setGameMode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const previewGame = useMemo(() => new Chess(), []);

  async function handleLogout() {
    await supabase?.auth.signOut();
  }

  async function handleNewGame(mode: string) {
    setGameMode(mode);
    setError("");

    if (mode === "local_multiplayer") {
      const { gameId, error: createError } = await createLocalMultiplayerGame(user.id);

      if (createError || !gameId) {
        setError(createError?.message || "Could not create local multiplayer game.");
        return;
      }

      window.location.href = `/game/local-multiplayer/${gameId}`;
      return;
    }
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
        <p className="text-white">Loading profile...</p>
      </div>
    );
  }

  const classicElo = Number(profile.elo?.classic ?? 1200);

  return (
    <main className="liquid-bg min-h-screen p-4 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="liquid-panel mb-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl text-[#c9a227]">♛</div>
            <div>
              <h1 className="text-2xl font-black tracking-[0.16em]">CHAOSMATE</h1>
              <p className="text-sm text-gray-400">Chess. Reimagined.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">Logged in as</p>
              <p className="font-semibold">{profile.username}</p>
            </div>
            <button onClick={handleLogout} className="rounded-xl border border-red-300/25 bg-red-500/15 px-4 py-2 font-semibold text-red-100 transition-colors hover:bg-red-500/25">
              Logout
            </button>
          </div>
        </header>

        {error && <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold">SELECT GAME MODE</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ModeCard
                title="♞ Classic vs AI"
                description="Play against Stockfish engine"
                active={gameMode === "classic_vs_ai"}
                onClick={() => handleNewGame("classic_vs_ai")}
                tags={["Easy", "Medium", "Hard"]}
              />
              <ModeCard
                title="♚♔ Local Multiplayer"
                description="Play against a friend on the same device"
                active={gameMode === "local_multiplayer"}
                onClick={() => handleNewGame("local_multiplayer")}
                tags={["Two Players", "Same Device"]}
              />
              <ModeCard disabled title="🌐 Online Multiplayer" description="Play with friends online" tags={["Coming Soon"]} />
              <ModeCard disabled title="↔ Switch Places" description="Colors swap mid-game" tags={["Coming Soon"]} />
            </div>

            <div className="liquid-panel mt-6 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{gameMode === "classic_vs_ai" ? "Classic Arena" : "Board Preview"}</h3>
                  <p className="text-sm text-gray-400">
                    {gameMode === "classic_vs_ai" ? "Animated moves, tactical hints, and Stockfish response." : "Game boards live behind the selected modes."}
                  </p>
                </div>
                <span className="rounded bg-[#0f0f0f] px-2 py-1 text-xs text-gray-400">Ready</span>
              </div>
              {gameMode === "classic_vs_ai" ? (
                <ClassicVsAI user={user} profile={profile} setProfile={setProfile} />
              ) : (
                <div className="mx-auto max-w-xl">
                  <ChessBoard game={previewGame} skin={profile.skin_equipped || "classic"} />
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="liquid-panel p-6">
              <h3 className="mb-4 text-lg font-bold">YOUR STATS</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Classic ELO</p>
                  <p className="text-2xl font-bold text-[#c9a227]">{classicElo}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Wins" value={profile.wins} />
                  <Stat label="Losses" value={profile.losses} />
                  <Stat label="Coins" value={profile.coins} />
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <p className="text-sm text-gray-400">City</p>
                  <p className="text-lg font-bold">{profile.city}</p>
                </div>
              </div>
            </div>

            <div className="liquid-panel p-6">
              <h3 className="mb-4 text-lg font-bold">LEADERBOARD</h3>
              <div className="space-y-2">
                {leaderboard.slice(0, 4).map((player, index) => (
                  <div key={player.username} className="grid grid-cols-[28px_1fr_52px] items-center rounded-2xl border border-white/10 bg-white/8 px-3 py-2">
                    <span className="font-black text-[#c9a227]">{index + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold">{player.username}</span>
                      <span className="text-xs text-gray-500">{player.city}</span>
                    </span>
                    <span className="text-sm font-bold">{player.classic}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ModeCard({
  title,
  description,
  tags,
  active = false,
  disabled = false,
  onClick,
}: {
  title: string;
  description: string;
  tags: string[];
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`liquid-tile rounded-3xl border p-6 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed border-gray-700/30 opacity-50"
          : active
            ? "border-[#c9a227] bg-[#c9a227]/15"
            : "border-[#c9a227]/25 hover:border-[#c9a227]"
      }`}
    >
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="mb-4 text-sm text-gray-400">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded bg-[#0f0f0f] px-2 py-1 text-xs text-gray-400">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
