// Shared room types + constants for the realtime (Supabase) multiplayer.
// Safe to import from both server (API routes) and client.
import { DIFFICULTIES, LANGUAGES, type Difficulty, type LangId } from "./languages";

export type RoomStatus = "lobby" | "racing" | "finished";

export interface RoomSnippet {
  title: string;
  code: string;
  language: LangId;
  difficulty: Difficulty;
}

/** Durable room state — the `rooms` table row. */
export interface RoomRow {
  code: string;
  status: RoomStatus;
  language: LangId;
  difficulty: Difficulty;
  max_players: number;
  is_public: boolean;
  leader_id: string;
  snippet: RoomSnippet | null;
  start_at: string | null; // ISO; moment typing begins
  results: ResultRow[] | null;
  /** playerIds removidos pelo líder — verdade durável da expulsão (ver #39). */
  kicked_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Final standing for one player (stored in rooms.results on finish). */
export interface ResultRow {
  id: string;
  name: string;
  color: string;
  wpm: number;
  accuracy: number;
  errors: number;
  progress: number;
  place: number | null;
  finished: boolean;
  finishedAt: number | null;
}

/** Live progress broadcast over the realtime channel during a race. */
export interface ProgressMsg {
  id: string;
  progress: number;
  wpm: number;
  accuracy: number;
  errors: number;
  finishedAt: number | null;
  /** true when the player gave up (abandon) — finishedAt is set but they didn't complete. */
  abandoned?: boolean;
}

/** Presence payload tracked per connected player. */
export interface PresenceMeta {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
  avatar?: string | null;
  ready?: boolean;
}

export interface ChatMsg {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

/** Merged live player = presence + latest progress. */
export interface LivePlayer {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  progress: number;
  wpm: number;
  accuracy: number;
  errors: number;
  finishedAt: number | null;
  place: number | null;
  ready: boolean;
  abandoned: boolean;
  /** Entrou depois que a rodada começou — assiste esta rodada, compete na próxima (#64). */
  spectator: boolean;
}

export const COUNTDOWN_MS = 4000;

// ─── Liveness da corrida (quando `racing` acaba) ──────────────────────────────
// A corrida só terminava quando TODOS os presentes tinham `finishedAt`, então um
// único jogador parado (AFK, celular bloqueado) prendia a sala em `racing` para
// sempre: ninguém via Results e nada era persistido. Aqui ficam os critérios
// alternativos de encerramento — puros e testáveis, sem sala real.

/** Sem `progress` novo por esse tempo, o jogador deixa de bloquear o fim. */
export const RACE_IDLE_MS = 30_000;
/** Intervalo do tick de decisão do líder — segundos, nunca ms (área sagrada). */
export const RACE_DECISION_TICK_MS = 1_000;
/** Piso do teto de duração, para snippets curtos. */
export const RACE_TIMEOUT_BASE_MS = 60_000;
/** Orçamento por caractere: 600ms/char ≈ 20 WPM, bem abaixo de qualquer humano. */
export const RACE_TIMEOUT_PER_CHAR_MS = 600;
/** Teto absoluto: nenhuma corrida legítima passa disso. */
export const RACE_TIMEOUT_MAX_MS = 600_000;

/** Duração máxima de uma corrida, dimensionada pelo tamanho do snippet. */
export function raceTimeoutMs(snippetLength: number): number {
  const len = Number.isFinite(Number(snippetLength)) ? Math.max(0, Number(snippetLength)) : 0;
  return Math.min(RACE_TIMEOUT_BASE_MS + len * RACE_TIMEOUT_PER_CHAR_MS, RACE_TIMEOUT_MAX_MS);
}

/** O mínimo que a decisão de encerramento precisa saber sobre um jogador. */
export interface FinishCandidate {
  /** `null` enquanto não completou nem abandonou. */
  finishedAt: number | null;
  /** Epoch (ms) do último `progress` dele; o início da corrida se nunca digitou. */
  lastActivityAt: number;
}

export interface FinishContext {
  /** Epoch (ms) em que a digitação começa (`rooms.start_at`). */
  startMs: number;
  now: number;
  snippetLength: number;
}

/**
 * `true` quando o líder deve postar a action `finish`. Três critérios, todos
 * conservadores (na dúvida, a corrida continua):
 *
 * 1. **Todos terminaram** — a regra original.
 * 2. **Inatividade** — quem falta está parado há `RACE_IDLE_MS`, E pelo menos um
 *    jogador terminou. A exigência do finalizador evita matar uma corrida em que
 *    todo mundo ainda está lendo o snippet nos primeiros segundos.
 * 3. **Teto de duração** — passou de `raceTimeoutMs(snippetLength)` desde o
 *    start. Único critério que vale mesmo sem ninguém ter terminado, e a rede de
 *    segurança final contra sala presa em `racing`.
 *
 * Não decide NADA sobre ranking: quem não terminou continua fora dos `results`
 * (ver `toResults` em `useRoom.ts`), então encerrar por tempo não é um caminho
 * novo para o leaderboard. Os espectadores (#64) já vêm filtrados por quem chama
 * (só os RACERS entram nesta lista), então a regra não os enxerga.
 */
export function shouldFinishRace(
  players: readonly FinishCandidate[],
  { startMs, now, snippetLength }: FinishContext
): boolean {
  if (!players.length) return false; // sala vazia: não há o que persistir
  if (!startMs || now < startMs) return false; // ainda em countdown

  const pending = players.filter(p => p.finishedAt == null);
  if (pending.length === 0) return true; // (1)

  if (now - startMs >= raceTimeoutMs(snippetLength)) return true; // (3)

  const someoneFinished = pending.length < players.length;
  return someoneFinished && pending.every(p => now - p.lastActivityAt >= RACE_IDLE_MS); // (2)
}

// ─── Espectador: quem entra com a corrida já em andamento (#64) ────────────────
// A lista de participantes ficava aberta durante a partida: um jogador que
// entrasse já em `racing` passava a compor a mesma rodada, e todos que já tinham
// terminado ficavam presos esperando o retardatário. A regra: uma partida é
// composta por quem estava presente quando ela COMEÇOU (o instante `start_at`).
// Puro e determinístico — `joinedAt` e `start_at` são compartilhados por presence
// + linha da sala, então todos os clientes classificam igual.

/**
 * `true` quando um jogador deve assistir a rodada atual em vez de competir: a
 * rodada está em andamento (`racing`/`finished`) e ele entrou DEPOIS que a
 * digitação começou (`joinedAt > startMs`). Em `lobby`/countdown ninguém é
 * espectador — quem está presente antes do start compõe a corrida normalmente.
 *
 * @param joinedAt epoch (ms) em que o jogador deu `track` na presence.
 * @param startMs  epoch (ms) de `rooms.start_at`, ou `null`/0 se não há corrida.
 */
export function isSpectatorJoin(
  joinedAt: number,
  startMs: number | null,
  status: RoomStatus
): boolean {
  if (status !== "racing" && status !== "finished") return false;
  if (!startMs) return false;
  return joinedAt > startMs;
}

// ─── Allowlist de settings (fronteira de criação/ajuste de sala) ──────────────
// `language`/`difficulty` chegam como string crua do cliente e são copiados para
// `matches`/`scores` (leaderboard global público). Sem allowlist, um POST direto
// injeta dimensões arbitrárias no ranking e grava payloads sem teto de tamanho.
// A fonte de verdade é `src/lib/languages.ts` — nunca uma segunda lista.

const LANG_IDS: ReadonlySet<string> = new Set(LANGUAGES.map(l => l.id));
const DIFFICULTY_IDS: ReadonlySet<string> = new Set(DIFFICULTIES.map(d => d.id));

/** `true` se `x` é um id de linguagem suportada. Puro e testável. */
export function isValidLang(x: unknown): x is LangId {
  return typeof x === "string" && LANG_IDS.has(x);
}

/** `true` se `x` é `easy` | `medium` | `hard`. Puro e testável. */
export function isValidDifficulty(x: unknown): x is Difficulty {
  return typeof x === "string" && DIFFICULTY_IDS.has(x);
}

/** Resolução de um campo de fronteira: `ok:false` sinaliza 400 para a rota. */
export type FieldResolution<T> = { ok: true; value: T } | { ok: false };

/**
 * Política de fronteira compartilhada pelas duas rotas de sala: campo ausente
 * (`undefined`/`null`/`""`) cai no `fallback` (não quebra o fluxo legítimo);
 * valor presente só é aceito se pertencer à allowlist; qualquer outro valor
 * presente é rejeitado (a rota responde 400 em vez de trocar silenciosamente).
 */
export function resolveLang(raw: unknown, fallback: LangId): FieldResolution<LangId> {
  if (raw == null || raw === "") return { ok: true, value: fallback };
  return isValidLang(raw) ? { ok: true, value: raw } : { ok: false };
}

export function resolveDifficulty(
  raw: unknown,
  fallback: Difficulty
): FieldResolution<Difficulty> {
  if (raw == null || raw === "") return { ok: true, value: fallback };
  return isValidDifficulty(raw) ? { ok: true, value: raw } : { ok: false };
}

// ─── Votação de linguagem na sala de espera (#72) ─────────────────────────────
// A linguagem da próxima corrida é decidida coletivamente: cada jogador tem um
// voto (mutável até o start). No start o líder resolve o vencedor e escreve em
// `rooms.language` via a action `settings` — a fonte de verdade continua sendo a
// linha da sala, então todos os clientes concordam. Puro e testável.

/** Votos válidos por linguagem (ignora votos em linguagens inexistentes). */
export function tallyVotes(votes: Record<string, unknown>): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const lang of Object.values(votes)) {
    if (!isValidLang(lang)) continue;
    tally[lang] = (tally[lang] ?? 0) + 1;
  }
  return tally;
}

