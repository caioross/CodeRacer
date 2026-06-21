"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import type { ChatMessage, Player } from "@/lib/types";

// During a race the chat isn't a panel — messages pop in on the right as little
// colored tags (each in its sender's color) that float up and fade away.
const TTL_MS = 6500;

export function FloatingChat({
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
  const [active, setActive] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const seen = useRef<Set<string>>(new Set());
  const mounted = useRef(false);

  const colorOf = (id: string) => players.find(p => p.id === id)?.color ?? "#7d8590";

  useEffect(() => {
    const fresh = messages.filter(m => !seen.current.has(m.id));
    fresh.forEach(m => seen.current.add(m.id));
    // Don't replay history on mount — only float messages that arrive live.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!fresh.length) return;
    setActive(a => [...a, ...fresh]);
    for (const m of fresh) {
      const id = m.id;
      setTimeout(() => setActive(a => a.filter(x => x.id !== id)), TTL_MS);
    }
  }, [messages]);

  return (
    <div className="pointer-events-none fixed right-3 top-24 bottom-20 z-30 hidden w-72 max-w-[70vw] flex-col items-end justify-end gap-2 md:flex">
      <div className="flex flex-col items-end gap-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {active.map(m => {
            const isSystem = m.system || m.playerId === "system";
            const color = colorOf(m.playerId);
            const mine = m.playerId === meId;
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, x: 50, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: -36, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="max-w-full"
              >
                {isSystem ? (
                  <span className="inline-block rounded-full border border-bg-line bg-bg-card/80 px-3 py-1 text-[11px] font-mono italic text-text-dim backdrop-blur">
                    // {m.text}
                  </span>
                ) : (
                  <span
                    className="inline-block rounded-2xl border bg-bg-card/85 px-3 py-1.5 text-xs backdrop-blur"
                    style={{ borderColor: `${color}66`, boxShadow: `0 0 14px ${color}22` }}
                  >
                    <span className="font-bold" style={{ color }}>
                      {m.name}
                      {mine && " (você)"}
                    </span>
                    <span className="text-text-muted"> › </span>
                    <span className="text-text [overflow-wrap:anywhere]">{m.text}</span>
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <form
        className="pointer-events-auto flex w-full items-center gap-1.5"
        onSubmit={e => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          onSend(t);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="// provoca a galera..."
          maxLength={200}
          className="input bg-bg-card/70 py-1.5 text-xs backdrop-blur"
        />
        <button type="submit" className="btn-primary px-2.5 py-1.5" aria-label="Enviar mensagem">
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  );
}
