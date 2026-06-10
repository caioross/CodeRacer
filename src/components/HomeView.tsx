"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, LogIn, Zap, Users, Trophy, Code2 } from "lucide-react";
import { Logo } from "./Logo";
import { MatrixRain } from "./MatrixRain";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/Toast";
import { LANGUAGES, DIFFICULTIES, type LangId, type Difficulty } from "@/lib/languages";
import { getSocket } from "@/lib/socket-client";
import type { RoomState } from "@/lib/types";

const PERSIST_NAME_KEY = "coderacer:name";

export function HomeView() {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [language, setLanguage] = useState<LangId>("javascript");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [loading, setLoading] = useState(false);

  // Persist player name locally so they don't have to retype
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PERSIST_NAME_KEY) : null;
    if (saved) setName(saved);
  }, []);

  function persistAndGo(playerId: string, code: string, room: RoomState) {
    try {
      localStorage.setItem(PERSIST_NAME_KEY, name.trim() || "anon");
      sessionStorage.setItem(
        `coderacer:room:${code}`,
        JSON.stringify({ playerId, name: name.trim() || "anon" })
      );
    } catch {}
    router.push(`/room/${code}`);
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.push({ kind: "error", text: "Coloca um nome aí, fera" });
      return;
    }
    setLoading(true);
    const socket = getSocket();
    socket.emit(
      "room:create",
      { name: name.trim(), settings: { language, difficulty, maxPlayers } },
      (res: any) => {
        setLoading(false);
        if (!res?.ok) {
          toast.push({ kind: "error", text: res?.error || "Erro ao criar sala" });
          return;
        }
        setCreateOpen(false);
        persistAndGo(res.playerId, res.code, res.room);
      }
    );
  }

  function handleJoin() {
    if (!name.trim()) {
      toast.push({ kind: "error", text: "Coloca um nome aí, fera" });
      return;
    }
    if (!joinCode.trim()) {
      toast.push({ kind: "error", text: "Cola o código da sala" });
      return;
    }
    setLoading(true);
    const socket = getSocket();
    socket.emit(
      "room:join",
      { name: name.trim(), code: joinCode.trim().toUpperCase() },
      (res: any) => {
        setLoading(false);
        if (!res?.ok) {
          toast.push({ kind: "error", text: res?.error || "Erro ao entrar" });
          return;
        }
        persistAndGo(res.playerId, res.code, res.room);
      }
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <MatrixRain opacity={0.06} />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-neon-amber transition-colors"
          >
            <Trophy className="size-3.5" /> ranking
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
            <span className="size-1.5 rounded-full bg-neon-green shadow-glow animate-pulse" />
            <span>online</span>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-10 md:pt-16">
        {/* hero */}
        <div className="text-center mb-12 md:mb-16">
          {/* Real, single H1 for SEO — visually replaced by the animated logo. */}
          <h1 className="sr-only">
            CodeRacer — corrida de digitação multiplayer para programadores. Digite código
            mais rápido que seus amigos, sem cadastro.
          </h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            aria-hidden="true"
          >
            <Logo size="xl" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-text-muted text-base md:text-lg max-w-2xl mx-auto text-balance"
          >
            <span className="text-neon-green">// </span>
            Crie uma sala, manda o link pros amigos e quem digita o código mais rápido leva.
            Sem cadastro, sem firula.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-5 inline-flex items-center gap-3 text-xs text-text-dim font-mono"
          >
            <span className="chip border-neon-green/30 text-neon-green">
              <Zap className="size-3" /> tempo real
            </span>
            <span className="chip border-neon-cyan/30 text-neon-cyan">
              <Users className="size-3" /> multiplayer
            </span>
            <span className="chip border-neon-violet/30 text-neon-violet">
              <Code2 className="size-3" /> 8 linguagens
            </span>
          </motion.div>
        </div>

        {/* main panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6 md:p-8 neon-border max-w-2xl mx-auto"
        >
          <div className="mb-5">
            <label className="label" htmlFor="player_name">player_name</label>
            <input
              id="player_name"
              className="input mt-1.5 text-base"
              placeholder="Ex.: caio_dev"
              aria-label="Seu nick de jogador"
              maxLength={20}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && setCreateOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setCreateOpen(true)}
              disabled={loading}
              className="btn-primary justify-center py-3 text-base"
            >
              <Plus className="size-4" />
              Criar sala
            </button>

            <div className="flex gap-2">
              <input
                className="input uppercase tracking-[0.3em] text-center"
                placeholder="CÓDIGO"
                aria-label="Código de 6 letras da sala"
                maxLength={6}
                value={joinCode}
                onChange={e =>
                  setJoinCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
                }
                onKeyDown={e => e.key === "Enter" && handleJoin()}
              />
              <button
                onClick={handleJoin}
                disabled={loading}
                className="btn-secondary px-4"
                aria-label="Entrar na sala com o código"
              >
                <LogIn className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* features strip */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Feature
            icon={<Code2 className="size-4 text-neon-green" />}
            title="snippets reais"
            text="Trechos de código de verdade, não 'O rato roeu...'. Cada partida sorteia um."
          />
          <Feature
            icon={<Users className="size-4 text-neon-cyan" />}
            title="até 12 jogadores"
            text="Compartilhe o código de 6 letras ou o link da sala — gente entra na hora."
          />
          <Feature
            icon={<Trophy className="size-4 text-neon-violet" />}
            title="WPM + precisão"
            text="Posição em tempo real no topo, estatísticas no final. Pódio com ouro/prata/bronze."
          />
        </div>

        <footer className="mt-16 mb-6 text-center text-xs text-text-dim font-mono">
          <span className="terminal-prompt">made with caffeine ☕ &amp; segfaults</span>
        </footer>
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="// configurar sala"
        footer={
          <>
            <button
              className="btn-ghost"
              onClick={() => setCreateOpen(false)}
              disabled={loading}
            >
              cancelar
            </button>
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? "criando..." : "criar sala →"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">linguagem</label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLanguage(l.id)}
                  className={
                    "rounded-md border px-2 py-2 text-xs font-mono transition-all " +
                    (language === l.id
                      ? "border-neon-green text-neon-green bg-neon-green/10 shadow-glow"
                      : "border-bg-line text-text-muted hover:text-text hover:border-text-dim")
                  }
                  title={l.label}
                >
                  <div className="font-bold">{l.icon}</div>
                  <div className="text-[10px] mt-0.5">{l.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">dificuldade</label>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={
                    "rounded-md border px-3 py-2 text-xs font-mono transition-all text-left " +
                    (difficulty === d.id
                      ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10 shadow-glow-cyan"
                      : "border-bg-line text-text-muted hover:text-text hover:border-text-dim")
                  }
                >
                  <div className="font-bold">{d.label}</div>
                  <div className="text-[10px] mt-0.5 text-text-dim normal-case">
                    {d.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">jogadores máx ({maxPlayers})</label>
            <input
              type="range"
              min={2}
              max={12}
              value={maxPlayers}
              onChange={e => setMaxPlayers(Number(e.target.value))}
              className="w-full mt-2 accent-[#00ff88]"
            />
            <div className="flex justify-between text-[10px] text-text-dim font-mono mt-1">
              <span>2</span>
              <span>12</span>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}

function Feature({
  icon,
  title,
  text
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="card p-4 hover:border-neon-green/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="label">{title}</span>
      </div>
      <p className="text-text-muted text-xs leading-relaxed">{text}</p>
    </div>
  );
}
