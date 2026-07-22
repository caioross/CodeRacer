import { NextResponse } from "next/server";
import { pickSnippet } from "@/lib/snippets";
import { resolveDifficulty, resolveLang } from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snippet?language=<LangId>&difficulty=<Difficulty>
// Sorteia um snippet para o Treino Livre (/practice) reusando o pool
// server-side (pickSnippet) — snippets nunca vão inteiros ao bundle do cliente.
// Endpoint só-leitura: não toca banco, Realtime nem leaderboard.
// Allowlist na fronteira: reusa `resolveLang`/`resolveDifficulty` (src/lib/room.ts,
// issue #35, já na main) em vez de uma segunda cópia da política — valor presente
// inválido → 400; ausente → default do treino (javascript / easy, coerente com §0.3).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = resolveLang(url.searchParams.get("language"), "javascript");
  if (!lang.ok) {
    return NextResponse.json({ ok: false, error: "Linguagem inválida" }, { status: 400 });
  }
  const difficulty = resolveDifficulty(url.searchParams.get("difficulty"), "easy");
  if (!difficulty.ok) {
    return NextResponse.json({ ok: false, error: "Dificuldade inválida" }, { status: 400 });
  }

  const snippet = pickSnippet(lang.value, difficulty.value);
  return NextResponse.json({ ok: true, snippet });
}
