"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useToast } from "./ui/Toast";
import { Lobby } from "./Lobby";
import { Race } from "./Race";
import { Results } from "./Results";
import { Countdown } from "./Countdown";
import { getSocket } from "@/lib/socket-client";
import type { RoomState } from "@/lib/types";
import { MatrixRain } from "./MatrixRain";

export function RoomView({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const toast = useToast();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [joining, setJoining] = useState(true);

  // Connect + recover identity / join if needed
  useEffect(() => {
    let mounted = true;
    const socket = getSocket();

    const stored = sessionStorage.getItem(`coderacer:room:${roomCode}`);
    const parsed = stored ? JSON.parse(stored) : null;

    const onState = (state: RoomState) => {
      if (!mounted) return;
      setRoom(state);
    };
    const onCountdown = (n: number) => {
      if (!mounted) return;
      setCountdown(n);
      if (n < 0) setTimeout(() => setCountdown(null), 800);
    };

    socket.on("room:state", onState);
    socket.on("race:countdown", onCountdown);

    // Re-join logic: if we don't have a playerId yet, prompt for name and join.
    if (parsed?.playerId) {
      // Existing session — re-join with same name (server will assign new id, ok)
      const name =
        parsed?.name || localStorage.getItem("coderacer:name") || "anon";
      socket.emit("room:join", { name, code: roomCode }, (res: any) => {
        if (!mounted) return;
        if (!res?.ok) {
          toast.push({ kind: "error", text: res?.error || "Sala indisponível" });
          router.push("/");
          return;
        }
        setMeId(res.playerId);
        sessionStorage.setItem(
          `coderacer:room:${roomCode}`,
          JSON.stringify({ playerId: res.playerId, name })
        );
        setRoom(res.room);
        setJoining(false);
      });
    } else {
      // No session yet — ask for name in-line
      const fallback =
        localStorage.getItem("coderacer:name") ||
        window.prompt("Seu nick para entrar na sala:") ||
        "anon";
      socket.emit(
        "room:join",
        { name: fallback.slice(0, 20), code: roomCode },
        (res: any) => {
          if (!mounted) return;
          if (!res?.ok) {
            toast.push({ kind: "error", text: res?.error || "Erro ao entrar" });
            router.push("/");
            return;
          }
          localStorage.setItem("coderacer:name", fallback);
          sessionStorage.setItem(
            `coderacer:room:${roomCode}`,
            JSON.stringify({ playerId: res.playerId, name: fallback })
          );
          setMeId(res.playerId);
          setRoom(res.room);
          setJoining(false);
        }
      );
    }

    return () => {
      mounted = false;
      socket.off("room:state", onState);
      socket.off("race:countdown", onCountdown);
    };
  }, [roomCode, router, toast]);

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

  if (joining || !room || !meId) {
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
        <button onClick={() => router.push("/")} className="flex items-center gap-2">
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
