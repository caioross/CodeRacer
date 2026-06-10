// CommonJS Supabase client + persistence, consumed by the custom server.
// Uses the SERVICE ROLE key (server-only — never exposed to the browser).
// Persistence is best-effort: if Supabase isn't configured or is unreachable,
// the game keeps working in memory and we just skip writing.

const { createClient } = require("@supabase/supabase-js");

let client = null;
let warned = false;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (!warned) {
      warned = true;
      console.warn(
        "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — match history disabled."
      );
    }
    return null;
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function rankPlayers(players) {
  return [...players].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return (a.place || 99) - (b.place || 99);
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return (b.progress || 0) - (a.progress || 0);
  });
}

// Persist a finished match and its per-player scores. Never throws.
async function recordMatch(room) {
  try {
    const supabase = getClient();
    if (!supabase || !room) return;
    const players = [...room.players.values()];
    if (players.length === 0) return;

    const winner = rankPlayers(players)[0];

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({
        room_code: room.code,
        language: room.settings.language,
        difficulty: room.settings.difficulty,
        snippet_title: (room.snippet && room.snippet.title) || null,
        player_count: players.length,
        winner_name: (winner && winner.name) || null,
        winner_wpm: winner ? Math.round(winner.wpm) || 0 : null,
        started_at: room.startedAt ? new Date(room.startedAt).toISOString() : null,
        finished_at: room.finishedAt
          ? new Date(room.finishedAt).toISOString()
          : new Date().toISOString()
      })
      .select("id")
      .single();

    if (mErr || !match) {
      console.warn("[supabase] match insert failed:", mErr && mErr.message);
      return;
    }

    const rows = players.map(p => ({
      match_id: match.id,
      name: p.name,
      language: room.settings.language,
      difficulty: room.settings.difficulty,
      wpm: Math.round(p.wpm) || 0,
      accuracy: Math.round(p.accuracy) || 0,
      errors: Math.round(p.errors) || 0,
      place: p.place || null,
      finished: !!p.finishedAt
    }));

    const { error: sErr } = await supabase.from("scores").insert(rows);
    if (sErr) console.warn("[supabase] scores insert failed:", sErr.message);
  } catch (e) {
    console.warn("[supabase] recordMatch error:", e && e.message);
  }
}

module.exports = { recordMatch, getClient };
