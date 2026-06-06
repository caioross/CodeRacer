"use client";

import { motion } from "framer-motion";
import { Crown, Play, Settings as SettingsIcon, Share2, Users } from "lucide-react";
import type { RoomState } from "@/lib/types";
import { LANGUAGES, DIFFICULTIES, type Difficulty, type LangId } from "@/lib/languages";
import { Chat } from "./Chat";
import { PlayerList } from "./PlayerList";
import { useToast } from "./ui/Toast";

export function Lobby({
  room,
  meId,
  isLeader,
  onUpdateSettings,
  onStart,
  onChat
}: {
  room: RoomState;
  meId: string;
  isLeader: boolean;
  onUpdateSettings: (s: Partial<RoomState["settings"]>) => void;
  onStart: () => void;
  onChat: (text: string) => void;
}) {
  const toast = useToast();

  function copyLink() {
    const link = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.push({ kind: "success", text: "Link copiado!" }))
      .catch(() => toast.push({ kind: "error", text: "Falha ao copiar" }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        {/* welcome card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                <span className="text-neon-green">// </span>lobby
                <span className="text-text-dim text-base ml-2">
                  {room.players.length}/{room.settings.maxPlayers} jogadores
                </span>
              </h1>
              <p className="text-text-muted text-sm mt-1">
                {isLeader ? (
                  <>
                    Você é o <span className="text-neon-amber">líder</span>. Configure
                    a partida e clique em iniciar quando estiver pronto.
                  </>
                ) : (
                  <>Aguardando o líder iniciar a partida...</>
                )}
              </p>
            </div>
            <button onClick={copyLink} className="btn-secondary">
              <Share2 className="size-4" />
              Compartilhar
            </button>
          </div>
        </motion.div>

        {/* settings */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="size-4 text-text-muted" />
            <span className="label">configurações</span>
            {!isLeader && (
              <span className="text-[10px] text-text-dim ml-2">
                (somente o líder edita)
              </span>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className="label">linguagem</label>
              <div className="mt-2 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {LANGUAGES.map(l => {
                  const active = room.settings.language === l.id;
                  return (
                    <button
                      key={l.id}
                      disabled={!isLeader}
                      onClick={() => onUpdateSettings({ language: l.id as LangId })}
                      className={
                        "rounded-md border px-2 py-2 text-xs font-mono transition-all " +
                        (active
                          ? "border-neon-green text-neon-green bg-neon-green/10 shadow-glow"
                          : "border-bg-line text-text-muted hover:text-text hover:border-text-dim disabled:hover:border-bg-line disabled:hover:text-text-muted")
                      }
                      title={l.label}
                    >
                      <div className="font-bold">{l.icon}</div>
                      <div className="text-[10px] mt-0.5">{l.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">dificuldade</label>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map(d => {
                  const active = room.settings.difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      disabled={!isLeader}
                      onClick={() =>
                        onUpdateSettings({ difficulty: d.id as Difficulty })
                      }
                      className={
                        "rounded-md border px-3 py-2 text-xs font-mono transition-all text-left " +
                        (active
                          ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-glow-cyan"
                          : "border-bg-line text-text-muted hover:text-text hover:border-text-dim disabled:hover:border-bg-line disabled:hover:text-text-muted")
                      }
                    >
                      <div className="font-bold">{d.label}</div>
                      <div className="text-[10px] mt-0.5 text-text-dim normal-case">
                        {d.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">
                jogadores máx ({room.settings.maxPlayers})
              </label>
              <input
                type="range"
                min={2}
                max={12}
                disabled={!isLeader}
                value={room.settings.maxPlayers}
                onChange={e =>
                  onUpdateSettings({ maxPlayers: Number(e.target.value) })
                }
                className="w-full mt-2 accent-[#00ff88] disabled:opacity-60"
              />
            </div>
          </div>

          {isLeader && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onStart}
              className="btn-primary w-full mt-6 py-3 text-base"
            >
              <Play className="size-4" /> Iniciar partida
            </motion.button>
          )}
        </motion.div>

        {/* players grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4 text-text-muted" />
            <span className="label">na sala</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {room.players.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card p-3 flex items-center gap-2"
                style={{ borderColor: `${p.color}40` }}
              >
                <div
                  className="size-8 rounded-md grid place-items-center font-bold text-xs"
                  style={{
                    background: `${p.color}20`,
                    color: p.color,
                    boxShadow: `0 0 12px ${p.color}40`
                  }}
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium" style={{ color: p.color }}>
                    {p.name}
                    {p.id === meId && <span className="text-text-dim ml-1 text-xs">(você)</span>}
                  </div>
                  <div className="text-[10px] text-text-dim flex items-center gap-1">
                    {p.id === room.leaderId && (
                      <>
                        <Crown className="size-2.5 text-neon-amber" /> líder
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-100px)] flex flex-col">
        <PlayerList players={room.players} leaderId={room.leaderId} meId={meId} />
        <div className="flex-1 min-h-[300px]">
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
