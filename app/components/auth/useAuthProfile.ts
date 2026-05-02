"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";
import type { Profile } from "@/app/lib/types";

const AUTH_TIMEOUT_MS = 4500;

function fallbackProfile(currentUser: User): Profile {
  return {
    id: currentUser.id,
    username: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "ChaosPlayer",
    email: currentUser.email || "",
    city: currentUser.user_metadata?.city || "Almaty",
    elo: { classic: 1200, switch: 1200, fog: 1200, chaos: 1200, team: 1200, speed: 1200 },
    coins: 0,
    skin_equipped: "classic",
    wins: 0,
    losses: 0,
  };
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

async function ensureProfile(currentUser: User) {
  const fallback = fallbackProfile(currentUser);

  if (!supabase) {
    return fallback;
  }

  const { data, error } = await withTimeout(
    supabase
      .from("users")
      .upsert(fallback, { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle(),
    AUTH_TIMEOUT_MS,
  ).catch((error) => {
    console.error("Profile ensure failed:", error);
    return { data: null, error };
  });

  if (error) {
    return fallback;
  }

  return (data as Profile | null) || fallback;
}

async function loadProfile(userId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await withTimeout(supabase.from("users").select("*").eq("id", userId).maybeSingle(), AUTH_TIMEOUT_MS).catch((error) => {
    console.error("Profile load failed:", error);
    return { data: null, error };
  });

  if (error) {
    return null;
  }

  return (data as Profile | null) || null;
}

export function useAuthProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function setUserAndProfile(nextUser: User | null) {
      if (!alive) {
        return;
      }

      setUser(nextUser);
      setProfile(null);
      setProfileReady(false);
      setLoading(false);

      if (nextUser) {
        const loadedProfile = (await loadProfile(nextUser.id)) || (await ensureProfile(nextUser));
        if (alive) {
          setProfile(loadedProfile);
          setProfileReady(true);
        }
      } else if (alive) {
        setProfileReady(true);
      }
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
        await setUserAndProfile(session?.user || null);
      } catch (error) {
        console.error("Auth check failed:", error);
        if (alive) {
          setLoading(false);
          setProfileReady(true);
        }
      }
    }

    checkAuth();

    if (!supabase) {
      return () => {
        alive = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await setUserAndProfile(session?.user || null);
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

  return { user, profile, setProfile, loading, profileReady };
}
