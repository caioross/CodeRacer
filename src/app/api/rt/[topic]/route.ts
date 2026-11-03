// Transporte de tempo real próprio (NEXT_PUBLIC_REALTIME=local) — ver src/lib/realtime/.
//   GET  /api/rt/<topic>?key=&meta=&self=&ref=  → stream SSE da sala
//   POST /api/rt/<topic>  { type, conn, key, ... } → broadcast | track | untrack | heartbeat
// Com o transporte desligado (modo supabase, o padrão) as duas respondem 404.
import { NextResponse } from "next/server";
import { getHub, handleClientMessage, type SseSink } from "@/lib/realtime/hub";
import { realtimeMode } from "@/lib/realtime/mode";
import {
  MAX_BODY_BYTES,
  isValidKey,
  parseMetaParam,
  parseRoomTopic
} from "@/lib/realtime/protocol";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { topic: string } };

const ROOM_CHECK_TIMEOUT_MS = 2500;

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });
}

function off() {
  return fail(404, "tempo real local desligado");
}

/** O segmento pode chegar codificado (`%3A`) ou cru — os dois valem. */
function topicOf(ctx: Ctx): string | null {
  let raw = ctx.params.topic || "";
  if (raw.includes("%")) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return parseRoomTopic(raw) ? raw : null;
}

/**
 * A sala tem de existir no banco: sem isto, qualquer um abriria streams para
 * tópicos inventados e o hub guardaria um tópico por código chutado.
 */
async function roomExists(code: string): Promise<boolean | "error"> {
  const sb = getServerSupabase();
  if (!sb) return "error";
  try {
    const { data, error } = await sb
      .from("rooms")
      .select("code")
      .eq("code", code)
      .abortSignal(AbortSignal.timeout(ROOM_CHECK_TIMEOUT_MS))
      .maybeSingle();
    if (error) {
      console.error("[rt:room]", code, error.message);
      return "error";
    }
    return !!data;
  } catch (e) {
    console.error("[rt:room]", code, (e as Error).message);
    return "error";
  }
}

export async function GET(req: Request, ctx: Ctx) {
  if (realtimeMode() !== "local") return off();
  const topic = topicOf(ctx);
  const code = topic ? parseRoomTopic(topic) : null;
  if (!topic || !code) return fail(400, "tópico inválido");

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!isValidKey(key)) return fail(400, "key inválida");
  const rawMeta = url.searchParams.get("meta");
  const meta = rawMeta ? parseMetaParam(rawMeta) : null;
  if (rawMeta && !meta) return fail(400, "meta inválida");

  const exists = await roomExists(code);
  if (exists === "error") return fail(503, "não foi possível conferir a sala");
  if (!exists) return fail(404, "sala não encontrada");

  const hub = getHub();
  const enc = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let conn: string | null = null;
  let closed = false;

  // Fim da conexão por QUALQUER caminho (aborto do pedido, cancel do stream,
  // escrita falhando ou o TTL do hub): uma vez só.
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (conn) hub.disconnect(topic, conn);
    try {
      controller?.close();
    } catch {
      // já fechado
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cleanup();
    }
  });

  const sink: SseSink = {
    send(frame) {
      if (closed || !controller) return;
      try {
        controller.enqueue(enc.encode(frame));
      } catch {
        cleanup();
      }
    },
    close() {
      // O hub já tirou a conexão (TTL): só fecha o stream.
      conn = null;
      cleanup();
    }
  };

  const result = hub.connect(
    topic,
    {
      key,
      meta,
      self: url.searchParams.get("self") === "1",
      ref: url.searchParams.get("ref")
    },
    sink
  );
  if (!result.ok) return fail(result.status, result.error);
  conn = result.conn;
  req.signal.addEventListener("abort", cleanup, { once: true });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // `no-transform` também impede a compressão do servidor Next de bufferizar o stream.
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive"
    }
  });
}

/** Lê o corpo com teto, sem confiar no `content-length` (corpo chunked não o tem). */
async function readBody(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

export async function POST(req: Request, ctx: Ctx) {
  if (realtimeMode() !== "local") return off();
  const topic = topicOf(ctx);
  if (!topic) return fail(400, "tópico inválido");

  const text = await readBody(req);
  if (text === null) return fail(413, "corpo grande demais");
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "corpo inválido");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail(400, "corpo inválido");
  }

  const r = handleClientMessage(getHub(), topic, body);
  return NextResponse.json(r.body, { status: r.status, headers: { "cache-control": "no-store" } });
}
