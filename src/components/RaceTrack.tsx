"use client";

import { motion } from "framer-motion";
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
  meId
}: {
  players: Player[];
  meId: string;
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
      className="card p-4 overflow-hidden relative"
      style={{ minHeight: 80 + sorted.length * TRACK_HEIGHT_PER_PLAYER }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="label">// posição em tempo real</span>
        <span className="text-[10px] text-text-dim">
          {doneCount}/{sorted.length} terminaram
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((p, idx) => {
          const isMe = p.id === meId;
          const { finished, abandoned } = classify(p);
          const barColor = abandoned ? "#7d8590" : p.color;
          const pct = Math.round(p.progress * 100);
          return (
            <div
              key={p.id}
              className={cn(
                "relative -mx-1 rounded-md px-1 py-0.5 transition-colors",
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
