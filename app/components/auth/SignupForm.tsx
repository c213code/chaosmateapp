"use client";

import { useState } from "react";
import { kazakhstanCities } from "@/app/lib/chess-platform";
import { supabase } from "@/app/lib/supabase";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("Almaty");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            city,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          email,
          username,
          city,
          elo: { classic: 1200, switch: 1200, fog: 1200, chaos: 1200, team: 1200 },
          wins: 0,
          losses: 0,
          coins: 0,
          skin_equipped: "classic",
        });

        if (profileError) {
          setError(`Failed to create profile: ${profileError.message}`);
        } else {
          setSuccess(data.session ? "Account created. Welcome to ChaosMate." : "Account created. Confirm email, then log in.");
        }
      }
    } catch (err) {
      setError("Signup failed. Try again.");
      console.error(err);
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-300">Username</span>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your_username"
          className="w-full rounded border border-gray-600 bg-[#0f0f0f] px-4 py-2 text-white placeholder-gray-500 outline-none focus:border-[#c9a227]"
          required
        />
      </label>

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

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-300">City</span>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="w-full rounded border border-gray-600 bg-[#0f0f0f] px-4 py-2 text-white outline-none focus:border-[#c9a227]"
        >
          {kazakhstanCities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[#c9a227] py-2 font-semibold text-black transition-colors hover:bg-[#d4af37] disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
