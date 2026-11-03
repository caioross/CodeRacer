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
export interface ShareTemplates {
  /** Com `{wpm}`, `{accuracy}`, `{ord}` e `{url}`. */
  withPlace: string;
  /** Com `{wpm}`, `{accuracy}` e `{url}`. */
  noPlace: string;
  /** Ordinal no idioma ("1º", "1st", "1位"). */
  ord: (n: number) => string;
}

// Padrão = pt-BR (idioma de origem); a tela de resultado passa os textos do idioma ativo.
const PT_TEMPLATES: ShareTemplates = {
  withPlace: "Fiz {wpm} WPM ({accuracy}%) e terminei em {ord} no CodeRacer 🏁 me alcança: {url}",
  noPlace: "Fiz {wpm} WPM ({accuracy}%) no CodeRacer 🏁 me alcança: {url}",
  ord: n => `${n}º`
};

export function buildShareText(
  me: Player,
  url: string = SITE.url,
  tpl: ShareTemplates = PT_TEMPLATES
): string {
  const vars: Record<string, string> = {
    wpm: String(Math.round(me.wpm)),
    accuracy: String(Math.round(me.accuracy)),
    url
  };
  if (me.place) vars.ord = tpl.ord(me.place);
  const template = me.place ? tpl.withPlace : tpl.noPlace;
  return template.replace(/\{(\w+)\}/g, (whole, k: string) => vars[k] ?? whole);
}
