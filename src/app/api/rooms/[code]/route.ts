import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";
import { pickSnippet } from "@/lib/snippets";
import {
  COUNTDOWN_MS,
  resolveDifficulty,
  resolveLang,
  sanitizeResults,
  type ResultRow,
  type RoomRow
} from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/[code] → current room row.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });

  const code = params.code.toUpperCase();
  const { data, error } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Sala não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true, room: data });
}

// POST /api/rooms/[code] → mutate the room. Body: { action, playerId, ... }
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });

  const code = params.code.toUpperCase();
  const body = await req.json().catch(() => ({} as any));
  const action = String(body?.action || "");
  const playerId = String(body?.playerId || "");

  const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
  if (!room) return NextResponse.json({ ok: false, error: "Sala não encontrada" }, { status: 404 });

  const isLeader = room.leader_id === playerId;
  const leaderOnly = () =>
    NextResponse.json({ ok: false, error: "Só o líder pode fazer isso" }, { status: 403 });

  switch (action) {
    case "settings": {
      if (!isLeader) return leaderOnly();
      if (room.status !== "lobby")
        return NextResponse.json({ ok: false, error: "Partida já começou" }, { status: 409 });
      const s = body.settings || {};
      // Allowlist de fronteira: presente inválido → 400; ausente mantém o valor
      // atual da sala. Mesma fonte de verdade da criação (src/lib/room.ts).
      const lang = resolveLang(s.language, room.language as RoomRow["language"]);
      if (!lang.ok) {
        return NextResponse.json(
          { ok: false, error: "language inválido — use uma das linguagens suportadas" },
          { status: 400 }
        );
      }
      const difficulty = resolveDifficulty(s.difficulty, room.difficulty as RoomRow["difficulty"]);
      if (!difficulty.ok) {
        return NextResponse.json(
          { ok: false, error: "difficulty inválido — use easy, medium ou hard" },
          { status: 400 }
        );
      }
      await sb
        .from("rooms")
        .update({
          language: lang.value,
          difficulty: difficulty.value,
          max_players: Math.min(Math.max(Number(s.maxPlayers) || room.max_players, 2), 12)
        })
        .eq("code", code);
      return NextResponse.json({ ok: true });
    }

    case "start": {
      if (!isLeader) return leaderOnly();
      const snippet = pickSnippet(room.language, room.difficulty);
      const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
      await sb
        .from("rooms")
        .update({ status: "racing", snippet, start_at: startAt, results: null })
        .eq("code", code);
      return NextResponse.json({ ok: true });
    }

    case "finish": {
      // Fronteira anti-cheat: `results` vem do cliente e alimenta o leaderboard
      // global. Sanitiza/clampa/descarta linhas forjadas antes de persistir.
      const results: ResultRow[] = sanitizeResults(body.results, room as RoomRow);
      // Conditional transition racing→finished so only the first caller persists.
      const { data: flipped } = await sb
        .from("rooms")
        .update({ status: "finished", results })
        .eq("code", code)
        .eq("status", "racing")
        .select("code");
      if (flipped && flipped.length) await persistMatch(sb, room as RoomRow, results);
      return NextResponse.json({ ok: true });
    }

    case "reset": {
      if (!isLeader) return leaderOnly();
      await sb
        .from("rooms")
        .update({ status: "lobby", snippet: null, start_at: null, results: null })
        .eq("code", code);
      return NextResponse.json({ ok: true });
    }

    case "claim-leader": {
      if (!playerId) return NextResponse.json({ ok: false, error: "playerId" }, { status: 400 });
      // The client only claims when it has detected the current leader left.
      await sb.from("rooms").update({ leader_id: playerId }).eq("code", code);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
  }
}

// Persist a finished match + scores for the leaderboard (best-effort).
async function persistMatch(sb: SupabaseClient, room: RoomRow, results: ResultRow[]) {
  try {
    if (!results.length) return;
    const ranked = [...results].sort((a, b) => (a.place || 99) - (b.place || 99));
    const winner = ranked[0];
    const { data: match } = await sb
      .from("matches")
      .insert({
        room_code: room.code,
        language: room.language,
        difficulty: room.difficulty,
        snippet_title: room.snippet?.title || null,
        player_count: results.length,
        winner_name: winner?.name || null,
        winner_wpm: winner ? Math.round(winner.wpm) || 0 : null,
        finished_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (!match) return;
    await sb.from("scores").insert(
      results.map(r => ({
        match_id: match.id,
        name: r.name,
        language: room.language,
        difficulty: room.difficulty,
        wpm: Math.round(r.wpm) || 0,
        accuracy: Math.round(r.accuracy) || 0,
        errors: Math.round(r.errors) || 0,
        place: r.place || null,
        finished: !!r.finished
      }))
    );
  } catch (e) {
    console.warn("[persistMatch]", (e as Error).message);
  }
}
