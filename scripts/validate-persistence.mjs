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
const ABSOLUTE_MAX_PLAYERS = 12;

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

// ─── Espelho das regras de coerência temporal (src/lib/room.ts, issue #34) ────
// `start_at` é o instante em que a DIGITAÇÃO começa (o countdown já está embutido);
// o tempo decorrido é `now - start_at`. Teto físico de WPM = (chars/5)/elapsedMin.

const CLOCK_SKEW_SLACK = 1.1;

/** Espelho fiel de `plausibleWpmCeiling(startAtISO, snippetChars, now)`. */
function plausibleWpmCeiling(startAtISO, snippetChars, now) {
  if (!startAtISO) return 0;
  const startMs = Date.parse(startAtISO);
  if (!Number.isFinite(startMs)) return 0;
  const elapsedMin = (now - startMs) / 60000;
  if (elapsedMin <= 0) return 0; // ainda no countdown → corrida impossível
  const chars = Math.max(0, Math.round(Number(snippetChars)) || 0);
  return ((chars / 5) / elapsedMin) * CLOCK_SKEW_SLACK;
}

/** Espelho fiel de `validateFinishTiming(results, room, now)`. */
function validateFinishTiming(results, room, now) {
  if (!Array.isArray(results) || results.length === 0) return [];
  const ceiling = plausibleWpmCeiling(room.start_at ?? null, room.snippet?.code.length ?? 0, now);
  if (ceiling <= 0) return [];
  return results.filter(r => r.wpm <= ceiling);
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
  const flood = Array.from({ length: 30 }, (_, i) => legit({ id: `p${i}`, name: `n${i}`, place: i + 1 }));
  assert("30 linhas numa sala de 8 → cortado em 8", sanitizeResults(flood, ROOM).length === 8);
  assert("teto absoluto 12 mesmo se max_players absurdo",
    sanitizeResults(flood, { max_players: 999 }).length === 12);
  assert("max_players ausente → cai no teto absoluto 12",
    sanitizeResults(flood, {}).length === 12);
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

// ─── Coerência temporal do finish (issue #34) ────────────────────────────────
// `now` é fixo e determinístico (nada de Date.now); `start_at` é construído
// relativo a ele. Espelha `validateFinishTiming` / `plausibleWpmCeiling`.

console.log("\n── Anti-cheat: coerência temporal (validateFinishTiming) ─────────");
{
  const NOW = 1720000000000;
  const iso = ms => new Date(ms).toISOString();
  const room = (over = {}) => ({ start_at: null, snippet: { code: 'x'.repeat(300) }, ...over });

  // Teto puro: 300 chars digitados em 60 s = 60 WPM; teto ≈ 60 × 1.1 = 66.
  const teto60s = plausibleWpmCeiling(iso(NOW - 60000), 300, NOW);
  assert("teto de 60s/300chars ≈ 66", Math.abs(teto60s - 66) < 0.5, `got ${teto60s}`);
  assert("teto com start_at nulo → 0", plausibleWpmCeiling(null, 300, NOW) === 0);
  assert("teto com start_at inválido → 0", plausibleWpmCeiling('não-data', 300, NOW) === 0);
  assert("teto dentro do countdown (now <= start_at) → 0",
    plausibleWpmCeiling(iso(NOW + 3800), 300, NOW) === 0);

  // Corrida honesta de 60s: 60/45 WPM sob teto 66 → preservada intacta.
  {
    const honest = [legit({ name: 'caio', wpm: 60, place: 1 }), legit({ name: 'ana', wpm: 45, place: 2 })];
    const out = validateFinishTiming(honest, room({ start_at: iso(NOW - 60000) }), NOW);
    assert("corrida honesta de 60s preservada (2 linhas)", out.length === 2);
    assert("WPM honesto intacto", out[0].wpm === 60 && out[1].wpm === 45);
  }

  // Finish 200 ms após o `start` (ainda no countdown): WPM 349 → array vazio.
  {
    const forged = [legit({ name: 'hacker', wpm: 349 })];
    const out = validateFinishTiming(forged, room({ start_at: iso(NOW + 3800) }), NOW);
    assert("finish no countdown com WPM 349 → descartado (vazio)", out.length === 0);
  }

  // Passado o countdown mas WPM impossível para o tempo: 349 em 10s/100chars (teto ≈132) → descartado.
  {
    const mixed = [legit({ name: 'real', wpm: 80, place: 1 }), legit({ name: 'hacker', wpm: 349, place: 2 })];
    const out = validateFinishTiming(mixed, room({ start_at: iso(NOW - 10000), snippet: { code: 'y'.repeat(100) } }), NOW);
    assert("WPM 349 impossível em 10s/100chars → descartado", out.length === 1 && out[0].name === 'real');
  }

  // start_at ausente numa sala `racing` → descarta tudo (nunca "passa tudo").
  assert("start_at ausente → descarta tudo",
    validateFinishTiming([legit({ wpm: 60 })], room({ start_at: null }), NOW).length === 0);
  // snippet ausente → sem chars para calcular → descarta (defensivo).
  assert("snippet ausente → descarta tudo",
    validateFinishTiming([legit({ wpm: 60 })], room({ start_at: iso(NOW - 10000), snippet: null }), NOW).length === 0);

  // Corrida lenta e real (90s, 200 chars → teto ≈29.3): 27/29 WPM não são descartados por arredondamento.
  {
    const slow = [legit({ name: 'lento', wpm: 27, place: 1 }), legit({ name: 'medio', wpm: 29, place: 2 })];
    const out = validateFinishTiming(slow, room({ start_at: iso(NOW - 90000), snippet: { code: 'z'.repeat(200) } }), NOW);
    assert("corrida lenta real (27/29 WPM) não descartada por arredondamento", out.length === 2);
  }
  assert("results vazio → vazio", validateFinishTiming([], room({ start_at: iso(NOW - 60000) }), NOW).length === 0);
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
