#!/usr/bin/env node
/**
 * validate-persistence.mjs
 * Valida a lógica de sanitização de `results` que protege o leaderboard global
 * (tabelas `matches`/`scores`) contra payloads de `finish` forjados.
 *
 * Espelha `sanitizeResults()` de src/lib/room.ts — a engine é client-side, então
 * a API (service_role) é o único guardião. Aqui testamos SÓ a lógica pura de
 * validação/clamp/descarte, sem chamadas de rede. Execute:
 *   node scripts/validate-persistence.mjs
 */

// ─── Espelho das regras de sanitizeResults() (src/lib/room.ts) ────────────────

const MAX_PLAUSIBLE_WPM = 350;
const MAX_NAME_LEN = 20;
const ABSOLUTE_MAX_PLAYERS = 30;

function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Espelho fiel de `sanitizeResults(input, room)`.
 * @param {unknown} input - array bruto de ResultRow do cliente
 * @param {{ max_players: number }} room
 * @returns {object[]} linhas sanitizadas (forjadas descartadas)
 */
function sanitizeResults(input, room) {
  if (!Array.isArray(input)) return [];
  const cap = Math.min(
    Math.max(Math.round(Number(room?.max_players)) || ABSOLUTE_MAX_PLAYERS, 1),
    ABSOLUTE_MAX_PLAYERS
  );

  const out = [];
  for (const r of input) {
    if (out.length >= cap) break;
    if (!r || typeof r !== 'object') continue;

    const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_NAME_LEN) : '';
    if (!name) continue;

    const wpm = Math.round(Number(r.wpm));
    if (!Number.isFinite(wpm) || wpm < 0 || wpm > MAX_PLAUSIBLE_WPM) continue;

    const placeN = Math.round(Number(r.place));
    out.push({
      id: typeof r.id === 'string' ? r.id : '',
      name,
      color: typeof r.color === 'string' ? r.color : '',
      wpm,
      accuracy: clampInt(r.accuracy, 0, 100),
      errors: clampInt(r.errors, 0, Number.MAX_SAFE_INTEGER),
      progress: Math.max(0, Math.min(1, Number(r.progress) || 0)),
      place: Number.isFinite(placeN) && placeN >= 1 ? placeN : null,
      finished: !!r.finished,
      finishedAt: Number.isFinite(Number(r.finishedAt)) ? Number(r.finishedAt) : null
    });
  }
  return out;
}

// ─── Espelho de dropTemporallyImpossible() (src/lib/room.ts, issue #34) ───────
// `sanitizeResults` limita o VALOR e é cega ao relógio: com o teto em 350, o
// forjador pede 349 e entra no ranking sem digitar. A checagem temporal é o
// mínimo FÍSICO — concluir N chars custa pelo menos `(N/5)/MAX_PLAUSIBLE_WPM`
// minutos de relógio, e o servidor mede esse tempo sozinho. O `wpm` alegado NÃO
// entra na conta (a 1ª versão usava, e por isso invertia: derrubava o honesto
// impreciso e deixava passar o trapaceiro paciente).

const TIMING_EPS_MS = 250;

/** Espelho fiel de `dropTemporallyImpossible(rows, room, nowMs)` (sem o console.warn). */
function dropTemporallyImpossible(rows, room, nowMs) {
  const startMs = room?.start_at ? Date.parse(room.start_at) : NaN;
  if (!Number.isFinite(startMs)) return [];
  const chars = room?.snippet?.code?.length ?? 0;
  const elapsedMs = Math.max(0, nowMs - startMs);

  return rows.filter(r => {
    if (chars <= 0) return true;
    const claimed = Math.max(0, Math.min(1, Number(r.progress) || 0));
    const typedChars = Math.max(claimed, r.finished ? 1 : 0) * chars;
    if (typedChars <= 0) return !(Number(r.wpm) > 0);
    const needMs = (typedChars / 5 / MAX_PLAUSIBLE_WPM) * 60_000;
    return !(elapsedMs + TIMING_EPS_MS < needMs);
  });
}

// ─── Espelho da allowlist de settings (src/lib/room.ts) ───────────────────────
// A fonte de verdade é `LANGUAGES`/`DIFFICULTIES` em src/lib/languages.ts. Este
// espelho segue o padrão do arquivo (sem import de TS) — se as listas mudarem lá,
// atualize aqui.

