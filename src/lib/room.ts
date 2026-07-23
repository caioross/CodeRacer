// Shared room types + constants for the realtime (Supabase) multiplayer.
// Safe to import from both server (API routes) and client.
import { DIFFICULTIES, LANGUAGES, type Difficulty, type LangId } from "./languages";

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

// ─── Allowlist de settings (fronteira de criação/ajuste de sala) ──────────────
// `language`/`difficulty` chegam como string crua do cliente e são copiados para
// `matches`/`scores` (leaderboard global público). Sem allowlist, um POST direto
// injeta dimensões arbitrárias no ranking e grava payloads sem teto de tamanho.
// A fonte de verdade é `src/lib/languages.ts` — nunca uma segunda lista.

const LANG_IDS: ReadonlySet<string> = new Set(LANGUAGES.map(l => l.id));
const DIFFICULTY_IDS: ReadonlySet<string> = new Set(DIFFICULTIES.map(d => d.id));

/** `true` se `x` é um id de linguagem suportada. Puro e testável. */
export function isValidLang(x: unknown): x is LangId {
  return typeof x === "string" && LANG_IDS.has(x);
}

/** `true` se `x` é `easy` | `medium` | `hard`. Puro e testável. */
export function isValidDifficulty(x: unknown): x is Difficulty {
  return typeof x === "string" && DIFFICULTY_IDS.has(x);
}

/** Resolução de um campo de fronteira: `ok:false` sinaliza 400 para a rota. */
export type FieldResolution<T> = { ok: true; value: T } | { ok: false };

/**
 * Política de fronteira compartilhada pelas duas rotas de sala: campo ausente
 * (`undefined`/`null`/`""`) cai no `fallback` (não quebra o fluxo legítimo);
 * valor presente só é aceito se pertencer à allowlist; qualquer outro valor
 * presente é rejeitado (a rota responde 400 em vez de trocar silenciosamente).
 */
export function resolveLang(raw: unknown, fallback: LangId): FieldResolution<LangId> {
  if (raw == null || raw === "") return { ok: true, value: fallback };
  return isValidLang(raw) ? { ok: true, value: raw } : { ok: false };
}

export function resolveDifficulty(
  raw: unknown,
  fallback: Difficulty
): FieldResolution<Difficulty> {
  if (raw == null || raw === "") return { ok: true, value: fallback };
  return isValidDifficulty(raw) ? { ok: true, value: raw } : { ok: false };
}

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
export function clampInt(n: unknown, min: number, max: number): number {
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
 * Teto de tamanho de um playerId aceito como alvo. Ids são UUID (36 chars);
 * 64 dá folga sem deixar a coluna virar depósito de texto arbitrário.
 * (Quórum do PR Doctor: sem teto, `kicked_ids` era um campo durável e
 * gravável que inflava sem limite — e cada UPDATE refaz o fan-out da linha
 * inteira para todo assinante `postgres_changes` da sala.)
 */
export const MAX_KICKED_ID_LEN = 64;
/** Teto de expulsos por sala — acima do teto absoluto de jogadores (12). */
export const MAX_KICKED = 24;

/**
 * Só o líder legítimo da sala (verdade = `room.leader_id`) pode remover um
 * jogador, e o alvo precisa ser um id não-vazio, dentro do teto de tamanho e
 * diferente do próprio líder. Puro e determinístico — coberto por
 * `scripts/validate-persistence.mjs`.
 */
export function canKick(
  room: Pick<RoomRow, "leader_id"> | null | undefined,
  playerId: string,
  targetId: string
): boolean {
  if (!room || typeof playerId !== "string" || room.leader_id !== playerId) return false;
  if (typeof targetId !== "string") return false;
  const t = targetId.trim();
  // Alvo vazio, gigante (inflação da linha) ou o próprio líder → rejeitado.
  return t.length > 0 && t.length <= MAX_KICKED_ID_LEN && t !== room.leader_id;
}

/**
 * Acrescenta `targetId` à lista durável de expulsos de forma idempotente (sem
 * duplicar). Alvo vazio, acima do teto de tamanho, já presente ou lista cheia
 * → lista de origem inalterada (no-op seguro). Puro e determinístico.
 */
export function addKickedId(current: string[] | null | undefined, targetId: string): string[] {
  const base = Array.isArray(current)
    ? current.filter(x => typeof x === "string" && x.length <= MAX_KICKED_ID_LEN)
    : [];
  const t = typeof targetId === "string" ? targetId.trim() : "";
  if (!t || t.length > MAX_KICKED_ID_LEN || base.includes(t)) return base;
  // Lista cheia: no-op. O crescimento da linha da sala é limitado por
  // construção — nenhuma sequência de requests infla `rooms` sem teto.
  if (base.length >= MAX_KICKED) return base;
  return [...base, t];
}

/** A lista de expulsos está cheia? (rota devolve erro honesto em vez de `ok` mudo.) */
export function kickedListFull(current: string[] | null | undefined): boolean {
  const base = Array.isArray(current) ? current.filter(x => typeof x === "string") : [];
  return base.length >= MAX_KICKED;
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
