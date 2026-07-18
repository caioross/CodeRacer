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
  /** playerIds removidos pelo líder — verdade durável da expulsão (ver #39). */
  kicked_ids: string[];
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

// ─── Autoridade de expulsão (fronteira pura, espelhada no validator) ──────────
// Kick trafegava só por broadcast peer-to-peer, sem autoridade — qualquer
// assinante do canal expulsava qualquer um (#39). A verdade agora vive no
// servidor: a rota valida `canKick` e registra o alvo em `rooms.kicked_ids`; a
// vítima descobre a remoção pela subscription postgres_changes, NUNCA por
// broadcast. Mitiga o vetor anônimo; a fechadura forte (token por jogador) é #6.

/**
 * Só o líder legítimo da sala (verdade = `room.leader_id`) pode remover um
 * jogador, e o alvo precisa ser um id não-vazio. Puro e determinístico —
 * coberto por `scripts/validate-persistence.mjs`.
 */
export function canKick(
  room: Pick<RoomRow, "leader_id"> | null | undefined,
  playerId: string,
  targetId: string
): boolean {
  return (
    !!room &&
    typeof playerId === "string" &&
    room.leader_id === playerId &&
    typeof targetId === "string" &&
    targetId.trim().length > 0
  );
}

/**
 * Acrescenta `targetId` à lista durável de expulsos de forma idempotente (sem
 * duplicar). Alvo vazio ou já presente → lista de origem inalterada (no-op
 * seguro). Puro e determinístico.
 */
export function addKickedId(current: string[] | null | undefined, targetId: string): string[] {
  const base = Array.isArray(current) ? current.filter(x => typeof x === "string") : [];
  const t = typeof targetId === "string" ? targetId.trim() : "";
  if (!t || base.includes(t)) return base;
  return [...base, t];
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
