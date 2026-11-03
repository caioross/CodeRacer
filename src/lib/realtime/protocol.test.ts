import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_PAYLOAD_BYTES,
  applyPresenceDiff,
  diffPresenceState,
  jsonBytes,
  matchesPostgresFilter,
  parseMetaParam,
  parseRoomTopic,
  rateBucketFor,
  roomTopic,
  sanitizeMeta,
  serializeSse,
  type PostgresChangesPayload,
  type PresenceState
} from "./protocol";
import { realtimeMode } from "./mode";
import { isValidRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../room";
import { parseSse } from "./testing";

describe("código e tópico da sala", () => {
  it("aceita só o formato que POST /api/rooms gera", () => {
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(ROOM_CODE_LENGTH).toBe(6);
    expect(isValidRoomCode("ABC234")).toBe(true);
    expect(isValidRoomCode("ZZ9988")).toBe(true);
    // I, O, 0 e 1 ficam fora do alfabeto; minúscula não existe (a página faz toUpperCase)
    for (const bad of ["abc234", "ABC23", "ABC2345", "ABCI23", "ABCO23", "ABC012", "ABC 23", "", null, 123456]) {
      expect(isValidRoomCode(bad)).toBe(false);
    }
  });

  it("tópico ↔ código", () => {
    expect(roomTopic("ABC234")).toBe("coderacer:room:ABC234");
    expect(parseRoomTopic("coderacer:room:ABC234")).toBe("ABC234");
    expect(parseRoomTopic("coderacer:room:abc234")).toBeNull();
    expect(parseRoomTopic("coderacer:room:ABC234:x")).toBeNull();
    expect(parseRoomTopic("outro:room:ABC234")).toBeNull();
    expect(parseRoomTopic(undefined)).toBeNull();
  });
});

describe("serialização SSE", () => {
  it("um evento por quadro, dado numa única linha `data:`", () => {
    const frame = serializeSse("broadcast", { event: "chat", payload: { text: "oi" } });
    expect(frame).toBe('event: broadcast\ndata: {"event":"chat","payload":{"text":"oi"}}\n\n');
    expect(frame.split("\n")).toHaveLength(4); // event, data, "", ""
  });

  it("quebra de linha e CR no payload não fecham o quadro antes da hora", () => {
    const evil = "linha1\n\nevent: postgres_changes\ndata: {}\r\n\r\nfim";
    const frame = serializeSse("broadcast", { event: "chat", payload: { text: evil } });
    const frames = parseSse(frame);
    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe("broadcast");
    expect(JSON.parse(frames[0].data).payload.text).toBe(evil);
  });

  it("vários quadros concatenados voltam na ordem; undefined vira null", () => {
    const text = serializeSse("hello", { conn: "c" }) + ": comentário\n\n" + serializeSse("ping", undefined);
    const frames = parseSse(text);
    expect(frames.map(f => f.event)).toEqual(["hello", "ping"]);
    expect(frames[1].data).toBe("null");
  });
});

describe("tetos e validação", () => {
  it("jsonBytes mede UTF-8 e recusa o que não serializa", () => {
    expect(jsonBytes({ a: 1 })).toBe(7);
    expect(jsonBytes("é")).toBe(4); // aspas + 2 bytes
    const ciclo: Record<string, unknown> = {};
    ciclo.self = ciclo;
    expect(jsonBytes(ciclo)).toBe(Infinity);
  });

  it("meta: objeto até o teto, sem presence_ref vindo do cliente", () => {
    expect(sanitizeMeta({ id: "a", presence_ref: "forjado" })).toEqual({ id: "a" });
    expect(sanitizeMeta([1])).toBeNull();
    expect(sanitizeMeta("x")).toBeNull();
    expect(sanitizeMeta({ big: "x".repeat(MAX_PAYLOAD_BYTES) })).toBeNull();
    expect(parseMetaParam('{"id":"a"}')).toEqual({ id: "a" });
    expect(parseMetaParam("{quebrado")).toBeNull();
    expect(parseMetaParam(null)).toBeNull();
  });

  it("baldes de taxa: progress final tem balde próprio; evento desconhecido cai no comum", () => {
    expect(rateBucketFor("progress", { finishedAt: null })).toEqual({ bucket: "progress", perSecond: 20 });
    expect(rateBucketFor("progress", { finishedAt: 123 })).toEqual({ bucket: "progress:final", perSecond: 5 });
    expect(rateBucketFor("chat", {})).toEqual({ bucket: "chat", perSecond: 2 });
    expect(rateBucketFor("ready", {}).perSecond).toBe(5);
    expect(rateBucketFor("vote", {}).perSecond).toBe(5);
    expect(rateBucketFor("qualquer", {}).bucket).toBe("*");
    expect(rateBucketFor("constructor", {}).bucket).toBe("*"); // nada de herdar do Object.prototype
  });
});

describe("presence com a semântica do Phoenix (supabase-js)", () => {
  const a = { presence_ref: "refA0000", id: "a", name: "ana" };
  const b = { presence_ref: "refB0000", id: "b", name: "bia" };

  it("estado completo novo vira joins/leaves por ref", () => {
    const cur: PresenceState = { a: [a] };
    const next: PresenceState = { b: [b] };
    expect(diffPresenceState(cur, next)).toEqual({ joins: { b: [b] }, leaves: { a: [a] } });
    expect(diffPresenceState(next, next)).toEqual({ joins: {}, leaves: {} });
  });

  it("join entrega o antes; leave entrega o que sobrou; chave vazia some", () => {
    const r1 = applyPresenceDiff({}, { joins: { a: [a] }, leaves: {} });
    expect(r1.state).toEqual({ a: [a] });
    expect(r1.joins).toEqual([{ key: "a", currentPresences: [], newPresences: [a] }]);
    const a2 = { ...a, presence_ref: "refA2222" };
    const r2 = applyPresenceDiff(r1.state, { joins: { a: [a2] }, leaves: {} });
    expect(r2.state.a).toEqual([a, a2]); // duas abas, mesma chave: as duas metas
    const r3 = applyPresenceDiff(r2.state, { joins: {}, leaves: { a: [a] } });
    expect(r3.state.a).toEqual([a2]);
    expect(r3.leaves).toEqual([{ key: "a", currentPresences: [a2], leftPresences: [a] }]);
    const r4 = applyPresenceDiff(r3.state, { joins: {}, leaves: { a: [a2] } });
    expect(r4.state).toEqual({});
    expect(r1.state).toEqual({ a: [a] }); // entrada não é mutada
  });

  it("re-track (join do ref novo + leave do velho no mesmo diff) deixa uma meta só", () => {
    const novo = { ...a, presence_ref: "refA3333", name: "ana2" };
    const r = applyPresenceDiff({ a: [a] }, { joins: { a: [novo] }, leaves: { a: [a] } });
    expect(r.state).toEqual({ a: [novo] });
  });
});

describe("filtro de postgres_changes", () => {
  const row = (code: string, eventType: PostgresChangesPayload["eventType"] = "UPDATE"): PostgresChangesPayload => ({
    schema: "public",
    table: "rooms",
    commit_timestamp: "2026-11-03T00:00:00Z",
    eventType,
    new: { code },
    old: {},
    errors: null
  });
  const f = { event: "*", schema: "public", table: "rooms", filter: "code=eq.ABC234" };

  it("entrega só a linha da sala filtrada", () => {
    expect(matchesPostgresFilter(f, row("ABC234"))).toBe(true);
    expect(matchesPostgresFilter(f, row("XYZ234"))).toBe(false);
    expect(matchesPostgresFilter({ ...f, table: "matches" }, row("ABC234"))).toBe(false);
    expect(matchesPostgresFilter({ ...f, event: "INSERT" }, row("ABC234"))).toBe(false);
    expect(matchesPostgresFilter({ ...f, event: "INSERT" }, row("ABC234", "INSERT"))).toBe(true);
    expect(matchesPostgresFilter({ ...f, filter: "code=in.(ABC234)" }, row("ABC234"))).toBe(false);
  });
});

describe("seleção do transporte", () => {
  const original = process.env.NEXT_PUBLIC_REALTIME;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_REALTIME;
    else process.env.NEXT_PUBLIC_REALTIME = original;
  });

  it("supabase é o padrão; local só quando pedido", () => {
    delete process.env.NEXT_PUBLIC_REALTIME;
    expect(realtimeMode()).toBe("supabase");
    process.env.NEXT_PUBLIC_REALTIME = "qualquer";
    expect(realtimeMode()).toBe("supabase");
    process.env.NEXT_PUBLIC_REALTIME = " Local ";
    expect(realtimeMode()).toBe("local");
  });
});
