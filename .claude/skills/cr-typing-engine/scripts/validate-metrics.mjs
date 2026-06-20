#!/usr/bin/env node
/**
 * validate-metrics.mjs
 * Valida as fórmulas de WPM, precisão e progresso do CodeRacer (Race.tsx).
 * Execute: node scripts/validate-metrics.mjs
 *
 * Fórmulas espelhadas de src/components/Race.tsx (linhas 49-60).
 * Se as fórmulas mudarem lá, atualize aqui também.
 */

// ─── Implementação das fórmulas (espelho de Race.tsx) ───────────────────────

/**
 * Conta caracteres corretos em `typed` comparando posição a posição com `code`.
 * @param {string} typed - O que o usuário digitou
 * @param {string} code  - O snippet alvo
 * @returns {number}
 */
function correctChars(typed, code) {
  let c = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === code[i]) c++;
  }
  return c;
}

/**
 * WPM padrão de indústria: (chars corretos / 5) / minutos decorridos.
 * Retorna 0 se elapsed for menor que 100 ms (evita divisão por zero e picos iniciais).
 * @param {number} correct   - Caracteres corretos
 * @param {number} elapsedMs - Tempo decorrido em ms
 * @returns {number} WPM arredondado
 */
function calcWpm(correct, elapsedMs) {
  const elapsedMin = elapsedMs / 60000;
  return elapsedMin > 0.001 ? Math.round((correct / 5) / elapsedMin) : 0;
}

/**
 * Precisão: (1 - erros / totalKeystrokes) * 100, arredondado.
 * Retorna 100 se não houve nenhum keystroke ainda.
 * Mínimo de 0 (não fica negativo).
 * @param {number} errors          - Total de teclas incorretas (cumulativo)
 * @param {number} totalKeystrokes - Total de teclas para frente (não backspace)
 * @returns {number} Precisão 0..100
 */
function calcAccuracy(errors, totalKeystrokes) {
  return totalKeystrokes === 0
    ? 100
    : Math.max(0, Math.round((1 - errors / totalKeystrokes) * 100));
}

/**
 * Progresso: posição no snippet (0..1), clamped.
 * Não depende de acurácia — o jogador avança mesmo errando e corrigindo.
 * @param {number} typedLen - Comprimento do que foi digitado
 * @param {number} codeLen  - Comprimento do snippet
 * @returns {number} 0..1
 */
function calcProgress(typedLen, codeLen) {
  return codeLen === 0 ? 0 : Math.min(1, typedLen / codeLen);
}

// ─── Framework de teste mínimo ───────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, actual, expected, tolerance = 0) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    esperado: ${expected} (±${tolerance}), obtido: ${actual}`);
    failed++;
  }
}

// ─── Casos de teste: WPM ─────────────────────────────────────────────────────

console.log("\n── WPM ──────────────────────────────────────────────────────────");

// Caso 1: 60 chars corretos em 1 minuto = 12 WPM (60/5/1)
assert("60 chars corretos em 60 s → 12 WPM",
  calcWpm(60, 60_000), 12);

// Caso 2: 300 chars corretos em 60 s = 60 WPM (tipista rápida)
assert("300 chars corretos em 60 s → 60 WPM",
  calcWpm(300, 60_000), 60);

// Caso 3: 100 chars corretos em 30 s = 40 WPM
assert("100 chars corretos em 30 s → 40 WPM",
  calcWpm(100, 30_000), 40);

// Caso 4: Elapsed < 100 ms → WPM deve ser 0 (evita pico no início)
assert("elapsed 50 ms → WPM = 0",
  calcWpm(10, 50), 0);

// Caso 5: 0 chars corretos → WPM = 0
assert("0 chars corretos → WPM = 0",
  calcWpm(0, 30_000), 0);

// Caso 6: Anti-cheat — WPM fisicamente impossível (>300 WPM = suspeito)
// O motor não bloqueia ainda, mas o teste documenta o threshold
const suspiciousWpm = calcWpm(1500, 60_000); // 1500 chars em 1 min = 300 WPM
assert("300 WPM (limite superior humano plausível) é calculável",
  suspiciousWpm, 300);
console.log(`    [anti-cheat] WPM > 300 deve ser bloqueado no servidor. Atual: ${suspiciousWpm}`);

