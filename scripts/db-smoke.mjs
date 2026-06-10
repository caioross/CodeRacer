// End-to-end smoke test of the Supabase data path using @supabase/supabase-js
// with the service-role key: insert a match + score, read the leaderboard view,
// then clean up. Validates keys, RLS and grants.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: m, error: me } = await sb
  .from("matches")
  .insert({
    room_code: "SMOKE1",
    language: "javascript",
    difficulty: "easy",
    snippet_title: "smoke test",
    player_count: 1,
    winner_name: "__smoke__",
    winner_wpm: 99
  })
  .select("id")
  .single();
console.log("insert match:", m ? "ok (" + m.id + ")" : "FAIL", me?.message || "");

if (m) {
  const { error: se } = await sb.from("scores").insert({
    match_id: m.id,
    name: "__smoke__",
    language: "javascript",
    difficulty: "easy",
    wpm: 99,
    accuracy: 100,
    errors: 0,
    place: 1,
    finished: true
  });
  console.log("insert score:", se ? "FAIL " + se.message : "ok");
}

const { data: lb, error: le } = await sb
  .from("leaderboard")
  .select("name, wpm, accuracy")
  .order("wpm", { ascending: false })
  .limit(5);
console.log("read leaderboard:", le ? "FAIL " + le.message : JSON.stringify(lb));

if (m) {
  await sb.from("matches").delete().eq("id", m.id); // cascade removes the score
  console.log("cleanup: ok");
}
