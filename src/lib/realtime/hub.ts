// Hub de tempo real EM PROCESSO (só Node) — o substituto do Supabase Realtime
// quando `NEXT_PUBLIC_REALTIME=local` (ver `mode.ts`).
//
// Um tópico por sala (`coderacer:room:<CODE>`); cada conexão é um stream SSE
// (`GET /api/rt/<topic>`), e o que o cliente manda chega por POST na mesma rota.
// O hub entrega três coisas, no formato que o supabase-js entregaria:
//   - presence por conexão, agrupada pela chave (playerId): entra no connect (ou
//     no `track`), sai no fim do stream, no `untrack` ou sem heartbeat por
//     `PRESENCE_TTL_MS`;
//   - broadcast em fan-out SEM eco para quem enviou (o `broadcast: { self: false }`
//     com que o `useRoom` cria o canal, que também é o padrão do Supabase);
//   - `postgres_changes` da linha de `rooms`, publicado pelas rotas de sala depois
//     de cada escrita confirmada — só o servidor publica isso, nunca um cliente.
//
// Vive em `globalThis`: sobrevive ao HMR do `next dev` e é a mesma instância para
// todas as rotas, mesmo que o bundler duplique este módulo entre camadas.
// Processo ÚNICO por construção: duas instâncias do servidor seriam duas salas
// diferentes com o mesmo código. Não serve para Vercel/serverless.
import { randomBytes } from "node:crypto";
import {
  HEARTBEAT_MS,
  MAX_BATCH,
  MAX_PAYLOAD_BYTES,
  MAX_SUBSCRIBERS_PER_TOPIC,
  MAX_SUBSCRIBERS_TOTAL,
  PING_MS,
  PRESENCE_RATE,
  PRESENCE_TTL_MS,
  isValidEvent,
  isValidKey,
  isValidRef,
  jsonBytes,
  parseRoomTopic,
  rateBucketFor,
  sanitizeMeta,
  serializeSse,
  type PostgresChangesPayload,
  type PresenceEntry,
  type PresenceState
} from "./protocol";

/** Para onde o hub escreve os quadros de UMA conexão (o stream SSE da rota). */
export interface SseSink {
  send(frame: string): void;
  close(): void;
}

interface Bucket {
  tokens: number;
  at: number;
}

interface Subscriber {
  conn: string;
  key: string;
  ref: string;
  self: boolean;
  meta: Record<string, unknown> | null;
  lastSeen: number;
  lastPing: number;
  sink: SseSink;
  buckets: Map<string, Bucket>;
}

interface Topic {
  subs: Map<string, Subscriber>;
  /** Última linha publicada: quem (re)conecta a recebe, e o dedupe por `updated_at` do useRoom a torna inerte se já for conhecida. */
  lastRow: PostgresChangesPayload | null;
}

export type HubResult =
  | "ok"
  | "unknown_conn"
  | "rate_limited"
  | "too_large"
  | "bad_event"
  | "bad_meta";

export type ConnectResult =
  | { ok: true; conn: string; ref: string }
  | { ok: false; status: 400 | 429 | 503; error: string };

export interface ConnectOptions {
  key: string;
  meta?: Record<string, unknown> | null;
  /** Receber o próprio broadcast (padrão do Supabase: não). */
  self?: boolean;
  /** `presence_ref` anterior, para a reconexão não aparecer como "saiu/entrou" para si mesma. */
  ref?: string | null;
}

export interface HubOptions {
  now?: () => number;
  newId?: (bytes: number) => string;
  ttlMs?: number;
  pingMs?: number;
  maxPerTopic?: number;
  maxTotal?: number;
  /** Liga o relógio interno (TTL + ping). Os testes chamam `tick()` à mão. */
  autoTick?: boolean;
}

const TICK_MS = 5_000;
const PRESENCE_BUCKET = "_presence";

export class RealtimeHub {
  private readonly topics = new Map<string, Topic>();
  private total = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly now: () => number;
  private readonly newId: (bytes: number) => string;
  private readonly ttlMs: number;
  private readonly pingMs: number;
  private readonly maxPerTopic: number;
  private readonly maxTotal: number;
  private readonly autoTick: boolean;

