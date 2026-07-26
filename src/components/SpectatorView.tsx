"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eye } from "lucide-react";
import type { RoomState } from "@/lib/types";
import { RaceTrack } from "./RaceTrack";
import { FloatingChat } from "./FloatingChat";

// Tela de quem entrou com a corrida já em andamento (#64). Não recebe editor —
// então nunca envia `progress`, nunca entra nos finishers e nunca prende a sala.
// Vê a pista ao vivo dos participantes e conversa no chat; entra na próxima rodada.
export function SpectatorView({
  room,
  meId,
  onChat
}: {
  room: RoomState;
  meId: string;
  onChat: (text: string) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card neon-border p-4 md:p-5 flex items-start gap-3"
        role="status"
      >
        <span className="mt-0.5 text-neon-cyan">
          <Eye className="size-5" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏁</span>
            <span className="font-bold gradient-text">Partida em andamento</span>
          </div>
          <p className="text-sm text-text mt-1 font-mono">Você entrou como espectador.</p>
          <p className="text-xs text-text-muted mt-1 font-mono">
            // assim que esta rodada terminar você participa automaticamente da próxima
          </p>
        </div>
      </motion.div>

      <RaceTrack players={room.players} meId={meId} />

      <FloatingChat messages={room.chat} players={room.players} meId={meId} onSend={onChat} />
    </div>
  );
}
