"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message);
      }
    } catch (err) {
      setError("Login failed. Try again.");
      console.error(err);
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-300">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className="w-full rounded border border-gray-600 bg-[#0f0f0f] px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-[#c9a227]"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-300">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded border border-gray-600 bg-[#0f0f0f] px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-[#c9a227]"
          required
        />
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[#c9a227] py-2 font-semibold text-black transition-colors hover:bg-[#d4af37] disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Log In"}
      </button>
    </form>
  );
}
