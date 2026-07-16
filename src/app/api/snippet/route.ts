import { NextResponse } from "next/server";
import { pickSnippet } from "@/lib/snippets";
import { LANGUAGES, DIFFICULTIES } from "@/lib/languages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snippet?language=<LangId>&difficulty=<Difficulty>
// Sorteia um snippet para o Treino Livre (/practice) reusando o pool
// server-side (pickSnippet) — snippets nunca vão inteiros ao bundle do cliente.
// Endpoint só-leitura: não toca banco, Realtime nem leaderboard.
// Allowlist na fronteira (mesma doutrina da #35): valor presente inválido →
// 400; ausente → default do treino (javascript / easy, coerente com §0.3).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = url.searchParams.get("language") ?? "";
  const difficulty = url.searchParams.get("difficulty") ?? "";

  if (language && !LANGUAGES.some(l => l.id === language)) {
    return NextResponse.json({ ok: false, error: "Linguagem inválida" }, { status: 400 });
  }
  if (difficulty && !DIFFICULTIES.some(d => d.id === difficulty)) {
    return NextResponse.json({ ok: false, error: "Dificuldade inválida" }, { status: 400 });
  }

  const snippet = pickSnippet(language || "javascript", difficulty || "easy");
  return NextResponse.json({ ok: true, snippet });
}