  constructor(opts: HubOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? (bytes => randomBytes(bytes).toString("base64url"));
    this.ttlMs = opts.ttlMs ?? PRESENCE_TTL_MS;
    this.pingMs = opts.pingMs ?? PING_MS;
    this.maxPerTopic = opts.maxPerTopic ?? MAX_SUBSCRIBERS_PER_TOPIC;
    this.maxTotal = opts.maxTotal ?? MAX_SUBSCRIBERS_TOTAL;
    this.autoTick = opts.autoTick ?? true;
  }

  /** Abre uma conexão: manda `hello` + `presence_state` (+ a última linha) a ela e o join aos demais. */
  connect(topic: string, opts: ConnectOptions, sink: SseSink): ConnectResult {
    if (!parseRoomTopic(topic)) return { ok: false, status: 400, error: "tópico inválido" };
    if (!isValidKey(opts.key)) return { ok: false, status: 400, error: "key inválida" };
    const meta = opts.meta == null ? null : sanitizeMeta(opts.meta);
    if (opts.meta != null && !meta) return { ok: false, status: 400, error: "meta inválida" };
    if (this.total >= this.maxTotal) return { ok: false, status: 503, error: "servidor cheio" };
    let t = this.topics.get(topic);
    if (t && t.subs.size >= this.maxPerTopic) return { ok: false, status: 429, error: "sala cheia" };
    if (!t) {
      t = { subs: new Map(), lastRow: null };
      this.topics.set(topic, t);
    }

    // Ref proposto só vale se ninguém vivo o usa: senão um membro (que vê os
    // refs na presence) entraria com o ref de outro e, ao sair, o apagaria.
    const ref = isValidRef(opts.ref) && !refInUse(t, opts.ref) ? opts.ref : this.newId(12);
    const now = this.now();
    const sub: Subscriber = {
      conn: this.newId(18),
      key: opts.key,
      ref,
      self: !!opts.self,
      meta,
      lastSeen: now,
      lastPing: now,
      sink,
      buckets: new Map()
    };
    t.subs.set(sub.conn, sub);
    this.total++;
    this.ensureTimer();

    sink.send(
      serializeSse("hello", { conn: sub.conn, ref, key: sub.key, tracked: !!meta, heartbeatMs: HEARTBEAT_MS })
    );
    sink.send(serializeSse("presence_state", stateOf(t)));
    if (t.lastRow) sink.send(serializeSse("postgres_changes", t.lastRow));
    if (meta) this.fanout(t, serializeSse("presence_diff", { joins: { [sub.key]: [entryOf(sub)] }, leaves: {} }), sub.conn);
    return { ok: true, conn: sub.conn, ref };
  }

  /** Fim do stream (cliente fechou, rede caiu). Idempotente. */
  disconnect(topic: string, conn: string): void {
    const t = this.topics.get(topic);
    const sub = t?.subs.get(conn);
    if (t && sub) this.drop(topic, t, sub, false);
  }

  track(topic: string, conn: string, key: string, rawMeta: unknown): { result: HubResult; ref?: string } {
    const found = this.find(topic, conn, key);
    if (!found) return { result: "unknown_conn" };
    const { t, sub } = found;
    const meta = sanitizeMeta(rawMeta);
    if (!meta) return { result: "bad_meta" };
    if (!take(sub, PRESENCE_BUCKET, PRESENCE_RATE, this.now())) return { result: "rate_limited" };
    const old = sub.meta ? entryOf(sub) : null;
    // Re-track troca o ref, como o Phoenix: o diff leva a entrada nova em `joins`
    // e a velha em `leaves`, e o cliente aplica nessa ordem sem perder ninguém.
    if (old) sub.ref = this.newId(12);
    sub.meta = meta;
    const diff = { joins: { [sub.key]: [entryOf(sub)] }, leaves: old ? { [sub.key]: [old] } : {} };
    this.fanout(t, serializeSse("presence_diff", diff)); // presence vai para todos, inclusive quem fez o track
    return { result: "ok", ref: sub.ref };
  }

  untrack(topic: string, conn: string, key: string): HubResult {
    const found = this.find(topic, conn, key);
    if (!found) return "unknown_conn";
    const { t, sub } = found;
    if (!sub.meta) return "ok";
    if (!take(sub, PRESENCE_BUCKET, PRESENCE_RATE, this.now())) return "rate_limited";
    const old = entryOf(sub);
    sub.meta = null;
    this.fanout(t, serializeSse("presence_diff", { joins: {}, leaves: { [sub.key]: [old] } }));
    return "ok";
  }

