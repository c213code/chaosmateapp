"use client";

import { useState } from "react";
import LoginForm from "@/app/components/auth/LoginForm";
import SignupForm from "@/app/components/auth/SignupForm";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="liquid-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 text-5xl text-[#c9a227]">♛</div>
          <h1 className="text-3xl font-black tracking-[0.18em] text-white">CHAOSMATE</h1>
          <p className="mt-2 text-gray-400">Chess. Reimagined.</p>
        </div>

        <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur-xl">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded py-2 font-semibold transition-colors ${
              mode === "login" ? "bg-[#c9a227] text-black" : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded py-2 font-semibold transition-colors ${
              mode === "signup" ? "bg-[#c9a227] text-black" : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="liquid-panel p-6">
          {mode === "login" ? <LoginForm /> : <SignupForm />}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">Play chess. Challenge friends. Claim the leaderboard.</p>
      </div>
    </div>
  );
}
