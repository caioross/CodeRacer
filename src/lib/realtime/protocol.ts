// Contrato do tempo real próprio (NEXT_PUBLIC_REALTIME=local), compartilhado pelo
// hub do servidor (`hub.ts`) e pelo adaptador do navegador (`client.ts`). Puro e
// sem API de Node: os dois lados importam daqui, e os testes também.
//
// O formato que chega ao `useRoom` é o MESMO do supabase-js — presence com
// `presence_ref` e eventos sync/join/leave, broadcast `{ type, event, payload }`
// e `postgres_changes` `{ schema, table, eventType, new, old }` — para o hook não
// precisar saber qual transporte está por baixo.
import { ABSOLUTE_MAX_PLAYERS, isValidRoomCode } from "../room";

// ─── Tópico ──────────────────────────────────────────────────────────────────
export const ROOM_TOPIC_PREFIX = "coderacer:room:";

export function roomTopic(code: string): string {
  return ROOM_TOPIC_PREFIX + code;
}

/** Código da sala de um tópico `coderacer:room:<CODE>`, ou `null` se o tópico não for de sala. */
export function parseRoomTopic(topic: unknown): string | null {
  if (typeof topic !== "string" || !topic.startsWith(ROOM_TOPIC_PREFIX)) return null;
  const code = topic.slice(ROOM_TOPIC_PREFIX.length);
  return isValidRoomCode(code) ? code : null;
}

// ─── Tetos (aplicados no SERVIDOR; o cliente só evita mandar o que seria recusado) ─
/** Teto de um payload de broadcast e de uma meta de presence (JSON, em bytes UTF-8). */
export const MAX_PAYLOAD_BYTES = 4096;
/** Teto do corpo de um POST (um lote de broadcasts cabe com folga). */
export const MAX_BODY_BYTES = 64 * 1024;
/** Mensagens por POST de broadcast (o cliente agrupa o que acumulou enquanto um POST estava no ar). */
export const MAX_BATCH = 20;
/** Conexões por sala: o teto de jogadores + folga para abas duplicadas e reconexões. */
export const MAX_SUBSCRIBERS_PER_TOPIC = ABSOLUTE_MAX_PLAYERS + 10;
/** Conexões no processo inteiro — o servidor é um só; isto o protege de um flood de salas. */
export const MAX_SUBSCRIBERS_TOTAL = 2000;
/** Sem heartbeat por esse tempo, a conexão é dada como morta (presence sai). */
export const PRESENCE_TTL_MS = 30_000;
/** Intervalo do heartbeat do cliente — três chances antes do TTL. */
export const HEARTBEAT_MS = 10_000;
/** Ping do servidor no stream: mantém proxies (Caddy/Cloudflare) e o watchdog do cliente acordados. */
export const PING_MS = 15_000;
/** O cliente reabre o stream se ficar esse tempo sem receber NADA (nem ping). */
export const STALE_STREAM_MS = PING_MS * 3;

/**
 * Mensagens por segundo, por conexão e por evento (#135, lado servidor). O
 * excesso é descartado — só o do emissor que estourou, nunca o da sala.
 * Folga sobre o cliente honesto: `progress` sai a ~8,3/s (PROGRESS_THROTTLE_MS
 * de 120 ms no useRoom).
 */
export const RATE_LIMITS: Readonly<Record<string, number>> = {
  progress: 20,
  // A mensagem FINAL (`finishedAt` preenchido) decide `place` e alimenta os
  // `results`: tem balde próprio, para nunca ser engolida por uma rajada de
  // progresso comum do mesmo jogador (#135, AC 3).
  "progress:final": 5,
  chat: 2,
  ready: 5,
  vote: 5
};
/** Qualquer outro evento cai num balde comum (o mapa de baldes não cresce sem teto). */
export const DEFAULT_EVENT_RATE = 5;
/** track/untrack por segundo — cada um vira um diff para a sala inteira. */
export const PRESENCE_RATE = 2;