const LANG_IDS = new Set([
  'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go',
  'rust', 'sql', 'bash', 'ruby', 'php', 'kotlin', 'swift'
]);
const DIFFICULTY_IDS = new Set(['easy', 'medium', 'hard']);

const isValidLang = x => typeof x === 'string' && LANG_IDS.has(x);
const isValidDifficulty = x => typeof x === 'string' && DIFFICULTY_IDS.has(x);

/** Ausente (`null`/`undefined`/`''`) → fallback; válido → valor; inválido → { ok:false }. */
function resolveLang(raw, fallback) {
  if (raw == null || raw === '') return { ok: true, value: fallback };
  return isValidLang(raw) ? { ok: true, value: raw } : { ok: false };
}
function resolveDifficulty(raw, fallback) {
  if (raw == null || raw === '') return { ok: true, value: fallback };
  return isValidDifficulty(raw) ? { ok: true, value: raw } : { ok: false };
}

/** Valida o objeto de match (linha na tabela `matches`). */
function validateMatchInsert(match) {
  const errors = [];
  if (!match.room_code || typeof match.room_code !== 'string') errors.push('room_code inválido');
  if (!match.language)   errors.push('language ausente');
  if (!match.difficulty) errors.push('difficulty ausente');
  if (!Number.isFinite(match.player_count) || match.player_count < 1)
    errors.push('player_count inválido');
  return { valid: errors.length === 0, errors };
}

// ─── Espelho da autoridade de expulsão (src/lib/room.ts, issue #39) ───────────

/** Espelhos dos tetos de `src/lib/room.ts` (quórum do PR Doctor: sem teto a
 *  coluna `kicked_ids` inflava sem limite e o fan-out da linha ia junto). */
const MAX_KICKED_ID_LEN = 64;
const MAX_KICKED = 24;

/** Espelho de `canKick(room, playerId, targetId)`. */
function canKick(room, playerId, targetId) {
  if (!room || typeof playerId !== 'string' || room.leader_id !== playerId) return false;
  if (typeof targetId !== 'string') return false;
  const t = targetId.trim();
  return t.length > 0 && t.length <= MAX_KICKED_ID_LEN && t !== room.leader_id;
}

/** Espelho de `addKickedId(current, targetId)` — dedupe idempotente com teto. */
function addKickedId(current, targetId) {
  const base = Array.isArray(current)
    ? current.filter(x => typeof x === 'string' && x.length <= MAX_KICKED_ID_LEN)
    : [];
  const t = typeof targetId === 'string' ? targetId.trim() : '';
  if (!t || t.length > MAX_KICKED_ID_LEN || base.includes(t)) return base;
  if (base.length >= MAX_KICKED) return base;
  return [...base, t];
}

/** Espelho de `kickedListFull(current)`. */
function kickedListFull(current) {
  const base = Array.isArray(current) ? current.filter(x => typeof x === 'string') : [];
  return base.length >= MAX_KICKED;
}

// ─── Framework de teste ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

const ROOM = { max_players: 8 };
const legit = (over = {}) => ({
  id: 'p1', name: 'caio', color: '#00ff88', wpm: 85, accuracy: 97,
  errors: 3, progress: 1, place: 1, finished: true, finishedAt: 1720000000000, ...over
});

// ─── Caminho legítimo: dados válidos passam intactos ─────────────────────────

console.log("\n── Caminho legítimo (não altera dados válidos) ──────────────────");
{
  const input = [legit(), legit({ id: 'p2', name: 'alice', wpm: 72, accuracy: 94, place: 2 })];
  const out = sanitizeResults(input, ROOM);
  assert("2 linhas legítimas preservadas", out.length === 2);
  assert("wpm preservado", out[0].wpm === 85 && out[1].wpm === 72);
  assert("accuracy preservado", out[0].accuracy === 97);
  assert("place preservado", out[0].place === 1 && out[1].place === 2);
  assert("campos cosméticos preservados (id/color/finishedAt)",
    out[0].id === 'p1' && out[0].color === '#00ff88' && out[0].finishedAt === 1720000000000);
}

// ─── Limites exigidos pela issue #7 ──────────────────────────────────────────

