"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, LogIn, Zap, Users, Trophy, Code2, Dumbbell, Github, Globe, Lock, RefreshCw } from "lucide-react";
import { fadeUp, ease, dur } from "@/lib/motion";
import { Logo } from "./Logo";
import { AuroraBackground } from "./effects/AuroraBackground";
import { MatrixRain } from "./MatrixRain";
import { ClickSpark } from "./effects/ClickSpark";
import { TypingDemo } from "./effects/TypingDemo";
import { Modal } from "./ui/Modal";
import { SpotlightCard } from "./ui/SpotlightCard";
import { StarBorder } from "./ui/StarBorder";
import { useToast } from "./ui/Toast";
import { LANGUAGES, DIFFICULTIES, langById, type LangId, type Difficulty } from "@/lib/languages";
import { newPlayerId, ABSOLUTE_MAX_PLAYERS } from "@/lib/room";
import { useAuth } from "@/lib/useAuth";

const PERSIST_NAME_KEY = "coderacer:name";
// Última dificuldade usada. Ausência = primeira sala do jogador → nasce no Fácil (§0.3).
const PERSIST_DIFFICULTY_KEY = "coderacer:difficulty";
const isDifficulty = (v: unknown): v is Difficulty =>
  v === "easy" || v === "medium" || v === "hard";

type PublicRoom = {
  code: string;
  language: string;
  difficulty: string;
  max_players: number;
  created_at: string;
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}