/**
 * Linguagem vencedora da votação: a mais votada; em caso de empate, sorteio entre
 * as empatadas (`rng`, injetável para teste). Sem votos válidos → `fallback` (a
 * linguagem padrão da sala), então o fluxo nunca fica sem linguagem.
 */
export function pickVoteWinner(
  votes: Record<string, unknown>,
  fallback: LangId,
  rng: () => number = Math.random
): LangId {
  const tally = tallyVotes(votes);
  const entries = Object.entries(tally);
  if (entries.length === 0) return fallback;
  const max = Math.max(...entries.map(([, n]) => n));
  const top = entries.filter(([, n]) => n === max).map(([lang]) => lang as LangId);
  if (top.length === 1) return top[0];
  return top[Math.min(top.length - 1, Math.floor(rng() * top.length))]; // sorteio
}

// ─── Sanitização de resultados (fronteira anti-cheat do leaderboard) ──────────
// A engine de digitação é client-side, então a API roda com service_role e é o
// único guardião das tabelas `matches`/`scores` (leaderboard global público).
// `sanitizeResults` é validação de FRONTEIRA: não recalcula a corrida (fora de
// escopo), apenas limita o raio de dano de um payload de `finish` forjado.

/** Teto de WPM humano plausível — acima disso a linha é descartada (não clampada). */
export const MAX_PLAUSIBLE_WPM = 350;
/** Teto de comprimento de nick — espelha o cap do cliente em `useRoom` (`join`). */
export const MAX_NAME_LEN = 20;
/** Teto absoluto de jogadores por sala — fonte única do cap (API + sliders da UI). */
export const ABSOLUTE_MAX_PLAYERS = 30;

