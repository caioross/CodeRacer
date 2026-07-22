import { describe, it, expect } from "vitest";
import {
  sanitizeResults,
  buildMatchRow,
  buildScoreRows,
  clampInt,
  MAX_PLAUSIBLE_WPM,
  MAX_NAME_LEN,
  ABSOLUTE_MAX_PLAYERS,
  type ResultRow,
  type RoomRow
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
  const flood = Array.from({ length: 30 }, (_, i) =>
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

// ─── Builders do leaderboard (matches/scores) ────────────────────────────────
// Antes da #50 esse mapeamento vivia inline dentro de `persistMatch` (async e
// privada, só alcançável atrás de uma corrida completa) — impossível de proteger.
// Aqui ele é puro: o contrato do que entra em `matches`/`scores` fica versionado.

const FINISHED_AT = "2026-07-22T14:00:00.000Z";

const FULL_ROOM: RoomRow = {
  code: "ABC123",
  status: "finished",
  language: "typescript",
  difficulty: "medium",
  max_players: 8,
  is_public: true,
  leader_id: "p1",
  snippet: { title: "Debounce", code: "…", language: "typescript", difficulty: "medium" },
  start_at: "2026-07-22T13:59:00.000Z",
  results: null,
  created_at: FINISHED_AT,
  updated_at: FINISHED_AT
};

/** Resultado já sanitizado (o que os builders realmente recebem em produção). */
const result = (over: Partial<ResultRow> = {}): ResultRow => ({
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

describe("buildMatchRow", () => {
  it("results vazio → null (nenhuma `matches` órfã)", () => {
    expect(buildMatchRow(FULL_ROOM, [], FINISHED_AT)).toBeNull();
  });

  it("copia o contexto da sala e conta os jogadores", () => {
    const row = buildMatchRow(FULL_ROOM, [result(), result({ id: "p2", name: "alice", place: 2 })], FINISHED_AT)!;
    expect(row.room_code).toBe("ABC123");
    expect(row.language).toBe("typescript");
    expect(row.difficulty).toBe("medium");
    expect(row.snippet_title).toBe("Debounce");
    expect(row.player_count).toBe(2);
    expect(row.finished_at).toBe(FINISHED_AT);
  });

  it("sala sem snippet → snippet_title null", () => {
    const row = buildMatchRow({ ...FULL_ROOM, snippet: null }, [result()], FINISHED_AT)!;
    expect(row.snippet_title).toBeNull();
  });

  it("vencedor = menor place, independente da ordem do array", () => {
    const row = buildMatchRow(
      FULL_ROOM,
      [result({ id: "p3", name: "zoe", place: 3, wpm: 40 }), result({ name: "caio", place: 1, wpm: 85 })],
      FINISHED_AT
    )!;
    expect(row.winner_name).toBe("caio");
    expect(row.winner_wpm).toBe(85);
  });

  it("place ausente cai no fallback e fica atrás de qualquer colocado", () => {
    const row = buildMatchRow(
      FULL_ROOM,
      [result({ name: "desistente", place: null, wpm: 200 }), result({ name: "alice", place: 4, wpm: 50 })],
      FINISHED_AT
    )!;
    expect(row.winner_name).toBe("alice");
  });

  it("empate de place mantém o primeiro do array (sort estável)", () => {
    const row = buildMatchRow(
      FULL_ROOM,
      [result({ name: "primeiro", place: 1 }), result({ name: "segundo", place: 1 })],
      FINISHED_AT
    )!;
    expect(row.winner_name).toBe("primeiro");
  });

  it("ninguém colocado (todos place null) ainda elege um vencedor e persiste a partida", () => {
    const row = buildMatchRow(FULL_ROOM, [result({ name: "bob", place: null })], FINISHED_AT)!;
    expect(row.winner_name).toBe("bob");
    expect(row.player_count).toBe(1);
  });

  it("winner_wpm arredonda e nunca vira NaN", () => {
    expect(buildMatchRow(FULL_ROOM, [result({ wpm: 85.6 })], FINISHED_AT)!.winner_wpm).toBe(86);
    expect(buildMatchRow(FULL_ROOM, [result({ wpm: 0 })], FINISHED_AT)!.winner_wpm).toBe(0);
    const nan = buildMatchRow(FULL_ROOM, [result({ wpm: NaN })], FINISHED_AT)!.winner_wpm;
    expect(nan).toBe(0);
    expect(Number.isNaN(nan)).toBe(false);
  });

  it("nome vazio no vencedor → winner_name null", () => {
    expect(buildMatchRow(FULL_ROOM, [result({ name: "" })], FINISHED_AT)!.winner_name).toBeNull();
  });
});

describe("buildScoreRows", () => {
  it("results vazio → nenhuma linha de score", () => {
    expect(buildScoreRows("m1", FULL_ROOM, [])).toEqual([]);
  });

  it("uma linha por resultado, na ordem recebida, com o match_id e o contexto da sala", () => {
    const rows = buildScoreRows("m1", FULL_ROOM, [
      result({ name: "caio", place: 1 }),
      result({ id: "p2", name: "alice", place: 2 })
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.name)).toEqual(["caio", "alice"]);
    expect(rows.every(r => r.match_id === "m1")).toBe(true);
    expect(rows[0].language).toBe("typescript");
    expect(rows[0].difficulty).toBe("medium");
  });

  it("wpm/accuracy/errors arredondados e nunca NaN", () => {
    const [row] = buildScoreRows("m1", FULL_ROOM, [
      result({ wpm: 85.4, accuracy: 96.7, errors: 2.5 })
    ]);
    expect(row.wpm).toBe(85);
    expect(row.accuracy).toBe(97);
    expect(row.errors).toBe(3);

    const [nan] = buildScoreRows("m1", FULL_ROOM, [
      result({ wpm: NaN, accuracy: NaN, errors: NaN })
    ]);
    expect([nan.wpm, nan.accuracy, nan.errors]).toEqual([0, 0, 0]);
  });

  it("place 0/ausente → null; place válido preservado", () => {
    const rows = buildScoreRows("m1", FULL_ROOM, [
      result({ place: 0 }),
      result({ place: null }),
      result({ place: 2 })
    ]);
    expect(rows.map(r => r.place)).toEqual([null, null, 2]);
  });

  it("place negativo NÃO é normalizado aqui — quem barra isso é sanitizeResults", () => {
    // Contrato real do `r.place || null`: só falsy vira null. Um place negativo
    // nunca chega aos builders porque `sanitizeResults` já o transformou em null
    // (ver suite acima); o teste versiona essa divisão de responsabilidade.
    expect(buildScoreRows("m1", FULL_ROOM, [result({ place: -1 })])[0].place).toBe(-1);
    expect(sanitizeResults([legit({ place: -1 })], ROOM)[0].place).toBeNull();
  });

  it("finished é coagido para booleano", () => {
    const rows = buildScoreRows("m1", FULL_ROOM, [
      result({ finished: 1 as unknown as boolean }),
      result({ finished: undefined as unknown as boolean })
    ]);
    expect(rows.map(r => r.finished)).toEqual([true, false]);
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