console.log("\n── Anti-cheat: WPM implausível ──────────────────────────────────");
{
  // Vetor da issue: injetar um top-1 forjado com wpm impossível.
  const out = sanitizeResults([legit({ name: 'hacker', wpm: 99999 })], ROOM);
  assert("wpm 99999 → linha DESCARTADA (não aparece no leaderboard)", out.length === 0);
  assert("wpm exatamente 350 (limite) → aceito", sanitizeResults([legit({ wpm: 350 })], ROOM).length === 1);
  assert("wpm 351 (acima do limite) → descartado", sanitizeResults([legit({ wpm: 351 })], ROOM).length === 0);
  assert("wpm negativo → descartado", sanitizeResults([legit({ wpm: -5 })], ROOM).length === 0);
  assert("wpm não-numérico → descartado", sanitizeResults([legit({ wpm: 'fast' })], ROOM).length === 0);
}

console.log("\n── name: trim, teto 20, vazio descartado ────────────────────────");
{
  const longName = 'x'.repeat(40);
  const out = sanitizeResults([legit({ name: longName })], ROOM);
  assert("name > 20 → truncado para 20", out.length === 1 && out[0].name.length === 20);
  assert("name só espaços → linha descartada", sanitizeResults([legit({ name: '   ' })], ROOM).length === 0);
  assert("name ausente → linha descartada", sanitizeResults([legit({ name: undefined })], ROOM).length === 0);
  assert("name com espaços nas bordas → trim aplicado",
    sanitizeResults([legit({ name: '  bob  ' })], ROOM)[0].name === 'bob');
}

console.log("\n── accuracy / errors / place: clamp ─────────────────────────────");
{
  assert("accuracy 150 → 100", sanitizeResults([legit({ accuracy: 150 })], ROOM)[0].accuracy === 100);
  assert("accuracy -10 → 0",   sanitizeResults([legit({ accuracy: -10 })], ROOM)[0].accuracy === 0);
  assert("errors -3 → 0",      sanitizeResults([legit({ errors: -3 })], ROOM)[0].errors === 0);
  assert("place 0 → null",     sanitizeResults([legit({ place: 0 })], ROOM)[0].place === null);
  assert("place -1 → null",    sanitizeResults([legit({ place: -1 })], ROOM)[0].place === null);
  assert("place null → null",  sanitizeResults([legit({ place: null })], ROOM)[0].place === null);
  assert("progress 5 → clamp 1", sanitizeResults([legit({ progress: 5 })], ROOM)[0].progress === 1);
}

console.log("\n── Tamanho do array limitado a room.max_players ─────────────────");
{
  const flood = Array.from({ length: 40 }, (_, i) => legit({ id: `p${i}`, name: `n${i}`, place: i + 1 }));
  assert("40 linhas numa sala de 8 → cortado em 8", sanitizeResults(flood, ROOM).length === 8);
  assert("teto absoluto 30 mesmo se max_players absurdo",
    sanitizeResults(flood, { max_players: 999 }).length === 30);
  assert("max_players ausente → cai no teto absoluto 30",
    sanitizeResults(flood, {}).length === 30);
}

console.log("\n── Entradas degeneradas ─────────────────────────────────────────");
{
  assert("input não-array → []", sanitizeResults(null, ROOM).length === 0);
  assert("linha null no meio → ignorada",
    sanitizeResults([legit(), null, legit({ id: 'p2', name: 'z' })], ROOM).length === 2);
  assert("linha não-objeto (string) → ignorada",
    sanitizeResults(['forjado', legit()], ROOM).length === 1);
}

// ─── Coerência temporal do finish (issue #34) ────────────────────────────────

const RACE_START = Date.parse('2026-07-30T12:00:00.000Z');
const TIMED_ROOM = {
  start_at: new Date(RACE_START).toISOString(),
  snippet: { title: 't', code: 'x'.repeat(300), language: 'javascript', difficulty: 'easy' }
};
/** Mínimo físico para 300 chars no teto humano: 10.285,7 ms. */
const MIN_MS_300 = (300 / 5 / MAX_PLAUSIBLE_WPM) * 60_000;
/** Linha já sanitizada (o filtro roda depois de `sanitizeResults`). */
const timed = (over = {}) => ({ ...legit({ finishedAt: null }), ...over });

