import { describe, it, expect } from "vitest";
import {
  sanitizeResults,
  buildMatchRow,
  buildScoreRows,
  clampInt,
  raceTimeoutMs,
  roomUpdateOutcome,
  shouldFinishRace,
  isSpectatorJoin,
  MAX_PLAUSIBLE_WPM,
  MAX_NAME_LEN,
  ABSOLUTE_MAX_PLAYERS,
  RACE_IDLE_MS,
  RACE_TIMEOUT_BASE_MS,
  RACE_TIMEOUT_MAX_MS,
  tallyVotes,
  pickVoteWinner,
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
  kicked_ids: [],
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

// Liveness da corrida (#58): antes, um único jogador parado prendia a sala em
// `racing` para sempre. `shouldFinishRace` é a decisão do líder — o teste cobre
// os três critérios e, principalmente, os casos em que a corrida NÃO pode morrer.

const START = 1_720_000_000_000;
const SNIPPET = 300; // teto = 60s + 300×600ms = 240s
const CTX = { startMs: START, snippetLength: SNIPPET };
const TIMEOUT = raceTimeoutMs(SNIPPET);

/** Jogador que terminou em `at`. */
const done = (at = START + 40_000) => ({ finishedAt: at, lastActivityAt: at });
/** Jogador ainda correndo, com último `progress` em `at`. */
const running = (at: number) => ({ finishedAt: null, lastActivityAt: at });

describe("raceTimeoutMs", () => {
  it("cresce com o snippet a partir do piso", () => {
    expect(raceTimeoutMs(0)).toBe(RACE_TIMEOUT_BASE_MS);
    expect(raceTimeoutMs(300)).toBe(RACE_TIMEOUT_BASE_MS + 300 * 600);
    expect(raceTimeoutMs(100)).toBeLessThan(raceTimeoutMs(500));
  });

  it("nunca passa do teto absoluto e absorve entrada suja", () => {
    expect(raceTimeoutMs(999_999)).toBe(RACE_TIMEOUT_MAX_MS);
    expect(raceTimeoutMs(-50)).toBe(RACE_TIMEOUT_BASE_MS);
    expect(raceTimeoutMs(NaN)).toBe(RACE_TIMEOUT_BASE_MS);
  });
});

describe("shouldFinishRace — a corrida acaba", () => {
  it("(1) todos terminaram", () => {
    expect(shouldFinishRace([done(), done(START + 50_000)], { ...CTX, now: START + 50_001 })).toBe(
      true
    );
  });

  it("(2) quem falta está inativo há RACE_IDLE_MS e alguém terminou — o caso da issue", () => {
    const now = START + 40_000 + RACE_IDLE_MS;
    const players = [done(START + 30_000), running(START + 40_000)];
    expect(shouldFinishRace(players, { ...CTX, now: now - 1 })).toBe(false); // 1ms antes, não
    expect(shouldFinishRace(players, { ...CTX, now })).toBe(true);
  });

  it("(2) jogador que nunca digitou conta como ativo desde o start (lastActivityAt = start)", () => {
    const players = [done(START + 5_000), running(START)];
    expect(shouldFinishRace(players, { ...CTX, now: START + RACE_IDLE_MS - 1 })).toBe(false);
    expect(shouldFinishRace(players, { ...CTX, now: START + RACE_IDLE_MS })).toBe(true);
  });

  it("(3) teto de duração encerra mesmo sem ninguém ter terminado", () => {
    const players = [running(START + 1_000), running(START + 2_000)];
    expect(shouldFinishRace(players, { ...CTX, now: START + TIMEOUT - 1 })).toBe(false);
    expect(shouldFinishRace(players, { ...CTX, now: START + TIMEOUT })).toBe(true);
  });
});

describe("shouldFinishRace — a corrida continua", () => {
  it("jogador ativo segurando a corrida não é encerrado por inatividade alheia", () => {
    const players = [done(START + 10_000), running(START + 59_000)];
    expect(shouldFinishRace(players, { ...CTX, now: START + 60_000 })).toBe(false);
  });

  it("todos parados mas NINGUÉM terminou → não mata a corrida (só o teto faz isso)", () => {
    // Cenário real: os primeiros segundos, todo mundo lendo o snippet antes de digitar.
    const players = [running(START), running(START)];
    expect(shouldFinishRace(players, { ...CTX, now: START + RACE_IDLE_MS + 5_000 })).toBe(false);
  });

  it("durante o countdown (now < startMs) nunca encerra", () => {
    expect(shouldFinishRace([done(), done()], { ...CTX, now: START - 1 })).toBe(false);
  });

  it("sala vazia ou sem start_at → não há finish a postar", () => {
    expect(shouldFinishRace([], { ...CTX, now: START + TIMEOUT * 2 })).toBe(false);
    expect(shouldFinishRace([done()], { ...CTX, startMs: 0, now: START })).toBe(false);
  });

  it("um só jogador que ainda corre segura a sala até o teto", () => {
    const solo = [running(START + 1_000)];
    expect(shouldFinishRace(solo, { ...CTX, now: START + TIMEOUT - 1 })).toBe(false);
    expect(shouldFinishRace(solo, { ...CTX, now: START + TIMEOUT })).toBe(true);
  });
});

// Espectador (#64): a partida é composta por quem estava presente quando ela
// começou. `isSpectatorJoin` classifica um retardatário como espectador desta
// rodada — determinístico, mesmo `joinedAt`/`start_at` em todos os clientes.
describe("isSpectatorJoin", () => {
  it("entrou depois do start em racing → espectador", () => {
    expect(isSpectatorJoin(START + 5_000, START, "racing")).toBe(true);
  });

  it("já estava presente antes do start → competidor", () => {
    expect(isSpectatorJoin(START - 4_000, START, "racing")).toBe(false);
  });

  it("empate exato no start não é espectador (>, não >=)", () => {
    expect(isSpectatorJoin(START, START, "racing")).toBe(false);
  });

  it("entrou durante a tela de resultado → espectador (compete na próxima)", () => {
    expect(isSpectatorJoin(START + 90_000, START, "finished")).toBe(true);
  });

  it("em lobby ninguém é espectador, mesmo com start_at antigo", () => {
    expect(isSpectatorJoin(START + 5_000, START, "lobby")).toBe(false);
  });

  it("sem corrida (startMs null/0) nunca é espectador", () => {
    expect(isSpectatorJoin(START, null, "racing")).toBe(false);
    expect(isSpectatorJoin(START, 0, "racing")).toBe(false);
  });
});

// Votação de linguagem (#72): decide a linguagem da próxima corrida. Puro e
// determinístico (o sorteio de empate recebe um `rng` injetável no teste).
describe("tallyVotes", () => {
  it("conta votos por linguagem", () => {
    expect(tallyVotes({ a: "python", b: "python", c: "rust" })).toEqual({ python: 2, rust: 1 });
  });

  it("ignora votos em linguagens inexistentes ou não-string", () => {
    expect(tallyVotes({ a: "cobiscript", b: 42, c: null, d: "go" })).toEqual({ go: 1 });
  });

  it("mapa vazio → tally vazio", () => {
    expect(tallyVotes({})).toEqual({});
  });
});

describe("pickVoteWinner", () => {
  it("sem votos → linguagem padrão (fallback)", () => {
    expect(pickVoteWinner({}, "javascript")).toBe("javascript");
    expect(pickVoteWinner({ a: "naoexiste" }, "javascript")).toBe("javascript");
  });

  it("vence a mais votada", () => {
    expect(pickVoteWinner({ a: "python", b: "python", c: "rust" }, "go")).toBe("python");
  });

  it("empate → sorteia entre as empatadas (rng injetável)", () => {
    const votes = { a: "python", b: "rust" }; // 1×1, top = [python, rust]
    expect(pickVoteWinner(votes, "go", () => 0)).toBe("python"); // índice 0
    expect(pickVoteWinner(votes, "go", () => 0.99)).toBe("rust"); // índice 1
  });

  it("empate nunca escapa do conjunto empatado nem estoura o índice", () => {
    const votes = { a: "python", b: "rust", c: "go" }; // triplo empate
    const winner = pickVoteWinner(votes, "javascript", () => 1); // rng no limite
    expect(["python", "rust", "go"]).toContain(winner);
  });

  it("um voto isolado vence mesmo contra o fallback", () => {
    expect(pickVoteWinner({ a: "elixir" }, "javascript")).toBe("elixir");
  });
});

// #56 — as mutações de sala respondiam `ok: true` sem olhar o `error` do
// supabase-js (que devolve `{ error }` em vez de lançar). O líder via "partida
// iniciada" com a sala parada no lobby. Esta é a decisão que a rota consulta.
describe("roomUpdateOutcome", () => {
  it("escrita confirmada (≥1 linha) → ok, sem mensagem", () => {
    const out = roomUpdateOutcome({ rows: 1 });
    expect(out).toEqual({ ok: true, status: 200 });
  });

  it("erro do banco → 500 com copy neutra (não vaza detalhe de schema)", () => {
    const out = roomUpdateOutcome({
      error: { message: 'new row violates check constraint "rooms_difficulty_chk"' },
      rows: 0
    });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(500);
    expect(out.error).toBe("Não foi possível atualizar a sala");
    // O texto do PostgREST vira toast no cliente (useRoom.ts) — nunca pode passar.
    expect(out.error).not.toMatch(/constraint|rooms_|violates/);
  });

  it("erro tem precedência sobre a contagem de linhas", () => {
    // Com anon+RLS o `.select()` pode voltar vazio junto com o erro; 500 é a
    // resposta certa — 409 afirmaria que a sala sumiu, o que não sabemos.
    expect(roomUpdateOutcome({ error: { message: "timeout" }, rows: 3 }).status).toBe(500);
  });

  it("zero linhas confirmadas → 409 neutro, nunca 'Sala não encontrada'", () => {
    // `getServerSupabase` cai para a chave anon sem service_role: 0 linhas pode
    // ser SELECT negado por RLS, não sala apagada. Não afirmamos o que não sabemos.
    for (const rows of [0, null, undefined]) {
      const out = roomUpdateOutcome({ rows });
      expect(out.ok).toBe(false);
      expect(out.status).toBe(409);
      expect(out.error).toBe("Não foi possível confirmar a alteração");
    }
  });

  it("nunca emite ok sem evidência de escrita (AC da #56)", () => {
    const semEvidencia = [{ rows: 0 }, { rows: null }, { error: { message: "x" }, rows: 1 }];
    for (const res of semEvidencia) expect(roomUpdateOutcome(res).ok).toBe(false);
  });
});