  heartbeat(topic: string, conn: string, key: string): HubResult {
    return this.find(topic, conn, key) ? "ok" : "unknown_conn";
  }

  /** Broadcast de um cliente: teto de tamanho e de taxa no servidor, fan-out sem eco. */
  broadcast(topic: string, conn: string, key: string, event: unknown, payload: unknown): HubResult {
    const found = this.find(topic, conn, key);
    if (!found) return "unknown_conn";
    const { t, sub } = found;
    if (!isValidEvent(event)) return "bad_event";
    if (jsonBytes(payload) > MAX_PAYLOAD_BYTES) return "too_large";
    const rate = rateBucketFor(event, payload);
    if (!take(sub, rate.bucket, rate.perSecond, this.now())) return "rate_limited";
    const frame = serializeSse("broadcast", { event, payload });
    for (const s of Array.from(t.subs.values())) {
      if (s.conn === sub.conn && !s.self) continue;
      s.sink.send(frame);
    }
    return "ok";
  }

  /** Broadcast do SERVIDOR (o sinal `room` das rotas): vai para todos. Devolve quantos receberam. */
  publish(topic: string, event: string, payload: unknown): number {
    const t = this.topics.get(topic);
    if (!t || !isValidEvent(event)) return 0;
    return this.fanout(t, serializeSse("broadcast", { event, payload }));
  }

  /** `postgres_changes` de uma linha confirmada pelo banco — só o servidor chama isto. */
  publishRow(topic: string, payload: PostgresChangesPayload): number {
    const t = this.topics.get(topic);
    if (!t) return 0; // ninguém assina: nada a entregar nem a guardar
    t.lastRow = payload;
    return this.fanout(t, serializeSse("postgres_changes", payload));
  }

  /** Relógio do hub: derruba quem passou do TTL sem heartbeat e manda o ping devido. */
  tick(): void {
    const now = this.now();
    for (const [topic, t] of Array.from(this.topics.entries())) {
      for (const sub of Array.from(t.subs.values())) {
        if (now - sub.lastSeen > this.ttlMs) {
          this.drop(topic, t, sub, true);
        } else if (now - sub.lastPing >= this.pingMs) {
          sub.lastPing = now;
          sub.sink.send(serializeSse("ping", { t: now }));
        }
      }
    }
  }

  presenceState(topic: string): PresenceState {
    const t = this.topics.get(topic);
    return t ? stateOf(t) : {};
  }

  stats(): { topics: number; subscribers: number } {
    return { topics: this.topics.size, subscribers: this.total };
  }

  /** Para testes: derruba tudo e desliga o relógio. */
  reset(): void {
    for (const [topic, t] of Array.from(this.topics.entries())) {
      for (const sub of Array.from(t.subs.values())) this.drop(topic, t, sub, true);
    }
    this.stopTimer();
  }

  // ─── interno ───────────────────────────────────────────────────────────────

  /** Conexão viva com essa chave? Todo POST válido conta como sinal de vida. */
  private find(topic: string, conn: string, key: string): { t: Topic; sub: Subscriber } | null {
    const t = this.topics.get(topic);
    const sub = typeof conn === "string" ? t?.subs.get(conn) : undefined;
    if (!t || !sub || sub.key !== key) return null;
    sub.lastSeen = this.now();
    return { t, sub };
  }

  private drop(topic: string, t: Topic, sub: Subscriber, closeSink: boolean): void {
    if (!t.subs.delete(sub.conn)) return;
    this.total--;
    if (sub.meta) {
      const left = entryOf(sub);
      sub.meta = null;
      this.fanout(t, serializeSse("presence_diff", { joins: {}, leaves: { [sub.key]: [left] } }));
    }
    if (closeSink) {
      try {
        sub.sink.close();
      } catch {
        // stream já fechado do outro lado
      }
    }
    if (t.subs.size === 0) this.topics.delete(topic); // tópico vazio some, com a linha guardada
    if (this.topics.size === 0) this.stopTimer();
  }

