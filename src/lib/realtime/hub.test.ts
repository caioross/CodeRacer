import { beforeEach, describe, expect, it } from "vitest";
import { RealtimeHub, getHub, handleClientMessage } from "./hub";
import { MAX_PAYLOAD_BYTES, PRESENCE_TTL_MS, applyPresenceDiff, type PresenceState } from "./protocol";
import { MemorySink } from "./testing";
import { ABSOLUTE_MAX_PLAYERS } from "../room";

const TOPIC = "coderacer:room:ABC234";
const meta = (id: string) => ({ id, name: id, color: "#00ff88", joinedAt: 1 });

let clock = 1_000_000;
let seq = 0;
function makeHub(extra: ConstructorParameters<typeof RealtimeHub>[0] = {}) {
  return new RealtimeHub({
    now: () => clock,
    newId: bytes => `id${String(++seq).padStart(Math.max(8, bytes), "0")}`,
    autoTick: false,
    ...extra
  });
}

function join(hub: RealtimeHub, key: string, opts: { meta?: boolean; self?: boolean } = {}) {
  const sink = new MemorySink();
  const r = hub.connect(TOPIC, { key, meta: opts.meta === false ? null : meta(key), self: opts.self }, sink);
  if (!r.ok) throw new Error(r.error);
  return { sink, conn: r.conn, ref: r.ref, key };
}

const kinds = (sink: MemorySink) => sink.take().map(e => e.event);

beforeEach(() => {
  clock = 1_000_000;
  seq = 0;
});

describe("presence: join/leave no formato do supabase-js", () => {
  it("quem conecta recebe hello + estado; os outros recebem o join", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const first = a.sink.take();
    expect(first.map(e => e.event)).toEqual(["hello", "presence_state"]);
    expect(first[0].data).toMatchObject({ conn: a.conn, ref: a.ref, key: "a", tracked: true });
    expect(first[1].data).toEqual({ a: [{ ...meta("a"), presence_ref: a.ref }] });

    const b = join(hub, "b");
    const toA = a.sink.take();
    expect(toA).toEqual([
      { event: "presence_diff", data: { joins: { b: [{ ...meta("b"), presence_ref: b.ref }] }, leaves: {} } }
    ]);
    const toB = b.sink.take();
    expect(toB[1].data).toEqual({
      a: [{ ...meta("a"), presence_ref: a.ref }],
      b: [{ ...meta("b"), presence_ref: b.ref }]
    });
    expect(hub.presenceState(TOPIC)).toEqual(toB[1].data);
  });

  it("fim do stream tira da presence e avisa quem ficou", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    a.sink.take();
    hub.disconnect(TOPIC, b.conn);
    hub.disconnect(TOPIC, b.conn); // idempotente
    expect(a.sink.take()).toEqual([
      { event: "presence_diff", data: { joins: {}, leaves: { b: [{ ...meta("b"), presence_ref: b.ref }] } } }
    ]);
    expect(Object.keys(hub.presenceState(TOPIC))).toEqual(["a"]);
  });

  it("track/untrack por POST vão para todos, inclusive quem os fez; re-track troca o ref", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b", { meta: false }); // conectou sem meta: ainda não aparece
    expect(hub.presenceState(TOPIC)).toEqual({ a: [{ ...meta("a"), presence_ref: a.ref }] });
    a.sink.take();
    b.sink.take();

    const t1 = hub.track(TOPIC, b.conn, "b", meta("b"));
    expect(t1.result).toBe("ok");
    expect(kinds(a.sink)).toEqual(["presence_diff"]);
    expect(kinds(b.sink)).toEqual(["presence_diff"]);

    clock += 1000;
    const t2 = hub.track(TOPIC, b.conn, "b", { ...meta("b"), name: "bia" });
    expect(t2.ref).not.toBe(t1.ref);
    const diff = a.sink.take()[0].data;
    let state: PresenceState = { b: [{ ...meta("b"), presence_ref: t1.ref as string }] };
    state = applyPresenceDiff(state, diff).state;
    expect(state).toEqual({ b: [{ ...meta("b"), name: "bia", presence_ref: t2.ref as string }] });

    clock += 1000;
    expect(hub.untrack(TOPIC, b.conn, "b")).toBe("ok");
    expect(a.sink.take()[0].data.leaves.b[0].presence_ref).toBe(t2.ref);
    expect(Object.keys(hub.presenceState(TOPIC))).toEqual(["a"]);
  });

  it("duas conexões com a mesma chave (aba duplicada) viram duas metas da chave", () => {
    const hub = makeHub();
    const a1 = join(hub, "a");
    const a2 = join(hub, "a");
    expect(hub.presenceState(TOPIC).a.map(m => m.presence_ref)).toEqual([a1.ref, a2.ref]);
    hub.disconnect(TOPIC, a1.conn);
    expect(hub.presenceState(TOPIC).a.map(m => m.presence_ref)).toEqual([a2.ref]);
  });

  it("ref proposto na reconexão vale se estiver livre; se alguém vivo o usa, ganha outro", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    hub.disconnect(TOPIC, a.conn);
    const back = hub.connect(TOPIC, { key: "a", meta: meta("a"), ref: a.ref }, new MemorySink());
    expect(back.ok && back.ref).toBe(a.ref);
    const thief = hub.connect(TOPIC, { key: "x", meta: meta("x"), ref: a.ref }, new MemorySink());
    expect(thief.ok && thief.ref).not.toBe(a.ref);
  });
});

