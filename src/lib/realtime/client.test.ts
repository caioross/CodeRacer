import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeHub } from "./hub";
import { createLocalRealtime, type EventSourceLike, type LocalChannel, type SubscribeStatus } from "./client";
import { HEARTBEAT_MS, STALE_STREAM_MS } from "./protocol";
import { flush, loopback, type Loopback } from "./testing";

const TOPIC = "coderacer:room:ABC234";
const meta = (id: string) => ({ id, name: id, color: "#00ff88", joinedAt: 1 });

interface Probe {
  ch: LocalChannel;
  statuses: SubscribeStatus[];
  syncs: number;
  joins: Array<{ key: string; newPresences: Array<Record<string, unknown>> }>;
  leaves: Array<{ key: string; leftPresences: Array<Record<string, unknown>> }>;
  broadcasts: Array<{ type: string; event: string; payload: any }>;
  rows: Array<{ eventType: string; new: Record<string, unknown> }>;
}

/** Abre um canal do jeito que o useRoom abre (mesmas chamadas, mesma ordem). */
function openLikeUseRoom(lb: Loopback, key: string, opts: { win?: EventTarget | null } = {}): Probe {
  const rt = createLocalRealtime({ EventSource: lb.EventSource, fetch: lb.fetch, win: (opts.win ?? null) as any });
  const ch = rt.channel(TOPIC, { config: { presence: { key }, broadcast: { self: false } } });
  const p: Probe = { ch, statuses: [], syncs: 0, joins: [], leaves: [], broadcasts: [], rows: [] };
  ch.on("presence", { event: "sync" }, () => p.syncs++);
  ch.on("presence", { event: "join" }, ({ key, newPresences }) => p.joins.push({ key, newPresences }));
  ch.on("presence", { event: "leave" }, ({ key, leftPresences }) => p.leaves.push({ key, leftPresences }));
  for (const ev of ["progress", "chat", "room"]) ch.on("broadcast", { event: ev }, m => p.broadcasts.push(m));
  ch.on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "code=eq.ABC234" }, m =>
    p.rows.push(m)
  );
  ch.subscribe(status => {
    p.statuses.push(status);
    if (status === "SUBSCRIBED") void ch.track(meta(key));
  });
  return p;
}

const rowPayload = (code: string, status: string) => ({
  schema: "public",
  table: "rooms",
  commit_timestamp: "2026-11-03T00:00:00Z",
  eventType: "UPDATE" as const,
  new: { code, status },
  old: {},
  errors: null
});

let hub: RealtimeHub;
let lb: Loopback;

beforeEach(() => {
  vi.useFakeTimers();
  hub = new RealtimeHub({ autoTick: false });
  lb = loopback(hub);
});

afterEach(() => {
  hub.reset();
  vi.useRealTimers();
});

