// Adaptador do NAVEGADOR para o tempo real próprio (NEXT_PUBLIC_REALTIME=local).
//
// Imita a parte do `RealtimeChannel` do supabase-js que o `useRoom` usa — `.on()`
// de presence/broadcast/postgres_changes, `.presenceState()`, `.track()`,
// `.send()`, `.subscribe(status)` — sobre `EventSource` (servidor → cliente) e
// `fetch` (cliente → servidor). O hook não sabe qual dos dois está por baixo.
//
// Garantias que o hook espera do Supabase e que aqui são feitas à mão:
//   - ordem: os broadcasts saem por UMA fila, um POST por vez (o que acumula
//     enquanto um está no ar vai junto no próximo, em lote). Sem isso, um
//     `progress` antigo podia ultrapassar o final (`finishedAt`) e o jogador
//     "desterminava" na tela dos outros;
//   - reconexão: o stream cai → reabre com backoff, levando a última meta na URL
//     (re-track automático, mesmo `presence_ref`) — o `joinedAt` não muda e o
//     jogador não vira espectador da própria corrida. SUBSCRIBED só sai uma vez;
//   - vida: heartbeat a cada `HEARTBEAT_MS` e watchdog — stream mudo por
//     `STALE_STREAM_MS` (nem o ping chegou) é dado como morto e reaberto.
import {
  HEARTBEAT_MS,
  MAX_BATCH,
  MAX_PAYLOAD_BYTES,
  STALE_STREAM_MS,
  applyPresenceDiff,
  diffPresenceState,
  isValidEvent,
  jsonBytes,
  matchesPostgresFilter,
  sanitizeMeta,
  type BroadcastData,
  type HelloData,
  type PostgresChangesFilter,
  type PostgresChangesPayload,
  type PresenceDiff,
  type PresenceState
} from "./protocol";

export type SubscribeStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
export type SendResult = "ok" | "timed out" | "error";

/** O pedaço do `EventSource` que o adaptador usa (o teste injeta um dublê). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  onerror: ((ev: Event) => void) | null;
  close(): void;
}

export interface LocalRealtimeDeps {
  EventSource?: new (url: string) => EventSourceLike;
  fetch?: typeof fetch;
  /** Origem da API; vazio = a mesma do app. */
  base?: string;
  /** Onde ouvir `pagehide`/`pageshow`; `null` desliga. */
  win?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
}

export interface LocalChannelOptions {
  config?: { presence?: { key?: string }; broadcast?: { self?: boolean } };
}

type Listener = (payload: any) => void;
type Binding =
  | { type: "presence"; event: string; cb: Listener }
  | { type: "broadcast"; event: string; cb: Listener }
  | { type: "postgres_changes"; filter: PostgresChangesFilter; cb: Listener };

interface Queued {
  event: string;
  payload: unknown;
  at: number;
  resolve: (r: SendResult) => void;
}

/** Igual ao `timeout` padrão do join do supabase-js. */
const JOIN_TIMEOUT_MS = 10_000;
/** Mensagem que esperou mais que isso por uma conexão é descartada (`timed out`). */
const SEND_TIMEOUT_MS = 10_000;
const MAX_QUEUE = 100;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

function topicSegment(topic: string): string {
  return /^[A-Za-z0-9:_.-]+$/.test(topic) ? topic : encodeURIComponent(topic);
}

