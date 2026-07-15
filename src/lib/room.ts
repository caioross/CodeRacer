// Shared room types + constants for the realtime (Supabase) multiplayer.
// Safe to import from both server (API routes) and client.
import type { Difficulty, LangId } from "./languages";

export type RoomStatus = "lobby" | "racing" | "finished";

export interface RoomSnippet {
  title: string;
  code: string;
  language: LangId;
  difficulty: Difficulty;
}

/** Durable room state — the `rooms` table row. */
export interface RoomRow {
  code: string;
  status: RoomStatus;
  language: LangId;
  difficulty: Difficulty;
  max_players: number;
  is_public: boolean;
  leader_id: string;
  snippet: RoomSnippet | null;
  start_at: string | null; // ISO; moment typing begins
  results: ResultRow[] | null;
  created_at: string;
  updated_at: string;
}

/** Final standing for one player (stored in rooms.results on finish). */
export interface ResultRow {
  id: string;
  name: string;
  color: string;
  wpm: number;
  accuracy: number;
  errors: number;
  progress: number;
  place: number | null;
  finished: boolean;
  finishedAt: number | null;
}

/** Live progress broadcast over the realtime channel during a race. */
export interface ProgressMsg {
  id: string;
  progress: number;
  wpm: number;
  accuracy: number;
  errors: number;
  finishedAt: number | null;
  /** true when the player gave up (abandon) — finishedAt is set but they didn't complete. */
  abandoned?: boolean;
}

/** Presence payload tracked per connected player. */
export interface PresenceMeta {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
  avatar?: string | null;
  ready?: boolean;
}