export function HomeView() {
  const router = useRouter();
  const toast = useToast();
  const auth = useAuth();

  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [language, setLanguage] = useState<LangId>("javascript");
  // Primeira sala nasce no Fácil; jogadores que já criaram salas recuperam o last-used abaixo.
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Persist player name locally so they don't have to retype
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PERSIST_NAME_KEY) : null;
    if (saved) setName(saved);
  }, []);

  // Recupera a última dificuldade escolhida (quem já criou salas mantém sua preferência).
  // Sem registro válido → mantém o padrão "easy" já definido no estado inicial.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(PERSIST_DIFFICULTY_KEY) : null;
    if (isDifficulty(saved)) setDifficulty(saved);
  }, []);

  // When signed in with Google, default the nick to that name.
  useEffect(() => {
    if (auth.user?.name) setName(auth.user.name);
  }, [auth.user]);

  // Load the public-rooms browser (and let the refresh button re-run it).
  const loadPublicRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setPublicRooms(json?.ok ? (json.rooms as PublicRoom[]) : []);
    } catch {
      setPublicRooms([]);
    }
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    loadPublicRooms();
  }, [loadPublicRooms]);

  function persistAndGo(playerId: string, code: string) {
    const nm = name.trim() || "anon";
    try {
      localStorage.setItem(PERSIST_NAME_KEY, nm);
      sessionStorage.setItem(`coderacer:room:${code}`, JSON.stringify({ playerId, name: nm }));
    } catch {}
    router.push(`/room/${code}`);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.push({ kind: "error", text: "Coloca um nome aí, fera" });
      return;
    }
    setLoading(true);
    const playerId = newPlayerId();
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          settings: { language, difficulty, maxPlayers },
          playerId,
          isPublic
        })
      });
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      if (!json?.ok) {
        toast.push({ kind: "error", text: json?.error || "Erro ao criar sala" });
        return;
      }
      // Lembra a dificuldade usada para as próximas salas deste jogador (last-used).
      try {
        localStorage.setItem(PERSIST_DIFFICULTY_KEY, difficulty);
      } catch {}
      setCreateOpen(false);
      persistAndGo(playerId, json.code);
    } catch {
      setLoading(false);
      toast.push({ kind: "error", text: "Sem conexão com o servidor" });
    }
  }

  async function joinByCode(rawCode: string) {
    if (!name.trim()) {
      toast.push({ kind: "error", text: "Coloca um nome aí, fera" });
      return;
    }
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      toast.push({ kind: "error", text: "Cola o código da sala" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      if (!json?.ok) {
        toast.push({ kind: "error", text: json?.error || "Sala não encontrada" });
        return;
      }
      if (json.room?.status === "racing") {
        toast.push({ kind: "error", text: "Partida em andamento, aguarda terminar" });
        return;
      }
      persistAndGo(newPlayerId(), code);
    } catch {
      setLoading(false);
      toast.push({ kind: "error", text: "Sem conexão com o servidor" });
    }
  }

  const handleJoin = () => joinByCode(joinCode);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <MatrixRain opacity={0.04} />
      <ClickSpark />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Logo size="sm" />
        <div className="flex items-center gap-3 md:gap-4">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-neon-amber transition-colors"
          >
            <Trophy className="size-3.5" /> ranking
          </Link>

          {auth.available &&
            (auth.user ? (
              <div className="flex items-center gap-2">
                {auth.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={auth.user.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-6 rounded-full border border-bg-line"
                  />
                ) : (
                  <span className="size-6 rounded-full bg-neon-green/20 text-neon-green grid place-items-center text-[10px] font-bold">
                    {auth.user.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline text-xs font-mono text-text-muted max-w-[110px] truncate">
                  {auth.user.name}
                </span>
                <button
                  onClick={auth.signOut}
                  className="text-[10px] font-mono text-text-dim hover:text-neon-red transition-colors"
                >
                  sair
                </button>
              </div>
            ) : (
              // O hero promete "sem cadastro, sem firula"; sem esta pista o botão
              // de login lê como requisito e trava o visitante na entrada
              // (persona Iniciante, D#14 → issue #17). Entrar só pré-preenche o nick.
              <div className="flex items-center gap-2">
                <button
                  onClick={auth.signInWithGoogle}
                  title="Opcional — entrar só pré-preenche seu nick. Dá para jogar sem conta."
                  aria-label="Entrar com Google (opcional — dá para jogar sem conta)"
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  <GoogleIcon /> entrar com Google
                </button>
                {/* Redundante para leitor de tela (já está no aria-label do botão). */}
                <span
                  aria-hidden="true"
                  className="hidden sm:inline text-[10px] font-mono text-text-dim"
                >
                  opcional
                </span>
              </div>
            ))}

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-text-muted">
            <span className="size-1.5 rounded-full bg-neon-green shadow-glow animate-pulse" />
            <span>online</span>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-8 md:pt-14">
        {/* hero */}
        <div className="text-center mb-10 md:mb-12">
          {/* Real, single H1 for SEO — visually replaced by the animated logo. */}
          <h1 className="sr-only">
            CodeRacer — corrida de digitação para programadores: treine sozinho ou jogue
            multiplayer com amigos, digitando código mais rápido, sem cadastro.
          </h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.slower, ease: ease.outExpo }}
            aria-hidden="true"
          >
            <div className="inline-block animate-cr-float">
              <Logo size="xl" decrypt />
            </div>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: dur.slow, ease: ease.outExpo }}
            className="mt-6 text-text-muted text-base md:text-lg max-w-2xl mx-auto text-balance"
          >
            <span className="text-neon-green">// </span>
            Digite código de verdade — treine sozinho ou crie uma sala e chame os amigos.
            Quem for mais rápido leva. Sem cadastro, sem firula.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: dur.slow, ease: ease.outExpo }}
            className="mt-5 inline-flex flex-wrap items-center justify-center gap-3 text-xs text-text-dim font-mono"
          >
            <span className="chip border-neon-green/30 text-neon-green">
              <Zap className="size-3" /> tempo real
            </span>
            <span className="chip border-neon-cyan/30 text-neon-cyan">
              <Users className="size-3" /> multiplayer
            </span>
            <span className="chip border-neon-violet/30 text-neon-violet">
              <Code2 className="size-3" /> {LANGUAGES.length} linguagens
            </span>
          </motion.div>
        </div>

        {/* live demo + entry panel */}
        <div className="grid md:grid-cols-2 gap-5 items-start max-w-4xl mx-auto">
          <motion.div {...fadeUp(0.5)}>
            <TypingDemo />
          </motion.div>

          <motion.div {...fadeUp(0.6)}>
            <SpotlightCard className="card neon-border h-full p-6 md:p-7">
              <div className="mb-4">
                <label className="label" htmlFor="player_name">
                  player_name
                </label>
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
                {/* Cobre o mobile, onde o "opcional" do header fica escondido
                    (`hidden sm:inline`): aqui é onde o jogador de fato age. */}
                <p className="mt-1.5 text-[11px] font-mono text-text-dim">
                  <span className="text-neon-green">// </span>
                  é só o nick — sem conta, sem e-mail
                </p>
              </div>

              <StarBorder
                onClick={() => setCreateOpen(true)}
                disabled={loading}
                className="w-full"
                innerClassName="py-3 text-base font-semibold text-neon-green glow-text-green"
              >
                <Plus className="size-4" />
                Criar sala
              </StarBorder>

              <div className="my-4 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-text-dim">
                <span className="h-px flex-1 bg-bg-line" />
                ou entre numa sala
                <span className="h-px flex-1 bg-bg-line" />
              </div>

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

              {/* Treino Livre (issue #25): caminho jogável em 1 clique, sem sala. */}
              <div className="my-4 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-text-dim">
                <span className="h-px flex-1 bg-bg-line" />
                ou sozinho
                <span className="h-px flex-1 bg-bg-line" />
              </div>

              <Link
                href="/practice"
                className="btn-secondary w-full justify-center py-2.5 text-sm"
                aria-label="Treinar sozinho, sem criar sala"
              >
                <Dumbbell className="size-4" /> treinar sozinho →
              </Link>
            </SpotlightCard>
          </motion.div>
        </div>

        {/* public rooms browser */}
        <PublicRooms
          rooms={publicRooms}
          loading={roomsLoading}
          onRefresh={loadPublicRooms}
          onEnter={joinByCode}
        />

        {/* features strip */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <Feature
            icon={<Code2 className="size-4 text-neon-green" />}
            title="snippets reais"
            text={`${LANGUAGES.length} linguagens, 300+ trechos de código de verdade em 3 níveis. Cada partida sorteia um diferente.`}
          />
          <Feature
            icon={<Users className="size-4 text-neon-cyan" />}
            title={`até ${ABSOLUTE_MAX_PLAYERS} jogadores`}
            text="Compartilhe o código de 6 letras ou o link da sala — gente entra na hora."
          />
          <Feature
            icon={<Trophy className="size-4 text-neon-violet" />}
            title="WPM + precisão"
            text="Posição em tempo real no topo, estatísticas no final. Pódio com ouro/prata/bronze."
          />
        </div>

        <footer className="mt-16 mb-6 flex flex-col items-center gap-2 text-center text-xs text-text-dim font-mono">
          <span className="terminal-prompt">made with caffeine ☕ &amp; segfaults</span>
          <a
            href="https://github.com/caioross"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-neon-green transition-colors"
          >
            <Github className="size-3.5" /> github.com/caioross
          </a>
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
            <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-1.5">
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
                  <div className="text-[10px] mt-0.5 truncate">{l.label}</div>
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
              max={ABSOLUTE_MAX_PLAYERS}
              value={maxPlayers}
              onChange={e => setMaxPlayers(Number(e.target.value))}
              className="w-full mt-2 accent-[#00ff88]"
            />
            <div className="flex justify-between text-[10px] text-text-dim font-mono mt-1">
              <span>2</span>
              <span>{ABSOLUTE_MAX_PLAYERS}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPublic(v => !v)}
            className="flex w-full items-center justify-between rounded-md border border-bg-line px-3 py-2.5 text-left transition-colors hover:border-text-dim"
            aria-pressed={isPublic}
          >
            <span className="flex items-center gap-2">
              {isPublic ? (
                <Globe className="size-4 text-neon-green" />
              ) : (
                <Lock className="size-4 text-text-muted" />
              )}
              <span>
                <span className="block text-sm font-medium text-text">
                  {isPublic ? "sala pública" : "sala privada"}
                </span>
                <span className="block text-[10px] text-text-dim normal-case">
                  {isPublic
                    ? "aparece na busca de salas da home"
                    : "só entra quem tem o código ou link"}
                </span>
              </span>
            </span>
            <span
              className={
                "relative h-5 w-9 shrink-0 rounded-full transition-colors " +
                (isPublic ? "bg-neon-green/30" : "bg-bg-line")
              }
            >
              <span
                className={
                  "absolute top-0.5 size-4 rounded-full transition-all " +
                  (isPublic ? "left-[18px] bg-neon-green" : "left-0.5 bg-text-muted")
                }
              />
            </span>
          </button>
        </div>
      </Modal>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
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
    <SpotlightCard className="card p-4 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="label">{title}</span>
      </div>
      <p className="text-text-muted text-xs leading-relaxed">{text}</p>
    </SpotlightCard>
  );
}

