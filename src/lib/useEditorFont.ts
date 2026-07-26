"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MAX_FONT,
  TOUCH_QUERY,
  clampFont,
  defaultFontFor,
  minFontFor
} from "./editorFont";

function isTouchViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(TOUCH_QUERY).matches;
}

/**
 * Resolve tamanho e piso da fonte do editor a partir do contexto (toque/viewport
 * estreita) — issue #53.
 *
 * O estado nasce de um lazy initializer, e não de um `useEffect`, porque o
 * `CodeEditor` chama `focus()` no mount: se o piso só chegasse no efeito, o iOS
 * já teria dado o zoom. Isso é seguro aqui porque o editor nunca é renderizado
 * no servidor (a corrida só monta com snippet do Realtime; o Treino Livre monta
 * depois do fetch), então não há divergência de hidratação.
 *
 * Área sagrada: a decisão é tomada no mount e em eventos de media query — nunca
 * no caminho da digitação.
 */
export function useEditorFont() {
  const [touch, setTouch] = useState(isTouchViewport);
  const [fontSize, setFontSize] = useState(() => defaultFontFor(isTouchViewport()));

  // Rotação, resize e troca de input (tablet com teclado) reavaliam o contexto.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(TOUCH_QUERY);
    const apply = () => setTouch(mql.matches);
    apply();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
    mql.addListener(apply); // Safari < 14
    return () => mql.removeListener(apply);
  }, []);

  // Mudou de contexto: reancora o tamanho escolhido no piso novo (ex.: 12px de
  // desktop vira 16px ao girar para um viewport de toque).
  useEffect(() => {
    setFontSize(s => clampFont(s, touch));
  }, [touch]);

  const minFont = minFontFor(touch);
  const decrease = useCallback(() => setFontSize(s => Math.max(minFontFor(touch), s - 1)), [touch]);
  const increase = useCallback(() => setFontSize(s => Math.min(MAX_FONT, s + 1)), []);

  return { fontSize, minFont, maxFont: MAX_FONT, increase, decrease };
}
