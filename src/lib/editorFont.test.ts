import { describe, expect, it } from "vitest";
import {
  DESKTOP_DEFAULT_FONT,
  DESKTOP_MIN_FONT,
  MAX_FONT,
  TOUCH_MIN_FONT,
  clampFont,
  defaultFontFor,
  minFontFor
} from "./editorFont";

// Issue #53: o contrato que impede o zoom automático do iOS no editor.
describe("editorFont", () => {
  it("crava 16px como limiar de toque (abaixo disso o iOS dá zoom ao focar)", () => {
    expect(TOUCH_MIN_FONT).toBe(16);
  });

  describe("defaultFontFor", () => {
    it("nasce >= 16 no toque", () => {
      expect(defaultFontFor(true)).toBeGreaterThanOrEqual(16);
    });

    it("preserva o default de desktop", () => {
      expect(defaultFontFor(false)).toBe(DESKTOP_DEFAULT_FONT);
      expect(DESKTOP_DEFAULT_FONT).toBe(15);
    });
  });

  describe("minFontFor", () => {
    it("piso de 16 no toque — não dá para descer abaixo do limiar pelo menu", () => {
      expect(minFontFor(true)).toBe(16);
    });

    it("desktop mantém o piso antigo de 12", () => {
      expect(minFontFor(false)).toBe(DESKTOP_MIN_FONT);
      expect(DESKTOP_MIN_FONT).toBe(12);
    });
  });

  describe("clampFont", () => {
    it("sobe qualquer tamanho abaixo do limiar quando é toque", () => {
      for (const size of [12, 13, 14, 15]) {
        expect(clampFont(size, true)).toBe(16);
      }
    });

    it("respeita a escolha do jogador acima do piso", () => {
      expect(clampFont(18, true)).toBe(18);
      expect(clampFont(13, false)).toBe(13);
    });

    it("não deixa passar do teto em nenhum contexto", () => {
      expect(clampFont(99, true)).toBe(MAX_FONT);
      expect(clampFont(99, false)).toBe(MAX_FONT);
    });

    it("segura o piso de desktop por baixo", () => {
      expect(clampFont(4, false)).toBe(DESKTOP_MIN_FONT);
    });

    it("nunca devolve NaN — cai no default do contexto", () => {
      expect(clampFont(Number.NaN, true)).toBe(TOUCH_MIN_FONT);
      expect(clampFont(Number.NaN, false)).toBe(DESKTOP_DEFAULT_FONT);
    });

    it("é idempotente (reancorar duas vezes não muda nada)", () => {
      const once = clampFont(15, true);
      expect(clampFont(once, true)).toBe(once);
    });
  });
});
