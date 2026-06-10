"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RotateCcw, Trophy } from "lucide-react";
import type { Player, RoomState } from "@/lib/types";
import { Chat } from "./Chat";
import { formatMs } from "@/lib/utils";

export function Results({
  room,
  meId,
  isLeader,
  onPlayAgain,
  onChat
}: {
  room: RoomState;
  meId: string;
  isLeader: boolean;
  onPlayAgain: () => void;
  onChat: (text: string) => void;
}) {
  const startedAt = room.startedAt || 0;
  const ranked = [...room.players].sort((a, b) => {
    // Finishers first (by place), then non-finishers by progress desc
    if (a.finishedAt && b.finishedAt) return (a.place || 99) - (b.place || 99);
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.progress - a.progress;
  });

  const podium = ranked.slice(0, 3);
  const me = ranked.find(p => p.id === meId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <div className="space-y-6">
        {/* headline */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 14 }}
            className="inline-flex items-center gap-2 text-neon-amber"
          >
            <Trophy className="size-6" />
            <span className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">
              Partida finalizada
            </span>
          </motion.div>
          {me && (
            <p className="text-text-muted text-sm mt-2 font-mono">
              {me.place
                ? `// você terminou em ${me.place}º`
                : "// você não terminou esta corrida"}
            </p>
          )}
        </div>

        {/* podium */}
        <div className="grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto">
          {[1, 0, 2].map(idx => {
            const p = podium[idx];
            const heights = [180, 220, 150];
            const medals = ["🥇", "🥈", "🥉"];
            // We want order on screen: 2nd, 1st, 3rd
            const place = idx + 1;
            if (!p) return <div key={idx} className="card" style={{ height: heights[idx] }} />;
            const isMe = p.id === meId;
            const isFirst = place === 1;
            return (
              <motion.div
                key={p.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + idx * 0.1, type: "spring", stiffness: 160, damping: 18 }}
                className="card relative overflow-hidden p-4 flex flex-col justify-end"
                style={{
                  height: heights[idx],
                  borderColor: isFirst ? "#fbbf24" : `${p.color}60`,
                  boxShadow: isFirst
                    ? "0 0 32px rgba(251, 191, 36, 0.3)"
                    : `0 0 16px ${p.color}30`
                }}
              >
                <div className="absolute top-3 left-3 text-3xl">{medals[idx]}</div>
                <div className="text-center mb-2 mt-2 text-xs text-text-dim font-mono">
                  {place}º lugar
                </div>
                <div
                  className="text-center font-bold truncate"
                  style={{ color: p.color, fontSize: isFirst ? 22 : 18 }}
                >
                  {p.name}{isMe && " (você)"}
                </div>
                <div className="text-center text-[11px] text-text-muted mt-1 font-mono">
                  {Math.round(p.wpm)} wpm · {Math.round(p.accuracy)}%
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* full table */}
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-bg-line">
            <span className="label">// classificação completa</span>
          </div>
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="text-left text-text-muted text-[11px] uppercase tracking-wider border-b border-bg-line">
                <th className="px-4 py-2 w-12">#</th>
                <th className="px-2 py-2">jogador</th>
                <th className="px-2 py-2 text-right">wpm</th>
                <th className="px-2 py-2 text-right">precisão</th>
                <th className="px-2 py-2 text-right">erros</th>
                <th className="px-2 py-2 text-right">tempo</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => {
                const time = p.finishedAt ? formatMs(p.finishedAt - startedAt) : "—";
                return (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    isMe={p.id === meId}
                    time={time}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* actions */}
        <div className="flex flex-col items-center gap-3">
          {isLeader ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onPlayAgain}
              className="btn-primary px-6 py-3"
            >
              <RotateCcw className="size-4" />
              Jogar de novo
            </motion.button>
          ) : (
            <div className="text-text-muted text-sm font-mono">
              <span className="animate-pulse">// aguardando líder reiniciar...</span>
            </div>
          )}
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-neon-amber transition-colors"
          >
            <Trophy className="size-3.5" /> ver ranking global
          </Link>
        </div>
      </div>

      <aside className="lg:max-h-[calc(100vh-100px)] flex">
        <div className="flex-1 min-h-[400px]">
          <Chat
            messages={room.chat}
            players={room.players}
            meId={meId}
            onSend={onChat}
          />
        </div>
      </aside>
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  isMe,
  time
}: {
  player: Player;
  rank: number;
  isMe: boolean;
  time: string;
}) {
  const medalStr = player.place === 1 ? "🥇" : player.place === 2 ? "🥈" : player.place === 3 ? "🥉" : "";
  return (
    <tr className={`border-b border-bg-line/60 ${isMe ? "bg-neon-green/5" : ""}`}>
      <td className="px-4 py-2 text-text-dim">
        {medalStr || rank + "º"}
      </td>
      <td className="px-2 py-2 font-medium" style={{ color: player.color }}>
        {player.name}{isMe && " (você)"}
        {!player.finishedAt && (
          <span className="text-text-dim text-xs ml-2">// não terminou</span>
        )}
      </td>
      <td className="px-2 py-2 text-right">{Math.round(player.wpm)}</td>
      <td className="px-2 py-2 text-right">{Math.round(player.accuracy)}%</td>
      <td className="px-2 py-2 text-right">{player.errors}</td>
      <td className="px-2 py-2 text-right text-text-muted">{time}</td>
    </tr>
  );
}
