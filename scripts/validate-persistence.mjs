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
