"use client";

import { leaderboard } from "@/app/lib/chess-platform";
import { signOut } from "@/app/lib/supabase";
import type { ChaosMateUser, Profile } from "@/app/lib/types";
import ThemeToggle from "@/app/components/ThemeToggle";

type GamePageProps = {
  user: ChaosMateUser;
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

const modes = [
  {
    title: "Classic vs AI",
    href: "/game/classic",
    icon: "♞",
    description: "Stockfish, full chess rules, ELO and coins.",
    tags: ["Easy", "Medium", "Hard"],
  },
  {
    title: "Switch Places",
    href: "/game/switch-places",
    icon: "↔",
    description: "Random side swaps with dramatic countdowns.",
    tags: ["Signature", "5-10 moves"],
  },
  {
    title: "2v2 Team Chess",
    href: "/game/2v2",
    icon: "♚♔",
    description: "Four seats split control of piece groups.",
    tags: ["Team", "Seats"],
  },
  {
    title: "Fog of War",
    href: "/game/fog-of-war",
    icon: "◌",
    description: "Only legal vision reveals hidden enemies.",
    tags: ["Vision", "Tactical"],
  },
  {
    title: "Chaos Mode",
    href: "/game/chaos-mode",
    icon: "ϟ",
    description: "Opponent pieces teleport every sixth move.",
    tags: ["Teleport", "Wild"],
  },
  {
    title: "Speed Chess",
    href: "/game/speed-chess",
    icon: "⚡",
    description: "Bullet or blitz timers with pressure states.",
    tags: ["30s", "3m"],
  },
  {
    title: "Local Multiplayer",
    href: "/game/local-multiplayer",
    icon: "♟",
    description: "Two players, one device, clean pass-and-play.",
    tags: ["Same device", "1v1"],
  },
];

export default function GamePage({ profile }: GamePageProps) {
  async function handleLogout() {
    try {
      await signOut();
      window.sessionStorage.clear();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.href = "/";
    }
  }

  if (!profile) {
    return (
      <div className="cm-page flex min-h-screen items-center justify-center">
        <p className="text-white">Loading profile...</p>
      </div>
    );
  }

  return (
    <main className="cm-page min-h-screen p-4 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="cm-panel mb-8 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-[#d4af37]/40 bg-[#d4af37]/12 text-2xl text-[#f7d96b]">♛</div>
            <div>
              <h1 className="text-2xl font-black tracking-[0.16em]">CHAOSMATE</h1>
              <p className="text-sm text-white/48">Chess. Reimagined.</p>
            </div>
          </a>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-right">
              <p className="text-sm text-white/45">Logged in as</p>
              <p className="font-semibold">{profile.username}</p>
            </div>
            <a href="/leaderboard" className="hidden rounded-md border border-white/10 px-4 py-2 font-semibold text-white/70 hover:text-white sm:inline">
              Leaderboard
            </a>
            <a href="/shop" className="hidden rounded-md border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-2 font-semibold text-[#f7d96b] sm:inline">
              Upgrade
            </a>
            <button onClick={handleLogout} className="rounded-md border border-red-300/25 bg-red-500/15 px-4 py-2 font-semibold text-red-100 transition-colors hover:bg-red-500/25">
              Logout
            </button>
          </div>
        </header>

        <section className="hero-board cm-panel mb-8 overflow-hidden p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d4af37]">Premium chess platform</p>
              <h2 className="mt-4 max-w-2xl text-4xl font-black leading-tight text-white sm:text-6xl">Experience Chess Like Never Before</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/62">
                Seven playable modes, tactical hints, profile persistence, coins, ELO, and a board designed to feel like a real product.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/game/mode-select" className="cm-button px-5 py-3 font-black">
                  Choose AI / Local / Online
                </a>
                <a href="/profile" className="rounded-md border border-white/10 px-5 py-3 font-black text-white/76 hover:text-white">
                  Profile
                </a>
              </div>
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#101626]">
              <div className="absolute inset-6 grid rotate-[-7deg] grid-cols-4 gap-3 opacity-95">
                {["♛", "♞", "♜", "♚", "♙", "♗", "♕", "♟"].map((piece, index) => (
                  <div key={`${piece}-${index}`} className="animate-float grid aspect-square place-items-center rounded-md border border-white/10 bg-white/[0.055] text-5xl text-[#d4af37]" style={{ animationDelay: `${index * 120}ms` }}>
                    {piece}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="cm-panel mb-8 overflow-hidden p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#d4af37]">Tournament announcement</p>
              <h2 className="mt-3 text-3xl font-black text-white">Weekend Arena unlocks at 100 players</h2>
              <p className="mt-3 text-base leading-7 text-white/62">
                When ChaosMate reaches 100 active players, we will launch weekly Friday, Saturday, and Sunday tournaments with a serious prize pool, live brackets, city rankings, coins, and exclusive champion badges.
              </p>
              <p className="mt-3 rounded-md border border-[#4ade80]/25 bg-[#4ade80]/10 p-3 text-sm font-bold leading-6 text-[#bbf7d0]">
                Invite a friend to ChaosMate and get 1 free tournament entry when the arena opens.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[430px]">
              <TournamentStat label="Entry" value="$2.99" detail="or 500 coins" />
              <TournamentStat label="Champion" value="$50+" detail="or 5000 coins" />
              <TournamentStat label="Target" value="100" detail="active players" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Invite friend = free entry", "Realtime bracket", "Weekend finals", "Kazakhstan city leaderboard", "Founder badge"].map((item) => (
              <span key={item} className="rounded-full border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-2 text-xs font-bold text-[#f7d96b]">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[#d4af37]/35 bg-[radial-gradient(circle_at_10%_20%,rgba(212,175,55,0.22),transparent_30%),linear-gradient(135deg,rgba(212,175,55,0.12),rgba(0,0,0,0.18))] p-5">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d4af37]">Separate offline event</p>
            <h3 className="mt-2 text-2xl font-black text-white">May 19, 2026: VERY BIG offline tournament</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-white/68">
              This is not the weekly arena. It is a separate high-stakes offline tournament with a much bigger prize pool. To participate, players must reach ChaosMate ELO 2000+.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-[0.12em]">Select Game Mode</h2>
                <p className="mt-1 text-sm text-white/45">Each mode opens on its own dedicated page.</p>
              </div>
              <a href="/game/rooms" className="rounded-md border border-[#4ade80]/30 bg-[#4ade80]/10 px-3 py-2 text-sm font-bold text-[#86efac]">
                Online Rooms
              </a>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {modes.map((mode) => (
                <ModeCard key={mode.href} {...mode} />
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="cm-panel p-6">
              <h3 className="mb-4 text-lg font-bold">YOUR STATS</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/45">Classic ELO</p>
                  <p className="text-3xl font-black text-[#d4af37]">{Number(profile.elo?.classic ?? 1200)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Wins" value={profile.wins} />
                  <Stat label="Losses" value={profile.losses} />
                  <Stat label="Coins" value={profile.coins} />
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-sm text-white/45">City</p>
                  <p className="text-lg font-bold">{profile.city}</p>
                </div>
              </div>
            </div>

            <div className="cm-panel p-6">
              <h3 className="mb-4 text-lg font-bold">KAZAKHSTAN LEADERBOARD</h3>
              <div className="space-y-2">
                {leaderboard.slice(0, 4).map((player, index) => (
                  <div key={player.username} className="grid grid-cols-[28px_1fr_52px] items-center rounded-md border border-white/10 bg-white/8 px-3 py-2">
                    <span className="font-black text-[#d4af37]">{index + 1}</span>
                    <span>
                      <span className="block text-sm font-semibold">{player.username}</span>
                      <span className="text-xs text-white/38">{player.city}</span>
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

function TournamentStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/22 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#b8ff38]">{value}</p>
      <p className="mt-1 text-xs font-bold text-white/48">{detail}</p>
    </div>
  );
}

function ModeCard({ title, href, icon, description, tags }: { title: string; href: string; icon: string; description: string; tags: string[] }) {
  return (
    <a href={href} className="cm-card group block p-5 transition duration-300 hover:-translate-y-1 hover:border-[#d4af37]/55">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-white/10 bg-[#0f172a] text-2xl text-[#d4af37]">{icon}</span>
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/56">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/48">
            {tag}
          </span>
        ))}
      </div>
      <span className="mt-5 inline-flex text-sm font-black uppercase tracking-[0.18em] text-[#d4af37]">Play</span>
    </a>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/8 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
