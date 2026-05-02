"use client";

import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";

const aiModes = [
  ["Classic", "/game/classic"],
];

const localModes = [
  ["Classic", "/game/local-multiplayer"],
  ["Switch Places", "/game/switch-places"],
  ["2v2 Team", "/game/2v2"],
  ["Fog of War", "/game/fog-of-war"],
  ["Chaos Mode", "/game/chaos-mode"],
  ["Speed Chess", "/game/speed-chess"],
];

export default function ModeSelectPage() {
  const { user, profile, loading } = useAuthProfile();

  if (loading) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading modes...</main>;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <main className="cm-page min-h-screen p-4 text-white">
      <div className="mx-auto max-w-7xl">
        <nav className="cm-panel mb-8 flex items-center justify-between p-4">
          <a href="/" className="font-black tracking-[0.18em]">
            ♛ CHAOSMATE
          </a>
          <span className="text-sm text-white/55">{profile?.username || "Player"}</span>
        </nav>

        <section className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#d4af37]">Choose how to play</p>
          <h1 className="mt-4 text-4xl font-black sm:text-6xl">AI, Local, or Online</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/58">Start with the right lobby, then pick the exact ChaosMate mode.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <ModeColumn title="Play with AI" icon="🤖" description="Only Classic uses the working Stockfish AI." modes={aiModes} />
          <ModeColumn title="Same Device" icon="👥" description="Pass-and-play with friends locally." modes={localModes} />
          <div className="cm-card p-6">
            <div className="text-4xl">🌐</div>
            <h2 className="mt-4 text-2xl font-black">Play Online</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-white/55">Create or join a room, share a link, and play from different devices.</p>
            <a href="/game/rooms" className="cm-button mt-6 w-full px-4 py-3 font-black">
              Open Rooms
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function ModeColumn({ title, icon, description, modes }: { title: string; icon: string; description: string; modes: string[][] }) {
  return (
    <div className="cm-card p-6">
      <div className="text-4xl">{icon}</div>
      <h2 className="mt-4 text-2xl font-black">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-white/55">{description}</p>
      <div className="mt-6 space-y-2">
        {modes.map(([label, href]) => (
          <a key={`${title}-${label}`} href={href} className="block rounded-md border border-white/10 bg-white/5 px-4 py-3 font-bold text-white/78 hover:border-[#d4af37]/55 hover:text-white">
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
