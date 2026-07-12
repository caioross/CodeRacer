// Server-side Supabase reads for the leaderboard page (App Router).
// Runs only on the server — uses the service-role key (or anon as fallback),
// never shipped to the browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_PLAUSIBLE_WPM } from "./room";

let client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type LeaderRow = {
  name: string;
  wpm: number;
  accuracy: number;
  errors: number;
  language: string;
  difficulty: string;
  created_at: string;
};

export type MatchRow = {
  id: string;
  room_code: string;
  language: string;
  difficulty: string;
  snippet_title: string | null;
  player_count: number;
  winner_name: string | null;
  winner_wpm: number | null;
  finished_at: string;
};

/** Whether Supabase persistence is configured (used to show a hint in the UI). */
export function isSupabaseConfigured(): boolean {
  return getServerSupabase() !== null;
}

/**
 * Top players by personal-best WPM.
 *
 * Defense-in-depth for the public ranking: `sanitizeResults` already blocks
 * implausible WPM at write time (see `room.ts`), but rows persisted BEFORE that
 * guard (e.g. the 3596 WPM record) still live in `scores`. Filtering reads by
 * `MAX_PLAUSIBLE_WPM` hides those legacy outliers from the ranking without
 * touching production data (owner-only per HANDBOOK §7.1).
 */
export async function getLeaderboard(limit = 25): Promise<LeaderRow[]> {
  const sb = getServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("leaderboard")
    .select("name, wpm, accuracy, errors, language, difficulty, created_at")
    .lte("wpm", MAX_PLAUSIBLE_WPM)
    .order("wpm", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[leaderboard] read error:", error.message);
    return [];
  }
  return (data as LeaderRow[]) ?? [];
}

/**
 * Most recent finished matches.
 *
 * Same defense-in-depth as `getLeaderboard`: a match whose `winner_wpm` exceeds
 * `MAX_PLAUSIBLE_WPM` is a legacy/forged outlier and is hidden. Matches with a
 * null `winner_wpm` (no ranked winner) are kept.
 */
export async function getRecentMatches(limit = 12): Promise<MatchRow[]> {
  const sb = getServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("matches")
    .select(
      "id, room_code, language, difficulty, snippet_title, player_count, winner_name, winner_wpm, finished_at"
    )
    .or(`winner_wpm.is.null,winner_wpm.lte.${MAX_PLAUSIBLE_WPM}`)
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[recent matches] read error:", error.message);
    return [];
  }
  return (data as MatchRow[]) ?? [];
}
