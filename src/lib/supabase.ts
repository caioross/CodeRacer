// Server-side Supabase reads for the leaderboard page (App Router).
// Runs only on the server — uses the service-role key (or anon as fallback),
// never shipped to the browser.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_PLAUSIBLE_WPM } from "./room";
import { bestPerName, type LeaderRow } from "./leaderboard";
import type { Difficulty, LangId } from "./languages";

let client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type { LeaderRow };

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

/**
 * Teto de linhas lidas de `scores` antes do dedupe por nick. Fixo de propósito:
 * o dedupe acontece em TS, então é preciso ler mais que `limit` — mas um fator
 * solto (`limit × k`) vira leitura ilimitada. No caso patológico (um punhado de
 * nicks ocupando as 500 melhores linhas do bucket) a lista sai curta; é
 * preferível a paginar o ranking nesta fatia.
 */
const LEADERBOARD_SCAN_LIMIT = 500;

export type LeaderboardQuery = {
  lang?: LangId;
  diff?: Difficulty;
  /** Início da janela deslizante (ISO, calculado no servidor). */
  sinceISO?: string;
};

/**
 * Top jogadores por recorde pessoal de WPM, opcionalmente restrito a um bucket
 * (linguagem / dificuldade / período).
 *
 * Lê SEMPRE `scores` e deduplica por nick em TS (`bestPerName`), inclusive sem
 * filtro. Antes, o caminho sem filtro lia a view `leaderboard`, que escolhe o PB
 * global ANTES do teto de WPM — quem tivesse um registro legado implausível era
 * apagado do ranking inteiro em vez de aparecer com seu melhor score legítimo.
 * Um único caminho de código elimina esse bug e a divergência entre filtrado e
 * não-filtrado (#92). A view continua no banco como artefato histórico.
 */
export async function getLeaderboard(
  limit = 25,
  filters: LeaderboardQuery = {}
): Promise<LeaderRow[]> {
  const sb = getServerSupabase();
  if (!sb) return [];
  let q = sb
    .from("scores")
    .select("name, wpm, accuracy, errors, language, difficulty, created_at")
    // Defesa em profundidade: `sanitizeResults` já barra WPM implausível na
    // escrita, mas registros legados (gravados antes do guard) continuam vivos
    // em `scores`. Reusar MAX_PLAUSIBLE_WPM aqui mantém teto de escrita e de
    // leitura sempre iguais — nada acima dele polui o ranking público (#68/#28).
    // Vale em TODOS os ramos: um `select` sem este `.lte` reabriria o 3596.
    .lte("wpm", MAX_PLAUSIBLE_WPM);
  if (filters.lang) q = q.eq("language", filters.lang);
  if (filters.diff) q = q.eq("difficulty", filters.diff);
  if (filters.sinceISO) q = q.gte("created_at", filters.sinceISO);
  const { data, error } = await q
    .order("wpm", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LEADERBOARD_SCAN_LIMIT);
  if (error) {
    console.warn("[leaderboard] read error:", error.message);
    return [];
  }
  return bestPerName((data as LeaderRow[]) ?? []).slice(0, limit);
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
