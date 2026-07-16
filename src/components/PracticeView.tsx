"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Home, RotateCcw, Target, Timer, Users, Zap } from "lucide-react";
import { Logo } from "./Logo";
import { MatrixRain } from "./MatrixRain";
import { TypingCore } from "./TypingCore";
import { LANGUAGES, DIFFICULTIES, type LangId, type Difficulty } from "@/lib/languages";
import type { Snippet } from "@/lib/types";

// Treino Livre (issue #25, fatia do epic #24): corrida solo sem sala, sem
// Realtime e sem persistência — zero chamadas a /api/rooms ou Supabase.
// O cronômetro dispara no 1º keystroke (sem countdown, recomendação do
// Conselho) e o snippet vem de GET /api/snippet (pool server-side).
// Sem animações de entrada: nada a suprimir sob prefers-reduced-motion.
export function PracticeView() {
  // Dificuldade default Fácil — porta de entrada do Iniciante (#16, spec §0.3).
  const [language, setLanguage] = useState<LangId>("javascript");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Muda a cada snippet novo — remonta o TypingCore (zera typed/erros/teclas).
  const [round, setRound] = useState(0);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [stats, setStats] = useState({ wpm: 0, accuracy: 100, errors: 0 });

  // Ignora respostas fora de ordem quando o jogador troca a config rápido.
  const fetchSeq = useRef(0);

  const loadSnippet = useCallback(async (lang: LangId, diff: Difficulty) => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    setStartedAt(null);
    setFinishedAt(null);
    try {
      const res = await fetch(
        `/api/snippet?language=${encodeURIComponent(lang)}&difficulty=${encodeURIComponent(diff)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (seq !== fetchSeq.current) return; // resposta antiga — descarta
      if (!json?.ok || !json.snippet) {
        setError(json?.error || "Não deu para sortear um snippet — tenta de novo.");
        setSnippet(null);
      } else {
        setSnippet(json.snippet as Snippet);
        setRound(r => r + 1);
      }
    } catch {
      if (seq !== fetchSeq.current) return;
      setError("Sem conexão com o servidor — tenta de novo.");
      setSnippet(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSnippet(language, difficulty);
  }, [language, difficulty, loadSnippet]);

  // 1º keystroke para frente inicia o cronômetro (sem espera, sem countdown).
  const handleStart = useCallback(() => {
    setStartedAt(s => s ?? Date.now());
  }, []);

  // Mesma semântica do multiplayer (useRoom.broadcastProgress): progress >= 1
  // encerra. O TypingCore congela o clock em finishedAt e re-emite as métricas
  // exatas do instante final — a segunda passada sobrescreve com o valor honesto.
  const handleProgress = useCallback(
    (progress: number, wpm: number, accuracy: number, errors: number) => {
      if (progress >= 1) {
        setFinishedAt(f => f ?? Date.now());
        setStats({ wpm, accuracy, errors });
      }
    },
    []
  );

  const done = finishedAt != null;
  const elapsedS = done && startedAt != null ? (finishedAt - startedAt) / 1000 : 0;

  return (
    <main className="relative min-h-screen">
      <MatrixRain opacity={0.04} />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-bg-line bg-bg/50 backdrop-blur">
        <Link href="/" className="flex items-center gap-2" aria-label="Voltar para a home">
          <Logo size="sm" />
        </Link>
        <Link href="/" className="btn-secondary px-3 py-1.5 text-xs">
          <Home className="size-3.5" /> home
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight gradient-text">
            Treino Livre
          </h1>
          <p className="text-xs font-mono text-text-muted">
            <span className="text-neon-green">// </span>
            só você e o código — o cronômetro dispara na primeira tecla
          </p>
        </div>

        {/* config: linguagem + dificuldade (mesmo padrão do modal de criar sala) */}
        <div className="card p-4 space-y-4">
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
                  <div className="text-[10px] mt-0.5 text-text-dim normal-case">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* treino concluído: stats + jogar de novo (sem recarregar a página) */}
        {done && (
          <div className="card neon-border p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="label">// treino concluído</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-neon-green">
                <Zap className="size-3.5" /> {stats.wpm} WPM
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-neon-cyan">
                <Target className="size-3.5" /> {stats.accuracy}%
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-text-muted">
                ⛔ {stats.errors} erros
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-sm text-text-muted">
                <Timer className="size-3.5" /> {elapsedS.toFixed(1)}s
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  onClick={() => loadSnippet(language, difficulty)}
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" /> treinar de novo
                </button>
                <Link href="/" className="btn-secondary px-3 py-1.5 text-xs">
                  <Users className="size-3.5" /> criar sala com amigos
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* corrida solo */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card h-[44vh] shimmer" />
            <div className="card h-[44vh] shimmer" />
          </div>
        ) : error ? (
          <div className="card p-6 text-center text-sm text-text-muted">
            {error}{" "}
            <button
              onClick={() => loadSnippet(language, difficulty)}
              className="text-neon-green underline-offset-2 hover:underline"
            >
              tentar de novo
            </button>
          </div>
        ) : snippet ? (
          <TypingCore
            key={round}
            code={snippet.code}
            language={snippet.language}
            startedAt={startedAt}
            finishedAt={finishedAt}
            onStart={handleStart}
            onProgress={handleProgress}
            finishedPlaceholder="✅ terminou! bora treinar de novo?"
          />
        ) : null}
      </div>
    </main>
  );
}
