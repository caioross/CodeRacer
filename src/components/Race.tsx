"use client";

import { useEffect } from "react";
import type { RoomState } from "@/lib/types";
import { playGo } from "@/lib/sound";
import { RaceTrack } from "./RaceTrack";
import { FloatingChat } from "./FloatingChat";
import { TypingCore } from "./TypingCore";

// Corrida multiplayer = núcleo de digitação (TypingCore, extraído na issue #25)
// composto com a pista (RaceTrack) e o chat — que só existem com sala/Realtime.
export function Race({
  room,
  meId,
  isLeader = false,
  onProgress,
  onAbandon,
  onChat,
  onKick
}: {
  room: RoomState;
  meId: string;
  isLeader?: boolean;
  onProgress: (progress: number, wpm: number, accuracy: number, errors: number) => void;
  onAbandon: () => void;
  onChat: (text: string) => void;
  onKick?: (targetId: string) => void;
}) {
  const snippet = room.snippet!;
  const startedAt = room.startedAt!;
  const me = room.players.find(p => p.id === meId);
  const myFinishedAt = me?.finishedAt ?? null;

  // "GO!" sonoro quando a pista aparece logo após a contagem (não ao reconectar no meio).
  useEffect(() => {
    if (Date.now() - startedAt < 2500) playGo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* track */}
      <RaceTrack
        players={room.players}
        meId={meId}
        leaderId={room.leaderId}
        onKick={isLeader ? onKick : undefined}
      />

      {/* code + input + personal stats */}
      <TypingCore
        code={snippet.code}
        language={snippet.language}
        startedAt={startedAt}
        finishedAt={myFinishedAt}
        onProgress={onProgress}
        heartbeat
        onAbandon={onAbandon}
        idleForfeit
      />

      <FloatingChat
        messages={room.chat}
        players={room.players}
        meId={meId}
        onSend={onChat}
      />
    </div>
  );
}
