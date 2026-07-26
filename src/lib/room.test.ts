import { describe, it, expect } from "vitest";
import {
  sanitizeResults,
  clampInt,
  MAX_PLAUSIBLE_WPM,
  MAX_NAME_LEN,
  ABSOLUTE_MAX_PLAYERS
} from "./room";

// Fronteira anti-cheat do leaderboard: a engine é client-side, então a API roda
// com service_role e `sanitizeResults` é o único guardião das tabelas públicas
// `matches`/`scores`. Uma regressão aqui corrompe o ranking global em silêncio
// (classe de bug das issues #7 e #28) — este suite versiona a rede de segurança
// que antes só vivia em `scripts/validate-persistence.mjs`.

const ROOM = { max_players: 8 } as const;

/** Resultado legítimo; `over` injeta o vetor de cada caso (tipos frouxos de propósito). */
const legit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "p1",
  name: "caio",
  color: "#00ff88",
  wpm: 85,
  accuracy: 97,
  errors: 3,
  progress: 1,
  place: 1,
  finished: true,
  finishedAt: 1720000000000,
  ...over
});

describe("sanitizeResults — caminho legítimo", () => {
  it("preserva linhas válidas intactas", () => {
    const out = sanitizeResults(
      [legit(), legit({ id: "p2", name: "alice", wpm: 72, accuracy: 94, place: 2 })],
      ROOM
    );
    expect(out).toHaveLength(2);
    expect(out[0].wpm).toBe(85);
    expect(out[1].wpm).toBe(72);
    expect(out[0].accuracy).toBe(97);
    expect(out[0].place).toBe(1);
    expect(out[1].place).toBe(2);
  });

  it("preserva/normaliza campos cosméticos (id/color/progress/finishedAt)", () => {
    const [row] = sanitizeResults([legit()], ROOM);
    expect(row.id).toBe("p1");
    expect(row.color).toBe("#00ff88");
    expect(row.progress).toBe(1);
    expect(row.finishedAt).toBe(1720000000000);
    expect(row.finished).toBe(true);
  });

  it("normaliza campos cosméticos de tipo inválido para o default seguro", () => {
    const [row] = sanitizeResults(
      [legit({ id: 42, color: null, progress: "x", finishedAt: "ontem" })],
      ROOM
    );
    expect(row.id).toBe(""); // id não-string → ""
    expect(row.color).toBe(""); // color não-string → ""
    expect(row.progress).toBe(0); // progress não-numérico → 0
    expect(row.finishedAt).toBeNull(); // finishedAt não-finito → null
  });
});

describe("sanitizeResults — anti-cheat de WPM (issues #7 e #28)", () => {
  it("descarta o recorde impossível de 3596 WPM (#28) sem clampá-lo", () => {
    expect(sanitizeResults([legit({ name: "hacker", wpm: 3596 })], ROOM)).toHaveLength(0);
  });

  it("aceita exatamente o teto plausível e descarta um acima", () => {
    expect(sanitizeResults([legit({ wpm: MAX_PLAUSIBLE_WPM })], ROOM)).toHaveLength(1);
    expect(sanitizeResults([legit({ wpm: MAX_PLAUSIBLE_WPM + 1 })], ROOM)).toHaveLength(0);
  });

  it("descarta wpm negativo, NaN e não-finito", () => {
    expect(sanitizeResults([legit({ wpm: -5 })], ROOM)).toHaveLength(0);
    expect(sanitizeResults([legit({ wpm: "fast" })], ROOM)).toHaveLength(0);
    expect(sanitizeResults([legit({ wpm: Infinity })], ROOM)).toHaveLength(0);
    expect(sanitizeResults([legit({ wpm: NaN })], ROOM)).toHaveLength(0);
  });
});

