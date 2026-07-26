"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import type { ChatMessage, Player } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Chat({
  messages,
  players,
  meId,
  onSend
}: {
  messages: ChatMessage[];
  players: Player[];
  meId: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [messages.length]);

  const colorOf = (id: string) =>
    players.find(p => p.id === id)?.color ?? "#7d8590";

  return (
    <div className="card flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-line">
        <span className="label">// chat</span>
        <span className="text-[10px] text-text-dim">{messages.length} msgs</span>
      </div>
      {/* Altura limitada + rolagem interna (issue #70): sem um teto, o chat cresce
          com as mensagens e empurra o resto da página. No desktop (lg) o `<aside>`
          já limita a altura, então soltamos o teto e deixamos o flex preencher;
          abaixo de lg (layout empilhado, sem esse limite) o `max-h-[45vh]` mantém
          o painel estável e rola por dentro. `min-h-0` garante o scroll no flex. */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 max-h-[45vh] lg:max-h-none overflow-y-auto px-3 py-2 space-y-1.5 text-sm"
      >
        <AnimatePresence initial={false}>
          {messages.map(m => {
            const isSystem = m.system || m.playerId === "system";
            const mine = m.playerId === meId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "leading-snug",
                  isSystem && "text-text-dim italic text-xs"
                )}
              >
                {isSystem ? (
                  <span>// {m.text}</span>
                ) : (
                  <span>
                    <span
                      className="font-semibold"
                      style={{ color: colorOf(m.playerId) }}
                    >
                      {m.name}
                      {mine && " (você)"}
                    </span>
                    <span className="text-text-muted"> › </span>
                    <span className="text-text">{m.text}</span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <form
        className="flex items-center gap-2 border-t border-bg-line p-2"
        onSubmit={e => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          onSend(trimmed);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="// digite uma msg..."
          maxLength={200}
          className="input"
        />
        <button type="submit" className="btn-primary px-3 py-2">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
