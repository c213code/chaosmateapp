"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";
import { kazakhstanCities, leaderboard } from "@/app/lib/chess-platform";
import { supabase } from "@/app/lib/supabase";

type LeaderboardRow = {
  username: string;
  city: string;
  classic: number;
  wins: number;
  losses: number;
  coins: number;
};

export default function GameRouteUtilityPage({ view }: { view: "profile" | "leaderboard" | "shop" }) {
  const { user, profile, loading } = useAuthProfile();
  const [cityFilter, setCityFilter] = useState("All cities");
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (view !== "leaderboard" || !supabase) {
      return;
    }

    const client = supabase;
    let alive = true;

    async function loadLeaderboard() {
      const { data } = await client
        .from("users")
        .select("username,city,elo,wins,losses,coins")
        .limit(100);

      if (!alive || !data) {
        return;
      }

      setLiveLeaderboard(
        data
          .map((item) => ({
            username: String(item.username || "Player"),
            city: String(item.city || "Almaty"),
            classic: Number((item.elo as Record<string, number> | null)?.classic ?? 1200),
            wins: Number(item.wins || 0),
            losses: Number(item.losses || 0),
            coins: Number(item.coins || 0),
          }))
          .sort((a, b) => b.classic - a.classic),
      );
    }

    loadLeaderboard();

    return () => {
      alive = false;
    };
  }, [view]);

  const leaderboardRows = useMemo(() => {
    const rows = liveLeaderboard.length
      ? liveLeaderboard
      : leaderboard.map((player) => ({ username: player.username, city: player.city, classic: player.classic, wins: 0, losses: 0, coins: 0 }));

    return cityFilter === "All cities" ? rows : rows.filter((player) => player.city === cityFilter);
  }, [cityFilter, liveLeaderboard]);

  if (loading) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading ChaosMate...</main>;
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!profile) {
    return <main className="cm-page grid min-h-screen place-items-center text-white">Loading profile...</main>;
  }

  return (
    <main className="cm-page min-h-screen p-4 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="cm-panel mb-8 flex items-center justify-between p-4">
          <a href="/" className="font-black tracking-[0.18em] text-white">
            ♛ CHAOSMATE
          </a>
          <div className="flex gap-2">
            <a className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white" href="/profile">
              Profile
            </a>
            <a className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white" href="/leaderboard">
              Leaderboard
            </a>
            <a className="rounded-md border border-[#d4af37]/35 bg-[#d4af37]/10 px-3 py-2 text-sm font-bold text-[#f7d96b]" href="/shop">
              Shop
            </a>
          </div>
        </nav>

        {view === "profile" && (
          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="cm-panel p-6">
              <div className="grid h-24 w-24 place-items-center rounded-2xl border border-[#d4af37]/35 bg-[#d4af37]/10 text-5xl">♛</div>
              <h1 className="mt-5 text-3xl font-black">{profile.username}</h1>
              <p className="text-white/48">{profile.city}</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <Stat label="Wins" value={profile.wins} />
                <Stat label="Losses" value={profile.losses} />
                <Stat label="Coins" value={profile.coins} />
              </div>
            </div>
            <div className="cm-panel p-6">
              <h2 className="text-xl font-black">Mode ELO</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {Object.entries(profile.elo || {}).map(([mode, value]) => (
                  <div key={mode} className="rounded-md border border-white/10 bg-white/8 p-4">
                    <p className="text-sm uppercase tracking-[0.16em] text-white/38">{mode}</p>
                    <p className="mt-1 text-2xl font-black text-[#d4af37]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === "leaderboard" && (
          <section className="cm-panel p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">Kazakhstan leaderboard</p>
                <h1 className="mt-2 text-3xl font-black">Global rankings by city</h1>
              </div>
              <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className="rounded-md border border-white/10 bg-[#0f172a] px-3 py-2 text-white">
                <option>All cities</option>
                {kazakhstanCities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="mt-6 space-y-3">
              {leaderboardRows.map((player, index) => (
                <div key={`${player.username}-${player.city}`} className="grid grid-cols-[42px_1fr_96px_90px] items-center rounded-md border border-white/10 bg-white/8 px-4 py-3">
                  <span className="text-xl font-black text-[#d4af37]">{index < 3 ? "♛" : index + 1}</span>
                  <span>
                    <span className="block font-bold">{player.username}</span>
                    <span className="text-sm text-white/42">{player.city} · {player.wins}W/{player.losses}L</span>
                  </span>
                  <span className="text-right text-sm font-bold text-[#f7d96b]">{player.coins} coins</span>
                  <span className="text-right font-black">{player.classic}</span>
                </div>
              ))}
              {!leaderboardRows.length && <p className="rounded-md border border-white/10 bg-white/8 p-4 text-white/55">No players in this city yet.</p>}
            </div>
          </section>
        )}

        {view === "shop" && (
          <section>
            <div className="cm-panel mb-6 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#d4af37]">Coins and skins</p>
              <h1 className="mt-2 text-3xl font-black">ChaosMate Shop</h1>
              <p className="mt-2 text-white/55">Balance: {profile.coins} coins. Stripe Pro upgrade is ready as a UI placeholder.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {["Neon", "Gold", "Wood", "Cyberpunk", "Marble", "Founders Pro"].map((item, index) => (
                <div key={item} className="cm-card p-5">
                  <div className="grid aspect-video place-items-center rounded-md border border-white/10 bg-[#101626] text-5xl text-[#d4af37]">♞</div>
                  <h2 className="mt-4 text-xl font-black">{item}</h2>
                  <p className="mt-1 text-sm text-white/50">{index === 5 ? "Pro exclusive. Coming soon via Stripe." : "Premium piece skin pack."}</p>
                  <button className="cm-button mt-4 w-full px-4 py-3 font-black">{index === 5 ? "Upgrade to Pro" : `${300 + index * 120} coins`}</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
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
