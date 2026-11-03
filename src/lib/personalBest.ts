// Recorde pessoal do Treino Livre por linguagem + nível, guardado no navegador.
// Não é ranking (não vai ao servidor): é só o "bata seu próprio número" do modo solo.

import { MAX_PLAUSIBLE_WPM } from "./room";

const PREFIX = "coderacer:pb:";

// Mesmo teto do ranking: acima disso é bug ou trapaça, não recorde.
const MAX_PLAUSIBLE = MAX_PLAUSIBLE_WPM;

export function bestKey(language: string, difficulty: string): string {
  return `${PREFIX}${language}:${difficulty}`;
}

export function parseBest(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_PLAUSIBLE ? Math.round(n) : null;
}

export function readBest(language: string, difficulty: string): number | null {
  try {
    return parseBest(localStorage.getItem(bestKey(language, difficulty)));
  } catch {
    return null;
  }
}

export function writeBest(language: string, difficulty: string, wpm: number): void {
  const v = parseBest(String(wpm));
  if (v == null) return;
  try {
    localStorage.setItem(bestKey(language, difficulty), String(v));
  } catch {}
}