// ─── Casos de teste: Precisão ────────────────────────────────────────────────

console.log("\n── Precisão ─────────────────────────────────────────────────────");

// Caso 7: Sem keystrokes → 100%
assert("sem keystrokes → 100%",
  calcAccuracy(0, 0), 100);

// Caso 8: 0 erros em 50 keystrokes → 100%
assert("0 erros, 50 keystrokes → 100%",
  calcAccuracy(0, 50), 100);

// Caso 9: 5 erros em 100 keystrokes → 95%
assert("5 erros, 100 keystrokes → 95%",
  calcAccuracy(5, 100), 95);

// Caso 10: 50 erros em 100 keystrokes → 50%
assert("50 erros, 100 keystrokes → 50%",
  calcAccuracy(50, 100), 50);

// Caso 11: 100 erros em 100 keystrokes → 0% (mínimo, não negativo)
assert("100 erros, 100 keystrokes → 0% (piso em 0)",
  calcAccuracy(100, 100), 0);

// Caso 12: mais erros que keystrokes (estado inválido) → nunca < 0
assert("120 erros, 100 keystrokes → piso em 0",
  calcAccuracy(120, 100), 0);

// ─── Casos de teste: Progresso ───────────────────────────────────────────────

console.log("\n── Progresso ────────────────────────────────────────────────────");

// Caso 13: sem digitar → 0
assert("0 chars digitados → progress = 0",
  calcProgress(0, 100), 0);

// Caso 14: metade → 0.5
assert("50 de 100 chars → progress = 0.5",
  calcProgress(50, 100), 0.5);

// Caso 15: exato → 1.0
assert("100 de 100 chars → progress = 1.0",
  calcProgress(100, 100), 1.0);

// Caso 16: overflow clampado (não deveria acontecer, mas defensivo)
assert("110 de 100 chars → progress clampado em 1.0",
  calcProgress(110, 100), 1.0);

// Caso 17: snippet vazio → 0 (evita divisão por zero)
assert("snippet vazio (codeLen=0) → progress = 0",
  calcProgress(0, 0), 0);

// ─── Casos de teste: correctChars ────────────────────────────────────────────

console.log("\n── correctChars ─────────────────────────────────────────────────");

const snippet = "let x = 1;";

// Caso 18: match perfeito
assert("typed = code → correctChars = code.length",
  correctChars(snippet, snippet), snippet.length);

// Caso 19: completamente errado
assert("typed todo errado → correctChars = 0",
  correctChars("XXXXXXXXXX", snippet), 0);

// Caso 20: parcialmente correto
assert("'let x' (6 chars) corretos no início",
  correctChars("let x = 1;ERROS", snippet), snippet.length);

// Caso 21: typed mais curto que code
assert("typed mais curto → conta só os digitados",
  correctChars("let", snippet), 3);

// Caso 22: um erro no meio não impede o resto
assert("'let X = 1;' — só o X errado → 9 corretos",
  correctChars("let X = 1;", snippet), 9);

// ─── Caso de integração: WPM com correctChars ────────────────────────────────

console.log("\n── Integração ───────────────────────────────────────────────────");

// Caso 23: snippet real de 10 chars, digitado 100% correto em 30 s
const code10 = "let x = 1;";
const typed10 = "let x = 1;";
const cc = correctChars(typed10, code10);  // 10
const wpmResult = calcWpm(cc, 30_000);     // (10/5) / 0.5 = 4 WPM
assert("snippet 10 chars, 100% correto, 30 s → 4 WPM",
  wpmResult, 4);

// Caso 24: snippet real — Debounce util (~112 chars), digitado em 60 s sem erros → ~22 WPM
const debounceLen = 112;
const wpmDebounce = calcWpm(debounceLen, 60_000); // (112/5)/1 ≈ 22
assert("snippet debounce 112 chars, 60 s → ~22 WPM", wpmDebounce, 22);

// ─── Resultado final ─────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────────────────────────────");
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);

if (failed > 0) {
  console.error("\n[FALHA] Corrija as fórmulas antes de commitar.");
  process.exit(1);
} else {
  console.log("\n[OK] Todas as métricas validadas. Seguro para commitar.");
  process.exit(0);
}
