import type { Difficulty, LangId } from "./languages";

// Regra do "treinar de novo" do Treino Livre (issue #121, completa a #115).
// Mora num módulo próprio, e não em `snippets.ts`, porque quem decide a exclusão
// é o cliente (`PracticeView`): importar `snippets.ts` de um componente
// `"use client"` arrastaria o pool inteiro (~96 KB de fonte) para o bundle e
// quebraria a promessa de `api/snippet/route.ts:10`.

/** O que o jogador acabou de digitar — bucket + título. */
export interface PracticeRound {
  lang: LangId;
  diff: Difficulty;
  title: string;
}

/**
 * Título a tirar da urna no próximo sorteio, ou `null` para sortear do pool cheio.
 *
 * Só exclui **dentro do mesmo bucket**: títulos se repetem entre linguagens
 * ("Inverter string" existe em vários pools), então carregar a exclusão ao trocar
 * de linguagem/dificuldade tiraria da urna um snippet que o jogador nunca viu.
 */
export function exclusionFor(
  prev: PracticeRound | null,
  lang: LangId,
  diff: Difficulty
): string | null {
  if (!prev || !prev.title) return null;
  return prev.lang === lang && prev.diff === diff ? prev.title : null;
}

/** Teto do `exclude` na fronteira da rota — títulos reais têm dezenas de chars. */
export const MAX_EXCLUDE_LEN = 120;

/**
 * Política de fronteira de `GET /api/snippet?exclude=`, no espírito de
 * `resolveLang`/`resolveDifficulty` (`room.ts`) mas sem o ramo de rejeição:
 * `exclude` é dica de sorteio, não política de acesso. Ausente, vazio ou acima do
 * teto → `null` (urna cheia, comportamento de sempre); valor desconhecido não é
 * erro — o filtro simplesmente não casa.
 */
export function resolveExclude(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw || raw.length > MAX_EXCLUDE_LEN) return null;
  return raw;
}
