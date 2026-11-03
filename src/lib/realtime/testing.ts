// Ferramentas de TESTE do tempo real próprio (usadas só pelos *.test.ts desta pasta).
// Ligam o adaptador do navegador ao hub de verdade, sem HTTP: o "EventSource"
// recebe os quadros SSE que o hub escreve, e o "fetch" chama o mesmo
// `handleClientMessage` que a rota POST chama.
import { handleClientMessage, type RealtimeHub, type SseSink } from "./hub";
import { parseMetaParam } from "./protocol";

/** Parser SSE mínimo (o do EventSource): quadros separados por linha em branco. */
export function parseSse(text: string): Array<{ event: string; data: string }> {
  const out: Array<{ event: string; data: string }> = [];
  for (const block of text.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    const data: string[] = [];
    let any = false;
    for (const line of block.split("\n")) {
      if (line.startsWith(":")) continue;
      any = true;
      const i = line.indexOf(":");
      const field = i < 0 ? line : line.slice(0, i);
      const value = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (any) out.push({ event, data: data.join("\n") });
  }
  return out;
}

/** Sink que só guarda o que o hub escreveu. */
export class MemorySink implements SseSink {
  frames: string[] = [];
  closed = false;
  send(frame: string): void {
    if (!this.closed) this.frames.push(frame);
  }
  close(): void {
    this.closed = true;
  }
  /** Eventos recebidos (e decodificados) desde a última chamada. */
  take(): Array<{ event: string; data: any }> {
    const text = this.frames.join("");
    this.frames = [];
    return parseSse(text).map(f => ({ event: f.event, data: JSON.parse(f.data) }));
  }
}

/** Esvazia a fila de microtarefas (a "rede" do loopback é microtarefa). */
export async function flush(rounds = 50): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

function topicFromUrl(url: string): string {
  const u = new URL(url, "http://loopback.test");
  return decodeURIComponent(u.pathname.replace(/^\/api\/rt\//, ""));
}

export interface Loopback {
  EventSource: new (url: string) => LoopbackStream;
  fetch: typeof fetch;
  /** Todos os streams abertos, na ordem. */
  streams: LoopbackStream[];
  /** Corpos de POST enviados, na ordem (com o `keepalive` do pedido). */
  posts: Array<Record<string, unknown> & { keepalive?: boolean }>;
}

/** O mesmo pedaço de `EventSource` que o adaptador usa (`EventSourceLike` em client.ts). */
export interface LoopbackStream {
  addEventListener(type: string, listener: (ev: MessageEvent) => void): void;
  onerror: ((ev: Event) => void) | null;
  close(): void;
  url: string;
  closed: boolean;
  /** Simula a rede caindo: o servidor perde a conexão e o navegador vê `error`. */
  cut(): void;
}

export function loopback(hub: RealtimeHub): Loopback {
  const streams: LoopbackStream[] = [];
  const posts: Loopback["posts"] = [];

  class LoopES implements LoopbackStream {
    onerror: ((ev: Event) => void) | null = null;
    closed = false;
    readonly url: string;
    private conn: string | null = null;
    private readonly topic: string;
    private readonly listeners = new Map<string, Array<(ev: MessageEvent) => void>>();

    constructor(url: string) {
      this.url = url;
      this.topic = topicFromUrl(url);
      streams.push(this);
      const u = new URL(url, "http://loopback.test");
      const sink: SseSink = {
        send: frame => {
          for (const f of parseSse(frame)) queueMicrotask(() => this.dispatch(f.event, f.data));
        },
        close: () => {
          this.conn = null;
          queueMicrotask(() => this.fail());
        }
      };
      queueMicrotask(() => {
        if (this.closed) return;
        const r = hub.connect(
          this.topic,
          {
            key: u.searchParams.get("key") || "",
            meta: parseMetaParam(u.searchParams.get("meta")),
            self: u.searchParams.get("self") === "1",
            ref: u.searchParams.get("ref")
          },
          sink
        );
        if (r.ok) this.conn = r.conn;
        else this.fail();
      });
    }

    addEventListener(type: string, listener: (ev: MessageEvent) => void): void {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    }

    close(): void {
      if (this.closed) return;
      this.closed = true;
      if (this.conn) hub.disconnect(this.topic, this.conn);
      this.conn = null;
    }

    cut(): void {
      if (this.conn) hub.disconnect(this.topic, this.conn);
      this.conn = null;
      this.fail();
    }

    private dispatch(event: string, data: string): void {
      if (this.closed) return;
      for (const l of this.listeners.get(event) ?? []) l({ data } as MessageEvent);
    }

    private fail(): void {
      if (this.closed) return;
      this.onerror?.({ type: "error" } as Event);
    }
  }

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    posts.push({ ...body, keepalive: !!init?.keepalive });
    await Promise.resolve();
    const r = handleClientMessage(hub, topicFromUrl(String(input)), body);
    return { ok: r.status < 400, status: r.status, json: async () => r.body } as unknown as Response;
  }) as typeof fetch;

  return { EventSource: LoopES, fetch: fetchFn, streams, posts };
}
