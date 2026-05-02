"use client";

import { useEffect } from "react";
import { useAuthProfile } from "@/app/components/auth/useAuthProfile";
import AuthPage from "@/app/components/pages/AuthPage";
import GamePage from "@/app/components/pages/GamePage";
import { applyTheme, loadInventory } from "@/app/lib/progression";

export default function ChaosMateApp() {
  const { user, profile, setProfile, loading } = useAuthProfile();

  useEffect(() => {
    if (profile) {
      applyTheme(loadInventory(profile.id).theme);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="cm-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl text-[#d4af37]">♛</div>
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
