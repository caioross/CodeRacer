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
  /** Entrou depois que a rodada começou — assiste esta rodada, compete na próxima (#64). */
  spectator: boolean;
}

export const COUNTDOWN_MS = 4000;

// ─── Liveness da corrida (quando `racing` acaba) ──────────────────────────────
// A corrida só terminava quando TODOS os presentes tinham `finishedAt`, então um
// único jogador parado (AFK, celular bloqueado) prendia a sala em `racing` para
// sempre: ninguém via Results e nada era persistido. Aqui ficam os critérios
// alternativos de encerramento — puros e testáveis, sem sala real.

/** Sem `progress` novo por esse tempo, o jogador deixa de bloquear o fim. */
export const RACE_IDLE_MS = 30_000;
/** Intervalo do tick de decisão do líder — segundos, nunca ms (área sagrada). */
export const RACE_DECISION_TICK_MS = 1_000;
/** Piso do teto de duração, para snippets curtos. */
export const RACE_TIMEOUT_BASE_MS = 60_000;
/** Orçamento por caractere: 600ms/char ≈ 20 WPM, bem abaixo de qualquer humano. */
export const RACE_TIMEOUT_PER_CHAR_MS = 600;
/** Teto absoluto: nenhuma corrida legítima passa disso. */
export const RACE_TIMEOUT_MAX_MS = 600_000;

/** Duração máxima de uma corrida, dimensionada pelo tamanho do snippet. */
export function raceTimeoutMs(snippetLength: number): number {
  const len = Number.isFinite(Number(snippetLength)) ? Math.max(0, Number(snippetLength)) : 0;
  return Math.min(RACE_TIMEOUT_BASE_MS + len * RACE_TIMEOUT_PER_CHAR_MS, RACE_TIMEOUT_MAX_MS);
}

/** O mínimo que a decisão de encerramento precisa saber sobre um jogador. */
export interface FinishCandidate {
  /** `null` enquanto não completou nem abandonou. */
  finishedAt: number | null;
  /** Epoch (ms) do último `progress` dele; o início da corrida se nunca digitou. */
  lastActivityAt: number;
}

export interface FinishContext {
  /** Epoch (ms) em que a digitação começa (`rooms.start_at`). */
  startMs: number;
  now: number;
  snippetLength: number;
}

/**
 * `true` quando o líder deve postar a action `finish`. Três critérios, todos
 * conservadores (na dúvida, a corrida continua):
 *
 * 1. **Todos terminaram** — a regra original.
 * 2. **Inatividade** — quem falta está parado há `RACE_IDLE_MS`, E pelo menos um
 *    jogador terminou. A exigência do finalizador evita matar uma corrida em que
 *    todo mundo ainda está lendo o snippet nos primeiros segundos.
 * 3. **Teto de duração** — passou de `raceTimeoutMs(snippetLength)` desde o
 *    start. Único critério que vale mesmo sem ninguém ter terminado, e a rede de
 *    segurança final contra sala presa em `racing`.
 *
 * Não decide NADA sobre ranking: quem não terminou continua fora dos `results`
 * (ver `toResults` em `useRoom.ts`), então encerrar por tempo não é um caminho
 * novo para o leaderboard. Os espectadores (#64) já vêm filtrados por quem chama
 * (só os RACERS entram nesta lista), então a regra não os enxerga.
 */
export function shouldFinishRace(
  players: readonly FinishCandidate[],
  { startMs, now, snippetLength }: FinishContext
): boolean {
  if (!players.length) return false; // sala vazia: não há o que persistir
  if (!startMs || now < startMs) return false; // ainda em countdown

  const pending = players.filter(p => p.finishedAt == null);
  if (pending.length === 0) return true; // (1)

  if (now - startMs >= raceTimeoutMs(snippetLength)) return true; // (3)

  const someoneFinished = pending.length < players.length;
  return someoneFinished && pending.every(p => now - p.lastActivityAt >= RACE_IDLE_MS); // (2)
}

// ─── Espectador: quem entra com a corrida já em andamento (#64) ────────────────
// A lista de participantes ficava aberta durante a partida: um jogador que
// entrasse já em `racing` passava a compor a mesma rodada, e todos que já tinham
// terminado ficavam presos esperando o retardatário. A regra: uma partida é
// composta por quem estava presente quando ela COMEÇOU (o instante `start_at`).
// Puro e determinístico — `joinedAt` e `start_at` são compartilhados por presence
// + linha da sala, então todos os clientes classificam igual.

/**
 * `true` quando um jogador deve assistir a rodada atual em vez de competir: a
 * rodada está em andamento (`racing`/`finished`) e ele entrou DEPOIS que a
 * digitação começou (`joinedAt > startMs`). Em `lobby`/countdown ninguém é
 * espectador — quem está presente antes do start compõe a corrida normalmente.
 *
 * @param joinedAt epoch (ms) em que o jogador deu `track` na presence.
 * @param startMs  epoch (ms) de `rooms.start_at`, ou `null`/0 se não há corrida.
 */
export function isSpectatorJoin(
  joinedAt: number,
  startMs: number | null,
  status: RoomStatus
): boolean {
  if (status !== "racing" && status !== "finished") return false;
  if (!startMs) return false;
  return joinedAt > startMs;
}

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