describe("TTL de heartbeat e ping", () => {
  it("sem heartbeat por mais de 30 s a conexão cai (stream fechado, leave para os outros)", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    a.sink.take();
    clock += PRESENCE_TTL_MS - 5_000;
    expect(hub.heartbeat(TOPIC, a.conn, "a")).toBe("ok"); // só A dá sinal de vida
    clock += 10_000; // B: 35 s calado · A: 10 s
    hub.tick();
    expect(b.sink.closed).toBe(true);
    expect(a.sink.closed).toBe(false);
    const evs = a.sink.take();
    expect(evs.find(e => e.event === "presence_diff")?.data.leaves.b).toHaveLength(1);
    expect(hub.heartbeat(TOPIC, b.conn, "b")).toBe("unknown_conn");
    expect(Object.keys(hub.presenceState(TOPIC))).toEqual(["a"]);
  });

  it("broadcast e track também contam como sinal de vida", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    for (let i = 0; i < 4; i++) {
      clock += 20_000;
      expect(hub.broadcast(TOPIC, a.conn, "a", "chat", { text: "oi" })).toBe("ok");
      hub.tick();
    }
    expect(a.sink.closed).toBe(false);
  });

  it("ping a cada 15 s em cada stream", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    a.sink.take();
    clock += 10_000;
    hub.tick();
    expect(kinds(a.sink)).toEqual([]);
    hub.heartbeat(TOPIC, a.conn, "a");
    clock += 5_000;
    hub.tick();
    expect(kinds(a.sink)).toEqual(["ping"]);
  });
});

describe("broadcast: fan-out sem eco", () => {
  it("quem envia não recebe; os outros recebem { event, payload }", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    const c = join(hub, "c");
    [a, b, c].forEach(x => x.sink.take());
    const payload = { id: "a", progress: 0.5, wpm: 80, accuracy: 98, errors: 1, finishedAt: null };
    expect(hub.broadcast(TOPIC, a.conn, "a", "progress", payload)).toBe("ok");
    expect(a.sink.take()).toEqual([]);
    expect(b.sink.take()).toEqual([{ event: "broadcast", data: { event: "progress", payload } }]);
    expect(c.sink.take()).toEqual([{ event: "broadcast", data: { event: "progress", payload } }]);
  });

  it("self: true recebe o próprio broadcast; o broadcast do servidor vai para todos", () => {
    const hub = makeHub();
    const a = join(hub, "a", { self: true });
    const b = join(hub, "b");
    [a, b].forEach(x => x.sink.take());
    hub.broadcast(TOPIC, a.conn, "a", "chat", { text: "eco" });
    expect(kinds(a.sink)).toEqual(["broadcast"]);
    expect(hub.publish(TOPIC, "room", { code: "ABC234" })).toBe(2);
    expect(kinds(a.sink)).toEqual(["broadcast"]);
    expect(kinds(b.sink)).toEqual(["broadcast", "broadcast"]);
  });

  it("conexão desconhecida ou chave trocada não publica nada", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    b.sink.take();
    expect(hub.broadcast(TOPIC, "conn-inventado", "a", "chat", {})).toBe("unknown_conn");
    expect(hub.broadcast(TOPIC, a.conn, "b", "chat", {})).toBe("unknown_conn"); // conn de A, chave de B
    expect(hub.untrack(TOPIC, a.conn, "b")).toBe("unknown_conn");
    expect(b.sink.take()).toEqual([]);
  });
});

