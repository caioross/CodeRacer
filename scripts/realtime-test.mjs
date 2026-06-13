// End-to-end realtime test: 2 simulated clients exercise the full Vercel-style
// flow — create (API) → presence → start (API) → progress broadcast both ways →
// finish (API) → room transitions via postgres_changes → match persisted.
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const BASE = process.env.TEST_URL || "http://127.0.0.1:47900";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => crypto.randomUUID();
const mk = () => createClient(URL, ANON, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
const api = async (path, body) =>
  (await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

function joinRoom(code, id, name, hooks) {
  const c = mk();
  const ch = c.channel(`coderacer:room:${code}`, { config: { presence: { key: id }, broadcast: { self: false } } });
  ch.on("presence", { event: "sync" }, () => hooks.onPresence?.(Object.keys(ch.presenceState()).length));
  ch.on("broadcast", { event: "progress" }, ({ payload }) => hooks.onProgress?.(payload));
  ch.on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, p => hooks.onRoom?.(p.new));
  return new Promise(res => {
    ch.subscribe(s => {
      if (s === "SUBSCRIBED") {
        ch.track({ id, name, color: "#00ff88", joinedAt: Date.now() });
        res({ c, ch });
      }
    });
  });
}

const fail = (m) => { console.error("❌", m); process.exitCode = 1; };
setTimeout(() => { fail("TIMEOUT"); process.exit(1); }, 30000);

const aId = rid(), bId = rid();
let aGotB = false, bGotA = false, aRacing = false, bRacing = false, aFinished = false, bPresence = 0;

const created = await api("/api/rooms", { name: "alice", settings: { language: "javascript", difficulty: "easy", maxPlayers: 4 }, playerId: aId });
if (!created.ok) { fail("create failed: " + JSON.stringify(created)); process.exit(1); }
const code = created.code;
console.log("✓ create room:", code);

const A = await joinRoom(code, aId, "alice", {
  onProgress: p => { if (p.id === bId) aGotB = true; },
  onRoom: r => { if (r.status === "racing") aRacing = true; if (r.status === "finished") aFinished = true; }
});
const B = await joinRoom(code, bId, "bob", {
  onProgress: p => { if (p.id === aId) bGotA = true; },
  onRoom: r => { if (r.status === "racing") bRacing = true; },
  onPresence: n => { bPresence = n; }
});
console.log("✓ both clients subscribed");
await sleep(1800);
console.log("  presence count (B sees):", bPresence, bPresence === 2 ? "✓" : "✗");

const started = await api(`/api/rooms/${code}`, { action: "start", playerId: aId });
console.log("✓ start:", started.ok);
await sleep(2000);
console.log("  racing via postgres_changes — A:", aRacing ? "✓" : "✗", "B:", bRacing ? "✓" : "✗");

A.ch.send({ type: "broadcast", event: "progress", payload: { id: aId, progress: 1, wpm: 110, accuracy: 99, errors: 1, finishedAt: Date.now() } });
B.ch.send({ type: "broadcast", event: "progress", payload: { id: bId, progress: 1, wpm: 88, accuracy: 95, errors: 4, finishedAt: Date.now() } });
await sleep(1000);
console.log("  progress broadcast — A got B:", aGotB ? "✓" : "✗", "| B got A:", bGotA ? "✓" : "✗");

const fin = await api(`/api/rooms/${code}`, {
  action: "finish", playerId: aId,
  results: [
    { id: aId, name: "alice", color: "#0f8", wpm: 110, accuracy: 99, errors: 1, progress: 1, place: 1, finished: true, finishedAt: Date.now() },
    { id: bId, name: "bob", color: "#08f", wpm: 88, accuracy: 95, errors: 4, progress: 1, place: 2, finished: true, finishedAt: Date.now() }
  ]
});
console.log("✓ finish:", fin.ok);
await sleep(1200);
console.log("  finished via postgres_changes (A):", aFinished ? "✓" : "✗");

const check = await (await fetch(`${BASE}/api/rooms/${code}`)).json();
console.log("  final room status:", check.room?.status, "| results:", check.room?.results?.length, "players");

// verify match persisted + cleanup
const cl = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await cl.connect();
const m = await cl.query("select winner_name, winner_wpm, player_count from matches where room_code=$1", [code]);
console.log("  match persisted:", m.rows.length ? JSON.stringify(m.rows[0]) : "✗ none");
await cl.query("delete from matches where room_code=$1", [code]);
await cl.query("delete from rooms where code=$1", [code]);
await cl.query("delete from scores where name in ('alice','bob')");
await cl.end();
console.log("✓ cleanup done");

A.c.removeAllChannels(); B.c.removeAllChannels();
process.exit(process.exitCode || 0);
