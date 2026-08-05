import { describe, expect, it } from "vitest";
import { MAX_EXCLUDE_LEN, exclusionFor, resolveExclude } from "./practiceExclusion";

// Issue #121: "treinar de novo" no Treino Livre não pode devolver o snippet
// recém-digitado — mas a exclusão vale só dentro do mesmo bucket.
describe("exclusionFor", () => {
  const prev = { lang: "javascript", diff: "easy", title: "Inverter string" } as const;

  it("exclui o título anterior quando linguagem e dificuldade não mudaram", () => {
    expect(exclusionFor(prev, "javascript", "easy")).toBe("Inverter string");
  });

  it("não carrega a exclusão ao trocar de linguagem (títulos se repetem entre pools)", () => {
    expect(exclusionFor(prev, "python", "easy")).toBeNull();
  });

  it("não carrega a exclusão ao trocar de dificuldade", () => {
    expect(exclusionFor(prev, "javascript", "hard")).toBeNull();
  });

  it("primeiro carregamento (sem run anterior) não exclui nada", () => {
    expect(exclusionFor(null, "javascript", "easy")).toBeNull();
  });

  it("título vazio não vira exclusão", () => {
    expect(exclusionFor({ lang: "javascript", diff: "easy", title: "" }, "javascript", "easy")).toBeNull();
  });
});

describe("resolveExclude", () => {
  it("aceita um título comum", () => {
    expect(resolveExclude("Inverter string")).toBe("Inverter string");
  });

  it("ausente/vazio → urna cheia", () => {
    expect(resolveExclude(null)).toBeNull();
    expect(resolveExclude(undefined)).toBeNull();
    expect(resolveExclude("")).toBeNull();
  });

  it("valor acima do teto é ignorado em vez de virar erro", () => {
    expect(resolveExclude("x".repeat(MAX_EXCLUDE_LEN))).toHaveLength(MAX_EXCLUDE_LEN);
    expect(resolveExclude("x".repeat(MAX_EXCLUDE_LEN + 1))).toBeNull();
  });

  it("tipo inesperado (array de query string repetida) não passa", () => {
    expect(resolveExclude(["a", "b"])).toBeNull();
    expect(resolveExclude(42)).toBeNull();
  });

  it("título desconhecido não é erro — a rota repassa e o filtro não casa", () => {
    expect(resolveExclude("snippet que não existe")).toBe("snippet que não existe");
  });
});