describe("sanitizeResults — name: trim, teto e vazio", () => {
  it("trunca name acima de MAX_NAME_LEN", () => {
    const [row] = sanitizeResults([legit({ name: "x".repeat(40) })], ROOM);
    expect(row.name).toHaveLength(MAX_NAME_LEN);
  });

  it("descarta score sem nome atribuível (vazio, só espaços, ausente ou não-string)", () => {
    expect(sanitizeResults([legit({ name: "   " })], ROOM)).toHaveLength(0);
    expect(sanitizeResults([legit({ name: undefined })], ROOM)).toHaveLength(0);
    expect(sanitizeResults([legit({ name: 123 })], ROOM)).toHaveLength(0);
  });

  it("aplica trim nas bordas do nome", () => {
    const [row] = sanitizeResults([legit({ name: "  bob  " })], ROOM);
    expect(row.name).toBe("bob");
  });
});

describe("sanitizeResults — clamp de accuracy/errors/place", () => {
  it("clampa accuracy para o intervalo [0,100]", () => {
    expect(sanitizeResults([legit({ accuracy: 150 })], ROOM)[0].accuracy).toBe(100);
    expect(sanitizeResults([legit({ accuracy: -10 })], ROOM)[0].accuracy).toBe(0);
  });

  it("nunca deixa errors negativo", () => {
    expect(sanitizeResults([legit({ errors: -3 })], ROOM)[0].errors).toBe(0);
  });

  it("clampa progress em [0,1]", () => {
    expect(sanitizeResults([legit({ progress: 5 })], ROOM)[0].progress).toBe(1);
    expect(sanitizeResults([legit({ progress: -2 })], ROOM)[0].progress).toBe(0);
  });

  it("normaliza place < 1 (ou inválido) para null", () => {
    expect(sanitizeResults([legit({ place: 0 })], ROOM)[0].place).toBeNull();
    expect(sanitizeResults([legit({ place: -1 })], ROOM)[0].place).toBeNull();
    expect(sanitizeResults([legit({ place: null })], ROOM)[0].place).toBeNull();
  });
});

describe("sanitizeResults — cap de tamanho do array", () => {
  // O flood precisa ser MAIOR que ABSOLUTE_MAX_PLAYERS, senão os asserts de teto
  // passam por tautologia (entram 30, saem 30) e o `break` do cap nunca dispara —
  // a rede que impede um `finish` forjado de inflar `scores` deixaria de ser testada.
  const flood = Array.from({ length: ABSOLUTE_MAX_PLAYERS + 10 }, (_, i) =>
    legit({ id: `p${i}`, name: `n${i}`, place: i + 1 })
  );

  it("corta no room.max_players", () => {
    expect(sanitizeResults(flood, ROOM)).toHaveLength(8);
  });

  it("respeita o teto absoluto quando max_players é absurdo", () => {
    expect(sanitizeResults(flood, { max_players: 999 })).toHaveLength(ABSOLUTE_MAX_PLAYERS);
  });

  it("cai no teto absoluto quando max_players está ausente/inválido", () => {
    expect(sanitizeResults(flood, {} as { max_players: number })).toHaveLength(
      ABSOLUTE_MAX_PLAYERS
    );
  });
});

describe("sanitizeResults — entradas degeneradas", () => {
  it("input não-array → []", () => {
    expect(sanitizeResults(null, ROOM)).toEqual([]);
    expect(sanitizeResults("forjado", ROOM)).toEqual([]);
    expect(sanitizeResults(undefined, ROOM)).toEqual([]);
  });

  it("ignora linhas null e não-objeto no meio do array", () => {
    const out = sanitizeResults(
      [legit(), null, "forjado", legit({ id: "p2", name: "z" })],
      ROOM
    );
    expect(out).toHaveLength(2);
  });
});

describe("clampInt", () => {
  it("arredonda para o inteiro mais próximo", () => {
    expect(clampInt(3.4, 0, 100)).toBe(3);
    expect(clampInt(3.6, 0, 100)).toBe(4);
  });

  it("respeita [min, max]", () => {
    expect(clampInt(150, 0, 100)).toBe(100);
    expect(clampInt(-5, 0, 100)).toBe(0);
    expect(clampInt(50, 0, 100)).toBe(50);
  });

  it("NaN / não-numérico / não-finito → min", () => {
    expect(clampInt(NaN, 0, 100)).toBe(0);
    expect(clampInt("abc", 0, 100)).toBe(0);
    expect(clampInt(Infinity, 0, 100)).toBe(0);
    expect(clampInt(undefined, 5, 100)).toBe(5); // min pode ser != 0
  });
});
