// Fixtures só-de-dev do harness da CORRIDA (issue #54, trilho mobile).
//
// Mesmo contrato do harness pós-corrida (#37): dados 100% sintéticos, sem
// Supabase/Realtime, tipados por `@/lib/types` para que uma mudança de
// `RoomState`/`Player` quebre o typecheck aqui em vez de deixar o harness
// divergir da tela real.
//
// O ganho específico deste harness: a corrida em viewport mobile só era
// alcançável jogando uma partida multiplayer completa, então mudança de layout
// mobile shipava sem medição. Com ele dá para medir a geometria (alvo × caret)
// em 375×812 antes e depois.
//
// Não entra no bundle de produção: só é alcançado pelo `import()` dinâmico de
// `src/app/(dev)/harness/race/page.tsx`, dentro de um ramo constante-falso
// quando `NODE_ENV === "production"`.

import type { Player, RoomState, Snippet } from "@/lib/types";

export const RACE_HARNESS_ME_ID = "fx-me";

/** Sonda de bundle: `grep -rl` por ela em `.next/` após o build deve dar ZERO. */
export const RACE_HARNESS_MARKER = "coderacer_harness_race_fixture_54";

// Instante fixo (não `Date.now()`): geometria determinística entre recargas.
const STARTED_AT = 1_750_000_000_000;

const SNIPPET: Snippet = {
  title: "groupBy",
  code: [
    "export function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {",
    "  return items.reduce((acc, item) => {",
    "    const k = key(item);",
    "    (acc[k] ||= []).push(item);",
    "    return acc;",
    "  }, {} as Record<K, T[]>);",
    "}"
  ].join("\n"),
  language: "typescript",
  difficulty: "medium"
};

function racer(
  id: string,
  name: string,
  color: string,
  progress: number,
  wpm: number,
  accuracy: number
): Player {
  return {
    id,
    name,
    color,
    avatar: null,
    progress,
    wpm,
    accuracy,
    errors: Math.round((100 - accuracy) / 2),
    finishedAt: null,
    place: null,
    ready: true,
    abandoned: false
  };
}

/** Sala em corrida, com o jogador local no meio do pelotão. */
export const RACING_ROOM: RoomState = {
  code: "FX54RC",
  leaderId: "fx-lider",
  status: "racing",
  settings: { language: "typescript", difficulty: "medium", maxPlayers: 8 },
  snippet: SNIPPET,
  players: [
    racer("fx-lider", "ponteira", "#00ff88", 0.62, 88, 97),
    racer(RACE_HARNESS_ME_ID, "você", "#00d4ff", 0.34, 61, 94),
    racer("fx-3", "terceiro", "#c77dff", 0.28, 55, 91),
    racer("fx-4", "quarto", "#ffb703", 0.19, 44, 89)
  ],
  chat: [],
  startedAt: STARTED_AT,
  finishedAt: null
};

/** Sala de 2 — o caso mais comum no mobile: você + um amigo. */
export const DUO_ROOM: RoomState = {
  ...RACING_ROOM,
  players: [RACING_ROOM.players[0], RACING_ROOM.players[1]]
};

export const RACE_SCENARIOS = {
  pelotao: RACING_ROOM,
  duo: DUO_ROOM
} as const;

export type RaceScenarioId = keyof typeof RACE_SCENARIOS;

export const RACE_SCENARIO_LIST: { id: RaceScenarioId; label: string }[] = [
  { id: "pelotao", label: "4 jogadores" },
  { id: "duo", label: "2 jogadores" }
];

export const DEFAULT_RACE_SCENARIO: RaceScenarioId = "pelotao";

export function isRaceScenarioId(value: string | undefined): value is RaceScenarioId {
  return value === "pelotao" || value === "duo";
}