export function rateBucketFor(event: string, payload: unknown): { bucket: string; perSecond: number } {
  if (
    event === "progress" &&
    payload !== null &&
    typeof payload === "object" &&
    (payload as { finishedAt?: unknown }).finishedAt != null
  ) {
    return { bucket: "progress:final", perSecond: RATE_LIMITS["progress:final"] };
  }
  if (Object.prototype.hasOwnProperty.call(RATE_LIMITS, event)) {
    return { bucket: event, perSecond: RATE_LIMITS[event] };
  }
  return { bucket: "*", perSecond: DEFAULT_EVENT_RATE };
}

// ─── Validação de fronteira ──────────────────────────────────────────────────
const KEY_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const EVENT_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const REF_RE = /^[A-Za-z0-9_-]{8,40}$/;

/** Chave de presence (o playerId no CodeRacer). */
export function isValidKey(x: unknown): x is string {
  return typeof x === "string" && KEY_RE.test(x);
}

/** Nome de evento de broadcast. */
export function isValidEvent(x: unknown): x is string {
  return typeof x === "string" && EVENT_RE.test(x);
}

/** `presence_ref` proposto pelo cliente ao reconectar. */
export function isValidRef(x: unknown): x is string {
  return typeof x === "string" && REF_RE.test(x);
}

export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

const utf8 = new TextEncoder();

/** Tamanho do JSON em bytes UTF-8; `Infinity` se não serializa (ciclo, BigInt). */
export function jsonBytes(v: unknown): number {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? 0 : utf8.encode(s).length;
  } catch {
    return Infinity;
  }
}

/** Meta de presence válida (objeto JSON ≤ teto), sem o `presence_ref` — quem o põe é o servidor. */
export function sanitizeMeta(x: unknown): Record<string, unknown> | null {
  if (!isPlainObject(x) || jsonBytes(x) > MAX_PAYLOAD_BYTES) return null;
  const { presence_ref: _ignored, ...meta } = x;
  void _ignored;
  return meta;
}