describe("tetos no servidor", () => {
  it("payload acima de 4 KB é recusado; no limite passa", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    b.sink.take();
    const atLimit = { t: "x".repeat(MAX_PAYLOAD_BYTES - 8) }; // {"t":"..."} = 8 bytes de moldura
    expect(JSON.stringify(atLimit).length).toBe(MAX_PAYLOAD_BYTES);
    expect(hub.broadcast(TOPIC, a.conn, "a", "chat", atLimit)).toBe("ok");
    expect(hub.broadcast(TOPIC, a.conn, "a", "chat", { t: "x".repeat(MAX_PAYLOAD_BYTES) })).toBe("too_large");
    expect(hub.broadcast(TOPIC, a.conn, "a", "evento com espaço", {})).toBe("bad_event");
    expect(hub.track(TOPIC, a.conn, "a", { big: "x".repeat(MAX_PAYLOAD_BYTES) }).result).toBe("bad_meta");
    expect(kinds(b.sink)).toEqual(["broadcast"]);
  });

  it("rajada do mesmo emissor: só o teto por segundo passa, e só ele é punido", () => {
    const hub = makeHub();
    const griefer = join(hub, "g");
    const honest = join(hub, "h");
    const watcher = join(hub, "w");
    const count = (ev: string, n: number, who = griefer, payload: unknown = { finishedAt: null }) =>
      Array.from({ length: n }, () => hub.broadcast(TOPIC, who.conn, who.key, ev, payload)).filter(r => r === "ok").length;

    expect(count("progress", 100)).toBe(20);
    expect(count("chat", 10)).toBe(2);
    expect(count("ready", 10)).toBe(5);
    expect(count("vote", 10)).toBe(5);
    expect(count("inventado", 10)).toBe(5);
    expect(count("outro-inventado", 10)).toBe(0); // desconhecidos dividem um balde só
    // O honesto da mesma sala não paga pela rajada alheia.
    expect(count("progress", 3, honest)).toBe(3);
    // A mensagem FINAL tem balde próprio: a rajada de progresso comum não a engole (#135).
    expect(count("progress", 1, griefer, { finishedAt: clock })).toBe(1);
    // Um segundo depois o balde está cheio de novo.
    clock += 1000;
    expect(count("progress", 100)).toBe(20);
    expect(count("chat", 10)).toBe(2);
    const delivered = watcher.sink.take().filter(e => e.event === "broadcast").length;
    expect(delivered).toBe(20 + 2 + 5 + 5 + 5 + 3 + 1 + 20 + 2);
  });

  it("tráfego honesto de sala cheia (30 jogadores a 8,3 Hz por 10 s) passa inteiro", () => {
    const hub = makeHub();
    const players = Array.from({ length: ABSOLUTE_MAX_PLAYERS }, (_, i) => join(hub, `p${i}`));
    let rejected = 0;
    for (let tick = 0; tick < 84; tick++) {
      clock += 120;
      for (const p of players) {
        const r = hub.broadcast(TOPIC, p.conn, p.key, "progress", { id: p.key, progress: tick / 84, finishedAt: null });
        if (r !== "ok") rejected++;
      }
    }
    for (const p of players) {
      if (hub.broadcast(TOPIC, p.conn, p.key, "progress", { id: p.key, progress: 1, finishedAt: clock }) !== "ok") rejected++;
    }
    expect(rejected).toBe(0);
  });

  it("track em laço também tem teto (cada um vira diff para a sala)", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const ok = Array.from({ length: 10 }, () => hub.track(TOPIC, a.conn, "a", meta("a")).result).filter(r => r === "ok");
    expect(ok).toHaveLength(2);
  });

  it("inscritos por sala ≤ teto de jogadores + 10; total do processo também tem teto", () => {
    const hub = makeHub();
    for (let i = 0; i < ABSOLUTE_MAX_PLAYERS + 10; i++) join(hub, `p${i}`);
    const full = hub.connect(TOPIC, { key: "extra" }, new MemorySink());
    expect(full).toMatchObject({ ok: false, status: 429 });
    const other = hub.connect("coderacer:room:XYZ234", { key: "extra" }, new MemorySink());
    expect(other.ok).toBe(true);

    const tiny = makeHub({ maxTotal: 1 });
    expect(tiny.connect(TOPIC, { key: "a" }, new MemorySink()).ok).toBe(true);
    expect(tiny.connect("coderacer:room:XYZ234", { key: "b" }, new MemorySink())).toMatchObject({ ok: false, status: 503 });
  });

  it("tópico, chave e meta inválidos são recusados no connect", () => {
    const hub = makeHub();
    expect(hub.connect("coderacer:room:abc", { key: "a" }, new MemorySink())).toMatchObject({ status: 400 });
    expect(hub.connect("outra:coisa", { key: "a" }, new MemorySink())).toMatchObject({ status: 400 });
    expect(hub.connect(TOPIC, { key: "a b" }, new MemorySink())).toMatchObject({ status: 400 });
    expect(hub.connect(TOPIC, { key: "x".repeat(65) }, new MemorySink())).toMatchObject({ status: 400 });
    expect(hub.stats()).toEqual({ topics: 0, subscribers: 0 });
  });
});

