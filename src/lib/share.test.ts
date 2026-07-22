import { describe, it, expect } from "vitest";
import { buildShareText } from "./share";
import { SITE } from "./site";
import type { Player } from "./types";

// O texto de share é o elo final do loop viral (#22): ele sai do app para fora
// (clipboard / Web Share) e não passa por React, então nem o escape do JSX nem
// `sanitizeResults` valem aqui. Este suite versiona as duas garantias que
// importam: a frase certa em cada estado (com/sem colocação) e a ausência de
// qualquer coisa que não seja pública — em especial o código da sala.

const player = (over: Partial<Player> = {}): Player => ({
  id: "p1",
  name: "caio",
  color: "#00ff88",
  progress: 1,
  wpm: 85,
  accuracy: 98,
  errors: 2,
  finishedAt: 1720000000000,
  place: 1,
  ready: true,
  abandoned: false,
  ...over
});

const URL_PROD = "https://code-racer-three.vercel.app";

describe("buildShareText — quem terminou", () => {
  it("inclui WPM, precisão, colocação e a URL recebida", () => {
    expect(buildShareText(player(), URL_PROD)).toBe(
      `Fiz 85 WPM (98%) e terminei em 1º no CodeRacer 🏁 me alcança: ${URL_PROD}`
    );
  });

  it("usa a colocação real, não a primeira", () => {
    expect(buildShareText(player({ place: 4 }), URL_PROD)).toContain("terminei em 4º");
  });

  it("arredonda wpm/accuracy fracionários (nada de 84.6666 no texto)", () => {
    const txt = buildShareText(player({ wpm: 84.6666, accuracy: 97.41 }), URL_PROD);
    expect(txt).toContain("85 WPM (97%)");
    expect(txt).not.toMatch(/\d+\.\d/);
  });
});

describe("buildShareText — quem não terminou", () => {
  it("omite o trecho de colocação quando place é null", () => {
    expect(buildShareText(player({ place: null, finishedAt: null }), URL_PROD)).toBe(
      `Fiz 85 WPM (98%) no CodeRacer 🏁 me alcança: ${URL_PROD}`
    );
  });

  it("trata place 0 como 'não terminou' (nunca 'em 0º')", () => {
    expect(buildShareText(player({ place: 0 }), URL_PROD)).not.toContain("0º");
  });
});

describe("buildShareText — URL", () => {
  it("cai em SITE.url quando o chamador não passa origem (sem window)", () => {
    expect(buildShareText(player())).toContain(SITE.url);
  });

  it("respeita a origem custom recebida (origin real do deploy)", () => {
    expect(buildShareText(player(), "http://localhost:3000")).toContain("http://localhost:3000");
    expect(buildShareText(player(), "http://localhost:3000")).not.toContain(SITE.url);
  });
});

describe("buildShareText — nada privado vaza", () => {
  it("não menciona código de sala nem rota /room", () => {
    const txt = buildShareText(player({ name: "ABCD12" }), URL_PROD);
    expect(txt).not.toContain("/room");
    // O nick aparece na tela, mas o texto de share só carrega números públicos.
    expect(txt).not.toContain("ABCD12");
  });

  it("não quebra com nick de caracteres estranhos (nick não entra no texto)", () => {
    const txt = buildShareText(player({ name: "<img src=x onerror=1>" }), URL_PROD);
    expect(txt).not.toContain("<img");
  });
});
