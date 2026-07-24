// Fixtures só-de-dev para o harness das telas pós-corrida (issue #37).
//
// Dados 100% sintéticos: nenhum nick real de partida, nenhuma chamada a Supabase
// ou Realtime. Tipados por `@/lib/types` de propósito — se `RoomState`/`Player`
// mudarem, o typecheck quebra aqui em vez de deixar o harness divergir da tela real.
//
// Este módulo NÃO deve entrar no bundle de produção: só é alcançado pelo
// `import()` dinâmico de `src/app/(dev)/harness/results/page.tsx`, dentro de um
// ramo constante-falso quando `NODE_ENV === "production"`.

import type { ChatMessage, Player, RoomState, Snippet } from "@/lib/types";

/** Id do "jogador local" no harness — casa com um dos fixtures para exercitar o "(você)". */
export const HARNESS_ME_ID = "fx-me";

/**
 * Sonda de bundle: string única, sem uso em produção. `grep -rl` por ela em
 * `.next/` depois do build deve dar ZERO ocorrências (AC "zero pegada em prod").
 */
export const HARNESS_FIXTURE_MARKER = "coderacer_harness_fixture_37";

// Instante fixo (não `Date.now()`): tempos da tabela são determinísticos entre
// recargas, então screenshot de PR comparável com screenshot de PR.
const STARTED_AT = 1_750_000_000_000;

const SNIPPET: Snippet = {
  title: "debounce",
  code: [
    "export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {",
    "  let t: ReturnType<typeof setTimeout> | undefined;",
    "  return (...args: Parameters<T>) => {",
    "    clearTimeout(t);",
    "    t = setTimeout(() => fn(...args), ms);",
    "  };",
    "}"
  ].join("\n"),
  language: "typescript",
  difficulty: "medium"
};

function finisher(
  id: string,
  name: string,
  color: string,
  place: number,
  seconds: number,
  wpm: number,
  accuracy: number,
  errors: number
): Player {
  return {
    id,
    name,
    color,
    avatar: null,
    progress: 1,
    wpm,
    accuracy,
    errors,
    finishedAt: STARTED_AT + Math.round(seconds * 1000),
    place,
    ready: true,
    abandoned: false
  };
}

function runner(
  id: string,
  name: string,
  color: string,
  progress: number,
  wpm: number,
  accuracy: number,
  errors: number,
  abandoned = false
): Player {
  return {
    id,
    name,
    color,
    avatar: null,
    progress,
    wpm,
    accuracy,
    errors,
    finishedAt: null,
    place: null,
    ready: true,
    abandoned
  };
}

const CHAT: ChatMessage[] = [
  { id: "c1", playerId: "fx-sys", name: "sistema", text: "A corrida começou!", at: STARTED_AT, system: true },
  { id: "c2", playerId: "fx-rhea", name: "Rhea", text: "esse regex me pegou", at: STARTED_AT + 21_000 },
  { id: "c3", playerId: HARNESS_ME_ID, name: "Sasha", text: "clearTimeout salvou", at: STARTED_AT + 33_000 },
  { id: "c4", playerId: "fx-sys", name: "sistema", text: "Partida finalizada.", at: STARTED_AT + 96_000, system: true }
];

function room(players: Player[]): RoomState {
  const lastFinish = players.reduce((max, p) => Math.max(max, p.finishedAt ?? 0), 0);
  return {
    code: "FXTR37",
    leaderId: HARNESS_ME_ID,
    status: "finished",
    settings: { language: "typescript", difficulty: "medium", maxPlayers: 8 },
    snippet: SNIPPET,
    players,
    chat: CHAT,
    startedAt: STARTED_AT,
    finishedAt: lastFinish || STARTED_AT
  };
}

export const SCENARIOS = {
  // 0 jogadores — o caso que crashava o pódio antes desta issue (podium[1] undefined).
  empty: room([]),
  // 1 jogador — caminho do <SoloHero>, o cenário que a #11 corrigiu.
  solo: room([finisher(HARNESS_ME_ID, "Sasha", "#39d353", 1, 41.2, 96, 98.4, 3)]),
  // 2 jogadores — grid de 2 colunas; "você" em 2º exercita o subtítulo com colocação.
  duo: room([
    finisher("fx-rhea", "Rhea", "#a371f7", 1, 38.9, 101, 99.1, 2),
    finisher(HARNESS_ME_ID, "Sasha", "#39d353", 2, 44.5, 88, 97.2, 6)
  ]),
  // 3 jogadores — pódio cheio (2º, 1º, 3º na ordem de tela).
  trio: room([
    finisher(HARNESS_ME_ID, "Sasha", "#39d353", 1, 36.4, 108, 99.4, 1),
    finisher("fx-rhea", "Rhea", "#a371f7", 2, 39.8, 99, 98.0, 4),
    finisher("fx-kori", "Kori", "#f0883e", 3, 47.1, 84, 96.5, 9)
  ]),
  // 5 jogadores, 3 terminaram — exercita as linhas "// não terminou" da tabela
  // e o subtítulo de quem não completou (aqui, "você").
  crowd: room([
    finisher("fx-rhea", "Rhea", "#a371f7", 1, 35.0, 112, 99.6, 1),
    finisher("fx-kori", "Kori", "#f0883e", 2, 37.6, 104, 98.8, 3),
    finisher("fx-nils", "Nils", "#58a6ff", 3, 43.2, 91, 97.5, 7),
    runner(HARNESS_ME_ID, "Sasha", "#39d353", 0.72, 76, 94.1, 12),
    runner("fx-vera", "Vera", "#ff7b72", 0.31, 52, 90.3, 18, true)
  ])
} satisfies Record<string, RoomState>;

export type ScenarioId = keyof typeof SCENARIOS;

export const SCENARIO_LIST: { id: ScenarioId; label: string }[] = [
  { id: "empty", label: "0 · vazio" },
  { id: "solo", label: "1 · solo" },
  { id: "duo", label: "2 · duo" },
  { id: "trio", label: "3 · pódio" },
  { id: "crowd", label: "5 · com desistentes" }
];

export const DEFAULT_SCENARIO: ScenarioId = "trio";

export function isScenarioId(value: string | undefined): value is ScenarioId {
  return value != null && Object.prototype.hasOwnProperty.call(SCENARIOS, value);
}
