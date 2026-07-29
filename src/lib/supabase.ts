// Server-side Supabase reads for the leaderboard page (App Router).
// Runs only on the server — uses the service-role key (or anon as fallback),
// never shipped to the browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_PLAUSIBLE_WPM } from "./room";

let client: SupabaseClient | null = null;

/** Credenciais do lado servidor — nunca saem daqui (nem para o bundle do cliente). */
function serverCredentials(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function getServerSupabase(): SupabaseClient | null {
  if (client) return client;
  const cred = serverCredentials();
  if (!cred) return null;
  client = createClient(cred.url, cred.key, { auth: { persistSession: false } });
  return client;
}

/** Teto de espera do broadcast: a mutação já foi confirmada, ninguém espera por isto. */
const BROADCAST_TIMEOUT_MS = 3000;

/**
 * Emite um evento de broadcast Realtime a partir do servidor, pelo endpoint REST
 * (`POST /realtime/v1/api/broadcast`) — o mesmo caminho que o `supabase-js` usa
 * quando não há websocket. A rota de API é serverless e efêmera: abrir canal e
 * socket para publicar UMA mensagem custaria handshake, o `unsubscribe` teria de
 * ser aguardado no caminho quente da resposta, e cada código de sala deixaria um
 * canal registrado no cliente singleton. Um POST não deixa nada para trás.
 *
 * **Best-effort por construção** (#109): quem chama já confirmou a escrita no
 * banco. Se isto falhar, o estado continua chegando ao cliente pelo
 * `postgres_changes` — por isso devolve `boolean` em vez de lançar.
 */
export async function broadcastRealtime(
  topic: string,
  event: string,
  payload: unknown
): Promise<boolean> {
  const cred = serverCredentials();
  if (!cred) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BROADCAST_TIMEOUT_MS);
  try {
    const res = await fetch(`${cred.url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: cred.key,
        authorization: `Bearer ${cred.key}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
      signal: ctrl.signal,
      cache: "no-store"
    });
    if (!res.ok) console.warn("[realtime:broadcast]", topic, event, res.status);
    return res.ok;
  } catch (e) {
    // Chave/URL ausentes, rede, ou o timeout acima — nunca derruba a mutação.
    console.warn("[realtime:broadcast]", topic, event, (e as Error).message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type LeaderRow = {
  name: string;
  wpm: number;
  accuracy: number;
  errors: number;
  language: string;
  difficulty: string;
  created_at: string;
};

export type MatchRow = {
  id: string;
  room_code: string;
  language: string;
  difficulty: string;
  snippet_title: string | null;
  player_count: number;
  winner_name: string | null;
  winner_wpm: number | null;
  finished_at: string;
};

/** Whether Supabase persistence is configured (used to show a hint in the UI). */
export function isSupabaseConfigured(): boolean {
  return getServerSupabase() !== null;
}

/** Top players by personal-best WPM. */
export async function getLeaderboard(limit = 25): Promise<LeaderRow[]> {
  const sb = getServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("leaderboard")
    .select("name, wpm, accuracy, errors, language, difficulty, created_at")
    // Defesa em profundidade: `sanitizeResults` já barra WPM implausível na
    // escrita, mas registros legados (gravados antes do guard) continuam vivos
    // em `scores`. Reusar MAX_PLAUSIBLE_WPM aqui mantém teto de escrita e de
    // leitura sempre iguais — nada acima dele polui o ranking público (#68/#28).
    .lte("wpm", MAX_PLAUSIBLE_WPM)
    .order("wpm", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[leaderboard] read error:", error.message);
    return [];
  }
  return (data as LeaderRow[]) ?? [];
}

/** Most recent finished matches. */
export async function getRecentMatches(limit = 12): Promise<MatchRow[]> {
  const sb = getServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("matches")
    .select(
      "id, room_code, language, difficulty, snippet_title, player_count, winner_name, winner_wpm, finished_at"
    )
    // Mesmo teto do leaderboard: uma partida cujo vencedor tem WPM impossível
    // não deve exibir esse número. Mantém matches sem vencedor ranqueado
    // (`winner_wpm` nulo) e só oculta os implausíveis (#68/#28).
    .or(`winner_wpm.is.null,winner_wpm.lte.${MAX_PLAUSIBLE_WPM}`)
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[recent matches] read error:", error.message);
    return [];
  }
  return (data as MatchRow[]) ?? [];
}
