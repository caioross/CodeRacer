import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getServerSupabase } from "@/lib/supabase";
import { resolveDifficulty, resolveLang } from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Friendly room codes — uppercase, no confusing chars.
const newRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// GET /api/rooms → list open public rooms for the home browser.
export async function GET() {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });
  }
  // Only fresh (last 3h), still-in-lobby public rooms are joinable/discoverable.
  const since = new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString();
  const { data, error } = await sb
    .from("rooms")
    .select("code, language, difficulty, max_players, created_at")
    .eq("is_public", true)
    .eq("status", "lobby")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rooms: data ?? [] });
}

// POST /api/rooms → create a room. Body: { name, settings, playerId, isPublic }
export async function POST(req: Request) {
  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({} as any));
  const playerId = String(body?.playerId || "");
  if (!playerId) {
    return NextResponse.json({ ok: false, error: "playerId obrigatório" }, { status: 400 });
  }

  const settings = body?.settings || {};
  // Allowlist de fronteira: valor presente inválido → 400 (não troca em silêncio);
  // ausente cai no default. Impede injeção de linguagem/dificuldade no leaderboard.
  const lang = resolveLang(settings.language, "javascript");
  if (!lang.ok) {
    return NextResponse.json(
      { ok: false, error: "language inválido — use uma das linguagens suportadas" },
      { status: 400 }
    );
  }
  const difficulty = resolveDifficulty(settings.difficulty, "medium");
  if (!difficulty.ok) {
    return NextResponse.json(
      { ok: false, error: "difficulty inválido — use easy, medium ou hard" },
      { status: 400 }
    );
  }
  const maxPlayers = Math.min(Math.max(Number(settings.maxPlayers) || 6, 2), 12);

  // Retry a couple of times on the (very unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newRoomCode();
    const { data, error } = await sb
      .from("rooms")
      .insert({
        code,
        status: "lobby",
        leader_id: playerId,
        language: lang.value,
        difficulty: difficulty.value,
        max_players: maxPlayers,
        is_public: !!body?.isPublic
      })
      .select("*")
      .single();

    if (!error && data) {
      return NextResponse.json({ ok: true, code, room: data });
    }
    // 23505 = unique_violation (code already taken) → retry
    if (error && (error as any).code !== "23505") {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Não foi possível gerar a sala" }, { status: 500 });
}
