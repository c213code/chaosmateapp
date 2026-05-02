"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";
import { kazakhstanCities, leaderboard } from "@/app/lib/chess-platform";
import { supabase } from "@/app/lib/supabase";
import type { Profile } from "@/app/lib/types";

type LeaderboardRow = {
  username: string;
  city: string;
  classic: number;
  wins: number;
  losses: number;
  coins: number;
};

const pieceSkins = [
  { id: "classic", name: "Classic", price: 0, preview: "♔♞", tone: "from-zinc-100 to-zinc-400" },
  { id: "neon", name: "Neon", price: 320, preview: "♕♘", tone: "from-cyan-300 to-fuchsia-500" },
  { id: "gold", name: "Gold", price: 520, preview: "♛♞", tone: "from-[#fff0a3] to-[#b8860b]" },
  { id: "wood", name: "Wood", price: 420, preview: "♜♟", tone: "from-amber-200 to-stone-700" },
] as const;

const boardThemes = [
  { name: "Royal Wood", price: 260, light: "#e8dcc4", dark: "#a97b59" },
  { name: "Midnight Glass", price: 380, light: "#c7d2fe", dark: "#111827" },
  { name: "Emerald Club", price: 460, light: "#d1fae5", dark: "#047857" },
  { name: "Carbon Arena", price: 560, light: "#d4d4d8", dark: "#27272a" },
];

const emotePacks = [
  { name: "GG Pack", price: 90, items: ["GG", "Nice move", "Rematch?"] },
  { name: "Chaos Reactions", price: 140, items: ["🔥", "⚡", "No way"] },
  { name: "Kazakh Hype", price: 160, items: ["Alga!", "Ketti!", "Top move"] },
];

const coinPacks = [
  { name: "Starter Coins", coins: 500, price: "$2.99" },
  { name: "Club Stack", coins: 1400, price: "$6.99" },
  { name: "Founder Vault", coins: 3600, price: "$14.99" },
];

