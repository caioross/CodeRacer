#!/usr/bin/env node
/**
 * validate-persistence.mjs
 * Valida a forma dos objetos ResultRow e MatchInsert que chegam ao Supabase
 * na função persistMatch() de src/app/api/rooms/[code]/route.ts.
 *
 * NÃO faz chamadas de rede — testa apenas a lógica de transformação/validação
 * dos dados antes do insert. Execute: node scripts/validate-persistence.mjs
 */

// ─── Espelho das regras de persistMatch() ────────────────────────────────────

/**
 * Valida e sanitiza um ResultRow antes de inserir em `scores`.
 * Espelha a lógica de src/app/api/rooms/[code]/route.ts:persistMatch().
 * @param {object} r - ResultRow bruto do cliente
 * @returns {{ valid: boolean, sanitized: object, errors: string[] }}
 */
function sanitizeResult(r) {
  const errors = [];

  if (!r || typeof r !== 'object') {
    return { valid: false, sanitized: null, errors: ['ResultRow não é objeto'] };
  }

  const name = typeof r.name === 'string' && r.name.trim()
    ? r.name.trim().slice(0, 50)
    : null;
  if (!name) errors.push('name ausente ou vazio');

  const wpm = Number.isFinite(r.wpm) ? Math.max(0, Math.min(300, Math.round(r.wpm))) : 0;
  if (r.wpm > 300) errors.push(`WPM suspeito: ${r.wpm} → clampado em 300`);

  const accuracy = Number.isFinite(r.accuracy)
    ? Math.max(0, Math.min(100, Math.round(r.accuracy)))
    : 0;

  const errorsCount = Number.isFinite(r.errors) ? Math.max(0, Math.round(r.errors)) : 0;
  const place = Number.isFinite(r.place) && r.place > 0 ? Math.round(r.place) : null;
  const finished = !!r.finished;

  return {
    valid: errors.length === 0,
    sanitized: { name, wpm, accuracy, errors: errorsCount, place, finished },
    errors
  };
}

/**
 * Valida o objeto de match (linha na tabela `matches`).
 * @param {object} match
 * @returns {{ valid: boolean, errors: string[] }}
 */
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

// ─── Testes: sanitizeResult ───────────────────────────────────────────────────

console.log("\n── sanitizeResult ───────────────────────────────────────────────");

// Caso 1: resultado válido e completo
{
  const r = { name: "caio", wpm: 85, accuracy: 97, errors: 3, place: 1, finished: true };
  const { valid, sanitized } = sanitizeResult(r);
  assert("resultado válido → valid = true", valid);
  assert("wpm preservado", sanitized.wpm === 85);
  assert("accuracy preservado", sanitized.accuracy === 97);
  assert("place preservado", sanitized.place === 1);
  assert("finished preservado", sanitized.finished === true);
}

// Caso 2: WPM acima de 300 (suspeito) → clampado
{
  const r = { name: "hacker", wpm: 999, accuracy: 100, errors: 0, place: 1, finished: true };
  const { sanitized, errors } = sanitizeResult(r);
  assert("WPM 999 → clampado em 300", sanitized.wpm === 300);
  assert("erro de WPM suspeito registrado", errors.some(e => e.includes("WPM suspeito")));
}

// Caso 3: name vazio → inválido
{
  const r = { name: "  ", wpm: 60, accuracy: 95, errors: 2, place: 2, finished: true };
  const { valid, errors } = sanitizeResult(r);
  assert("name vazio → valid = false", !valid);
  assert("erro de name registrado", errors.some(e => e.includes("name")));
}

// Caso 4: place inválido (null, 0 ou negativo) → null
{
  const r1 = { name: "x", wpm: 50, accuracy: 90, errors: 5, place: null, finished: false };
  const r2 = { name: "x", wpm: 50, accuracy: 90, errors: 5, place: 0,    finished: false };
  const r3 = { name: "x", wpm: 50, accuracy: 90, errors: 5, place: -1,   finished: false };
  assert("place null  → null", sanitizeResult(r1).sanitized.place === null);
  assert("place 0     → null", sanitizeResult(r2).sanitized.place === null);
  assert("place -1    → null", sanitizeResult(r3).sanitized.place === null);
}

// Caso 5: accuracy fora do range → clampado 0..100
{
  const rHigh = { name: "a", wpm: 50, accuracy: 150, errors: 0, place: 1, finished: true };
  const rLow  = { name: "a", wpm: 50, accuracy: -10, errors: 0, place: 1, finished: true };
  assert("accuracy 150 → 100", sanitizeResult(rHigh).sanitized.accuracy === 100);
  assert("accuracy -10 → 0",   sanitizeResult(rLow).sanitized.accuracy  === 0);
}

// Caso 6: result não é objeto
{
  const { valid, errors } = sanitizeResult(null);
  assert("null → valid = false", !valid);
  assert("erro descritivo", errors.length > 0);
}

// ─── Testes: validateMatchInsert ─────────────────────────────────────────────

console.log("\n── validateMatchInsert ──────────────────────────────────────────");

// Caso 7: match completo e válido
{
  const m = {
    room_code: "ABCDEF",
    language: "javascript",
    difficulty: "medium",
    player_count: 3,
    winner_name: "caio",
    winner_wpm: 85
  };
  const { valid } = validateMatchInsert(m);
  assert("match válido → valid = true", valid);
}

// Caso 8: room_code ausente
{
  const m = { language: "python", difficulty: "easy", player_count: 2 };
  const { valid } = validateMatchInsert(m);
  assert("room_code ausente → inválido", !valid);
}

// Caso 9: player_count = 0 → inválido
{
  const m = { room_code: "XYZABC", language: "go", difficulty: "hard", player_count: 0 };
  const { valid } = validateMatchInsert(m);
  assert("player_count 0 → inválido", !valid);
}

// ─── Teste de integração: ranking dos resultados ──────────────────────────────

console.log("\n── Ranking de resultados ────────────────────────────────────────");

// Espelha a lógica de `persistMatch`: ordena por place, 1º é winner
const results = [
  { name: "caio",  wpm: 85, accuracy: 97, errors: 3,  place: 1, finished: true },
  { name: "alice", wpm: 72, accuracy: 94, errors: 5,  place: 2, finished: true },
  { name: "bob",   wpm: 0,  accuracy: 80, errors: 10, place: null, finished: false }
];

const ranked = [...results].sort((a, b) => (a.place || 99) - (b.place || 99));
const winner = ranked[0];

assert("winner é o de place=1", winner.name === "caio");
assert("winner_wpm correto",    winner.wpm  === 85);
assert("não-finalizado fica por último", ranked[ranked.length - 1].name === "bob");

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