function randomKey(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class LocalChannel {
  readonly topic: string;
  private readonly key: string;
  private readonly self: boolean;
  private readonly ES: new (url: string) => EventSourceLike;
  private readonly doFetch: typeof fetch;
  private readonly base: string;
  private readonly win: LocalRealtimeDeps["win"];

  private bindings: Binding[] = [];
  private state: PresenceState = {};
  private meta: Record<string, unknown> | null = null;
  private conn: string | null = null;
  private ref: string | null = null;
  private es: EventSourceLike | null = null;
  private statusCb: ((status: SubscribeStatus, err?: Error) => void) | null = null;
  private started = false;
  private subscribed = false;
  private errorReported = false;
  private closed = false;
  private attempt = 0;
  private lastEventAt = 0;
  private heartbeatMs = HEARTBEAT_MS;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private queue: Queued[] = [];
  private inFlight = false;
  private readonly onPageHide = () => {
    // Fechar a aba não roda o cleanup do React: avisa a saída na hora (keepalive
    // sobrevive ao unload) em vez de esperar o servidor notar o stream morto.
    if (this.conn && this.meta) void this.post({ type: "untrack" }, true);
  };
  private readonly onPageShow = (ev: Event) => {
    // Voltou do bfcache: a saída já foi anunciada no pagehide — entra de novo.
    if ((ev as PageTransitionEvent).persisted && this.meta) void this.track(this.meta);
  };

  constructor(topic: string, opts: LocalChannelOptions = {}, deps: LocalRealtimeDeps = {}) {
    this.topic = topic;
    this.key = opts.config?.presence?.key || randomKey();
    this.self = !!opts.config?.broadcast?.self;
    const ES = deps.EventSource ?? (globalThis as { EventSource?: new (url: string) => EventSourceLike }).EventSource;
    if (!ES) throw new Error("EventSource indisponível neste ambiente");
    this.ES = ES;
    this.doFetch = deps.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.base = (deps.base ?? "").replace(/\/+$/, "");
    this.win = deps.win !== undefined ? deps.win : typeof window !== "undefined" ? window : null;
  }

  // ─── superfície do RealtimeChannel ─────────────────────────────────────────

  on(type: string, filter: Record<string, unknown> | undefined, cb: Listener): this {
    if (type === "presence" || type === "broadcast") {
      this.bindings.push({ type, event: String(filter?.event ?? "*"), cb });
    } else if (type === "postgres_changes") {
      this.bindings.push({ type, filter: { event: "*", ...(filter ?? {}) } as PostgresChangesFilter, cb });
    }
    return this;
  }

  presenceState<T = Record<string, unknown>>(): Record<string, Array<T & { presence_ref: string }>> {
    const out: Record<string, Array<T & { presence_ref: string }>> = {};
    for (const key of Object.keys(this.state)) {
      out[key] = this.state[key].map(m => ({ ...m }) as T & { presence_ref: string });
    }
    return out;
  }

  subscribe(cb?: (status: SubscribeStatus, err?: Error) => void): this {
    if (this.started || this.closed) return this;
    this.started = true;
    this.statusCb = cb ?? null;
    this.joinTimer = setTimeout(() => {
      this.joinTimer = null;
      if (!this.subscribed && !this.closed) this.report("TIMED_OUT");
    }, JOIN_TIMEOUT_MS);
    this.win?.addEventListener("pagehide", this.onPageHide);
    this.win?.addEventListener("pageshow", this.onPageShow);
    this.open();
    return this;
  }

  async track(meta: Record<string, unknown>): Promise<SendResult> {
    const clean = sanitizeMeta(meta);
    if (!clean || this.closed) return "error";
    this.meta = clean;
    if (!this.conn) return "ok"; // segue na URL da próxima conexão
    const res = await this.post({ type: "track", meta: clean });
    if (res.status === 410) {
      this.reconnect();
      return "ok";
    }
    if (res.ok && typeof res.body?.ref === "string") this.ref = res.body.ref;
    return res.ok ? "ok" : "error";
  }

  async untrack(): Promise<SendResult> {
    this.meta = null;
    if (!this.conn) return "ok";
    const res = await this.post({ type: "untrack" }, true);
    return res.ok ? "ok" : "error";
  }

  send(msg: { type: string; event: string; payload?: unknown }): Promise<SendResult> {
    if (
      this.closed ||
      msg?.type !== "broadcast" ||
      !isValidEvent(msg.event) ||
      jsonBytes(msg.payload) > MAX_PAYLOAD_BYTES
    ) {
      return Promise.resolve("error");
    }
    return new Promise<SendResult>(resolve => {
      this.queue.push({ event: msg.event, payload: msg.payload, at: Date.now(), resolve });
      while (this.queue.length > MAX_QUEUE) this.queue.shift()?.resolve("error");
      void this.pump();
    });
  }

  async unsubscribe(): Promise<"ok"> {
    if (this.closed) return "ok";
    this.closed = true;
    if (this.conn && this.meta) void this.post({ type: "untrack" }, true);
    this.win?.removeEventListener("pagehide", this.onPageHide);
    this.win?.removeEventListener("pageshow", this.onPageShow);
    if (this.joinTimer) clearTimeout(this.joinTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.joinTimer = this.reconnectTimer = null;
    this.stopBeat();
    this.es?.close();
    this.es = null;
    this.conn = null;
    for (const q of this.queue.splice(0)) q.resolve("error");
    this.report("CLOSED");
    return "ok";
  }

  // ─── stream ────────────────────────────────────────────────────────────────

  private open(): void {
    if (this.closed) return;
    const params = new URLSearchParams({ key: this.key });
    if (this.self) params.set("self", "1");
    if (this.meta) params.set("meta", JSON.stringify(this.meta));
    if (this.ref) params.set("ref", this.ref);
    const es = new this.ES(`${this.base}/api/rt/${topicSegment(this.topic)}?${params.toString()}`);
    this.es = es;
    this.lastEventAt = Date.now();
    const on = (name: string, fn: (data: any) => void) =>
      es.addEventListener(name, ev => {
        if (this.es !== es) return; // quadro atrasado de um stream já trocado
        this.lastEventAt = Date.now();
        let data: unknown;
        try {
          data = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        fn(data);
      });
    on("hello", d => this.onHello(d as HelloData));
    on("presence_state", d => this.applyDiff(diffPresenceState(this.state, (d ?? {}) as PresenceState)));
    on("presence_diff", d => this.applyDiff((d ?? { joins: {}, leaves: {} }) as PresenceDiff));
    on("broadcast", d => this.onBroadcast(d as BroadcastData));
    on("postgres_changes", d => this.onRow(d as PostgresChangesPayload));
    on("ping", () => {});
    es.onerror = () => {
      if (this.es === es) this.onStreamError();
    };
  }

  private onHello(d: HelloData): void {
    if (!d || typeof d.conn !== "string") return;
    this.conn = d.conn;
    if (typeof d.ref === "string") this.ref = d.ref;
    if (typeof d.heartbeatMs === "number" && d.heartbeatMs >= 1000) this.heartbeatMs = d.heartbeatMs;
    this.attempt = 0;
    this.errorReported = false;
    this.startBeat();
    // Decide ANTES de avisar: no SUBSCRIBED o useRoom chama `track()` na hora.
    const retrack = !!this.meta && !d.tracked;
    if (!this.subscribed) {
      this.subscribed = true;
      if (this.joinTimer) clearTimeout(this.joinTimer);
      this.joinTimer = null;
      this.report("SUBSCRIBED");
    }
    if (retrack && this.meta) void this.track(this.meta);
    void this.pump();
  }

  private onStreamError(): void {
    this.dropStream();
    if (this.closed) return;
    // Um aviso por queda, não um por tentativa de reconexão.
    if (!this.errorReported) {
      this.errorReported = true;
      this.report("CHANNEL_ERROR", new Error("stream de tempo real caiu"));
    }
    this.scheduleReconnect();
  }

  /** Reabre o stream sem alarde (conexão esquecida pelo servidor, stream mudo). */
  private reconnect(): void {
    if (this.closed) return;
    this.dropStream();
    if (!this.reconnectTimer) this.scheduleReconnect();
  }

  private dropStream(): void {
    this.es?.close();
    this.es = null;
    this.conn = null;
    this.stopBeat();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.attempt);
    this.attempt = Math.min(this.attempt + 1, 10);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startBeat(): void {
    this.stopBeat();
    this.beatTimer = setInterval(() => {
      if (Date.now() - this.lastEventAt > STALE_STREAM_MS) {
        this.reconnect();
        return;
      }
      if (!this.conn) return;
      void this.post({ type: "heartbeat" }).then(res => {
        if (res.status === 410) this.reconnect();
      });
    }, this.heartbeatMs);
  }

  private stopBeat(): void {
    if (this.beatTimer) clearInterval(this.beatTimer);
    this.beatTimer = null;
  }

  // ─── entrega aos callbacks ─────────────────────────────────────────────────

  private applyDiff(diff: PresenceDiff): void {
    const r = applyPresenceDiff(this.state, diff);
    this.state = r.state;
    for (const j of r.joins) this.emitPresence("join", { event: "join", ...j });
    for (const l of r.leaves) this.emitPresence("leave", { event: "leave", ...l });
    this.emitPresence("sync", { event: "sync" });
  }

  private emitPresence(event: string, payload: unknown): void {
    for (const b of this.bindings) {
      if (b.type === "presence" && (b.event === event || b.event === "*")) safeCall(b.cb, payload);
    }
  }

  private onBroadcast(d: BroadcastData): void {
    if (!d || typeof d.event !== "string") return;
    const payload = { type: "broadcast", event: d.event, payload: d.payload };
    for (const b of this.bindings) {
      if (b.type === "broadcast" && (b.event === d.event || b.event === "*")) safeCall(b.cb, payload);
    }
  }

  private onRow(d: PostgresChangesPayload): void {
    if (!d || typeof d.eventType !== "string") return;
    for (const b of this.bindings) {
      if (b.type === "postgres_changes" && matchesPostgresFilter(b.filter, d)) safeCall(b.cb, d);
    }
  }

  private report(status: SubscribeStatus, err?: Error): void {
    if (this.statusCb) safeCall(() => this.statusCb?.(status, err), undefined);
  }

  // ─── cliente → servidor ────────────────────────────────────────────────────

  /** Uma fila, um POST por vez: a ordem do emissor é a ordem de entrega. */
  private async pump(): Promise<void> {
    if (this.inFlight || !this.conn || this.closed) return;
    const now = Date.now();
    while (this.queue.length && now - this.queue[0].at > SEND_TIMEOUT_MS) {
      this.queue.shift()?.resolve("timed out");
    }
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, MAX_BATCH);
    const conn = this.conn;
    this.inFlight = true;
    const res = await this.post({
      type: "broadcast",
      messages: batch.map(q => ({ event: q.event, payload: q.payload }))
    });
    this.inFlight = false;
    if (res.status === 410) {
      // O servidor esqueceu a conexão e não entregou nada do lote: volta para a
      // frente da fila e sai na próxima conexão, na mesma ordem.
      this.queue.unshift(...batch);
      if (this.conn === conn) this.reconnect();
      return;
    }
    const results: unknown[] = Array.isArray(res.body?.results) ? res.body.results : [];
    batch.forEach((q, i) => q.resolve(res.ok && results[i] === "ok" ? "ok" : "error"));
    void this.pump();
  }

  private async post(
    body: Record<string, unknown>,
    keepalive = false
  ): Promise<{ ok: boolean; status: number; body: any }> {
    try {
      const res = await this.doFetch(`${this.base}/api/rt/${topicSegment(this.topic)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, conn: this.conn, key: this.key }),
        keepalive,
        cache: "no-store"
      });
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // corpo vazio/ilegível
      }
      return { ok: res.ok, status: res.status, body: json };
    } catch {
      return { ok: false, status: 0, body: null };
    }
  }
}

function safeCall(cb: Listener, payload: unknown): void {
  try {
    cb(payload);
  } catch (e) {
    // Um handler que lança não pode derrubar a entrega para os outros.
    console.error("[realtime:local]", e);
  }
}

export interface LocalRealtime {
  channel(topic: string, opts?: LocalChannelOptions): LocalChannel;
  removeChannel(ch: LocalChannel): Promise<"ok">;
}

export function createLocalRealtime(deps: LocalRealtimeDeps = {}): LocalRealtime {
  return {
    channel: (topic, opts) => new LocalChannel(topic, opts, deps),
    removeChannel: ch => ch.unsubscribe()
  };
}
