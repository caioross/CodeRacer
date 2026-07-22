"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target, Timer, Zap } from "lucide-react";
import type { RoomState } from "@/lib/types";
import { RaceTrack } from "./RaceTrack";
import { CodeDisplay } from "./CodeDisplay";
import { CodeEditor } from "./CodeEditor";
import { FloatingChat } from "./FloatingChat";
import {
  countCorrectChars,
  computeWpm,
  computeAccuracy,
  computeProgress
} from "@/lib/metrics";

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
  const code = snippet.code;
  const startedAt = room.startedAt!;
  const me = room.players.find(p => p.id === meId);
  const myFinishedAt = me?.finishedAt ?? null;
  const iFinished = !!myFinishedAt;

  const [typed, setTyped] = useState("");
  const [errors, setErrors] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [now, setNow] = useState<number>(Date.now());
  // Bumps every time a keystroke lands a wrong char — drives the editor-card
  // error feedback (issue #10). Não altera nenhuma métrica (WPM/erros/precisão).
  const [errorPulse, setErrorPulse] = useState(0);

  // Tick clock — stops once we finish so the timer and WPM freeze in place.
  useEffect(() => {
    if (iFinished) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [iFinished]);

  // Compute metrics — once we finish, freeze the clock at our finish time so
  // WPM (correctChars / elapsedMin) stops decaying while we wait for others.
  const clockNow = myFinishedAt ?? now;
  const elapsedMs = Math.max(0, clockNow - startedAt);
  const elapsedMin = elapsedMs / 60000;
  // Fonte única de verdade das métricas (issue #32): funções puras em `@/lib/metrics`,
  // as mesmas que os testes de honestidade pinam. `correctChars` segue no `useMemo`
  // para não recontar o loop char-a-char a cada re-render (área sagrada, HANDBOOK §2).
  const correctChars = useMemo(() => countCorrectChars(typed, code), [typed, code]);
  const wpm = computeWpm(correctChars, elapsedMin);
  const accuracy = computeAccuracy(errors, totalKeystrokes);
  const progress = computeProgress(typed.length, code.length);

  // Stream progress to server (throttled implicitly by react re-renders on typed change)
  useEffect(() => {
    onProgress(progress, wpm, accuracy, errors);
  }, [progress, wpm, accuracy, errors, onProgress]);

  // Heartbeat to keep WPM moving even when not typing (so UI updates)
  useEffect(() => {
    if (iFinished) return;
    const id = setInterval(() => {
      onProgress(progress, wpm, accuracy, errors);
    }, 1000);
    return () => clearInterval(id);
  }, [iFinished, progress, wpm, accuracy, errors, onProgress]);

  const handleInput = useCallback(
    (next: string) => {
      if (iFinished) return;
      // Only consider growth (typing forward). Allow backspace by trimming.
      if (next.length > code.length) next = next.slice(0, code.length);

      // Detect new keystrokes (compare next vs typed)
      if (next.length > typed.length) {
        const added = next.length - typed.length;
        // Count incorrect chars among the newly added ones
        let newErrors = 0;
        for (let i = typed.length; i < next.length; i++) {
          if (next[i] !== code[i]) newErrors++;
        }
        setErrors(e => e + newErrors);
        setTotalKeystrokes(k => k + added);
        if (newErrors > 0) setErrorPulse(p => p + 1);
      } else if (next.length < typed.length) {
        // Backspace doesn't count as keystroke in classic WPM tests
      }
      setTyped(next);
    },
    [code, typed, iFinished]
  );

  // Disable copy/paste so it's fair
  const noPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* track */}
      <RaceTrack players={room.players} meId={meId} />

        {/* code + input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CodeDisplay code={code} typed={typed} language={snippet.language} />

          <CodeEditor
            value={typed}
            onChange={handleInput}
            onPaste={noPaste}
            disabled={iFinished}
            language={snippet.language}
            target={code}
            onAbandon={iFinished ? undefined : onAbandon}
            errorPulse={errorPulse}
          />
        </div>

        {/* personal stats */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="label">// suas estatísticas</span>
            <span className="text-[10px] text-text-dim ml-auto">
              tempo {(elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              icon={<Zap className="size-4" />}
              label="WPM"
              value={wpm}
              color="text-neon-green"
            />
            <Stat
              icon={<Target className="size-4" />}
              label="Precisão"
              value={`${accuracy}%`}
              color={accuracy >= 95 ? "text-neon-green" : accuracy >= 85 ? "text-neon-cyan" : "text-neon-amber"}
            />
            <Stat
              icon={<Timer className="size-4" />}
              label="Progresso"
              value={`${Math.round(progress * 100)}%`}
              color="text-neon-cyan"
            />
            <Stat
              icon={<span className="font-bold text-sm leading-none">⛔</span>}
              label="Erros (total)"
              value={errors}
              color={errors === 0 ? "text-neon-green" : "text-neon-red"}
              title="Teclas erradas digitadas ao longo da corrida — inclui as que você já corrigiu."
            />
          </div>
          <div className="mt-3 relative h-1.5 rounded-full bg-bg-soft overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neon-green to-neon-cyan"
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        <FloatingChat
          messages={room.chat}
          players={room.players}
          meId={meId}
          onSend={onChat}
        />
      </div>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
  title
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  title?: string;
}) {
  return (
    <div className="rounded-md border border-bg-line bg-bg-soft/60 px-3 py-2" title={title}>
      <div className="flex items-center gap-1 text-text-muted text-[10px] uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`font-mono font-bold text-2xl leading-tight mt-1 ${color}`}>
        {value}
      </div>
    </div>
  );
}
