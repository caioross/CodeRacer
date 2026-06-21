"use client";

import { motion } from "framer-motion";
import { Check, Crown, Play, Settings as SettingsIcon, Share2, Users, X } from "lucide-react";
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
  onChat,
  onSetReady,
  onKick
}: {
  room: RoomState;
  meId: string;
  isLeader: boolean;
  onUpdateSettings: (s: Partial<RoomState["settings"]>) => void;
  onStart: () => void;
  onChat: (text: string) => void;
  onSetReady: (ready: boolean) => void;
  onKick: (id: string) => void;
}) {
  const toast = useToast();

  const me = room.players.find(p => p.id === meId);
  const myReady = !!me?.ready;
  // Everyone except the leader must be ready before the leader can start.
  const others = room.players.filter(p => p.id !== room.leaderId);
  const readyCount = others.filter(p => p.ready).length;
  const allReady = others.length === 0 || others.every(p => p.ready);

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
                    a partida — você só inicia quando todos marcarem{" "}
                    <span className="text-neon-green">pronto</span>.
                  </>
                ) : (
                  <>
                    Marque que você está <span className="text-neon-green">pronto</span> — o
                    líder começa quando todos estiverem.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isLeader && (
                <button
                  onClick={() => onSetReady(!myReady)}
                  className={myReady ? "btn-primary" : "btn-secondary"}
                  aria-pressed={myReady}
                >
                  {myReady ? (
                    <>
                      <Check className="size-4" /> pronto
                    </>
                  ) : (
                    "marcar como pronto"
                  )}
                </button>
              )}
              <button onClick={copyLink} className="btn-secondary">
                <Share2 className="size-4" />
                Compartilhar
              </button>
            </div>
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
            <div className="mt-6">
              <motion.button
                whileHover={allReady ? { scale: 1.01 } : undefined}
                whileTap={allReady ? { scale: 0.99 } : undefined}
                onClick={onStart}
                disabled={!allReady}
                className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="size-4" /> Iniciar partida
              </motion.button>
              <p className="mt-2 text-center text-[11px] font-mono text-text-dim">
                {others.length === 0
                  ? "// sem outros jogadores — inicie quando quiser"
                  : allReady
                  ? "// todos prontos! manda ver 🚀"
                  : `// prontos: ${readyCount}/${others.length} — aguardando todos marcarem pronto`}
              </p>
            </div>
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
                className="card p-3 flex items-center gap-2 relative group"
                style={{ borderColor: `${p.color}40` }}
              >
                {isLeader && p.id !== meId && p.id !== room.leaderId && (
                  <button
                    onClick={() => onKick(p.id)}
                    title={`Remover ${p.name} da sala`}
                    aria-label={`Remover ${p.name} da sala`}
                    className="absolute -top-2 -right-2 z-10 grid size-5 place-items-center rounded-full border border-neon-red/40 bg-bg-card text-neon-red opacity-0 transition hover:bg-neon-red/15 group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                )}
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-8 rounded-md object-cover"
                    style={{ boxShadow: `0 0 12px ${p.color}40` }}
                  />
                ) : (
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
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium" style={{ color: p.color }}>
                    {p.name}
                    {p.id === meId && <span className="text-text-dim ml-1 text-xs">(você)</span>}
                  </div>
                  <div className="text-[10px] flex items-center gap-1">
                    {p.id === room.leaderId ? (
                      <span className="inline-flex items-center gap-1 text-neon-amber">
                        <Crown className="size-2.5" /> líder
                      </span>
                    ) : p.ready ? (
                      <span className="inline-flex items-center gap-1 text-neon-green">
                        <Check className="size-2.5" /> pronto
                      </span>
                    ) : (
                      <span className="text-text-dim">aguardando...</span>
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
