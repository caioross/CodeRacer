"use client";

import type { RoomState } from "@/lib/types";
import { RaceTrack } from "./RaceTrack";
import { FloatingChat } from "./FloatingChat";
import { TypingCore } from "./TypingCore";

// Corrida multiplayer = núcleo de digitação (TypingCore, extraído na issue #25)
// composto com a pista (RaceTrack) e o chat — que só existem com sala/Realtime.
export function Race({
  room,
  meId,
  onProgress,
  onAbandon,
  onChat
}: {
  room: RoomState;
  meId: string;
  onProgress: (progress: number, wpm: number, accuracy: number, errors: number) => void;
  onAbandon: () => void;
  onChat: (text: string) => void;
}) {
  const snippet = room.snippet!;
  const startedAt = room.startedAt!;
  const me = room.players.find(p => p.id === meId);
  const myFinishedAt = me?.finishedAt ?? null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* track */}
      <RaceTrack players={room.players} meId={meId} />

      {/* code + input + personal stats */}
      <TypingCore
        code={snippet.code}
        language={snippet.language}
        startedAt={startedAt}
        finishedAt={myFinishedAt}
        onProgress={onProgress}
        heartbeat
        onAbandon={onAbandon}
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
