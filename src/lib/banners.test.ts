import { describe, it, expect } from "vitest";
import {
  wrapDelta,
  nearestIndex,
  offsetForIndex,
  stepsBetween,
  decayVelocity,
  stepCloth,
  isClothAtRest,
  bendProfile,
  bannerSrc,
  CLOTH_REST,
  HEAVY_CLOTH
} from "./banners";

// A gôndola de estandartes (#97) é toda dirigida por estas funções: o carousel
// é infinito por aritmética modular (nada de lista duplicada) e o pano é um
// pêndulo amortecido. Regressão aqui = estandarte que dispara, teleporta no
// wrap, ou simulação que nunca dorme — este suite trava os três.

// ─── Carousel infinito ────────────────────────────────────────────────────

describe("wrapDelta — o anel do carousel", () => {
  it("não mexe no que já está na faixa central", () => {
    expect(wrapDelta(0, 100)).toBe(0);
    expect(wrapDelta(30, 100)).toBe(30);
    expect(wrapDelta(-30, 100)).toBe(-30);
  });

  it("traz de volta pelo lado mais curto (é o que faz o item reaparecer)", () => {
    expect(wrapDelta(80, 100)).toBe(-20);
    expect(wrapDelta(-80, 100)).toBe(20);
    expect(wrapDelta(230, 100)).toBe(30);
  });

  it("o resultado sempre cabe em [-total/2, total/2)", () => {
    for (let x = -450; x <= 450; x += 7) {
      const d = wrapDelta(x, 100);
      expect(d).toBeGreaterThanOrEqual(-50);
      expect(d).toBeLessThan(50);
    }
  });

  it("total inválido não gera NaN", () => {
    expect(wrapDelta(42, 0)).toBe(0);
    expect(wrapDelta(42, -10)).toBe(0);
  });
});

describe("nearestIndex", () => {
  it("arredonda para o item centralizado", () => {
    expect(nearestIndex(0, 100, 14)).toBe(0);
    expect(nearestIndex(49, 100, 14)).toBe(0);
    expect(nearestIndex(51, 100, 14)).toBe(1);
  });

  it("dá a volta no anel em vez de estourar a lista", () => {
    expect(nearestIndex(1400, 100, 14)).toBe(0);
    expect(nearestIndex(1500, 100, 14)).toBe(1);
    expect(nearestIndex(-100, 100, 14)).toBe(13);
  });

  it("entrada degenerada → índice 0 (sem divisão por zero)", () => {
    expect(nearestIndex(500, 0, 14)).toBe(0);
    expect(nearestIndex(500, 100, 0)).toBe(0);
  });
});

describe("offsetForIndex — girar pelo caminho curto", () => {
  it("do último para o primeiro avança 1 passo, não volta 13", () => {
    const pitch = 100;
    const from = 13 * pitch; // item 13 centralizado
    expect(offsetForIndex(0, from, pitch, 14)).toBe(1400); // +100, não 0
  });

  it("do primeiro para o último recua 1 passo", () => {
    expect(offsetForIndex(13, 0, 100, 14)).toBe(-100);
  });

  it("centralizar o item já centralizado não move nada", () => {
    expect(offsetForIndex(3, 300, 100, 14)).toBe(300);
  });
});

describe("stepsBetween", () => {
  it("caminho curto atravessando a costura do anel", () => {
    expect(stepsBetween(13, 0, 14)).toBe(1);
    expect(stepsBetween(0, 13, 14)).toBe(-1);
    expect(stepsBetween(0, 3, 14)).toBe(3);
  });

  it("empate na meia-volta não trava", () => {
    expect(Math.abs(stepsBetween(0, 7, 14))).toBe(7);
  });
});

