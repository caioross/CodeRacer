"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Users } from "lucide-react";
import { Logo } from "./Logo";
import { useToast } from "./ui/Toast";
import { Lobby } from "./Lobby";
import { Race } from "./Race";
import { Results } from "./Results";
import { Countdown } from "./Countdown";
import { getSocket } from "@/lib/socket-client";
import type { RoomState } from "@/lib/types";
import { MatrixRain } from "./MatrixRain";

type Phase = "connecting" | "need-name" | "ready";

export function RoomView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const toast = useToast();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");

  const mountedRef = useRef(true);

  // Join the room with a given nick. Stable enough to call from the effect
  // (via ref) and from the name gate.
  const doJoin = useCallback(
    (rawName: string) => {
      const name = (rawName || "anon").slice(0, 20);
      const socket = getSocket();
      setPhase("connecting");
      socket.emit("room:join", { name, code: roomCode }, (res: any) => {
        if (!mountedRef.current) return;
        if (!res?.ok) {
          toast.push({ kind: "error", text: res?.error || "Sala indisponível" });
          router.push("/");
          return;
        }
        try {
          localStorage.setItem("coderacer:name", name);
          sessionStorage.setItem(
            `coderacer:room:${roomCode}`,
            JSON.stringify({ playerId: res.playerId, name })
          );
        } catch {}
        setMeId(res.playerId);
        setRoom(res.room);
        setPhase("ready");
      });
    },
    [roomCode, router, toast]
  );

  // Keep a ref to the latest doJoin so the connect effect runs only on roomCode.
  const doJoinRef = useRef(doJoin);
  doJoinRef.current = doJoin;

  // Connect + recover identity / decide whether to auto-join or ask for a nick.
  useEffect(() => {
    mountedRef.current = true;
    const socket = getSocket();

    const onState = (state: RoomState) => {
      if (mountedRef.current) setRoom(state);
    };
    const onCountdown = (n: number) => {
      if (!mountedRef.current) return;
      setCountdown(n);
      if (n < 0) setTimeout(() => setCountdown(null), 800);
    };

    socket.on("room:state", onState);
    socket.on("race:countdown", onCountdown);

    let knownName: string | null = null;
    try {
      const stored = sessionStorage.getItem(`coderacer:room:${roomCode}`);
      const parsed = stored ? JSON.parse(stored) : null;
      knownName = parsed?.name || localStorage.getItem("coderacer:name");
    } catch {}

    if (knownName) {
      doJoinRef.current(knownName);
    } else {
      // No saved nick — show the styled gate instead of a native prompt().
      setPhase("need-name");
    }

    return () => {
      mountedRef.current = false;
      socket.off("room:state", onState);
      socket.off("race:countdown", onCountdown);
    };
  }, [roomCode]);

  const sendChat = useCallback((text: string) => {
    getSocket().emit("chat:send", { text });
  }, []);

  const updateSettings = useCallback(
    (settings: Partial<RoomState["settings"]>) => {
      getSocket().emit("room:updateSettings", { settings }, (res: any) => {
        if (!res?.ok) toast.push({ kind: "error", text: res?.error || "Erro" });
      });
    },
    [toast]
  );

  const startRace = useCallback(() => {
    getSocket().emit("race:start", null, (res: any) => {
      if (!res?.ok) toast.push({ kind: "error", text: res?.error || "Erro" });
    });
  }, [toast]);

  const sendProgress = useCallback(
    (progress: number, wpm: number, accuracy: number, errors: number) => {
      getSocket().emit("race:progress", { progress, wpm, accuracy, errors });
    },
    []
  );

  const abandon = useCallback(() => {
    getSocket().emit("race:abandon");
  }, []);

  const resetToLobby = useCallback(() => {
    getSocket().emit("race:reset", null, (res: any) => {
      if (!res?.ok) toast.push({ kind: "error", text: res?.error || "Erro" });
    });
  }, [toast]);

  // 1) Ask for a nick with an in-theme screen (replaces window.prompt).
  if (phase === "need-name") {
    return <NameGate roomCode={roomCode} onJoin={doJoin} onCancel={() => router.push("/")} />;
  }

  // 2) Connecting / joining.
  if (phase === "connecting" || !room || !meId) {
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

  const isLeader = room.leaderId === meId;

  return (
    <main className="relative min-h-screen">
      <MatrixRain opacity={0.04} />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-bg-line bg-bg/50 backdrop-blur">
        <button onClick={() => router.push("/")} className="flex items-center gap-2" aria-label="Voltar para a home">
          <Logo size="sm" />
        </button>
        <RoomCodePill code={room.code} />
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-6 py-6">
        {room.status === "lobby" && (
          <Lobby
            room={room}
            meId={meId}
            isLeader={isLeader}
            onUpdateSettings={updateSettings}
            onStart={startRace}
            onChat={sendChat}
          />
        )}

        {room.status === "countdown" && (
          <div className="grid place-items-center min-h-[60vh]">
            <Countdown n={countdown ?? 3} />
          </div>
        )}

        {room.status === "racing" && (
          <Race
            room={room}
            meId={meId}
            onProgress={sendProgress}
            onAbandon={abandon}
            onChat={sendChat}
          />
        )}

        {room.status === "finished" && (
          <Results
            room={room}
            meId={meId}
            isLeader={isLeader}
            onPlayAgain={resetToLobby}
            onChat={sendChat}
          />
        )}
      </div>
    </main>
  );
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
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onJoin(name.trim());
  }

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

        <label className="label" htmlFor="nick">
          escolha seu nick
        </label>
        <input
          id="nick"
          autoFocus
          className="input mt-1.5 text-base"
          placeholder="Ex.: caio_dev"
          maxLength={20}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
        />

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
          <button onClick={submit} disabled={!name.trim()} className="btn-primary justify-center py-3">
            <LogIn className="size-4" />
            Entrar na corrida
          </button>
          <button onClick={onCancel} className="btn-ghost px-4">
            voltar
          </button>
        </div>
      </motion.div>
    </main>
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