describe("postgres_changes e limpeza", () => {
  const row = (status: string) => ({
    schema: "public",
    table: "rooms",
    commit_timestamp: "2026-11-03T00:00:00Z",
    eventType: "UPDATE" as const,
    new: { code: "ABC234", status, updated_at: `2026-11-03T00:00:0${status.length}Z` },
    old: {},
    errors: null
  });

  it("linha publicada chega a todos, e quem (re)conecta recebe a última", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    a.sink.take();
    expect(hub.publishRow(TOPIC, row("racing"))).toBe(1);
    expect(a.sink.take()).toEqual([{ event: "postgres_changes", data: row("racing") }]);
    const b = join(hub, "b");
    expect(kinds(b.sink)).toEqual(["hello", "presence_state", "postgres_changes"]);
  });

  it("sala sem ninguém não guarda nada; o último a sair apaga o tópico", () => {
    const hub = makeHub();
    expect(hub.publishRow(TOPIC, row("racing"))).toBe(0);
    expect(hub.publish(TOPIC, "room", {})).toBe(0);
    expect(hub.stats().topics).toBe(0);

    const a = join(hub, "a");
    const b = join(hub, "b");
    hub.publishRow(TOPIC, row("racing"));
    expect(hub.stats()).toEqual({ topics: 1, subscribers: 2 });
    hub.disconnect(TOPIC, a.conn);
    hub.disconnect(TOPIC, b.conn);
    expect(hub.stats()).toEqual({ topics: 0, subscribers: 0 });
    const c = join(hub, "c");
    expect(kinds(c.sink)).toEqual(["hello", "presence_state"]); // a linha antiga foi junto
  });

  it("TTL também limpa o tópico", () => {
    const hub = makeHub();
    join(hub, "a");
    clock += PRESENCE_TTL_MS + 1;
    hub.tick();
    expect(hub.stats()).toEqual({ topics: 0, subscribers: 0 });
  });
});

describe("POST (handleClientMessage)", () => {
  it("lote de broadcast mantém a ordem e devolve o desfecho de cada mensagem", () => {
    const hub = makeHub();
    const a = join(hub, "a");
    const b = join(hub, "b");
    b.sink.take();
    const r = handleClientMessage(hub, TOPIC, {
      type: "broadcast",
      conn: a.conn,
      key: "a",
      messages: [
        { event: "chat", payload: { n: 1 } },
        { event: "chat", payload: { n: 2 } },
        { event: "chat", payload: { n: 3 } } // 3ª do segundo: acima de 2/s
      ]
    });
    expect(r.status).toBe(200);
    expect(r.body.results).toEqual(["ok", "ok", "rate_limited"]);
    expect(b.sink.take().map(e => e.data.payload.n)).toEqual([1, 2]);
  });

  it("conexão esquecida → 410 (o cliente reabre o stream); type desconhecido → 400", () => {
    const hub = makeHub();
    expect(handleClientMessage(hub, TOPIC, { type: "heartbeat", conn: "x", key: "a" }).status).toBe(410);
    expect(handleClientMessage(hub, TOPIC, { type: "broadcast", conn: "x", key: "a", event: "chat" }).status).toBe(410);
    expect(handleClientMessage(hub, TOPIC, { type: "postgres_changes" }).status).toBe(400);
    const a = join(hub, "a");
    const single = handleClientMessage(hub, TOPIC, { type: "broadcast", conn: a.conn, key: "a", event: "vote", payload: {} });
    expect(single.body.results).toEqual(["ok"]);
    const t = handleClientMessage(hub, TOPIC, { type: "track", conn: a.conn, key: "a", meta: meta("a") });
    expect(t).toMatchObject({ status: 200, body: { ok: true } });
  });
});

describe("instância do processo", () => {
  it("getHub devolve sempre a mesma, guardada em globalThis", () => {
    const h = getHub();
    expect(getHub()).toBe(h);
    expect((globalThis as Record<string, unknown>).__coderacerRealtimeHub_v1).toBe(h);
  });
});
