// Texto de compartilhamento do resultado de uma corrida.
//
// Helper PURO (sem `window`, sem DOM) para ser testável: o chamador passa a URL
// — no browser, `window.location.origin`, que é a origem real do deploy; `SITE.url`
// fica só como default para contextos sem `window` (SSR/teste).
//
// Regra de segurança: nada aqui pode vazar o código da sala. A sala é efêmera e
// um link `/room/<code>` no texto daria entrada a qualquer um que veja o post —
// o convite é para o site, não para a partida que acabou.

import type { Player } from "./types";
import { SITE } from "./site";

/**
 * Monta o texto curto que o jogador compartilha após a corrida.
 * Sem `place` (não terminou), a frase sai sem o trecho de colocação.
 */
export function buildShareText(me: Player, url: string = SITE.url): string {
  const wpm = Math.round(me.wpm);
  const accuracy = Math.round(me.accuracy);
  const placed = me.place ? ` e terminei em ${me.place}º` : "";
  return `Fiz ${wpm} WPM (${accuracy}%)${placed} no CodeRacer 🏁 me alcança: ${url}`;
}
