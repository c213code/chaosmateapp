import type { User } from "@supabase/supabase-js";
import type { Skin } from "@/app/lib/chess-platform";

export type ChaosMateUser = User;

export type Profile = {
  id: string;
  username: string;
  email: string;
  city: string;
  elo: Record<string, number>;
  coins: number;
  skin_equipped: Skin;
  wins: number;
  losses: number;
  created_at?: string;
};
