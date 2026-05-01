"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AuthPage from "@/app/components/pages/AuthPage";
import GamePage from "@/app/components/pages/GamePage";
import { supabase } from "@/app/lib/supabase";
import type { Profile } from "@/app/lib/types";

const AUTH_TIMEOUT_MS = 4500;

export default function ChaosMateApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    function fallbackProfile(currentUser: User): Profile {
      return {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "ChaosPlayer",
        email: currentUser.email || "",
        city: currentUser.user_metadata?.city || "Almaty",
        elo: { classic: 1200, switch: 1200, fog: 1200, chaos: 1200, team: 1200 },
        coins: 0,
        skin_equipped: "classic",
        wins: 0,
        losses: 0,
      };
    }

    async function ensureProfile(currentUser: User) {
      if (!supabase) {
        return fallbackProfile(currentUser);
      }

      const fallback = fallbackProfile(currentUser);
      const { data, error } = await withTimeout(
        supabase
          .from("users")
          .upsert(fallback, { onConflict: "id", ignoreDuplicates: true })
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle(),
        AUTH_TIMEOUT_MS,
      ).catch((error) => {
        console.error("Profile ensure timed out:", error);
        return { data: null, error };
      });

      if (error) {
        console.error("Profile ensure failed:", error);
        return fallback;
      }

      return (data as Profile | null) || fallback;
    }

    async function loadProfile(userId: string) {
      if (!supabase) {
        return null;
      }

      const { data, error } = await withTimeout(
        supabase.from("users").select("*").eq("id", userId).maybeSingle(),
        AUTH_TIMEOUT_MS,
      ).catch((error) => {
        console.error("Profile load timed out:", error);
        return { data: null, error };
      });

      if (error) {
        console.error("Profile load failed:", error);
        return null;
      }

      return (data as Profile | null) || null;
    }

    async function checkAuth() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS);
        const currentUser = session?.user || null;

        if (!alive) {
          return;
        }
        setUser(currentUser);
        if (!currentUser) {
          setProfile(null);
          return;
        }

        const fallback = fallbackProfile(currentUser);
        setProfile(fallback);
        setLoading(false);

        const loadedProfile = (await loadProfile(currentUser.id)) || (await ensureProfile(currentUser));
        if (alive) {
          setProfile(loadedProfile);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      if (!alive) {
        return;
      }
      setUser(nextUser);
      setProfile(nextUser ? fallbackProfile(nextUser) : null);
      setLoading(false);

      if (nextUser) {
        const loadedProfile = (await loadProfile(nextUser.id)) || (await ensureProfile(nextUser));
        if (alive) {
          setProfile(loadedProfile);
        }
      }
    });

    const loadingGuard = window.setTimeout(() => {
      if (alive) {
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS + 1000);

    return () => {
      alive = false;
      window.clearTimeout(loadingGuard);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <div className="mb-4 text-4xl text-[#c9a227]">♛</div>
          <p className="text-lg text-white">ChaosMate loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <GamePage user={user} profile={profile} setProfile={setProfile} />;
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Supabase request timed out")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
