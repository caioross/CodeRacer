"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

// "Descriptografa" um texto: começa embaralhado e resolve da esquerda p/ a direita.
// Coerente com o tema hacker (docs/UI-AAA-OVERHAUL.md §III.1). Respeita reduced-motion.
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>-_\\/[]{}=+*!?#";

export function DecryptedText({
  text,
  className,
  durationMs = 800
}: {
  text: string;
  className?: string;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  // Inicia com o texto real → sem hydration mismatch e sem CLS; embaralha no mount.
  const [display, setDisplay] = useState(text);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const revealed = Math.floor(p * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (i < revealed || ch === " ") out += ch;
        else out += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      }
      setDisplay(out);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(text);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, durationMs, reduced]);

  // aria-label dá o texto real ao leitor de tela enquanto o visual embaralha.
  return (
    <span className={className} aria-label={text}>
      {display}
    </span>
  );
}