function PublicRooms({
  rooms,
  loading,
  onRefresh,
  onEnter
}: {
  rooms: PublicRoom[];
  loading: boolean;
  onRefresh: () => void;
  onEnter: (code: string) => void;
}) {
  return (
    <div className="mt-12 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-neon-green" />
          <span className="label">salas públicas abertas</span>
          {rooms.length > 0 && (
            <span className="text-[10px] text-text-dim">({rooms.length})</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="btn-ghost text-xs px-2 py-1"
          aria-label="Atualizar lista de salas"
        >
          <RefreshCw className={"size-3.5 " + (loading ? "animate-spin" : "")} /> atualizar
        </button>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="card h-[68px] shimmer" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-muted">
          nenhuma sala pública aberta agora —{" "}
          <span className="text-neon-green">crie a primeira!</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rooms.map(r => {
            const lang = langById(r.language);
            return (
              <div
                key={r.code}
                className="card p-3 flex items-center gap-3 hover:border-neon-green/30 transition-colors"
              >
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-md text-[11px] font-bold"
                  style={{
                    background: `${lang?.color ?? "#7d8590"}20`,
                    color: lang?.color ?? "#7d8590"
                  }}
                >
                  {lang?.icon ?? r.language.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {lang?.label ?? r.language}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-dim font-mono">
                    <span>{r.difficulty}</span>
                    <span>·</span>
                    <span>até {r.max_players}p</span>
                    <span>·</span>
                    <span>{timeAgo(r.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => onEnter(r.code)}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  <LogIn className="size-3.5" /> entrar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
