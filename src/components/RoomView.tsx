"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Users } from "lucide-react";
import { Logo } from "./Logo";
import { useToast } from "./ui/Toast";
import { Lobby } from "./Lobby";
import { Race } from "./Race";
import { Results } from "./Results";
import { Countdown } from "./Countdown";
import { MatrixRain } from "./MatrixRain";
import { useRoom } from "@/lib/useRoom";
import type { Player, RoomState } from "@/lib/types";
import type { LivePlayer, ResultRow } from "@/lib/room";

export function RoomView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const toast = useToast();

  const onError = useCallback((msg: string) => toast.push({ kind: "error", text: msg }), [toast]);
  const onLeave = useCallback(() => router.push("/"), [router]);

  const { phase, meId, room, players, isLeader, chat, countdownN, join, actions } = useRoom(
    roomCode,
    { onError, onLeave }
  );

  // Adapt the realtime state to the RoomState shape the views already expect.
  const compatRoom = useMemo<RoomState | null>(() => {
    if (!room) return null;
    const startedAt = room.start_at ? Date.parse(room.start_at) : null;

    const live: Player[] = players.map(p => liveToPlayer(p));
    const finalFromResults: Player[] | null =
      room.status === "finished" && room.results?.length
        ? room.results.map(r => resultToPlayer(r))
        : null;

    return {
      code: room.code,
      leaderId: room.leader_id,
      status: room.status,
      settings: {
        language: room.language,
        difficulty: room.difficulty,
        maxPlayers: room.max_players
      },
      snippet: room.snippet,
      players: finalFromResults ?? live,
      chat,
      startedAt,
      finishedAt: null
    };
  }, [room, players, chat]);

  // 1) Ask for a nick with an in-theme screen (no native prompt).
  if (phase === "need-name") {
    return <NameGate roomCode={roomCode} onJoin={join} onCancel={() => router.push("/")} />;
  }

  // 2) Connecting / joining.
  if (phase === "connecting" || !compatRoom || !meId) {
    return (
      <main className="min-h-screen grid place-items-center">
        <MatrixRain opacity={0.05} />
        <div className="text-center">
          <Logo size="md" />
          <p className="mt-4 text-text-muted text-sm font-mono">
            <span className="animate-pulse">conectando à sala {roomCode}...</span>
          </p>
        </div>
      </main>
    );
  }

  const showCountdown = compatRoom.status === "racing" && countdownN != null;
  const showRace = compatRoom.status === "racing" && countdownN == null;

  return (
    <main className="relative min-h-screen">
      <MatrixRain opacity={0.04} />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-bg-line bg-bg/50 backdrop-blur">
        <button onClick={() => router.push("/")} className="flex items-center gap-2" aria-label="Voltar para a home">
          <Logo size="sm" />
        </button>
        <RoomCodePill code={compatRoom.code} />
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6 py-6">
        {compatRoom.status === "lobby" && (
          <Lobby
            room={compatRoom}
            meId={meId}
            isLeader={isLeader}
            onUpdateSettings={actions.updateSettings}
            onStart={actions.startRace}
            onChat={actions.sendChat}
            onSetReady={actions.setReady}
            onKick={actions.kick}
          />
        )}

        {showCountdown && (
          <div className="grid place-items-center min-h-[60vh]">
            <Countdown n={countdownN ?? 3} />
          </div>
        )}

        {showRace && (
          <Race
            room={compatRoom}
            meId={meId}
            isLeader={isLeader}
            onProgress={actions.sendProgress}
            onAbandon={actions.abandon}
            onChat={actions.sendChat}
            onKick={actions.kick}
          />
        )}

        {compatRoom.status === "finished" && (
          <Results
            room={compatRoom}
            meId={meId}
            isLeader={isLeader}
            onPlayAgain={actions.resetToLobby}
            onChat={actions.sendChat}
          />
        )}
      </div>
    </main>
  );
}

function liveToPlayer(p: LivePlayer): Player {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    avatar: p.avatar ?? null,
    progress: p.progress,
    wpm: p.wpm,
    accuracy: p.accuracy,
    errors: p.errors,
    finishedAt: p.finishedAt,
    place: p.place,
    ready: p.ready,
    abandoned: p.abandoned
  };
}

function resultToPlayer(r: ResultRow): Player {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    progress: r.progress,
    wpm: r.wpm,
    accuracy: r.accuracy,
    errors: r.errors,
    finishedAt: r.finishedAt,
    place: r.place,
    ready: true,
    abandoned: false
  };
}

function NameGate({
  roomCode,
  onJoin,
  onCancel
}: {
  roomCode: string;
  onJoin: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <main className="relative min-h-screen grid place-items-center px-4">
      <MatrixRain opacity={0.06} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card neon-border w-full max-w-md p-6 md:p-8 relative z-10"
      >
        <div className="flex justify-center mb-5">
          <Logo size="md" />
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 chip border-neon-green/40 text-neon-green mb-3">
            <Users className="size-3" /> você foi convidado
          </div>
          <p className="text-text-muted text-sm">
            entre na sala{" "}
            <span className="text-neon-green font-bold tracking-[0.25em]">{roomCode}</span>{" "}
            e mostre quem digita mais rápido.
          </p>
        </div>

        <NameForm onJoin={onJoin} onCancel={onCancel} />
      </motion.div>
    </main>
  );
}

function NameForm({ onJoin, onCancel }: { onJoin: (name: string) => void; onCancel: () => void }) {
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem("nick") as HTMLInputElement);
        const val = input.value.trim();
        if (val) onJoin(val);
      }}
    >
      <label className="label" htmlFor="nick">
        escolha seu nick
      </label>
      <input
        id="nick"
        name="nick"
        autoFocus
        className="input mt-1.5 text-base"
        placeholder="Ex.: caio_dev"
        maxLength={20}
        defaultValue={typeof window !== "undefined" ? localStorage.getItem("coderacer:name") || "" : ""}
      />
      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
        <button type="submit" className="btn-primary justify-center py-3">
          <LogIn className="size-4" />
          Entrar na corrida
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost px-4">
          voltar
        </button>
      </div>
    </form>
  );
}

function RoomCodePill({ code }: { code: string }) {
  const toast = useToast();
  function copyLink() {
    const link = `${window.location.origin}/room/${code}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.push({ kind: "success", text: "Link copiado!" }))
      .catch(() => toast.push({ kind: "error", text: "Falha ao copiar" }));
  }
  return (
    <button
      onClick={copyLink}
      title="Copiar link da sala"
      className="chip border-neon-green/40 text-neon-green hover:bg-neon-green/10 transition px-3 py-1.5"
    >
      <span className="text-text-muted normal-case">sala</span>
      <span className="font-bold tracking-[0.25em] ml-1">{code}</span>
      <span className="ml-2 text-[10px] text-text-dim">copiar link</span>
    </button>
  );
}