console.log("\n── Anti-cheat: coerência temporal do finish (#34) ───────────────");
{
  assert("ataque da issue: finish 200 ms após o start com wpm 349 → descartado",
    dropTemporallyImpossible([timed({ wpm: 349 })], TIMED_ROOM, RACE_START + 200).length === 0);
  assert("ataque SEM o campo `progress` também cai (desligamento por omissão)",
    dropTemporallyImpossible(
      [timed({ wpm: 349, progress: 0, finished: true })], TIMED_ROOM, RACE_START + 200
    ).length === 0);
  assert("WPM alegado sem trabalho alegado é incoerente → descartado",
    dropTemporallyImpossible(
      [timed({ wpm: 349, progress: 0, finished: false })], TIMED_ROOM, RACE_START + 200
    ).length === 0);
  assert("residual declarado: esperar o mínimo físico (~10,3 s) passa",
    dropTemporallyImpossible(
      [timed({ wpm: 349 })], TIMED_ROOM, RACE_START + Math.ceil(MIN_MS_300)
    ).length === 1);
  assert("fronteira = mínimo físico menos a tolerância de relógio",
    dropTemporallyImpossible(
      [timed({ wpm: 349 })], TIMED_ROOM, RACE_START + Math.floor(MIN_MS_300 - TIMING_EPS_MS) - 1
    ).length === 0 &&
    dropTemporallyImpossible(
      [timed({ wpm: 349 })], TIMED_ROOM, RACE_START + Math.floor(MIN_MS_300 - TIMING_EPS_MS) + 1
    ).length === 1);

  // Não-regressão do que a 1ª versão (3×VETA) quebrava: o honesto impreciso.
  assert("digitador ruim: 300 chars em 90 s com wpm 8 → preservado",
    dropTemporallyImpossible([timed({ wpm: 8 })], TIMED_ROOM, RACE_START + 90_000).length === 1);
  assert("corrida honesta de 60 s com 3 erros não corrigidos (wpm 59) → preservada",
    dropTemporallyImpossible([timed({ wpm: 59 })], TIMED_ROOM, RACE_START + 60_000).length === 1);
  assert("jogador lento: 10 chars em 5 min, wpm 0 → preservado",
    dropTemporallyImpossible(
      [timed({ wpm: 0, progress: 10 / 300, finished: false })], TIMED_ROOM, RACE_START + 300_000
    ).length === 1);
  assert("abandono com progress parcial → julgado pelo que digitou, preservado",
    dropTemporallyImpossible(
      [timed({ wpm: 30, progress: 0.25, finished: false })], TIMED_ROOM, RACE_START + 30_000
    ).length === 1);
  assert("quem não digitou nada e não alega WPM → passa",
    dropTemporallyImpossible(
      [timed({ wpm: 0, progress: 0, finished: false })], TIMED_ROOM, RACE_START + 200
    ).length === 1);
  assert("teto humano numa corrida real de 60 s → passa",
    dropTemporallyImpossible(
      [timed({ wpm: MAX_PLAUSIBLE_WPM })], TIMED_ROOM, RACE_START + 60_000
    ).length === 1);

  assert("finishedAt baixo (forjável por terceiro) não derruba o honesto",
    dropTemporallyImpossible(
      [timed({ wpm: 59, finishedAt: RACE_START + 200 })], TIMED_ROOM, RACE_START + 60_000
    ).length === 1);
  assert("finishedAt no futuro não compra tempo",
    dropTemporallyImpossible(
      [timed({ wpm: 349, finishedAt: RACE_START + 3_600_000 })], TIMED_ROOM, RACE_START + 200
    ).length === 0);

  assert("sala racing sem start_at → descarta tudo (nunca 'passa tudo')",
    dropTemporallyImpossible(
      [timed(), timed({ name: 'z' })],
      { start_at: null, snippet: TIMED_ROOM.snippet }, RACE_START + 60_000
    ).length === 0);
  assert("start_at inválido → descarta tudo",
    dropTemporallyImpossible(
      [timed()], { start_at: 'ontem', snippet: TIMED_ROOM.snippet }, RACE_START + 60_000
    ).length === 0);
  assert("sala sem snippet → sem alvo para medir, a linha passa",
    dropTemporallyImpossible(
      [timed({ wpm: 349 })], { start_at: TIMED_ROOM.start_at, snippet: null }, RACE_START + 200
    ).length === 1);
  assert("relógio do servidor antes do start → elapsed 0, impossível não passa",
    dropTemporallyImpossible([timed({ wpm: 349 })], TIMED_ROOM, RACE_START - 5_000).length === 0);
  // Aos 2 s do start, só quem digitou POUCO é possível: o honesto está em 15
  // chars (need 514 ms) e o forjado alega os 300 (need 10,3 s).
  assert("descarta só a linha impossível, preserva a honesta do mesmo payload",
    dropTemporallyImpossible(
      [timed({ name: 'honesto', wpm: 90, progress: 0.05, finished: false }),
       timed({ name: 'forjado', wpm: 349, progress: 0, finished: true })],
      TIMED_ROOM, RACE_START + 2_000
    ).map(r => r.name).join() === 'honesto');
}


