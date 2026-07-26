// Tamanho da fonte do editor da corrida (issue #53).
//
// O Safari/iOS dá zoom automático ao focar um campo cuja fonte é menor que 16px.
// Isso acontece no PRIMEIRO toque: a viewport desloca, o código-alvo sai de vista
// e a corrida começa torta — aumentar a fonte depois não desfaz o estrago. A
// correção certa é a fonte, nunca `user-scalable=no` (que mataria o pinch-zoom).
//
// Aqui ficam só as regras puras (testáveis); o sinal de viewport vive no hook
// `useEditorFont`, que as aplica no mount e quando o contexto muda.

/** Abaixo disto o iOS dá zoom ao focar a textarea. */
export const TOUCH_MIN_FONT = 16;
/** No desktop não há zoom automático — o jogador pode compactar à vontade. */
export const DESKTOP_MIN_FONT = 12;
export const MAX_FONT = 20;
export const DESKTOP_DEFAULT_FONT = 15;

/** Toque OU viewport estreita — um único sinal decide default e piso, em vez de
 *  espalhar condicional pela UI. */
export const TOUCH_QUERY = "(pointer: coarse), (max-width: 767px)";

/** Piso do controle "tamanho da fonte" no contexto atual. */
export function minFontFor(touch: boolean): number {
  return touch ? TOUCH_MIN_FONT : DESKTOP_MIN_FONT;
}

/** Tamanho com que o editor nasce no contexto atual. */
export function defaultFontFor(touch: boolean): number {
  return touch ? TOUCH_MIN_FONT : DESKTOP_DEFAULT_FONT;
}

/** Mantém o tamanho dentro de [piso do contexto, MAX]. Usado no mount, nos
 *  botões +/- e quando o contexto muda (rotação, resize, mouse↔toque) — nunca
 *  por keystroke. */
export function clampFont(size: number, touch: boolean): number {
  if (!Number.isFinite(size)) return defaultFontFor(touch);
  return Math.min(MAX_FONT, Math.max(minFontFor(touch), Math.round(size)));
}
