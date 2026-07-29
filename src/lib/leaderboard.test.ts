import { describe, it, expect } from "vitest";
import {
  bestPerName,
  filtersToHref,
  hasActiveFilter,
  periodSinceISO,
  resolvePeriod,
  type LeaderRow
} from "./leaderboard";

// `bestPerName` substitui a view `leaderboard` no caminho de leitura (#92): é
// ela que garante uma linha por jogador DEPOIS do filtro de bucket. Se ela
// divergir da regra da view (`distinct on (lower(name))`, desempate
// `wpm desc, created_at desc`), o mesmo nick aparece duas vezes com filtro e uma
// sem — exatamente o bug que a fatia existe para não criar.

const row = (over: Partial<LeaderRow> = {}): LeaderRow => ({
  name: "caio",
  wpm: 80,
  accuracy: 97,
  errors: 2,
  language: "sql",
  difficulty: "easy",
  created_at: "2026-07-20T12:00:00.000Z",
  ...over
});

describe("bestPerName — uma linha por jogador", () => {
  it("mantém o maior WPM do jogador e descarta os demais", () => {
    const out = bestPerName([
      row({ wpm: 35, difficulty: "hard" }),
      row({ wpm: 76, difficulty: "easy" }),
      row({ wpm: 50, difficulty: "medium" })
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].wpm).toBe(76);
  });

  it("deduplica por nick case-insensitive, como o `lower(name)` da view", () => {
    const out = bestPerName([
      row({ name: "Caio", wpm: 60 }),
      row({ name: "caio", wpm: 90 }),
      row({ name: "CAIO", wpm: 70 })
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].wpm).toBe(90);
  });

  it("no empate de WPM fica a linha mais recente (desempate estável)", () => {
    const antiga = row({ wpm: 80, created_at: "2026-07-01T00:00:00.000Z" });
    const nova = row({ wpm: 80, created_at: "2026-07-25T00:00:00.000Z" });
    expect(bestPerName([antiga, nova])[0].created_at).toBe(nova.created_at);
    // ordem de entrada invertida → mesmo vencedor (determinístico)
    expect(bestPerName([nova, antiga])[0].created_at).toBe(nova.created_at);
  });

  it("ordena a saída por WPM desc, empate pelo mais recente", () => {
    const out = bestPerName([
      row({ name: "ana", wpm: 70, created_at: "2026-07-10T00:00:00.000Z" }),
      row({ name: "bia", wpm: 90 }),
      row({ name: "gil", wpm: 70, created_at: "2026-07-22T00:00:00.000Z" })
    ]);
    expect(out.map(r => r.name)).toEqual(["bia", "gil", "ana"]);
  });

  it("jogadores diferentes não interferem entre si", () => {
    const out = bestPerName([row({ name: "ana", wpm: 40 }), row({ name: "bia", wpm: 41 })]);
    expect(out.map(r => `${r.name}:${r.wpm}`)).toEqual(["bia:41", "ana:40"]);
  });

  it("lista vazia → lista vazia (sem filtro que case, a página mostra o estado vazio)", () => {
    expect(bestPerName([])).toEqual([]);
  });

  it("não muta o array recebido", () => {
    const rows = [row({ name: "ana", wpm: 40 }), row({ name: "bia", wpm: 90 })];
    const copy = [...rows];
    bestPerName(rows);
    expect(rows).toEqual(copy);
  });
});

describe("resolvePeriod — allowlist do período", () => {
  it.each(["24h", "7d"])("aceita %s", p => {
    expect(resolvePeriod(p)).toBe(p);
  });

  it.each([undefined, null, "", "hoje", "semana", "'; drop table scores; --", 7, ["24h"]])(
    "valor inválido (%p) cai em `todos`, nunca quebra a página",
    v => {
      expect(resolvePeriod(v)).toBe("todos");
    }
  );
});

describe("periodSinceISO — janela deslizante calculada no servidor", () => {
  const now = Date.UTC(2026, 6, 28, 15, 0, 0); // 2026-07-28T15:00:00Z

  it("24h volta exatamente um dia", () => {
    expect(periodSinceISO("24h", now)).toBe("2026-07-27T15:00:00.000Z");
  });

  it("7d volta exatamente sete dias", () => {
    expect(periodSinceISO("7d", now)).toBe("2026-07-21T15:00:00.000Z");
  });

  it("`todos` não gera predicado de tempo", () => {
    expect(periodSinceISO("todos", now)).toBeUndefined();
  });
});

describe("filtersToHref — a URL é o estado", () => {
  it("sem filtro nenhum a URL fica limpa", () => {
    expect(filtersToHref({ period: "todos" }, {})).toBe("/leaderboard");
  });

  it("troca uma dimensão preservando as outras", () => {
    const href = filtersToHref({ lang: "sql", diff: "hard", period: "7d" }, { diff: "easy" });
    expect(href).toBe("/leaderboard?lang=sql&diff=easy&period=7d");
  });

  it("limpar uma dimensão a remove da query string", () => {
    expect(filtersToHref({ lang: "sql", diff: "hard", period: "todos" }, { lang: undefined })).toBe(
      "/leaderboard?diff=hard"
    );
  });
});

describe("hasActiveFilter", () => {
  it("default (sem lang/diff e período `todos`) não é filtro", () => {
    expect(hasActiveFilter({ period: "todos" })).toBe(false);
  });

  it.each([
    { lang: "sql", period: "todos" },
    { diff: "hard", period: "todos" },
    { period: "24h" }
  ] as const)("qualquer dimensão preenchida conta como filtro (%p)", f => {
    expect(hasActiveFilter(f)).toBe(true);
  });
});