/** Arredonda e força um inteiro finito dentro de [min, max]; NaN vira `min`. */
export function clampInt(n: unknown, min: number, max: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/**
 * Valida e sanitiza um array de `results` fornecido pelo cliente antes de
 * persistir no leaderboard. DESCARTA linhas que não podem ser um resultado
 * humano real (não-objeto, `name` vazio após trim, ou `wpm` fora do inteiro
 * plausível 0..MAX_PLAUSIBLE_WPM) e CLAMPA os demais campos. Campos cosméticos
 * (`id`/`color`/`progress`/`finishedAt`) são preservados para a tela de fim de
 * corrida. O array é limitado a `room.max_players` (teto absoluto
 * `ABSOLUTE_MAX_PLAYERS`).
 *
 * Puro e determinístico — coberto por `scripts/validate-persistence.mjs`.
 */
export function sanitizeResults(
  input: unknown,
  room: Pick<RoomRow, "max_players">
): ResultRow[] {
  if (!Array.isArray(input)) return [];
  const cap = Math.min(
    Math.max(Math.round(Number(room?.max_players)) || ABSOLUTE_MAX_PLAYERS, 1),
    ABSOLUTE_MAX_PLAYERS
  );

  const out: ResultRow[] = [];
  for (const r of input) {
    if (out.length >= cap) break; // descarta linhas além da capacidade da sala
    if (!r || typeof r !== "object") continue;
    const row = r as Partial<ResultRow>;

    const name = typeof row.name === "string" ? row.name.trim().slice(0, MAX_NAME_LEN) : "";
    if (!name) continue; // não dá para atribuir um score anônimo

    const wpm = Math.round(Number(row.wpm));
    if (!Number.isFinite(wpm) || wpm < 0 || wpm > MAX_PLAUSIBLE_WPM) continue; // implausível → descarta

    const placeN = Math.round(Number(row.place));
    out.push({
      id: typeof row.id === "string" ? row.id : "",
      name,
      color: typeof row.color === "string" ? row.color : "",
      wpm,
      accuracy: clampInt(row.accuracy, 0, 100),
      errors: clampInt(row.errors, 0, Number.MAX_SAFE_INTEGER),
      progress: Math.max(0, Math.min(1, Number(row.progress) || 0)),
      place: Number.isFinite(placeN) && placeN >= 1 ? placeN : null,
      finished: !!row.finished,
      finishedAt: Number.isFinite(Number(row.finishedAt)) ? Number(row.finishedAt) : null
    });
  }
  return out;
}

// ─── Montagem das linhas do leaderboard (matches/scores) ─────────────────────
// A API só orquestra os `insert`; o mapeamento `results → linhas` vive aqui,
// puro e determinístico, para ser coberto por teste (o `finished_at` entra como
// parâmetro justamente para manter as funções determinísticas).

/** Linha de `matches` (sem `id`, gerado pelo banco). */
export interface MatchInsert {
  room_code: string;
  language: LangId;
  difficulty: Difficulty;
  snippet_title: string | null;
  player_count: number;
  winner_name: string | null;
  winner_wpm: number | null;
  finished_at: string;
}

/** Linha de `scores` — um score por jogador da partida. */
export interface ScoreInsert {
  match_id: string;
  name: string;
  language: LangId;
  difficulty: Difficulty;
  wpm: number;
  accuracy: number;
  errors: number;
  place: number | null;
  finished: boolean;
}

/**
 * Monta a linha de `matches` a partir dos `results` já sanitizados.
 * Vencedor = menor `place` (ausente/0 cai no fallback 99, atrás de qualquer
 * colocado). Retorna `null` quando não há resultado — assim nenhuma `matches`
 * órfã é escrita e nenhum score é gerado.
 */
export function buildMatchRow(
  room: RoomRow,
  results: ResultRow[],
  finishedAt: string
): MatchInsert | null {
  if (!results.length) return null;
  const ranked = [...results].sort((a, b) => (a.place || 99) - (b.place || 99));
  const winner = ranked[0];
  return {
    room_code: room.code,
    language: room.language,
    difficulty: room.difficulty,
    snippet_title: room.snippet?.title || null,
    player_count: results.length,
    winner_name: winner?.name || null,
    // `|| 0` cobre NaN/-0: um WPM não-numérico vira 0, nunca `NaN` no banco.
    winner_wpm: winner ? Math.round(winner.wpm) || 0 : null,
    finished_at: finishedAt
  };
}

/** Monta as linhas de `scores` da partida (uma por resultado, na ordem recebida). */
export function buildScoreRows(
  matchId: string,
  room: RoomRow,
  results: ResultRow[]
): ScoreInsert[] {
  return results.map(r => ({
    match_id: matchId,
    name: r.name,
    language: room.language,
    difficulty: room.difficulty,
    wpm: Math.round(r.wpm) || 0,
    accuracy: Math.round(r.accuracy) || 0,
    errors: Math.round(r.errors) || 0,
    place: r.place || null,
    finished: !!r.finished
  }));
}

// ─── Autoridade de expulsão (fronteira pura, espelhada no validator) ──────────
// Kick trafegava só por broadcast peer-to-peer, sem autoridade — qualquer
// assinante do canal expulsava qualquer um (#39). A verdade agora vive no
// servidor: a rota valida `canKick` e registra o alvo em `rooms.kicked_ids`; a
// vítima descobre a remoção pela subscription postgres_changes, NUNCA por
// broadcast. Mitiga o vetor anônimo; a fechadura forte (token por jogador) é #6.

/**
 * Teto de tamanho de um playerId aceito como alvo. Ids são UUID (36 chars);
 * 64 dá folga sem deixar a coluna virar depósito de texto arbitrário.
 * (Quórum do PR Doctor: sem teto, `kicked_ids` era um campo durável e
 * gravável que inflava sem limite — e cada UPDATE refaz o fan-out da linha
 * inteira para todo assinante `postgres_changes` da sala.)
 */
export const MAX_KICKED_ID_LEN = 64;
/** Teto de expulsos por sala — acima do teto absoluto de jogadores (12). */
export const MAX_KICKED = 24;

/**
 * Só o líder legítimo da sala (verdade = `room.leader_id`) pode remover um
 * jogador, e o alvo precisa ser um id não-vazio, dentro do teto de tamanho e
 * diferente do próprio líder. Puro e determinístico — coberto por
 * `scripts/validate-persistence.mjs`.
 */
export function canKick(
  room: Pick<RoomRow, "leader_id"> | null | undefined,
  playerId: string,
  targetId: string
): boolean {
  if (!room || typeof playerId !== "string" || room.leader_id !== playerId) return false;
  if (typeof targetId !== "string") return false;
  const t = targetId.trim();
  // Alvo vazio, gigante (inflação da linha) ou o próprio líder → rejeitado.
  return t.length > 0 && t.length <= MAX_KICKED_ID_LEN && t !== room.leader_id;
}

/**
 * Acrescenta `targetId` à lista durável de expulsos de forma idempotente (sem
 * duplicar). Alvo vazio, acima do teto de tamanho, já presente ou lista cheia
 * → lista de origem inalterada (no-op seguro). Puro e determinístico.
 */
export function addKickedId(current: string[] | null | undefined, targetId: string): string[] {
  const base = Array.isArray(current)
    ? current.filter(x => typeof x === "string" && x.length <= MAX_KICKED_ID_LEN)
    : [];
  const t = typeof targetId === "string" ? targetId.trim() : "";
  if (!t || t.length > MAX_KICKED_ID_LEN || base.includes(t)) return base;
  // Lista cheia: no-op. O crescimento da linha da sala é limitado por
  // construção — nenhuma sequência de requests infla `rooms` sem teto.
  if (base.length >= MAX_KICKED) return base;
  return [...base, t];
}

/** A lista de expulsos está cheia? (rota devolve erro honesto em vez de `ok` mudo.) */
export function kickedListFull(current: string[] | null | undefined): boolean {
  const base = Array.isArray(current) ? current.filter(x => typeof x === "string") : [];
  return base.length >= MAX_KICKED;
}

// ─── Sync da linha da sala com DUAS fontes (#109) ─────────────────────────────
// A linha durável passou a chegar por dois caminhos: o broadcast autoritativo
// que a API emite depois de cada mutação confirmada e a subscription
// `postgres_changes` (mantida ligada nesta fatia — desligá-la no mesmo deploy
// congelaria toda sala viva). O mesmo estado chega, portanto, DUAS vezes, e
// reprocessá-lo tem efeito colateral visível: cada expulsão nova vira mensagem
// no chat, e o aviso duplicado é o sintoma clássico. O relógio da sala é
// `updated_at` — o trigger `rooms_touch` (0002) o renova a cada UPDATE, então
// ele ordena os estados independentemente de qual fonte chegou primeiro.

/**
 * `true` quando `nextStamp` traz estado mais NOVO que o já processado. Estado
 * igual (a segunda cópia da mesma mutação) ou anterior (entrega fora de ordem
 * entre as duas fontes) é descartado.
 *
 * Fail-open deliberado: carimbo ausente ou ilegível de qualquer um dos lados faz
 * a linha ser processada. Processar duas vezes é um incômodo contornável;
 * ignorar a única cópia de um `start` prenderia a sala no lobby — e a corrida é
 * a área sagrada do produto.
 */
export function isNewerRoomState(processedStamp: unknown, nextStamp: unknown): boolean {
  const next = typeof nextStamp === "string" ? Date.parse(nextStamp) : NaN;
  if (!Number.isFinite(next)) return true;
  const prev = typeof processedStamp === "string" ? Date.parse(processedStamp) : NaN;
  if (!Number.isFinite(prev)) return true; // nada processado ainda
  return next > prev;
}

/** O que o cliente precisa lembrar entre dois eventos de sala. */
export interface RoomSyncState {
  /** `updated_at` da última linha aceita. */
  stamp: string | null;
  /** Ids de expulsão já anunciados no chat nesta sessão. */
  announced: ReadonlySet<string>;
}

/** Decisão de sync: o que aplicar e o que anunciar. Nenhum efeito colateral. */
export interface RoomSyncDecision {
  /** Aplicar esta linha como o novo estado da sala? */
  apply: boolean;
  /** Fui EU o expulso? (saio da sala; nada é anunciado no meu chat.) */
  kickedMe: boolean;
  /** Expulsões ainda não anunciadas, na ordem da lista da sala. */
  announce: string[];
  /** Estado a guardar para o próximo evento. */
  state: RoomSyncState;
}

/**
 * Núcleo puro do handler de sala do `useRoom`: dedupe entre as duas fontes,
 * detecção da minha própria expulsão e quais expulsões ainda não foram
 * anunciadas. Chamado com a linha vinda do broadcast OU do `postgres_changes` —
 * as duas passam pelo mesmo caminho, então o mesmo estado nunca é aplicado (nem
 * anunciado) duas vezes.
 *
 * Expulsão continua sendo autoridade do servidor (#39): a saída só é definitiva
 * quando a linha da sala traz meu id em `kicked_ids`. `kicked_ids` vazio (efeito
 * do `reset`) limpa a memória de anúncios, para que a próxima rodada anuncie de
 * novo quem for expulso de novo.
 */
export function reduceRoomSync(
  state: RoomSyncState,
  next: RoomRow | null | undefined,
  meId: string
): RoomSyncDecision {
  const keep: RoomSyncDecision = { apply: false, kickedMe: false, announce: [], state };
  if (!next || !next.code) return keep;
  if (!isNewerRoomState(state.stamp, next.updated_at)) return keep;

  const stamp = typeof next.updated_at === "string" ? next.updated_at : state.stamp;
  const kicks = Array.isArray(next.kicked_ids) ? next.kicked_ids : [];

  if (meId && kicks.includes(meId)) {
    return { apply: false, kickedMe: true, announce: [], state: { stamp, announced: state.announced } };
  }
  if (kicks.length === 0) {
    return { apply: true, kickedMe: false, announce: [], state: { stamp, announced: new Set() } };
  }

  const announced = new Set(state.announced);
  const announce: string[] = [];
  for (const kid of kicks) {
    if (announced.has(kid)) continue;
    announced.add(kid);
    announce.push(kid);
  }
  return { apply: true, kickedMe: false, announce, state: { stamp, announced } };
}

const PLAYER_COLORS = [
  "#00ff88",
  "#00e5ff",
  "#a855f7",
  "#fbbf24",
  "#ff3860",
  "#f472b6",
  "#34d399",
  "#60a5fa"
];

/** Deterministic color from a player id (no coordination needed). */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Resposta que a rota deve emitir depois de tentar escrever na sala (#56). */
export interface RoomUpdateOutcome {
  ok: boolean;
  status: number;
  /** Copy voltada ao jogador (o detalhe técnico fica no log do servidor). */
  error?: string;
}

/**
 * Decide, a partir do resultado de um `UPDATE` em `rooms`, se a escrita pode ser
 * anunciada como sucesso. As mutações de sala respondiam `ok: true` sem olhar o
 * `error` do supabase-js — que devolve `{ error }` em vez de lançar —, então
 * constraint violada, RLS ou timeout viravam "deu certo" na tela do líder (#56).
 *
 * Regras (puro e determinístico, coberto por `room.test.ts`):
 * - `error` presente ⇒ 500 e copy neutra; o detalhe do PostgREST NUNCA volta ao
 *   cliente (`useRoom.ts` exibe `error` em toast — seria schema na tela do jogador).
 * - zero linhas confirmadas ⇒ 409 "não foi possível confirmar". Não afirmamos
 *   "sala não encontrada": `getServerSupabase` cai para a chave anon quando não há
 *   service_role, e aí 0 linhas pode ser SELECT negado por RLS, não sala apagada.
 * - ≥1 linha ⇒ ok.
 */
export function roomUpdateOutcome(res: {
  error?: unknown;
  rows?: number | null;
}): RoomUpdateOutcome {
  if (res.error) return { ok: false, status: 500, error: "Não foi possível atualizar a sala" };
  if (!res.rows || res.rows < 1)
    return { ok: false, status: 409, error: "Não foi possível confirmar a alteração" };
  return { ok: true, status: 200 };
}
