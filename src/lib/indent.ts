// ─── Indentação por Tab na corrida (fricção nº1 do Iniciante — issue #41) ─────
// O editor não é um IDE genérico: o único texto "certo" é o `target` (o snippet
// da corrida). Então Tab não insere um tab fixo — ele preenche exatamente a
// indentação que o `target` espera na linha lógica atual, para bater posição a
// posição com `handleInput` e NÃO acender erro nem baixar a precisão.
//
// Bug original (CodeEditor.tsx): o handler lia `target[caret]` cegamente, o que
// só alinha enquanto `value` for prefixo exato de `target`. Um único erro
// anterior (comum em Python, onde se erra cedo e a indentação é a parede)
// deslocava o índice e o Tab "não inseria nada"; um fallback `"  "` ainda
// injetava 2 espaços tóxicos que contavam como erro. Aqui a indentação esperada
// é derivada da LINHA LÓGICA (nº de `\n` antes do caret), não do offset cru, o
// que imuniza contra divergências upstream.

/** Conta o run de espaços a partir de `offset` em `text`. */
function spaceRunAt(text: string, offset: number): number {
  let n = 0;
  while (offset + n < text.length && text[offset + n] === " ") n++;
  return n;
}

/**
 * Calcula a edição que o Tab deve produzir no editor da corrida.
 *
 * Insere apenas os espaços que faltam para completar a indentação que o `target`
 * espera na linha lógica atual — e SÓ quando o caret está dentro da zona de
 * indentação dessa linha (tudo antes dele na linha são espaços). Fora disso, ou
 * quando a linha não tem indentação a preencher, é um no-op honesto (não polui
 * o texto nem a precisão). Puro e determinístico — coberto pelo espelho em
 * `.claude/skills/cr-typing-engine/scripts/validate-metrics.mjs`.
 *
 * @param value    Texto atual digitado (o `value` controlado da textarea).
 * @param target   Snippet-alvo da corrida (fonte da indentação correta).
 * @param selStart Início da seleção/caret (`selectionStart`).
 * @param selEnd   Fim da seleção (`selectionEnd`); default = `selStart`.
 * @returns `{ text, caret }` — quando não há nada a inserir, devolve o `value` e
 *          o `selStart` intactos (o chamador pode detectar o no-op por `text === value`).
 */
export function indentEdit(
  value: string,
  target: string,
  selStart: number,
  selEnd: number = selStart
): { text: string; caret: number } {
  const noop = { text: value, caret: selStart };

  // Só indentamos com um caret simples dentro do intervalo válido.
  if (selStart < 0 || selStart > value.length || selEnd < selStart) return noop;

  // Início da linha atual em `value` e o que já foi digitado nela até o caret.
  const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
  const beforeCaret = value.slice(lineStart, selStart);
  if (!/^ *$/.test(beforeCaret)) return noop; // caret fora da zona de indentação

  // Linha lógica = nº de `\n` antes do caret (entre `lineStart` e o caret só há
  // espaços, então basta contar até `lineStart`). Localiza o início da MESMA
  // linha em `target`, imune a divergências de comprimento upstream.
  let lineIdx = 0;
  for (let i = 0; i < lineStart; i++) if (value[i] === "\n") lineIdx++;

  let ti = 0;
  for (let l = 0; l < lineIdx; l++) {
    const nx = target.indexOf("\n", ti);
    if (nx === -1) return noop; // `target` tem menos linhas → nada a indentar
    ti = nx + 1;
  }

  const expected = spaceRunAt(target, ti);
  const remaining = expected - beforeCaret.length; // já digitados descontados
  if (remaining <= 0) return noop; // sem indentação a preencher (linha rasa/completa)

  const ins = " ".repeat(remaining);
  return {
    text: value.slice(0, selStart) + ins + value.slice(selEnd),
    caret: selStart + ins.length
  };
}

// ─── Auto-indentação no Enter (fricção nº3 do Mobile — issue #62) ─────────────
// O teclado virtual não tem Tab, então em snippets aninhados o jogador de celular
// indentava espaço a espaço. `enterEdit` insere o `\n` e delega a `indentEdit` o
// preenchimento da indentação que o `target` espera na LINHA SEGUINTE — mesma
// fonte de verdade do Tab, mesmo imunizante contra divergência de índice. Sem
// nada a indentar (linha rasa, erro que zera o alvo, `target` curto), devolve o
// `value`/`selStart` intactos: o chamador detecta o no-op por `text === value` e
// deixa o Enter NATIVO agir (nunca insere lixo, nunca acende erro).

/**
 * Calcula a edição que o Enter deve produzir no editor da corrida: a quebra de
 * linha já acompanhada da indentação esperada na linha seguinte.
 *
 * Puro e determinístico (reusa `indentEdit`). No-op honesto — sinalizado por
 * `text === value` — quando não há indentação a preencher; aí o chamador deve
 * deixar o Enter nativo seguir.
 *
 * @returns `{ text, caret }`; no no-op, `{ text: value, caret: selStart }`.
 */
export function enterEdit(
  value: string,
  target: string,
  selStart: number,
  selEnd: number = selStart
): { text: string; caret: number } {
  const noop = { text: value, caret: selStart };
  if (selStart < 0 || selStart > value.length || selEnd < selStart || selEnd > value.length)
    return noop;

  // Só auto-indenta quebrando no FIM do texto digitado — o fluxo real da corrida
  // é linear (caret sempre no fim). Enter no meio da linha empurraria conteúdo já
  // digitado para baixo; indentá-lo seria lixo que desalinha do alvo. Fora daí,
  // Enter nativo.
  if (selEnd !== value.length) return noop;

  // Insere o `\n` (substituindo a seleção, se houver) e pergunta a `indentEdit`
  // o que falta na linha nova — o caret nasce logo após a quebra.
  const withNl = value.slice(0, selStart) + "\n" + value.slice(selEnd);
  const { text, caret } = indentEdit(withNl, target, selStart + 1);
  if (text === withNl) return noop; // sem indentação a preencher → Enter nativo
  return { text, caret };
}
