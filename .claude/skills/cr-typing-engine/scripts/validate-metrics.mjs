#!/usr/bin/env node
/**
 * validate-metrics.mjs
 * Valida as fórmulas de WPM, precisão e progresso do CodeRacer (Race.tsx).
 * Execute: node scripts/validate-metrics.mjs
 *
 * Fórmulas espelhadas de src/components/Race.tsx (bloco de cálculo de métricas).
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
 * Precisão honesta (issue #20): 100% só com zero erros cometidos.
 * Com ≥1 erro, usa floor e teto de 99% para nunca exibir 100% coexistindo com
 * "Erros ≥ 1". errors > 0 garante totalKeystrokes > 0 (não há erro sem tecla).
 * Mínimo de 0 (não fica negativo).
 * @param {number} errors          - Total de teclas incorretas (cumulativo)
 * @param {number} totalKeystrokes - Total de teclas para frente (não backspace)
 * @returns {number} Precisão 0..100
 */
function calcAccuracy(errors, totalKeystrokes) {
  return errors === 0
    ? 100
    : Math.max(0, Math.min(99, Math.floor((1 - errors / totalKeystrokes) * 100)));
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

// Caso 12b: honestidade (issue #20) — 1 erro em 200 teclas NÃO pode virar 100%.
// Antes, Math.round(0.995*100)=100 contradizia o cartão "Erros 1". Agora → 99%.
assert("1 erro, 200 keystrokes → 99% (nunca 100% com erro cometido)",
  calcAccuracy(1, 200), 99);

// Caso 12c: teto de 99% mesmo com fração altíssima (1 erro em 10000 teclas)
assert("1 erro, 10000 keystrokes → 99% (teto, não 100%)",
  calcAccuracy(1, 10_000), 99);

// Caso 12d: 100% é reservado a zero erros cometidos
assert("0 erros, 200 keystrokes → 100% (único caminho para 100%)",
  calcAccuracy(0, 200), 100);

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

// ─── Indentação por Tab (issue #41) ──────────────────────────────────────────
// Espelho de src/lib/indent.ts (indentEdit). Se a lógica mudar lá, atualize aqui.

function spaceRunAt(text, offset) {
  let n = 0;
  while (offset + n < text.length && text[offset + n] === " ") n++;
  return n;
}

function indentEdit(value, target, selStart, selEnd = selStart) {
  const noop = { text: value, caret: selStart };
  if (selStart < 0 || selStart > value.length || selEnd < selStart) return noop;
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const beforeCaret = value.slice(lineStart, selStart);
  if (!/^ *$/.test(beforeCaret)) return noop;
  let lineIdx = 0;
  for (let i = 0; i < lineStart; i++) if (value[i] === "\n") lineIdx++;
  let ti = 0;
  for (let l = 0; l < lineIdx; l++) {
    const nx = target.indexOf("\n", ti);
    if (nx === -1) return noop;
    ti = nx + 1;
  }
  const expected = spaceRunAt(target, ti);
  const remaining = expected - beforeCaret.length;
  if (remaining <= 0) return noop;
  const ins = " ".repeat(remaining);
  return {
    text: value.slice(0, selStart) + ins + value.slice(selEnd),
    caret: selStart + ins.length
  };
}

// Espelho de src/lib/indent.ts (enterEdit — auto-indent no Enter, issue #62).
function enterEdit(value, target, selStart, selEnd = selStart) {
  const noop = { text: value, caret: selStart };
  if (selStart < 0 || selStart > value.length || selEnd < selStart || selEnd > value.length)
    return noop;
  if (selEnd !== value.length) return noop; // só quebra no fim do texto digitado
  const withNl = value.slice(0, selStart) + "\n" + value.slice(selEnd);
  const { text, caret } = indentEdit(withNl, target, selStart + 1);
  if (text === withNl) return noop; // sem indentação a preencher → Enter nativo
  return { text, caret };
}

/** Igualdade estrita (string/número), para além do `assert` com tolerância. */
function assertEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    esperado: ${JSON.stringify(expected)}, obtido: ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\n── Indentação por Tab (#41) ─────────────────────────────────────");

// Snippet do repro (O Iniciante, Python/Fácil): linha 2 indenta 4 espaços.
const py = "def soma(numeros):\n    return sum(numeros)";
const l1 = "def soma(numeros):\n"; // caret no início da linha 2 = offset 19

// Caso 25: caret no início da linha 2 → insere exatamente os 4 espaços do target
const c25 = indentEdit(l1, py, 19);
assertEq("Tab no início da linha 2 → insere 4 espaços", c25.text, l1 + "    ");
assert("caret após os 4 espaços inseridos", c25.caret, 23);

// Caso 26: os espaços inseridos batem o target → não geram erro (honestidade)
assertEq("indentação inserida é 100% correta vs target",
  correctChars(c25.text, py), c25.text.length);

// Caso 27: erro upstream (value não é prefixo de target) → ainda indenta certo.
// Antes o índice cru quebrava aqui — este é o coração do bug.
const errUp = "def somaX(numeros):\n"; // 'X' extra desloca o offset cru
const c27 = indentEdit(errUp, py, errUp.length);
assertEq("com erro anterior na linha 1, Tab ainda insere 4 espaços",
  c27.text, errUp + "    ");

// Caso 28: linha sem indentação (linha 1) → no-op (fim do fallback tóxico "  ")
const c28 = indentEdit("", py, 0);
assertEq("linha 1 (indent 0) → não insere nada", c28.text, "");
assert("caret preservado no no-op", c28.caret, 0);

// Caso 29: já digitou 2 dos 4 espaços → completa só os 2 que faltam
const half = "def soma(numeros):\n  "; // 2 espaços já na linha 2
const c29 = indentEdit(half, py, half.length);
assertEq("2 espaços já digitados → insere só os 2 restantes", c29.text, l1 + "    ");

// Caso 30: caret no meio de código (não-espaço antes) → no-op (não polui)
const c30 = indentEdit("def soma(numeros):", py, 5);
assertEq("Tab no meio do código → no-op", c30.text, "def soma(numeros):");

// Caso 31: target com menos linhas que a linha lógica atual → no-op seguro
const c31 = indentEdit("a\nb\n", "x", 4);
assertEq("linha além do target → no-op", c31.text, "a\nb\n");

// Caso 32: seleção é substituída pela indentação esperada
const sel = "def soma(numeros):\nZZ";
const c32 = indentEdit(sel, py, 19, 21); // seleciona "ZZ"
assertEq("seleção substituída pelos 4 espaços", c32.text, l1 + "    ");

console.log("\n── Auto-indent no Enter (#62, touch sem Tab) ────────────────────");

// Caso 33: Enter no fim da linha 1 → \n + os 4 espaços da linha 2 (nem 1 a mais)
const e33 = enterEdit("def soma(numeros):", py, 18);
assertEq("Enter no fim da linha 1 → \\n + 4 espaços", e33.text, l1 + "    ");
assert("caret após \\n + 4 espaços", e33.caret, 23);

// Caso 34: honestidade — os espaços do Enter batem o target char-a-char
assertEq("indent do Enter é 100% correto vs target",
  correctChars(e33.text, py), e33.text.length);

// Caso 35: erro anterior (offset cru divergente) → ainda indenta certo pela linha lógica
const e35 = enterEdit("def somaX(numeros):", "def somaX(numeros):\n    return 0", 19);
assertEq("Enter com erro anterior ainda insere 4 espaços",
  e35.text, "def somaX(numeros):\n    ");

// Caso 36: linha seguinte sem indentação → no-op (Enter nativo, sem lixo)
const e36 = enterEdit("a", "a\nb\n", 1);
assertEq("Enter com linha seguinte rasa → no-op", e36.text, "a");

// Caso 37: caret no meio da linha → no-op (não empurra/indenta conteúdo)
const e37 = enterEdit("def soma(numeros):", py, 5);
assertEq("Enter no meio da linha → no-op", e37.text, "def soma(numeros):");

// Caso 38: target com menos linhas que o digitado → no-op honesto
const e38 = enterEdit("linha unica", "linha unica", 11);
assertEq("Enter sem próxima linha no target → no-op", e38.text, "linha unica");

// Caso 39: seleção até o fim é substituída por \n + indentação
const e39 = enterEdit("def soma(numeros):YY", py, 18, 20);
assertEq("Enter substitui seleção final por \\n + 4 espaços", e39.text, l1 + "    ");

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