describe("LocalChannel com a superfície que o useRoom usa", () => {
  it("presence, broadcast sem eco e postgres_changes filtrado — dois clientes pelo hub de verdade", async () => {
    const a = openLikeUseRoom(lb, "a");
    await flush();
    expect(a.statuses).toEqual(["SUBSCRIBED"]);
    expect(lb.streams[0].url).toBe(`/api/rt/${TOPIC}?key=a`);
    const stateA = a.ch.presenceState<{ id: string }>();
    expect(Object.keys(stateA)).toEqual(["a"]);
    expect(stateA.a[0]).toMatchObject({ ...meta("a"), presence_ref: expect.any(String) });

    const b = openLikeUseRoom(lb, "b");
    await flush();
    expect(a.joins.map(j => j.key)).toEqual(["a", "b"]); // o próprio join também chega (como no Supabase)
    expect(a.joins[1].newPresences[0]).toMatchObject(meta("b"));
    expect(Object.keys(b.ch.presenceState()).sort()).toEqual(["a", "b"]);
    expect(b.joins.map(j => j.key).sort()).toEqual(["a", "b"]);
    expect(a.syncs).toBeGreaterThan(0);

    const msg = { id: "b", progress: 0.4, wpm: 70, accuracy: 97, errors: 2, finishedAt: null };
    expect(await b.ch.send({ type: "broadcast", event: "progress", payload: msg })).toBe("ok");
    await flush();
    expect(a.broadcasts).toEqual([{ type: "broadcast", event: "progress", payload: msg }]);
    expect(b.broadcasts).toEqual([]); // sem eco

    hub.publishRow(TOPIC, rowPayload("ABC234", "racing"));
    hub.publishRow(TOPIC, rowPayload("XYZ234", "racing")); // de outra sala: o filtro barra
    await flush();
    expect(a.rows.map(r => r.new.code)).toEqual(["ABC234"]);
    expect(b.rows.map(r => r.eventType)).toEqual(["UPDATE"]);

    await b.ch.unsubscribe();
    await flush();
    expect(b.statuses).toEqual(["SUBSCRIBED", "CLOSED"]);
    const untrack = lb.posts.find(p => p.type === "untrack" && p.key === "b");
    expect(untrack?.keepalive).toBe(true);
    expect(a.leaves.map(l => l.key)).toEqual(["b"]);
    expect(Object.keys(a.ch.presenceState())).toEqual(["a"]);
    expect(await b.ch.send({ type: "broadcast", event: "chat", payload: {} })).toBe("error");
  });

  it("um POST por vez: o que acumula vai junto no próximo, na ordem", async () => {
    const a = openLikeUseRoom(lb, "a");
    const b = openLikeUseRoom(lb, "b");
    await flush();
    const sent = [1, 2, 3, 4, 5].map(n => b.ch.send({ type: "broadcast", event: "chat", payload: { n } }));
    await flush();
    const batches = lb.posts.filter(p => p.type === "broadcast").map(p => (p.messages as any[]).map(m => m.payload.n));
    expect(batches).toEqual([[1], [2, 3, 4, 5]]);
    expect(await Promise.all(sent)).toEqual(["ok", "ok", "error", "error", "error"]); // teto do servidor: 2/s
    expect(a.broadcasts.map(m => m.payload.n)).toEqual([1, 2]);
  });

  it("queda do stream: CHANNEL_ERROR uma vez, reabre com meta + ref, sem segundo SUBSCRIBED; o que foi enviado na queda chega", async () => {
    const a = openLikeUseRoom(lb, "a");
    const b = openLikeUseRoom(lb, "b");
    await flush();
    const refBefore = a.ch.presenceState().a[0].presence_ref;
    const leavesBefore = a.leaves.length;

    lb.streams[0].cut();
    await flush();
    expect(a.statuses).toEqual(["SUBSCRIBED", "CHANNEL_ERROR"]);
    expect(b.leaves.map(l => l.key)).toEqual(["a"]);
    // A mensagem final sai durante a queda: fica na fila em vez de se perder.
    const final = a.ch.send({ type: "broadcast", event: "progress", payload: { id: "a", progress: 1, finishedAt: 99 } });

    vi.advanceTimersByTime(1000);
    await flush();
    expect(lb.streams).toHaveLength(3);
    const reopened = new URL(lb.streams[2].url, "http://x");
    expect(JSON.parse(reopened.searchParams.get("meta") || "null")).toEqual(meta("a"));
    expect(reopened.searchParams.get("ref")).toBe(refBefore);
    expect(a.statuses).toEqual(["SUBSCRIBED", "CHANNEL_ERROR"]);
    expect(await final).toBe("ok");
    expect(b.broadcasts.map(m => m.payload.finishedAt)).toEqual([99]);
    expect(b.joins.filter(j => j.key === "a")).toHaveLength(2); // entrou, caiu, voltou
    // Para si mesmo, a reconexão é invisível: mesmo ref, nenhum "saí".
    expect(a.ch.presenceState().a.map(m => m.presence_ref)).toEqual([refBefore]);
    expect(a.leaves.length).toBe(leavesBefore);
    // Re-track automático pela URL: não houve POST de track depois da queda.
    expect(lb.posts.filter(p => p.type === "track" && p.key === "a")).toHaveLength(1);
  });

  it("servidor esqueceu a conexão (410 no heartbeat): reabre sozinho", async () => {
    const a = openLikeUseRoom(lb, "a");
    await flush();
    const conn = (a.ch as unknown as { conn: string }).conn;
    hub.disconnect(TOPIC, conn); // meio-aberto: o stream do navegador não sabe
    vi.advanceTimersByTime(HEARTBEAT_MS);
    await flush();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(lb.streams).toHaveLength(2);
    expect(lb.streams[0].closed).toBe(true);
    expect(Object.keys(hub.presenceState(TOPIC))).toEqual(["a"]);
    expect(a.statuses).toEqual(["SUBSCRIBED"]);
  });

  it("watchdog: stream mudo (nem ping) é dado como morto e reaberto", async () => {
    const a = openLikeUseRoom(lb, "a");
    await flush();
    for (let t = 0; t <= STALE_STREAM_MS; t += HEARTBEAT_MS) {
      vi.advanceTimersByTime(HEARTBEAT_MS);
      await flush();
    }
    vi.advanceTimersByTime(1000);
    await flush();
    expect(lb.streams.length).toBeGreaterThanOrEqual(2);
    expect(lb.streams[0].closed).toBe(true);
    expect(a.statuses).toEqual(["SUBSCRIBED"]);
  });

  it("TIMED_OUT quando o hello não chega em 10 s", async () => {
    class Silent implements EventSourceLike {
      onerror = null;
      addEventListener() {}
      close() {}
    }
    const rt = createLocalRealtime({ EventSource: Silent, fetch: lb.fetch, win: null });
    const statuses: string[] = [];
    rt.channel(TOPIC, { config: { presence: { key: "a" } } }).subscribe(s => statuses.push(s));
    vi.advanceTimersByTime(10_000);
    expect(statuses).toEqual(["TIMED_OUT"]);
  });

  it("send recusa tipo errado e payload acima do teto sem gastar POST", async () => {
    const a = openLikeUseRoom(lb, "a");
    await flush();
    const before = lb.posts.length;
    expect(await a.ch.send({ type: "presence", event: "x", payload: {} })).toBe("error");
    expect(await a.ch.send({ type: "broadcast", event: "chat", payload: { t: "x".repeat(5000) } })).toBe("error");
    expect(lb.posts.length).toBe(before);
  });

  it("pagehide avisa a saída com keepalive; pageshow do bfcache entra de novo", async () => {
    const win = new EventTarget();
    const a = openLikeUseRoom(lb, "a", { win });
    const b = openLikeUseRoom(lb, "b");
    await flush();
    win.dispatchEvent(new Event("pagehide"));
    await flush();
    expect(lb.posts.at(-1)).toMatchObject({ type: "untrack", key: "a", keepalive: true });
    expect(Object.keys(b.ch.presenceState())).toEqual(["b"]);
    const show = Object.assign(new Event("pageshow"), { persisted: true });
    vi.advanceTimersByTime(1000); // teto de track/untrack (2/s)
    win.dispatchEvent(show);
    await flush();
    expect(Object.keys(b.ch.presenceState()).sort()).toEqual(["a", "b"]);
    await a.ch.unsubscribe();
  });
});