describe("decayVelocity", () => {
  it("freia o arremesso", () => {
    expect(decayVelocity(1000, 0.1)).toBeLessThan(1000);
    expect(decayVelocity(1000, 0.1)).toBeGreaterThan(0);
  });

  it("é independente do frame rate: 2×8ms ≈ 1×16ms", () => {
    const doisPassos = decayVelocity(decayVelocity(1000, 0.008), 0.008);
    const umPasso = decayVelocity(1000, 0.016);
    expect(Math.abs(doisPassos - umPasso)).toBeLessThan(1e-9);
  });

  it("velocidade zero continua zero", () => {
    expect(decayVelocity(0, 0.5)).toBe(0);
  });
});

// ─── Tecido pesado ────────────────────────────────────────────────────────

const still = { accel: 0, velocity: 0 };

/** Roda a simulação por `secs` a 60fps com um drive constante. */
function simulate(s = CLOTH_REST, drive = still, secs = 1) {
  let cur = s;
  for (let t = 0; t < secs; t += 1 / 60) cur = stepCloth(cur, drive, 1 / 60);
  return cur;
}

describe("stepCloth — o pano", () => {
  it("parado e sem estímulo permanece exatamente parado", () => {
    expect(simulate(CLOTH_REST, still, 2)).toEqual(CLOTH_REST);
  });

  it("acelerar o carousel inclina o pano para o lado oposto (inércia)", () => {
    const right = simulate(CLOTH_REST, { accel: 400, velocity: 100 }, 0.2);
    const left = simulate(CLOTH_REST, { accel: -400, velocity: -100 }, 0.2);
    expect(right.theta).toBeLessThan(0);
    expect(left.theta).toBeGreaterThan(0);
  });

  it("em movimento contínuo o pano fica atrás, mas discreto — arrasto, não vento", () => {
    // A issue pede "o tecido atrasa levemente" ENQUANTO a gôndola anda; o rastro
    // existe, mas tem que ser uma fração do que a aceleração provoca.
    const arrastando = simulate(CLOTH_REST, { accel: 0, velocity: 1500 }, 2);
    const freando = simulate(CLOTH_REST, { accel: 4800, velocity: 1500 }, 0.3);
    expect(Math.abs(arrastando.theta)).toBeGreaterThan(0.01);
    expect(Math.abs(arrastando.theta)).toBeLessThan(0.09);
    expect(Math.abs(freando.theta)).toBeGreaterThan(3 * Math.abs(arrastando.theta));
  });

  it("o balanço é grande o bastante para ser VISTO (a regressão da #99)", () => {
    // Calibração antiga: a desaceleração de um arremesso dava θ≈0.027 rad, que
    // num estandarte de 50px vira <1px de ponta — daí "praticamente rígidas".
    const arremesso = simulate(CLOTH_REST, { accel: 4800, velocity: 1500 }, 0.25);
    const pontaPx = Math.abs(arremesso.theta) * 50; // SWAY_FACTOR 1.0, w=50px
    expect(pontaPx).toBeGreaterThan(6);
  });

  it("cessado o estímulo, volta ao repouso em ~2,5s (amortecido)", () => {
    const chutado = simulate(CLOTH_REST, { accel: 4800, velocity: 1500 }, 0.15);
    expect(Math.abs(chutado.theta)).toBeGreaterThan(0.02); // de fato balançou
    const parado = simulate(chutado, still, 2.5);
    expect(Math.abs(parado.theta)).toBeLessThan(0.005);
    expect(Math.abs(parado.omega)).toBeLessThan(0.03);
  });

  it("dá uma ou duas oscilações discretas antes de estabilizar (não mais)", () => {
    // Conta as inversões de sinal de θ depois que o estímulo cessa.
    let cur = simulate(CLOTH_REST, { accel: 4800, velocity: 0 }, 0.15);
    let sinal = Math.sign(cur.theta);
    let inversoes = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      cur = stepCloth(cur, still, 1 / 60);
      const s = Math.sign(cur.theta);
      // Só conta enquanto a amplitude ainda é perceptível (>0.5px na ponta).
      if (s !== 0 && s !== sinal && Math.abs(cur.theta) * 50 > 0.5) {
        inversoes++;
        sinal = s;
      }
    }
    expect(inversoes).toBeGreaterThanOrEqual(1);
    expect(inversoes).toBeLessThanOrEqual(4); // ≤2 oscilações completas
  });

  it("a oscilação decai — nunca é um pêndulo perpétuo", () => {
    let cur = simulate(CLOTH_REST, { accel: 900, velocity: 0 }, 0.15);
    const picos: number[] = [];
    for (let janela = 0; janela < 3; janela++) {
      let pico = 0;
      for (let t = 0; t < 0.35; t += 1 / 60) {
        cur = stepCloth(cur, still, 1 / 60);
        pico = Math.max(pico, Math.abs(cur.theta));
      }
      picos.push(pico);
    }
    expect(picos[1]).toBeLessThan(picos[0]);
    expect(picos[2]).toBeLessThan(picos[1]);
  });

  it("respeita o teto de inclinação mesmo sob estímulo absurdo", () => {
    const violento = simulate(CLOTH_REST, { accel: 900_000, velocity: 90_000 }, 1);
    expect(Math.abs(violento.theta)).toBeLessThanOrEqual(HEAVY_CLOTH.maxTheta);
    expect(Number.isFinite(violento.omega)).toBe(true);
  });

  it("frame perdido (dt gigante) não explode a integração", () => {
    // Aba em background por 2s: sem o clamp de dt o pano dispararia ao voltar.
    const s = stepCloth({ theta: 0.2, omega: 1 }, { accel: 500, velocity: 200 }, 2);
    expect(Number.isFinite(s.theta)).toBe(true);
    expect(Math.abs(s.theta)).toBeLessThanOrEqual(HEAVY_CLOTH.maxTheta);
  });

  it("dt zero ou negativo é no-op", () => {
    const s = { theta: 0.1, omega: 0.5 };
    expect(stepCloth(s, { accel: 100, velocity: 0 }, 0)).toEqual(s);
    expect(stepCloth(s, { accel: 100, velocity: 0 }, -1)).toEqual(s);
  });
});