  private fanout(t: Topic, frame: string, exceptConn?: string): number {
    let n = 0;
    for (const s of Array.from(t.subs.values())) {
      if (s.conn === exceptConn) continue;
      s.sink.send(frame);
      n++;
    }
    return n;
  }

  private ensureTimer(): void {
    if (!this.autoTick || this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    // Não segura o processo vivo só por causa do relógio.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function entryOf(sub: Subscriber): PresenceEntry {
  return { ...(sub.meta ?? {}), presence_ref: sub.ref };
}

/** Estado no formato do `presenceState()` do supabase-js: `{ [key]: meta[] }`, na ordem de entrada. */
function stateOf(t: Topic): PresenceState {
  const state: PresenceState = {};
  for (const sub of Array.from(t.subs.values())) {
    if (!sub.meta) continue;
    (state[sub.key] ??= []).push(entryOf(sub));
  }
  return state;
}

function refInUse(t: Topic, ref: string): boolean {
  for (const s of Array.from(t.subs.values())) if (s.ref === ref) return true;
  return false;
}

/** Balde de fichas: `perSecond` de rajada, reposto a `perSecond`/s. O excesso é descartado. */
function take(sub: Subscriber, bucket: string, perSecond: number, now: number): boolean {
  const b = sub.buckets.get(bucket);
  if (!b) {
    sub.buckets.set(bucket, { tokens: perSecond - 1, at: now });
    return true;
  }
  b.tokens = Math.min(perSecond, b.tokens + (Math.max(0, now - b.at) / 1000) * perSecond);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/** Status HTTP de cada desfecho. 410 = a conexão não existe mais: o cliente reabre o stream. */
export function httpStatusOf(r: HubResult): number {
  if (r === "ok") return 200;
  if (r === "unknown_conn") return 410;
  if (r === "rate_limited") return 429;
  if (r === "too_large") return 413;
  return 400;
}

/**
 * O que o `POST /api/rt/<topic>` faz com um corpo já lido e parseado — fora da
 * rota para o teste exercitar o caminho inteiro cliente → hub sem HTTP.
 * Corpo: `{ type: "broadcast"|"track"|"untrack"|"heartbeat", conn, key, ... }`.
 */
export function handleClientMessage(
  hub: RealtimeHub,
  topic: string,
  body: Record<string, unknown>
): { status: number; body: Record<string, unknown> } {
  const conn = typeof body.conn === "string" ? body.conn : "";
  const key = typeof body.key === "string" ? body.key : "";
  switch (body.type) {
    case "heartbeat":
    case "untrack": {
      const r = body.type === "heartbeat" ? hub.heartbeat(topic, conn, key) : hub.untrack(topic, conn, key);
      return { status: httpStatusOf(r), body: { ok: r === "ok", result: r } };
    }
    case "track": {
      const r = hub.track(topic, conn, key, body.meta);
      return { status: httpStatusOf(r.result), body: { ok: r.result === "ok", result: r.result, ref: r.ref } };
    }
    case "broadcast": {
      // Lote (o cliente junta o que acumulou enquanto o POST anterior estava no
      // ar, preservando a ordem) ou mensagem única `{ event, payload }`.
      const messages: unknown[] = Array.isArray(body.messages)
        ? body.messages.slice(0, MAX_BATCH)
        : [{ event: body.event, payload: body.payload }];
      const results: HubResult[] = [];
      for (const m of messages) {
        const msg = (m && typeof m === "object" ? m : {}) as { event?: unknown; payload?: unknown };
        const r = hub.broadcast(topic, conn, key, msg.event, msg.payload);
        results.push(r);
        if (r === "unknown_conn") break; // a conexão sumiu: o resto também falharia
      }
      const gone = results.includes("unknown_conn");
      return { status: gone ? 410 : 200, body: { ok: !gone, results } };
    }
    default:
      return { status: 400, body: { ok: false, error: "type inválido" } };
  }
}

const GLOBAL_KEY = "__coderacerRealtimeHub_v1";

/** O hub do processo (um só, em `globalThis`). */
export function getHub(): RealtimeHub {
  const g = globalThis as unknown as Record<string, RealtimeHub | undefined>;
  return (g[GLOBAL_KEY] ??= new RealtimeHub());
}