export default function GameRouteUtilityPage({ view }: { view: "profile" | "leaderboard" | "shop" }) {
  const { user, profile, setProfile, loading } = useAuthProfile();
  const [cityFilter, setCityFilter] = useState("All cities");
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardRow[]>([]);
  const [shopMessage, setShopMessage] = useState("");
  const [hasPass, setHasPass] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

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

  useEffect(() => {
    if (!profile || view !== "shop") {
      return;
    }

    setHasPass(window.localStorage.getItem(`chaosmate-pass-${profile.id}`) === "owned");
    setRewardClaimed(window.localStorage.getItem(`chaosmate-elo1300-${profile.id}`) === "claimed");
  }, [profile, view]);

  async function saveProfile(nextProfile: Profile) {
    setProfile(nextProfile);

    if (supabase) {
      await supabase
        .from("users")
        .update({
          coins: nextProfile.coins,
          skin_equipped: nextProfile.skin_equipped,
        })
        .eq("id", nextProfile.id);
    }
  }

  async function spendCoins(price: number, onSuccess: (nextProfile: Profile) => Profile, label: string) {
    if (!profile) {
      return;
    }

    if (profile.coins < price) {
      setShopMessage(`Need ${price - profile.coins} more coins for ${label}.`);
      return;
    }

    await saveProfile(onSuccess({ ...profile, coins: profile.coins - price }));
    setShopMessage(`${label} unlocked.`);
  }

  async function buyCoinPack(coins: number, label: string) {
    if (!profile) {
      return;
    }

    await saveProfile({ ...profile, coins: profile.coins + coins });
    setShopMessage(`${label}: +${coins} coins added. Stripe checkout placeholder.`);
  }

  async function claimEloReward() {
    if (!profile || rewardClaimed) {
      return;
    }

    const classicElo = Number(profile.elo?.classic ?? 1200);
    if (classicElo < 1300) {
      setShopMessage(`Reach Classic ELO 1300 to claim. Current: ${classicElo}.`);
      return;
    }

    const reward = hasPass ? 80 : 20;
    window.localStorage.setItem(`chaosmate-elo1300-${profile.id}`, "claimed");
    setRewardClaimed(true);
    await saveProfile({ ...profile, coins: profile.coins + reward });
    setShopMessage(`ELO 1300 reward claimed: +${reward} coins.`);
  }

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
          <section className="space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-[#d4af37]/25 bg-[radial-gradient(circle_at_15%_10%,rgba(212,175,55,0.24),transparent_28%),linear-gradient(135deg,rgba(21,27,42,0.96),rgba(6,10,25,0.9))] p-6 shadow-2xl shadow-black/40">
              <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#d4af37]">Premium catalog</p>
                  <h1 className="mt-2 text-4xl font-black">ChaosMate Market</h1>
                  <p className="mt-3 max-w-2xl text-white/60">Board themes, piece skins, game emotes, coin packs, and the Chaos Pass reward track.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm text-white/48">Balance</p>
                  <p className="text-4xl font-black text-[#f7d96b]">{profile.coins} coins</p>
                  <p className="mt-1 text-xs text-white/42">Equipped: {profile.skin_equipped}</p>
                </div>
              </div>
              {shopMessage && <p className="mt-5 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-3 text-sm font-bold text-[#f7d96b]">{shopMessage}</p>}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="cm-panel p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Chaos Pass</p>
                <h2 className="mt-2 text-2xl font-black">ELO 1300 milestone</h2>
                <p className="mt-2 text-sm text-white/55">Free players claim 20 coins at Classic ELO 1300. Pass owners claim 80 coins.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ShopMetric label="Your classic ELO" value={Number(profile.elo?.classic ?? 1200)} />
                  <ShopMetric label="Free reward" value="20 coins" />
                  <ShopMetric label="Pass reward" value="80 coins" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button onClick={claimEloReward} disabled={rewardClaimed} className="cm-button px-4 py-3 font-black disabled:opacity-45">
                    {rewardClaimed ? "Reward claimed" : "Claim ELO reward"}
                  </button>
                  <button
                    onClick={() =>
                      spendCoins(
                        700,
                        (nextProfile) => {
                          window.localStorage.setItem(`chaosmate-pass-${nextProfile.id}`, "owned");
                          setHasPass(true);
                          return nextProfile;
                        },
                        "Chaos Pass",
                      )
                    }
                    disabled={hasPass}
                    className="rounded-md border border-[#d4af37]/45 bg-[#d4af37]/10 px-4 py-3 font-black text-[#f7d96b] disabled:opacity-45"
                  >
                    {hasPass ? "Pass active" : "Buy Chaos Pass · 700 coins"}
                  </button>
                </div>
              </div>

              <div className="cm-panel p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">Buy coins</p>
                <h2 className="mt-2 text-2xl font-black">Coin packs</h2>
                <div className="mt-4 space-y-3">
                  {coinPacks.map((pack) => (
                    <button key={pack.name} onClick={() => buyCoinPack(pack.coins, pack.name)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/8 p-4 text-left hover:border-[#d4af37]/45">
                      <span>
                        <span className="block font-black">{pack.name}</span>
                        <span className="text-sm text-white/48">{pack.price} checkout placeholder</span>
                      </span>
                      <span className="font-black text-[#f7d96b]">+{pack.coins}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ShopSection title="Piece Skins" subtitle="Buy and equip the global piece style used on game boards.">
              {pieceSkins.map((skin) => (
                <div key={skin.id} className="cm-card overflow-hidden p-5">
                  <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${skin.tone} text-6xl text-black shadow-inner`}>
                    <span className="drop-shadow-xl">{skin.preview}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-black">{skin.name}</h3>
                  <p className="mt-1 text-sm text-white/48">{skin.price ? `${skin.price} coins` : "Default unlocked"}</p>
                  <button
                    onClick={() =>
                      skin.price
                        ? spendCoins(skin.price, (nextProfile) => ({ ...nextProfile, skin_equipped: skin.id }), `${skin.name} skin`)
                        : saveProfile({ ...profile, skin_equipped: skin.id })
                    }
                    className="cm-button mt-4 w-full px-4 py-3 font-black"
                  >
                    {profile.skin_equipped === skin.id ? "Equipped" : skin.price ? "Buy & equip" : "Equip"}
                  </button>
                </div>
              ))}
            </ShopSection>

            <ShopSection title="Board Themes" subtitle="Visual board catalog. Full theme persistence can be wired once board_theme exists in Supabase.">
              {boardThemes.map((theme) => (
                <div key={theme.name} className="cm-card p-5">
                  <div className="grid aspect-video grid-cols-4 overflow-hidden rounded-xl border border-white/10">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span key={index} style={{ background: (index + Math.floor(index / 4)) % 2 ? theme.dark : theme.light }} />
                    ))}
                  </div>
                  <h3 className="mt-4 text-xl font-black">{theme.name}</h3>
                  <button onClick={() => spendCoins(theme.price, (nextProfile) => nextProfile, `${theme.name} board theme`)} className="cm-button mt-4 w-full px-4 py-3 font-black">
                    Unlock · {theme.price} coins
                  </button>
                </div>
              ))}
            </ShopSection>

            <ShopSection title="Messages & Emotes" subtitle="Unlock phrases and reactions for table talk during games.">
              {emotePacks.map((pack) => (
                <div key={pack.name} className="cm-card p-5">
                  <div className="flex min-h-28 flex-wrap content-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 p-4">
                    {pack.items.map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm font-black">
                        {item}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-4 text-xl font-black">{pack.name}</h3>
                  <button onClick={() => spendCoins(pack.price, (nextProfile) => nextProfile, `${pack.name} emotes`)} className="cm-button mt-4 w-full px-4 py-3 font-black">
                    Buy · {pack.price} coins
                  </button>
                </div>
              ))}
            </ShopSection>
          </section>
        )}
      </div>
    </main>
  );
}

function ShopSection({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d4af37]">{title}</p>
        <p className="mt-1 text-sm text-white/52">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function ShopMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/8 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
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
