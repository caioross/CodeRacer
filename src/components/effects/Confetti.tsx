"use client";

import { useMemo } from "react";

const COLORS = ["#00ff88", "#00e5ff", "#a855f7", "#fbbf24", "#ff3860"];

// Confete de comemoração (1º lugar, recorde pessoal). Peças em CSS puro — transform e
// opacity, sem canvas e sem JS por quadro; some sozinho e não existe sob
// prefers-reduced-motion (regra em globals.css). Decorativo: aria-hidden.
export function Confetti({ pieces = 36, seed = 1 }: { pieces?: number; seed?: number }) {
  const parts = useMemo(() => {
    let s = seed * 9301 + 49297;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: pieces }, (_, i) => ({
      left: `${Math.round(rnd() * 100)}%`,
      color: COLORS[i % COLORS.length],
      dx: `${Math.round((rnd() - 0.5) * 160)}px`,
      rot: `${Math.round(360 + rnd() * 540)}deg`,
      dur: `${Math.round(1200 + rnd() * 900)}ms`,
      delay: `${Math.round(rnd() * 350)}ms`
    }));
  }, [pieces, seed]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {parts.map((p, i) => (
        <span
          key={i}
          className="cr-confetti"
          style={
            {
              left: p.left,
              background: p.color,
              "--cr-dx": p.dx,
              "--cr-rot": p.rot,
              "--cr-dur": p.dur,
              "--cr-delay": p.delay
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
