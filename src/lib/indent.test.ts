import { describe, it, expect } from "vitest";
import { indentEdit, enterEdit } from "./indent";

// Indentação da corrida (Tab desktop — #41 — e Enter no touch — #62). O editor
// não é IDE genérico: o único texto "certo" é o `target`. `indentEdit`/`enterEdit`
// só inserem os espaços que o alvo espera na linha lógica, batendo char-a-char
// com `handleInput` para NÃO acender erro nem baixar a precisão. Uma regressão
// aqui reintroduz o "espaço tóxico" que a #41 matou — este suite pina as
// invariantes (espelhadas no barato `validate-metrics.mjs`).

// Alvo Python — indentação é a parede onde o Iniciante/Mobile mais sofre.
const PY = "def soma(a, b):\n    return a + b\n";

describe("indentEdit — Tab preenche a indentação do alvo (regressão da #41)", () => {
  it("completa a indentação que falta na linha lógica", () => {
    // Linha 1 do alvo tem 4 espaços; caret logo após a quebra digitada.
    const value = "def soma(a, b):\n";
    const { text, caret } = indentEdit(value, PY, value.length);
    expect(text).toBe("def soma(a, b):\n    ");
    expect(caret).toBe(value.length + 4);
  });

  it("desconta o que o jogador já digitou (insere só o restante)", () => {
    const value = "def soma(a, b):\n  "; // já digitou 2 dos 4 espaços
    const { text } = indentEdit(value, PY, value.length);
    expect(text).toBe("def soma(a, b):\n    "); // só +2
  });

  it("no-op quando o caret está fora da zona de indentação", () => {
    const value = "def soma(a, b):\n    return"; // caret após conteúdo não-espaço
    const out = indentEdit(value, PY, value.length);
    expect(out.text).toBe(value); // sinal de no-op
  });
});

describe("enterEdit — Enter quebra a linha já indentada (#62)", () => {
  it("caminho feliz: insere \\n + a indentação exata da linha seguinte", () => {
    const value = "def soma(a, b):";
    const { text, caret } = enterEdit(value, PY, value.length);
    expect(text).toBe("def soma(a, b):\n    ");
    // nem um espaço a mais: bate com o alvo char-a-char
    expect(text.endsWith("\n    ")).toBe(true);
    expect(caret).toBe(value.length + 1 + 4); // após \n + 4 espaços
  });

  it("robusto a erro anterior: usa a linha LÓGICA, não o offset cru", () => {
    // Jogador errou o nome ('X' no lugar de 'f') — mesmo nº de linhas, indentação
    // da linha 1 continua sendo 4 espaços; insere-os corretamente, sem lixo.
    const target = "def f():\n    return 1\n";
    const value = "def X():";
    const { text } = enterEdit(value, target, value.length);
    expect(text).toBe("def X():\n    ");
  });

  it("linha seguinte sem indentação → no-op (deixa o Enter nativo)", () => {
    const target = "a\nb\n"; // linha 1 tem 0 espaços
    const out = enterEdit("a", target, 1);
    expect(out.text).toBe("a"); // no-op
    expect(out.caret).toBe(1);
  });

  it("caret no meio da linha → no-op (não empurra/indenta conteúdo digitado)", () => {
    const value = "def soma(a, b):"; // caret no meio (após 'def so')
    const out = enterEdit(value, PY, 6);
    expect(out.text).toBe(value); // no-op: selEnd != fim
  });

  it("target com menos linhas que o digitado → no-op honesto", () => {
    const value = "linha unica"; // alvo de 1 linha, sem próxima
    const out = enterEdit(value, "linha unica", value.length);
    expect(out.text).toBe(value);
  });

  it("índices inválidos → no-op (nunca lança nem insere lixo)", () => {
    expect(enterEdit("abc", PY, -1).text).toBe("abc");
    expect(enterEdit("abc", PY, 99).text).toBe("abc");
    expect(enterEdit("abc", PY, 2, 1).text).toBe("abc"); // selEnd < selStart
  });

  it("substitui a seleção pela quebra + indentação quando a seleção vai até o fim", () => {
    const value = "def soma(a, b):XX"; // 'XX' sobrando, selecionado até o fim
    const { text } = enterEdit(value, PY, 15, 17);
    expect(text).toBe("def soma(a, b):\n    ");
  });
});
