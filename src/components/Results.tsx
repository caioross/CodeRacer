"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Share2, Trophy } from "lucide-react";
import type { Player, RoomState } from "@/lib/types";
import { Chat } from "./Chat";
import { useToast } from "./ui/Toast";
import { buildShareText } from "@/lib/share";
import { formatMs } from "@/lib/utils";

// Metadados por lugar (índice = colocação-1): altura da coluna e medalha.
const PODIUM_META = [
  { place: 1, height: 220, medal: "🥇" },
  { place: 2, height: 180, medal: "🥈" },
  { place: 3, height: 150, medal: "🥉" }
] as const;

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
  const reduced = useReducedMotion();
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

  // Ordem na tela: 2º, 1º, 3º (só as colocações que têm jogador).
  const empty = ranked.length === 0;
  const solo = ranked.length === 1;
  const duo = ranked.length === 2;
  const screenOrder = duo ? [1, 0] : [1, 0, 2];

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

        {/* pódio (ou resultado herói quando há um só corredor) */}
        {empty ? (
          <EmptyPodium />
        ) : solo ? (
          <SoloHero
            player={podium[0]}
            startedAt={startedAt}
            isMe={podium[0].id === meId}
            reduced={reduced}
          />
        ) : (
          <div
            className={`grid gap-3 items-end mx-auto ${
              duo ? "grid-cols-2 max-w-md" : "grid-cols-3 max-w-2xl"
            }`}
          >
            {screenOrder.map((rankIdx, col) => (
              <PodiumCard
                key={podium[rankIdx].id}
                player={podium[rankIdx]}
                meta={PODIUM_META[rankIdx]}
                col={col}
                isMe={podium[rankIdx].id === meId}
                reduced={reduced}
              />
            ))}
          </div>
        )}

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
          <div className="flex flex-wrap items-center justify-center gap-3">
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
            {me && <ShareButton me={me} />}
          </div>
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

// Sala terminou sem ninguém na lista (todos saíram antes do fim). Sem este guard o
// pódio indexaria `podium[1]` num array vazio e a tela quebrava com TypeError.
function EmptyPodium() {
  return (
    <div className="card max-w-md mx-auto p-6 text-center">
      <div className="text-4xl mb-2">🏁</div>
      <div className="text-sm font-mono text-text-muted">
        // ninguém terminou esta corrida
      </div>
    </div>
  );
}

// Uma coluna do pódio (2+ jogadores). Sem fallback vazio: só recebe jogador existente.
function PodiumCard({
  player,
  meta,
  col,
  isMe,
  reduced
}: {
  player: Player;
  meta: (typeof PODIUM_META)[number];
  col: number;
  isMe: boolean;
  reduced: boolean | null;
}) {
  const isFirst = meta.place === 1;
  return (
    <motion.div
      initial={reduced ? false : { y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        reduced
          ? { duration: 0 }
          : { delay: 0.15 + col * 0.1, type: "spring", stiffness: 160, damping: 18 }
      }
      className="card relative overflow-hidden p-4 flex flex-col justify-end"
      style={{
        height: meta.height,
        borderColor: isFirst ? "#fbbf24" : `${player.color}60`,
        boxShadow: isFirst
          ? "0 0 32px rgba(251, 191, 36, 0.3)"
          : `0 0 16px ${player.color}30`
      }}
    >
      <div className="absolute top-3 left-3 text-3xl">{meta.medal}</div>
      <div className="text-center mb-2 mt-2 text-xs text-text-dim font-mono">
        {meta.place}º lugar
      </div>
      <div
        className="text-center font-bold truncate"
        style={{ color: player.color, fontSize: isFirst ? 22 : 18 }}
      >
        {player.name}{isMe && " (você)"}
      </div>
      <div className="text-center text-[11px] text-text-muted mt-1 font-mono">
        {Math.round(player.wpm)} wpm · {Math.round(player.accuracy)}%
      </div>
    </motion.div>
  );
}

// Resultado "herói" para corrida solo: sem pódio de 3 lugares com buracos.
function SoloHero({
  player,
  startedAt,
  isMe,
  reduced
}: {
  player: Player;
  startedAt: number;
  isMe: boolean;
  reduced: boolean | null;
}) {
  const time = player.finishedAt ? formatMs(player.finishedAt - startedAt) : "—";
  return (
    <div className="max-w-md mx-auto">
      <motion.div
        initial={reduced ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 16 }}
        className="card relative overflow-hidden p-6 text-center"
        style={{
          borderColor: "#fbbf24",
          boxShadow: "0 0 32px rgba(251, 191, 36, 0.3)"
        }}
      >
        <div className="text-5xl mb-2">🥇</div>
        <div className="text-xs text-text-dim font-mono mb-1">1º lugar</div>
        <div
          className="font-bold truncate text-2xl"
          style={{ color: player.color }}
        >
          {player.name}{isMe && " (você)"}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <SoloStat label="wpm" value={Math.round(player.wpm)} />
          <SoloStat label="precisão" value={`${Math.round(player.accuracy)}%`} />
          <SoloStat label="erros" value={player.errors} />
          <SoloStat label="tempo" value={time} />
        </div>
      </motion.div>
    </div>
  );
}

function SoloStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-bg-line/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-mono">
        {label}
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}

// Convite do loop viral: cada corrida terminada vira um link compartilhável (#22).
// Ação SECUNDÁRIA de propósito — "Jogar de novo" continua sendo o CTA primário.
function ShareButton({ me }: { me: Player }) {
  const toast = useToast();

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.push({ kind: "success", text: "Resultado copiado!" }))
      .catch(() => toast.push({ kind: "error", text: "Falha ao copiar" }));
  }

  function onShare() {
    // `window.location.origin` é a origem real do deploy; SITE.url depende de
    // NEXT_PUBLIC_SITE_URL estar setada no build e cai num domínio que não é o
    // de produção quando não está.
    const url = window.location.origin;
    const text = buildShareText(me, url);
    if (typeof navigator.share === "function") {
      navigator.share({ text, url }).catch((err: unknown) => {
        // Cancelar não é falhar: se o jogador fechou o sheet nativo ele disse
        // "não" — copiar assim mesmo seria hostil. Só caímos no clipboard
        // quando o compartilhamento realmente quebrou.
        if ((err as { name?: string } | null)?.name !== "AbortError") copyToClipboard(text);
      });
      return;
    }
    copyToClipboard(text);
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onShare}
      aria-label="Compartilhar meu resultado"
      className="btn-secondary px-6 py-3"
    >
      <Share2 className="size-4" />
      Compartilhar
    </motion.button>
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
