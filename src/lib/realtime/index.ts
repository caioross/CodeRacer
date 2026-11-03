"use client";

// Ponto único de onde o `useRoom` obtém (e devolve) o canal da sala. O resto do
// hook não muda com o transporte: os dois entregam presence, broadcast e
// postgres_changes no formato do supabase-js.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../supabase-browser";
import { createLocalRealtime, type LocalChannel, type LocalChannelOptions } from "./client";
import { realtimeMode, type RealtimeMode } from "./mode";

export { realtimeMode, type RealtimeMode } from "./mode";

export interface RealtimeTransport {
  readonly mode: RealtimeMode;
  channel(topic: string, opts?: LocalChannelOptions): RealtimeChannel;
  removeChannel(ch: RealtimeChannel): void;
}

let transport: RealtimeTransport | null = null;

export function getRealtime(): RealtimeTransport {
  if (transport) return transport;
  if (realtimeMode() === "local") {
    const local = createLocalRealtime();
    transport = {
      mode: "local",
      // O LocalChannel implementa só a superfície que o useRoom usa (on/presenceState/
      // track/send/subscribe — fixada por client.test.ts), não o RealtimeChannel inteiro.
      channel: (topic, opts) => local.channel(topic, opts) as unknown as RealtimeChannel,
      removeChannel: ch => {
        void local.removeChannel(ch as unknown as LocalChannel);
      }
    };
  } else {
    const sb = getBrowserSupabase();
    transport = {
      mode: "supabase",
      channel: (topic, opts) => sb.channel(topic, { config: opts?.config ?? {} }),
      removeChannel: ch => {
        void sb.removeChannel(ch);
      }
    };
  }
  return transport;
}
