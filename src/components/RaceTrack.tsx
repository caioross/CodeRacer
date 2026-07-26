"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_HEIGHT_PER_PLAYER = 34;

// `abandoned` is an explicit flag; a finished player has finishedAt and didn't abandon.
function classify(p: Player) {
  const abandoned = p.abandoned;
  const finished = !!p.finishedAt && !abandoned;
  return { finished, abandoned };
}

export function RaceTrack({
  players,
  meId,
  leaderId,
  onKick
}: {
  players: Player[];
  meId: string;
  leaderId?: string;
  /** Presente só para o líder: expulsa um griefer sem sair da corrida (#66). */
  onKick?: (targetId: string) => void;
}) {
  // Finished first (by place), then who's still racing (by progress), then who gave up.
  const sorted = [...players].sort((a, b) => {
    const A = classify(a);
    const B = classify(b);
    if (A.finished && B.finished) return (a.place || 99) - (b.place || 99);
    if (A.finished) return -1;
    if (B.finished) return 1;
    if (A.abandoned && !B.abandoned) return 1;
    if (B.abandoned && !A.abandoned) return -1;
    return b.progress - a.progress;
  });

  const doneCount = sorted.filter(p => classify(p).finished).length;

  return (
    <div
      // Mobile (#54, fatia 2): faixa compacta e fixa no topo — só você e quem
      // lidera. A altura mínima por jogador vale só no desktop (via CSS var),
      // senão a pista reservaria espaço para linhas que o mobile nem mostra.
      className="card p-3 md:p-4 overflow-hidden relative sticky top-0 z-20 md:static md:z-auto"
      style={
        {
          "--track-min": `${80 + sorted.length * TRACK_HEIGHT_PER_PLAYER}px`
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <span className="label">// posição em tempo real</span>
        <span className="text-[10px] text-text-dim">
          {doneCount}/{sorted.length} terminaram
        </span>
      </div>

      <div className="space-y-2 md:min-h-[calc(var(--track-min)-3.25rem)]">
        {sorted.map((p, idx) => {
          const isMe = p.id === meId;
          const { finished, abandoned } = classify(p);
          const barColor = abandoned ? "#7d8590" : p.color;
          const pct = Math.round(p.progress * 100);
          // No mobile a pista mostra só você e o ponteiro da corrida (idx 0) —
          // os demais continuam no DOM (e no desktop), apenas ocultos por CSS,
          // então nada de estado novo nem re-render extra durante a digitação.
          const compactOnMobile = !isMe && idx !== 0;
          return (
            <div
              key={p.id}
              className={cn(
                "relative -mx-1 rounded-md px-1 py-0.5 transition-colors",
                compactOnMobile && "hidden md:block",
                finished && "bg-neon-green/[0.06]",
                abandoned && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-mono w-5 text-text-dim text-right"
                  aria-label={`posição ${idx + 1}`}
                >
                  {finished
                    ? p.place === 1
                      ? "🥇"
                      : p.place === 2
                      ? "🥈"
                      : p.place === 3
                      ? "🥉"
                      : p.place
                    : abandoned
                    ? "—"
                    : idx + 1}
                </span>
                <span
                  className={cn("text-xs font-mono truncate", abandoned && "line-through")}
                  style={{ color: abandoned ? "#7d8590" : p.color, fontWeight: isMe ? 700 : 500 }}
                >
                  {p.name}
                  {isMe && " (você)"}
                </span>
                <span className="text-[10px] text-text-dim ml-auto flex items-center gap-2">
                  <span>{Math.round(p.wpm)} wpm</span>
                  <span className="text-text-dim">·</span>
                  <span>{Math.round(p.accuracy)}%</span>
                  {finished && (
                    <span className="ml-1 font-semibold text-neon-green">✓ terminou</span>
                  )}
                  {abandoned && (
                    <span className="ml-1 font-semibold text-neon-red/80">desistiu</span>
                  )}
                </span>
                {onKick && !isMe && p.id !== leaderId && (
                  <button
                    onClick={() => onKick(p.id)}
                    title={`Remover ${p.name} da sala`}
                    aria-label={`Remover ${p.name} da sala`}
                    className="grid size-4 shrink-0 place-items-center rounded-full border border-neon-red/40 text-neon-red opacity-60 transition hover:bg-neon-red/15 hover:opacity-100"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
              </div>
              <div
                className={cn(
                  "relative h-2 rounded-full bg-bg-soft overflow-hidden border",
                  finished ? "border-neon-green/40" : "border-bg-line"
                )}
              >
                {/* track grid */}
                <div
                  className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent 0, transparent 9%, rgba(255,255,255,0.06) 9%, rgba(255,255,255,0.06) 10%)"
                  }}
                />
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  style={{
                    background: `linear-gradient(90deg, ${barColor}40, ${barColor})`,
                    boxShadow: abandoned ? "none" : `0 0 ${finished ? 16 : 12}px ${barColor}80`
                  }}
                />
                {/* racer marker */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  animate={{ left: `calc(${pct}% - 8px)` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                >
                  <div
                    className="text-base leading-none select-none"
                    style={{
                      filter: abandoned ? "grayscale(1)" : `drop-shadow(0 0 6px ${barColor})`
                    }}
                    aria-hidden
                  >
                    {finished ? "🏁" : abandoned ? "💀" : "🚀"}
                  </div>
                </motion.div>
                {/* finish line */}
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-neon-green/40" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