// ─── validateMatchInsert (linha na tabela `matches`) ──────────────────────────

console.log("\n── validateMatchInsert ──────────────────────────────────────────");
{
  const m = { room_code: 'ABCDEF', language: 'javascript', difficulty: 'medium', player_count: 3 };
  assert("match válido → valid", validateMatchInsert(m).valid);
  assert("room_code ausente → inválido",
    !validateMatchInsert({ language: 'python', difficulty: 'easy', player_count: 2 }).valid);
  assert("player_count 0 → inválido",
    !validateMatchInsert({ room_code: 'XYZABC', language: 'go', difficulty: 'hard', player_count: 0 }).valid);
}

// ─── Ranking (espelha persistMatch: ordena por place, 1º é winner) ────────────

console.log("\n── Ranking de resultados ────────────────────────────────────────");
{
  const results = sanitizeResults([
    legit({ id: 'a', name: 'caio',  wpm: 85, place: 1 }),
    legit({ id: 'b', name: 'alice', wpm: 72, place: 2 }),
    legit({ id: 'c', name: 'bob',   wpm: 40, place: null, finished: false })
  ], ROOM);
  const ranked = [...results].sort((a, b) => (a.place || 99) - (b.place || 99));
  assert("winner é o de place=1", ranked[0].name === 'caio');
  assert("winner_wpm correto",    ranked[0].wpm === 85);
  assert("place=null fica por último", ranked[ranked.length - 1].name === 'bob');
}

// ─── Autoridade de expulsão (kick) — issue #39 ───────────────────────────────

console.log("\n── canKick: só o líder legítimo expulsa ─────────────────────────");
{
  const ROOM39 = { leader_id: 'leader-1' };
  assert("líder remove um jogador → autorizado", canKick(ROOM39, 'leader-1', 'victim-2') === true);
  assert("não-líder tenta remover → rejeitado (rota devolve 403)",
    canKick(ROOM39, 'rando-9', 'victim-2') === false);
  assert("não-líder tenta expulsar o próprio líder → rejeitado",
    canKick(ROOM39, 'rando-9', 'leader-1') === false);
  assert("alvo vazio → rejeitado (rota devolve 400)", canKick(ROOM39, 'leader-1', '') === false);
  assert("alvo só espaços → rejeitado", canKick(ROOM39, 'leader-1', '   ') === false);
  assert("room ausente → rejeitado", canKick(null, 'leader-1', 'victim-2') === false);
  assert("playerId não-string → rejeitado", canKick(ROOM39, undefined, 'victim-2') === false);
}

console.log("\n── addKickedId: dedupe idempotente, estado seguro ───────────────");
{
  assert("acrescenta alvo novo", JSON.stringify(addKickedId([], 'v1')) === JSON.stringify(['v1']));
  assert("preserva os já existentes",
    JSON.stringify(addKickedId(['v1'], 'v2')) === JSON.stringify(['v1', 'v2']));
  assert("alvo já presente → lista inalterada (idempotente)",
    JSON.stringify(addKickedId(['v1', 'v2'], 'v1')) === JSON.stringify(['v1', 'v2']));
  assert("alvo vazio → lista inalterada (no-op seguro)",
    JSON.stringify(addKickedId(['v1'], '')) === JSON.stringify(['v1']));
  assert("current null → parte de lista vazia", JSON.stringify(addKickedId(null, 'v1')) === JSON.stringify(['v1']));
  assert("aplica trim ao alvo", JSON.stringify(addKickedId([], '  v9  ')) === JSON.stringify(['v9']));
}