/** `?meta=` da URL do stream → meta válida, ou `null`. */
export function parseMetaParam(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || raw.length > MAX_PAYLOAD_BYTES * 2) return null;
  try {
    return sanitizeMeta(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ─── SSE ─────────────────────────────────────────────────────────────────────
/** Eventos do stream, na ordem em que um cliente novo os recebe. */
export type SseEventName =
  | "hello"
  | "presence_state"
  | "presence_diff"
  | "broadcast"
  | "postgres_changes"
  | "ping";

/**
 * Um quadro SSE. `JSON.stringify` escapa todo caractere de controle (CR/LF
 * inclusive), então o dado cabe numa única linha `data:` e nunca fecha o quadro
 * antes da hora — é isso que torna seguro repassar payload de outro cliente.
 */
export function serializeSse(event: SseEventName, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data ?? null)}\n\n`;
}

/** Primeiro evento do stream: identifica a conexão para os POSTs seguintes. */
export interface HelloData {
  /** Segredo da conexão — prova que o POST vem de quem abriu o stream. */
  conn: string;
  ref: string;
  key: string;
  /** A conexão já entrou na presence (veio `?meta=` na URL)? */
  tracked: boolean;
  heartbeatMs: number;
}

export interface BroadcastData {
  event: string;
  payload: unknown;
}

// ─── Presence (semântica do Phoenix, que o supabase-js usa) ──────────────────
export type PresenceEntry = { presence_ref: string } & Record<string, unknown>;
export type PresenceState = Record<string, PresenceEntry[]>;
export interface PresenceDiff {
  joins: PresenceState;
  leaves: PresenceState;
}

export interface PresenceJoin {
  key: string;
  currentPresences: PresenceEntry[];
  newPresences: PresenceEntry[];
}
export interface PresenceLeave {
  key: string;
  currentPresences: PresenceEntry[];
  leftPresences: PresenceEntry[];
}

/** Diferença entre o estado local e o estado completo vindo do servidor (Phoenix `syncState`). */
export function diffPresenceState(current: PresenceState, next: PresenceState): PresenceDiff {
  const joins: PresenceState = {};
  const leaves: PresenceState = {};
  for (const key of Object.keys(current)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) leaves[key] = current[key];
  }
  for (const key of Object.keys(next)) {
    const cur = current[key];
    if (!cur) {
      joins[key] = next[key];
      continue;
    }
    const nextRefs = new Set(next[key].map(m => m.presence_ref));
    const curRefs = new Set(cur.map(m => m.presence_ref));
    const joined = next[key].filter(m => !curRefs.has(m.presence_ref));
    const left = cur.filter(m => !nextRefs.has(m.presence_ref));
    if (joined.length) joins[key] = joined;
    if (left.length) leaves[key] = left;
  }
  return { joins, leaves };
}

/**
 * Aplica um diff (Phoenix `syncDiff`) sem mutar a entrada. Devolve o estado novo
 * e, na ordem do supabase-js (joins, depois leaves), o que cada callback recebe:
 * no join, `currentPresences` é o que a chave tinha ANTES; no leave, o que sobrou.
 */
export function applyPresenceDiff(
  current: PresenceState,
  diff: PresenceDiff
): { state: PresenceState; joins: PresenceJoin[]; leaves: PresenceLeave[] } {
  const state: PresenceState = {};
  for (const k of Object.keys(current)) state[k] = current[k].slice();
  const joins: PresenceJoin[] = [];
  const leaves: PresenceLeave[] = [];

  for (const key of Object.keys(diff.joins || {})) {
    const added = diff.joins[key];
    if (!Array.isArray(added) || added.length === 0) continue;
    const before = state[key] ?? [];
    const addedRefs = new Set(added.map(m => m.presence_ref));
    state[key] = [...before.filter(m => !addedRefs.has(m.presence_ref)), ...added];
    joins.push({ key, currentPresences: before, newPresences: added });
  }
  for (const key of Object.keys(diff.leaves || {})) {
    const removed = diff.leaves[key];
    const before = state[key];
    if (!before || !Array.isArray(removed)) continue;
    const refs = new Set(removed.map(m => m.presence_ref));
    const remaining = before.filter(m => !refs.has(m.presence_ref));
    if (remaining.length) state[key] = remaining;
    else delete state[key];
    leaves.push({ key, currentPresences: remaining, leftPresences: removed });
  }
  return { state, joins, leaves };
}

// ─── postgres_changes ────────────────────────────────────────────────────────
export type RowEventType = "INSERT" | "UPDATE" | "DELETE";

/** O payload que o supabase-js entrega ao callback de `postgres_changes`. */
export interface PostgresChangesPayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: RowEventType;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  errors: null;
}

export interface PostgresChangesFilter {
  event: string;
  schema?: string;
  table?: string;
  /** Só `coluna=eq.valor` — o único filtro que o CodeRacer usa. */
  filter?: string;
}

const EQ_FILTER_RE = /^([A-Za-z_][A-Za-z0-9_]*)=eq\.(.*)$/;

export function matchesPostgresFilter(f: PostgresChangesFilter, p: PostgresChangesPayload): boolean {
  if (f.event !== "*" && f.event !== p.eventType) return false;
  if (f.schema && f.schema !== "*" && f.schema !== p.schema) return false;
  if (f.table && f.table !== "*" && f.table !== p.table) return false;
  if (f.filter) {
    const m = EQ_FILTER_RE.exec(f.filter);
    if (!m) return false; // filtro que não sabemos avaliar: não entrega (falha fechada)
    const row = p.eventType === "DELETE" ? p.old : p.new;
    const v = row ? row[m[1]] : undefined;
    if (v == null || String(v) !== m[2]) return false;
  }
  return true;
}
