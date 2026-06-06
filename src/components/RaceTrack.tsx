"use client";

import { motion } from "framer-motion";
import type { Player } from "@/lib/types";

const TRACK_HEIGHT_PER_PLAYER = 30;

export function RaceTrack({
  players,
  meId
}: {
  players: Player[];
  meId: string;
}) {
  // Sort by progress descending so leader is on top
  const sorted = [...players].sort((a, b) => b.progress - a.progress);

  return (
    <div
      className="card p-4 overflow-hidden relative"
      style={{ minHeight: 80 + sorted.length * TRACK_HEIGHT_PER_PLAYER }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="label">// posição em tempo real</span>
        <span className="text-[10px] text-text-dim">
          {sorted.filter(p => p.finishedAt).length}/{sorted.length} terminaram
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((p, idx) => {
          const isMe = p.id === meId;
          return (
            <div key={p.id} className="relative">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-mono w-5 text-text-dim text-right"
                  aria-label={`posição ${idx + 1}`}
                >
                  {idx + 1}
                </span>
                <span
                  className="text-xs font-mono truncate"
                  style={{ color: p.color, fontWeight: isMe ? 700 : 500 }}
                >
                  {p.name}{isMe && " (você)"}
                </span>
                <span className="text-[10px] text-text-dim ml-auto flex items-center gap-2">
                  <span>{Math.round(p.wpm)} wpm</span>
                  <span className="text-text-dim">·</span>
                  <span>{Math.round(p.accuracy)}%</span>
                  {p.finishedAt && (
                    <span className="text-neon-green ml-1">
                      {p.place === 1 ? "🥇" : p.place === 2 ? "🥈" : p.place === 3 ? "🥉" : `${p.place}º`}
                    </span>
                  )}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-bg-soft overflow-hidden border border-bg-line">
                {/* track grid */}
                <div className="absolute inset-0 opacity-30 pointer-events-none"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent 0, transparent 9%, rgba(255,255,255,0.06) 9%, rgba(255,255,255,0.06) 10%)"
                  }}
                />
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(p.progress * 100)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  style={{
                    background: `linear-gradient(90deg, ${p.color}40, ${p.color})`,
                    boxShadow: `0 0 12px ${p.color}80`
                  }}
                />
                {/* car marker */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  animate={{ left: `calc(${Math.round(p.progress * 100)}% - 8px)` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                >
                  <div
                    className="text-base leading-none select-none"
                    style={{ filter: `drop-shadow(0 0 6px ${p.color})` }}
                    aria-hidden
                  >
                    🚀
                  </div>
                </motion.div>
                {/* finish flag */}
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-neon-green/40" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
