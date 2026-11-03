import { describe, expect, it } from "vitest";
import { bestKey, parseBest } from "./personalBest";
import { MAX_PLAUSIBLE_WPM } from "./room";

describe("recorde pessoal do Treino Livre", () => {
  it("chave separa linguagem e nível", () => {
    expect(bestKey("rust", "hard")).toBe("coderacer:pb:rust:hard");
    expect(bestKey("rust", "hard")).not.toBe(bestKey("rust", "easy"));
  });

  it("lê só números plausíveis (lixo, zero, negativo e impossível viram null)", () => {
    expect(parseBest("87")).toBe(87);
    expect(parseBest("87.6")).toBe(88);
    expect(parseBest(null)).toBeNull();
    expect(parseBest("abc")).toBeNull();
    expect(parseBest("0")).toBeNull();
    expect(parseBest("-5")).toBeNull();
    expect(parseBest(String(MAX_PLAUSIBLE_WPM + 1))).toBeNull();
    expect(parseBest(String(MAX_PLAUSIBLE_WPM))).toBe(MAX_PLAUSIBLE_WPM);
  });
});
