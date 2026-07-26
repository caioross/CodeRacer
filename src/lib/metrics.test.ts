import { describe, it, expect } from "vitest";
import {
  countCorrectChars,
  computeWpm,
  computeAccuracy,
  computeProgress
} from "./metrics";

// Honestidade das métricas é a verdade sagrada do domínio (spec §0.3): WPM, precisão
// e progresso mostrados na corrida precisam ser justos e reproduzíveis. Estas funções
// foram extraídas 1:1 de `Race.tsx` (issue #32) — este suite pina as invariantes para
// que a fonte única de verdade não regrida em silêncio (classe de bug da issue #20).

describe("countCorrectChars", () => {
  it("só conta posições onde typed[i] === code[i]", () => {
    expect(countCorrectChars("hello", "hello")).toBe(5);
    expect(countCorrectChars("hallo", "hello")).toBe(4); // 'a' != 'e'
    expect(countCorrectChars("", "hello")).toBe(0);
  });

  it("typed mais longo que code não estoura (conta só o prefixo alinhado)", () => {
    expect(countCorrectChars("helloXYZ", "hello")).toBe(5);
  });

  it("prefixo parcial correto conta até divergir", () => {
    expect(countCorrectChars("hel", "hello")).toBe(3);
  });
});

describe("computeWpm — só conta corretos, guarda contra divisão por ~0", () => {
  it("elapsedMin <= 0.001 → 0 (início da corrida)", () => {
    expect(computeWpm(50, 0)).toBe(0);
    expect(computeWpm(50, 0.001)).toBe(0);
  });

  it("padrão de 5 chars por palavra, arredondado", () => {
    // 100 chars corretos em 1 min → 20 palavras → 20 WPM
    expect(computeWpm(100, 1)).toBe(20);
    // 25 chars em 0.5 min → (5 palavras)/0.5 → 10 WPM
    expect(computeWpm(25, 0.5)).toBe(10);
  });

  it("chars errados não entram (o chamador passa apenas correctChars)", () => {
    // Só corretos alimentam o WPM; nada aqui multiplica por totalKeystrokes.
    expect(computeWpm(0, 1)).toBe(0);
  });
});

describe("computeAccuracy — honestidade da precisão (issue #20)", () => {
  it("zero erros → 100", () => {
    expect(computeAccuracy(0, 0)).toBe(100); // totalKeystrokes === 0 → 100
    expect(computeAccuracy(0, 200)).toBe(100);
  });

  it("NUNCA retorna 100 quando há erro (o bug de #20: 1 erro em 201 teclas)", () => {
    expect(computeAccuracy(1, 201)).toBe(99);
    expect(computeAccuracy(1, 1000)).toBe(99); // arredondaria a 100, mas é barrado
  });

  it("floor honesto para o percentual real com erros", () => {
    // (1 - 5/100) * 100 = 95
    expect(computeAccuracy(5, 100)).toBe(95);
    // (1 - 3/100) * 100 = 97
    expect(computeAccuracy(3, 100)).toBe(97);
  });

  it("clampada em [0,100] mesmo com mais erros que teclas", () => {
    expect(computeAccuracy(200, 100)).toBe(0);
  });
});

describe("computeProgress — [0,1], sem estourar", () => {
  it("codeLen === 0 → 0 (evita divisão por zero)", () => {
    expect(computeProgress(0, 0)).toBe(0);
    expect(computeProgress(5, 0)).toBe(0);
  });

  it("razão típica no meio da corrida", () => {
    expect(computeProgress(25, 100)).toBe(0.25);
    expect(computeProgress(100, 100)).toBe(1);
  });

  it("clampada em 1 quando typedLen ultrapassa codeLen", () => {
    expect(computeProgress(150, 100)).toBe(1);
  });
});
