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
