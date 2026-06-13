import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Friendly room codes — uppercase, no confusing chars.
const newRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// POST /api/rooms → create a room. Body: { name, settings, playerId }
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
        language: settings.language || "javascript",
        difficulty: settings.difficulty || "medium",
        max_players: maxPlayers
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
