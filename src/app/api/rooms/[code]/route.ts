import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";
import { pickSnippet } from "@/lib/snippets";
import {
  COUNTDOWN_MS,
  MAX_KICKED_ID_LEN,
  addKickedId,
  buildMatchRow,
  buildScoreRows,
  canKick,
  kickedListFull,
  resolveDifficulty,
  resolveLang,
  roomUpdateOutcome,
  sanitizeResults,
  ABSOLUTE_MAX_PLAYERS,
  type ResultRow,
  type RoomRow
} from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escreve na sala e só devolve `null` quando a escrita foi CONFIRMADA (#56).
 * Qualquer outro caso vira a `NextResponse` de erro que a action deve retornar —
 * o `.select("code")` cobre de uma vez o erro do PostgREST e o "0 linhas
 * afetadas" (sala apagada entre o SELECT da linha 44 e este UPDATE).
 * A decisão mora em `roomUpdateOutcome` (pura, testada); aqui só há I/O.
 */
async function applyRoomUpdate(
  sb: SupabaseClient,
  code: string,
  action: string,
  patch: Record<string, unknown>
): Promise<NextResponse | null> {
  const { data, error } = await sb.from("rooms").update(patch).eq("code", code).select("code");
  const outcome = roomUpdateOutcome({ error, rows: data?.length });
  if (outcome.ok) return null;
  // Detalhe do banco fica no servidor; o cliente recebe copy neutra.
  if (error) console.error("[rooms:update]", action, error.message);
  else console.warn("[rooms:update]", action, "0 linhas confirmadas");
  return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
}

// GET /api/rooms/[code] → current room row.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase não configurado" }, { status: 500 });

  const code = params.code.toUpperCase();
  const { data, error } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) {
    // `error.message` do PostgREST vira toast na tela do jogador (useRoom.ts) —
    // detalhe de schema fica no log do servidor, o cliente recebe copy neutra.
    console.error("[rooms:get]", code, error.message);
    return NextResponse.json({ ok: false, error: "Não foi possível carregar a sala" }, { status: 500 });
  }
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
      const failed = await applyRoomUpdate(sb, code, "settings", {
        language: lang.value,
        difficulty: difficulty.value,
        max_players: Math.min(Math.max(Number(s.maxPlayers) || room.max_players, 2), ABSOLUTE_MAX_PLAYERS)
      });
      if (failed) return failed;
      return NextResponse.json({ ok: true });
    }

    case "start": {
      if (!isLeader) return leaderOnly();
      const snippet = pickSnippet(room.language, room.difficulty);
      const startAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
      const failed = await applyRoomUpdate(sb, code, "start", {
        status: "racing",
        snippet,
        start_at: startAt,
        results: null
      });
      if (failed) return failed;
      return NextResponse.json({ ok: true });
    }

    case "finish": {
      // Fronteira anti-cheat: `results` vem do cliente e alimenta o leaderboard
      // global. Sanitiza/clampa/descarta linhas forjadas antes de persistir.
      const results: ResultRow[] = sanitizeResults(body.results, room as RoomRow);
      // Conditional transition racing→finished so only the first caller persists.
      const { data: flipped, error: finishErr } = await sb
        .from("rooms")
        .update({ status: "finished", results })
        .eq("code", code)
        .eq("status", "racing")
        .select("code");
      // Aqui `applyRoomUpdate` NÃO serve: zero linhas é o caminho feliz da
      // corrida com vários clientes ("outro já finalizou") e continua `ok: true`
      // sem repersistir. Só o `error` — que era descartado — vira falha honesta.
      if (finishErr) {
        console.error("[rooms:update]", "finish", finishErr.message);
        return NextResponse.json(
          { ok: false, error: "Não foi possível encerrar a partida" },
          { status: 500 }
        );
      }
      if (flipped && flipped.length) await persistMatch(sb, room as RoomRow, results);
      return NextResponse.json({ ok: true });
    }

    case "kick": {
      // Autoridade de expulsão no servidor (#39): só o líder remove, e a saída
      // da vítima passa a vir de `kicked_ids` (postgres_changes), nunca de um
      // broadcast confiado cegamente. Escopo honesto: mitiga o kick anônimo
      // trivial — não dá autoridade forte (leader_id ainda é spoofável, ver #6).
      if (!isLeader) return leaderOnly();
      // Corta antes de qualquer trabalho: `targetId` gigante não vira string de
      // 1 MB na memória do handler só para ser rejeitado depois.
      const targetId = String(body?.targetId || "")
        .slice(0, MAX_KICKED_ID_LEN + 1)
        .trim();
      // `canKick` é a verdade da autorização (espelhada em validate-persistence):
      // líder legítimo, alvo não-vazio, dentro do teto de tamanho e != líder.
      if (!canKick(room as RoomRow, playerId, targetId))
        return NextResponse.json({ ok: false, error: "Alvo inválido" }, { status: 400 });
      // Lista cheia → erro honesto. Sem isto o `addKickedId` faria no-op e a rota
      // devolveria `ok: true` sem ter expulsado ninguém.
      if (kickedListFull(room.kicked_ids) && !(room.kicked_ids || []).includes(targetId))
        return NextResponse.json(
          { ok: false, error: "Limite de expulsões desta sala atingido" },
          { status: 409 }
        );
      const kicked = addKickedId(room.kicked_ids, targetId); // idempotente e com teto
      // Falha alto: enquanto a migração 0005 não for aplicada a coluna não existe,
      // e um `ok: true` silencioso faria o líder crer que expulsou alguém.
      const { error: kickErr } = await sb
        .from("rooms")
        .update({ kicked_ids: kicked })
        .eq("code", code);
      if (kickErr)
        return NextResponse.json(
          { ok: false, error: "Expulsão indisponível — migração pendente" },
          { status: 503 }
        );
      return NextResponse.json({ ok: true });
    }

    case "reset": {
      if (!isLeader) return leaderOnly();
      // O reset da partida NÃO pode depender da coluna nova: entre este deploy e a
      // aplicação da 0005 pelo dono, `kicked_ids` não existe e um update único
      // falharia inteiro — "jogar de novo" morreria em silêncio (as rotas não
      // conferem o `error` do update). Statements separados: o reset sempre vale.
      // Ordem importa: limpa os expulsos ANTES de anunciar o lobby, senão o
      // evento que devolve todo mundo ao lobby ainda carrega a lista velha.
      // Best-effort: inerte enquanto a 0005 não estiver aplicada.
      await sb.from("rooms").update({ kicked_ids: [] }).eq("code", code);
      // O reset em si, ao contrário da limpeza acima, precisa ser confirmado:
      // "jogar de novo" que falha em silêncio deixa a sala presa em `finished`.
      const failed = await applyRoomUpdate(sb, code, "reset", {
        status: "lobby",
        snippet: null,
        start_at: null,
        results: null
      });
      if (failed) return failed;
      return NextResponse.json({ ok: true });
    }

    case "claim-leader": {
      if (!playerId) return NextResponse.json({ ok: false, error: "playerId" }, { status: 400 });
      // The client only claims when it has detected the current leader left.
      // Este PR não muda a semântica de autorização (segue aberta, ver #6/PR #12):
      // só passa a reportar a falha de escrita em vez de fingir sucesso.
      const failed = await applyRoomUpdate(sb, code, "claim-leader", { leader_id: playerId });
      if (failed) return failed;
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Ação inválida" }, { status: 400 });
  }
}

// Persist a finished match + scores for the leaderboard (best-effort).
async function persistMatch(sb: SupabaseClient, room: RoomRow, results: ResultRow[]) {
  try {
    const matchRow = buildMatchRow(room, results, new Date().toISOString());
    if (!matchRow) return; // sem resultado → nenhuma `matches` órfã
    const { data: match } = await sb.from("matches").insert(matchRow).select("id").single();
    if (!match) return;
    await sb.from("scores").insert(buildScoreRows(match.id, room, results));
  } catch (e) {
    console.warn("[persistMatch]", (e as Error).message);
  }
}