export interface ChatMsg {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

/** Merged live player = presence + latest progress. */
export interface LivePlayer {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  progress: number;
  wpm: number;
  accuracy: number;
  errors: number;
  finishedAt: number | null;
  place: number | null;
  ready: boolean;
  abandoned: boolean;
}

export const COUNTDOWN_MS = 4000;

// ─── Sanitização de resultados (fronteira anti-cheat do leaderboard) ──────────
// A engine de digitação é client-side, então a API roda com service_role e é o
// único guardião das tabelas `matches`/`scores` (leaderboard global público).
// `sanitizeResults` é validação de FRONTEIRA: não recalcula a corrida (fora de
// escopo), apenas limita o raio de dano de um payload de `finish` forjado.

/** Teto de WPM humano plausível — acima disso a linha é descartada (não clampada). */
export const MAX_PLAUSIBLE_WPM = 350;
/** Teto de comprimento de nick — espelha o cap do cliente em `useRoom` (`join`). */
export const MAX_NAME_LEN = 20;
/** Teto absoluto de jogadores por sala — espelha o cap de `settings` na API. */
export const ABSOLUTE_MAX_PLAYERS = 12;

/** Arredonda e força um inteiro finito dentro de [min, max]; NaN vira `min`. */
function clampInt(n: unknown, min: number, max: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Valida e sanitiza um array de `results` fornecido pelo cliente antes de
 * persistir no leaderboard. DESCARTA linhas que não podem ser um resultado
 * humano real (não-objeto, `name` vazio após trim, ou `wpm` fora do inteiro
 * plausível 0..MAX_PLAUSIBLE_WPM) e CLAMPA os demais campos. Campos cosméticos
 * (`id`/`color`/`progress`/`finishedAt`) são preservados para a tela de fim de
 * corrida. O array é limitado a `room.max_players` (teto absoluto 12).
 *
 * Puro e determinístico — coberto por `scripts/validate-persistence.mjs`.
 */
export function sanitizeResults(
  input: unknown,
  room: Pick<RoomRow, "max_players">
): ResultRow[] {
  if (!Array.isArray(input)) return [];
  const cap = Math.min(
    Math.max(Math.round(Number(room?.max_players)) || ABSOLUTE_MAX_PLAYERS, 1),
    ABSOLUTE_MAX_PLAYERS
  );

  const out: ResultRow[] = [];
  for (const r of input) {
    if (out.length >= cap) break; // descarta linhas além da capacidade da sala
    if (!r || typeof r !== "object") continue;
    const row = r as Partial<ResultRow>;

    const name = typeof row.name === "string" ? row.name.trim().slice(0, MAX_NAME_LEN) : "";
    if (!name) continue; // não dá para atribuir um score anônimo

    const wpm = Math.round(Number(row.wpm));
    if (!Number.isFinite(wpm) || wpm < 0 || wpm > MAX_PLAUSIBLE_WPM) continue; // implausível → descarta

    const placeN = Math.round(Number(row.place));
    out.push({
      id: typeof row.id === "string" ? row.id : "",
      name,
      color: typeof row.color === "string" ? row.color : "",
      wpm,
      accuracy: clampInt(row.accuracy, 0, 100),
      errors: clampInt(row.errors, 0, Number.MAX_SAFE_INTEGER),
      progress: Math.max(0, Math.min(1, Number(row.progress) || 0)),
      place: Number.isFinite(placeN) && placeN >= 1 ? placeN : null,
      finished: !!row.finished,
      finishedAt: Number.isFinite(Number(row.finishedAt)) ? Number(row.finishedAt) : null
    });
  }
  return out;
}

/**
 * Folga multiplicativa para clock-skew entre o relógio do servidor (no `finish`)
 * e o instante real em que a digitação começou (`start_at`). 10% de margem para
 * não descartar corrida honesta por diferença de relógio ou latência de rede.
 */
export const CLOCK_SKEW_SLACK = 1.1;

/**
 * Maior WPM fisicamente atingível nesta corrida no instante `now` (ms epoch).
 *
 * `start_at` é o momento em que a DIGITAÇÃO começa — o countdown já está embutido
 * (a rota grava `Date.now() + COUNTDOWN_MS` no `start`, e o cliente só conclui a
 * corrida quando `now >= start_at`). Logo o tempo de digitação decorrido é
 * `now - start_at`; durante o countdown isso é ≤ 0 e a corrida ainda é impossível.
 * Como WPM = (chars / 5) / minutos, o teto por-corrida é `(chars / 5) / elapsedMin`,
 * com a folga `CLOCK_SKEW_SLACK`.
 *
 * Retorna **0** quando nada é plausível ainda: `start_at` ausente/inválido, ou
 * `now` dentro do countdown (`now <= start_at`). Puro: recebe `now` por parâmetro
 * (nada de `Date.now()` interno) — coberto por `scripts/validate-persistence.mjs`.
 */
export function plausibleWpmCeiling(
  startAtISO: string | null,
  snippetChars: number,
  now: number
): number {
  if (!startAtISO) return 0;
  const startMs = Date.parse(startAtISO);
  if (!Number.isFinite(startMs)) return 0;
  const elapsedMin = (now - startMs) / 60000;
  if (elapsedMin <= 0) return 0; // ainda no countdown → corrida impossível
  const chars = Math.max(0, Math.round(Number(snippetChars)) || 0);
  return ((chars / 5) / elapsedMin) * CLOCK_SKEW_SLACK;
}

/**
 * DESCARTA as linhas de `results` temporalmente impossíveis para esta corrida:
 * um WPM acima do teto físico (`plausibleWpmCeiling`) não pode ter sido digitado
 * no tempo decorrido desde `start_at`. Ao contrário do clamp, linhas impossíveis
 * são REMOVIDAS — clampar premiaria o trapaceiro com o valor máximo.
 *
 * Se a corrida ainda é impossível (sem `start_at`/`snippet`, ou `now` no
 * countdown), o teto é 0 e **todas** as linhas são descartadas (nunca "passa
 * tudo"). Roda depois de `sanitizeResults` na rota `finish`; recebe `now` por
 * parâmetro. Puro e determinístico — coberto por `scripts/validate-persistence.mjs`.
 */
export function validateFinishTiming(
  results: ResultRow[],
  room: Pick<RoomRow, "start_at" | "snippet">,
  now: number
): ResultRow[] {
  if (!Array.isArray(results) || results.length === 0) return [];
  const ceiling = plausibleWpmCeiling(room.start_at ?? null, room.snippet?.code.length ?? 0, now);
  if (ceiling <= 0) return []; // corrida impossível/sem dado → nada plausível
  return results.filter(r => r.wpm <= ceiling);
}

const PLAYER_COLORS = [
  "#00ff88",
  "#00e5ff",
  "#a855f7",
  "#fbbf24",
  "#ff3860",
  "#f472b6",
  "#34d399",
  "#60a5fa"
];

/** Deterministic color from a player id (no coordination needed). */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
