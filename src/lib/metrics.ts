// Métricas de digitação — fonte única de verdade (issue #32).
//
// Funções puras e determinísticas extraídas 1:1 de `Race.tsx` (não mudam fórmula
// nem arredondamento). A honestidade dessas métricas é a verdade sagrada do domínio
// (spec §0.3); antes elas moravam inline no componente e só eram "testadas" por uma
// cópia em `.claude/skills/cr-typing-engine/scripts/validate-metrics.mjs` — divergência
// silenciosa era possível. Aqui elas ganham testes reais sem alterar comportamento.
//
// Área sagrada (HANDBOOK §2): são chamadas em render/`useMemo` como hoje, sem trabalho
// extra por keystroke — nenhuma alocação/loop novo no hot path da corrida.

/** Conta posições em que o texto digitado bate com o alvo. `typed` maior que `code`
 *  não estoura: `code[i] === undefined` nunca iguala um caractere digitado. */
export function countCorrectChars(typed: string, code: string): number {
  let c = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === code[i]) c++;
  return c;
}

/** WPM no padrão clássico (~5 chars por palavra), contando só caracteres corretos.
 *  `elapsedMin <= 0.001` → 0 (evita divisão por ~0 no início da corrida). */
export function computeWpm(correctChars: number, elapsedMin: number): number {
  return elapsedMin > 0.001 ? Math.round((correctChars / 5) / elapsedMin) : 0;
}

/** Precisão honesta (issue #20): 100% só com zero erros cometidos. Com ≥1 erro usa
 *  `floor` e teto de 99% para nunca contradizer o cartão "Erros (total)". `errors > 0`
 *  garante `totalKeystrokes > 0` (não há erro sem tecla), então sem divisão por zero
 *  no caminho real. Clampada em [0,100]. */
export function computeAccuracy(errors: number, totalKeystrokes: number): number {
  return errors === 0
    ? 100
    : Math.max(0, Math.min(99, Math.floor((1 - errors / totalKeystrokes) * 100)));
}

/** Progresso [0,1] pela razão de caracteres digitados sobre o alvo. `codeLen === 0` → 0. */
export function computeProgress(typedLen: number, codeLen: number): number {
  return codeLen === 0 ? 0 : Math.min(1, typedLen / codeLen);
}
