// Regras puras do Ranking Global (#92). A página é 100% servidor e o filtro vem
// da query string, então tudo o que decide QUEM aparece no ranking mora aqui —
// puro, determinístico e testável sem banco.
//
// Por que dedupe em TS e não na view: a view `leaderboard`
// (`0001_coderacer_init.sql:43-54`) faz `distinct on (lower(name))` ANTES de
// qualquer filtro, ou seja, o PB já foi escolhido globalmente. Filtrar em cima
// dela apagaria da lista o jogador cujo melhor score é de outro bucket, em vez
// de mostrar o melhor dele DENTRO do bucket filtrado. `bestPerName` reproduz a
// mesma regra da view (`lower(name)`, desempate `wpm desc, created_at desc`)
// depois do filtro — mesmo comportamento, ordem certa.

import type { Difficulty, LangId } from "./languages";

/** Linha crua de `scores` que alimenta o ranking (subconjunto usado na página). */
export type LeaderRow = {
  name: string;
  wpm: number;
  accuracy: number;
  errors: number;
  language: string;
  difficulty: string;
  created_at: string;
};

/**
 * Recorde pessoal por jogador, na mesma semântica da view `leaderboard`:
 * uma linha por `lower(name)`, escolhendo maior `wpm` e, no empate, a mais
 * recente (`created_at desc`). Saída ordenada por `wpm desc` — com o mesmo
 * desempate, para que empates tenham ordem estável e não dependam da ordem de
 * chegada do Postgres.
 */
export function bestPerName(rows: readonly LeaderRow[]): LeaderRow[] {
  const best = new Map<string, LeaderRow>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const current = best.get(key);
    if (!current || isBetter(row, current)) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0));
}

/** `a` vem antes de `b`: maior WPM; empatou, mais recente. */
function isBetter(a: LeaderRow, b: LeaderRow): boolean {
  if (a.wpm !== b.wpm) return a.wpm > b.wpm;
  return a.created_at > b.created_at;
}

// ─── Período ──────────────────────────────────────────────────────────────────
// Janela DESLIZANTE, não calendário: a Vercel roda em UTC e o público é UTC−3,
// então "hoje" viraria ontem às 21h local e o jogador veria o próprio score
// sumir sem explicação. `24h`/`7d` não dependem de fuso nenhum.

export type PeriodId = "24h" | "7d" | "todos";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "24h", label: "24 h" },
  { id: "7d", label: "7 dias" },
  { id: "todos", label: "sempre" }
];

const PERIOD_MS: Record<Exclude<PeriodId, "todos">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000
};

/** Período válido? Valor desconhecido cai no default `todos` (nunca 400). */
export function resolvePeriod(raw: unknown): PeriodId {
  return raw === "24h" || raw === "7d" ? raw : "todos";
}

/**
 * Início da janela em ISO, calculado no servidor a partir de `now` — a string
 * do usuário nunca vira data. `todos` → `undefined` (sem predicado de tempo).
 */
export function periodSinceISO(period: PeriodId, now: number): string | undefined {
  if (period === "todos") return undefined;
  return new Date(now - PERIOD_MS[period]).toISOString();
}

// ─── Estado do filtro (query string ⇄ página) ────────────────────────────────

export type LeaderboardFilters = {
  lang?: LangId;
  diff?: Difficulty;
  period: PeriodId;
};

/** Algum filtro ativo? (default = ranking global de sempre) */
export function hasActiveFilter(f: LeaderboardFilters): boolean {
  return Boolean(f.lang) || Boolean(f.diff) || f.period !== "todos";
}

/**
 * Href de um chip: o estado atual com UMA dimensão trocada. Valores default
 * saem da URL (`/leaderboard` limpo em vez de `?period=todos`), então cada
 * estado tem exatamente uma URL — boa para compartilhar e para o histórico.
 */
export function filtersToHref(f: LeaderboardFilters, patch: Partial<LeaderboardFilters>): string {
  const next = { ...f, ...patch };
  const qs = new URLSearchParams();
  if (next.lang) qs.set("lang", next.lang);
  if (next.diff) qs.set("diff", next.diff);
  if (next.period !== "todos") qs.set("period", next.period);
  const s = qs.toString();
  return s ? `/leaderboard?${s}` : "/leaderboard";
}