console.log("\n── Teto da lista de expulsos (inflação da linha da sala) ────────");
{
  const ROOM39 = { leader_id: 'leader-1' };
  const HUGE = 'x'.repeat(MAX_KICKED_ID_LEN + 1);
  // Vetor do quórum: alvo gigante distinto a cada request escapava o dedupe e
  // inflava `rooms.kicked_ids` sem limite — e cada UPDATE reemite a linha
  // inteira para todos os assinantes postgres_changes da sala.
  assert("alvo acima do teto de tamanho → canKick rejeita (400)",
    canKick(ROOM39, 'leader-1', HUGE) === false);
  assert("alvo acima do teto → addKickedId é no-op",
    JSON.stringify(addKickedId([], HUGE)) === JSON.stringify([]));
  assert("alvo exatamente no teto ainda é aceito",
    canKick(ROOM39, 'leader-1', 'y'.repeat(MAX_KICKED_ID_LEN)) === true);
  assert("líder não expulsa a si mesmo", canKick(ROOM39, 'leader-1', 'leader-1') === false);

  const cheia = Array.from({ length: MAX_KICKED }, (_, i) => `v${i}`);
  assert("lista cheia → kickedListFull true", kickedListFull(cheia) === true);
  assert("lista cheia → addKickedId não cresce",
    addKickedId(cheia, 'novo').length === MAX_KICKED);
  assert("lista cheia → alvo já presente segue idempotente",
    JSON.stringify(addKickedId(cheia, 'v0')) === JSON.stringify(cheia));
  assert("lista quase cheia ainda aceita",
    addKickedId(cheia.slice(0, MAX_KICKED - 1), 'novo').length === MAX_KICKED);

  // 1000 requests hostis não fazem a lista passar do teto.
  let acc = [];
  for (let i = 0; i < 1000; i++) acc = addKickedId(acc, `atk-${i}`);
  assert("1000 kicks hostis → lista limitada ao teto", acc.length === MAX_KICKED);
  assert("entrada suja no banco (item gigante) é descartada na leitura",
    addKickedId([HUGE, 'v1'], 'v2').every(x => x.length <= MAX_KICKED_ID_LEN));
}

// ─── Allowlist de settings (issue #35: language/difficulty na fronteira) ──────

console.log("\n── Allowlist de language ────────────────────────────────────────");
{
  assert("linguagem válida passa preservada", resolveLang('rust', 'javascript').value === 'rust');
  assert("todas as 14 linguagens suportadas são válidas",
    ['javascript','typescript','python','java','csharp','cpp','go','rust','sql','bash','ruby','php','kotlin','swift']
      .every(isValidLang));
  assert("linguagem inventada → rejeitada (400)", resolveLang('brainfuck', 'javascript').ok === false);
  assert("payload gigante → rejeitado (storage abuse)",
    resolveLang('x'.repeat(2_000_000), 'javascript').ok === false);
  assert("ausente (undefined) → cai no default", resolveLang(undefined, 'javascript').value === 'javascript');
  assert("null → cai no default", resolveLang(null, 'javascript').value === 'javascript');
  assert("string vazia → cai no default", resolveLang('', 'javascript').value === 'javascript');
  assert("ausente na action settings → mantém o valor atual da sala",
    resolveLang(undefined, 'python').value === 'python');
  assert("não-string (número) → rejeitado", resolveLang(42, 'javascript').ok === false);
}

console.log("\n── Allowlist de difficulty ──────────────────────────────────────");
{
  assert("easy/medium/hard válidos",
    isValidDifficulty('easy') && isValidDifficulty('medium') && isValidDifficulty('hard'));
  assert("dificuldade válida passa preservada", resolveDifficulty('hard', 'medium').value === 'hard');
  assert("dificuldade inventada → rejeitada (400)", resolveDifficulty('impossible', 'medium').ok === false);
  assert("ausente → cai no default", resolveDifficulty(undefined, 'medium').value === 'medium');
  assert("string vazia → cai no default", resolveDifficulty('', 'medium').value === 'medium');
  assert("ausente na action settings → mantém o valor atual da sala",
    resolveDifficulty(undefined, 'hard').value === 'hard');
  assert("case-sensitive: 'Easy' → rejeitado", resolveDifficulty('Easy', 'medium').ok === false);
}

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────────────────────────────");
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);

if (failed > 0) {
  console.error("\n[FALHA] Corrija a lógica de persistência antes de commitar.");
  process.exit(1);
} else {
  console.log("\n[OK] Persistência validada. Seguro para commitar.");
  process.exit(0);
}