describe("isClothAtRest — desligar o rAF", () => {
  it("pano parado e carousel parado → pode dormir", () => {
    expect(isClothAtRest(CLOTH_REST, still)).toBe(true);
  });

  it("carousel em movimento segura a simulação acordada", () => {
    expect(isClothAtRest(CLOTH_REST, { accel: 0, velocity: 200 })).toBe(false);
    expect(isClothAtRest(CLOTH_REST, { accel: 200, velocity: 0 })).toBe(false);
  });

  it("pano ainda balançando segura a simulação acordada", () => {
    expect(isClothAtRest({ theta: 0.05, omega: 0 }, still)).toBe(false);
    expect(isClothAtRest({ theta: 0, omega: 0.5 }, still)).toBe(false);
  });

  it("o repouso é alcançável de verdade a partir de um chute", () => {
    // Sem isto o rAF nunca desligaria — o limiar precisa ser atingível.
    const parado = simulate(simulate(CLOTH_REST, { accel: 4800, velocity: 1500 }, 0.15), still, 5);
    expect(isClothAtRest(parado, still)).toBe(true);
  });
});

describe("bendProfile — curvatura do pano", () => {
  it("topo preso na haste, ponta com deslocamento total", () => {
    const p = bendProfile(9);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(1);
  });

  it("cresce monotonicamente de cima para baixo", () => {
    const p = bendProfile(9);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
  });

  it("é quadrático: a metade de cima quase não se move", () => {
    const p = bendProfile(9);
    expect(p[4]).toBeCloseTo(0.25, 5); // meio do pano = 25% do balanço
  });

  it("degenerado não quebra", () => {
    expect(bendProfile(1)).toEqual([0]);
    expect(bendProfile(0)).toEqual([0]);
  });
});

describe("bannerSrc", () => {
  it("aponta para o asset fatiado da linguagem", () => {
    expect(bannerSrc("typescript")).toBe("/banners/typescript.webp");
  });
});
