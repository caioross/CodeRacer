"use client";

import { Crown, Wifi } from "lucide-react";
import type { Player } from "@/lib/types";

export function PlayerList({
  players,
  leaderId,
  meId
}: {
  players: Player[];
  leaderId: string;
  meId: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-line">
        <span className="label">// jogadores</span>
        <span className="text-[10px] text-text-dim">{players.length}</span>
      </div>
      <ul className="divide-y divide-bg-line/60">
        {players.map(p => (
          <li
            key={p.id}
            className="flex items-center gap-2 px-3 py-2 text-sm"
          >
            <span
              className="size-2 rounded-full"
              style={{
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`
              }}
            />
            <span className="flex-1 truncate" style={{ color: p.color }}>
              {p.name}
              {p.id === meId && (
                <span className="text-text-dim ml-1 text-xs">(você)</span>
              )}
            </span>
            {p.id === leaderId && (
              <Crown
                className="size-3.5 text-neon-amber"
                aria-label="líder"
              />
            )}
            <Wifi className="size-3.5 text-neon-green" />
          </li>
        ))}
      </ul>
    </div>
  );
}
