// Persistência da partida terminada (matches + scores) — a fonte do leaderboard.
// Vive fora do route file (#112) por dois motivos: um route module do App Router
// não pode exportar função arbitrária (o Next trata exports desses módulos como
// configuração de rota), e os caminhos de ERRO — que são o assunto desta lógica —
// só dá para cobrir com um `sb` dublê se ela for importável.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMatchRow, buildScoreRows, type ResultRow, type RoomRow } from "./room";

/** Erro do PostgREST para "a query não devolveu exatamente uma linha" (`.single()`). */
const NO_SINGLE_ROW = "PGRST116";

/** Formato mínimo do erro do supabase-js — só o que é seguro logar. */
type QueryError = { code?: string; message?: string } | null;

/** Só código e mensagem: a linha carrega os nicks dos jogadores e não vai para o log. */
function describe(err: QueryError): string {
  return `${err?.code || "?"} ${err?.message || "erro desconhecido"}`;
}

/**
 * Grava a partida terminada e os placares dos jogadores (best-effort).
 *
 * "Best-effort" aqui significa **nunca propagar** a falha: quando esta função roda,
 * a sala já flipou para `finished` e o broadcast já saiu, então o `finish` responde
 * `{ ok: true }` em qualquer desfecho (#112, AC 4). O que ela NÃO faz mais é falhar
 * em silêncio — o `supabase-js` não lança em erro de query, devolve `{ data, error }`,
 * e esse `error` descartado escondia corrida sumindo do ranking sem uma linha de log.
 *
 * Integridade do par: se `scores` falha, a `matches` recém-criada é apagada nesta
 * mesma chamada (AC 3). O `delete` é seguro e suficiente porque `scores.match_id`
 * referencia `matches(id)` `on delete cascade` (`0001_coderacer_init.sql:24`) — não
 * há linha filha para deixar órfã na direção oposta. A alternativa "insert atômico"
 * exigiria transação, que o PostgREST não oferece: viraria função Postgres + migração
 * nova, muito mais superfície para o mesmo resultado.
 */
export async function persistMatch(
  sb: SupabaseClient,
  room: RoomRow,
  results: ResultRow[]
): Promise<void> {
  try {
    const matchRow = buildMatchRow(room, results, new Date().toISOString());
    if (!matchRow) return; // sem resultado → nenhuma `matches` órfã
    const { data: match, error: matchErr } = await sb
      .from("matches")
      .insert(matchRow)
      .select("id")
      .single();
    // Falhou a escrita: nada de `scores`, senão o insert filho erra sozinho depois.
    if (matchErr) {
      console.error("[persistMatch:matches]", room.code, describe(matchErr));
      return;
    }
    // Escreveu e não voltou linha (`PGRST116` do `.single()`): a partida pode até
    // existir no banco, mas sem o `id` não há como ligar os `scores` a ela.
    if (!match) {
      console.error("[persistMatch:matches]", room.code, `sem id retornado (${NO_SINGLE_ROW}?)`);
      return;
    }
    const { error: scoresErr } = await sb
      .from("scores")
      .insert(buildScoreRows(match.id, room, results));
    if (!scoresErr) return;
    // Meia partida grava mentira: "Partidas recentes" mostraria vencedor e
    // `player_count` enquanto nenhum jogador entra no ranking (view sobre `scores`).
    console.error("[persistMatch:scores]", room.code, match.id, describe(scoresErr));
    const { error: rollbackErr } = await sb.from("matches").delete().eq("id", match.id);
    // O guarda também pode falhar — e aí a órfã que a AC 3 proíbe EXISTE.
    // Esse é o caso que mais precisa de log, então ele nunca é mudo.
    if (rollbackErr)
      console.error("[persistMatch:rollback]", room.code, match.id, describe(rollbackErr));
  } catch (e) {
    // Só exceção de verdade chega aqui (rede/runtime) — merece o mesmo nível dos acima.
    console.error("[persistMatch]", (e as Error).message);
  }
}
