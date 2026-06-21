"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Minus, Plus, Settings2, Volume2, VolumeX, WrapText } from "lucide-react";
import { langById } from "@/lib/languages";
import { tokColor, tokenize } from "@/lib/highlight";
import { isMuted, playKey, setMuted } from "@/lib/sound";

// VSCode-like typing surface with live syntax highlighting: a transparent
// textarea sits over a colored <pre> mirror (perfectly aligned metrics).
// Plus line-number gutter, active-line highlight, status bar, keyboard sound
// (toggleable), and an options menu (font size + word wrap). Anti-cheat kept.
const MIN_FONT = 12;
const MAX_FONT = 20;

export function CodeEditor({
  value,
  onChange,
  onPaste,
  disabled,
  language,
  onAbandon
}: {
  value: string;
  onChange: (next: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  disabled: boolean;
  language: string;
  onAbandon?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(15);
  const [wrap, setWrap] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [scrollTop, setScrollTop] = useState(0);

  const lineHeight = Math.round(fontSize * 1.7);
  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value]);
  const tokens = useMemo(() => tokenize(value), [value]);
  const lang = langById(language);
  const showGutter = !wrap;

  useEffect(() => {
    taRef.current?.focus();
    setSoundOn(!isMuted());
  }, []);

  const sharedStyle: React.CSSProperties = {
    fontSize,
    lineHeight: `${lineHeight}px`,
    fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
    whiteSpace: wrap ? "pre-wrap" : "pre",
    overflowWrap: wrap ? "anywhere" : "normal",
    tabSize: 2
  };

  function syncCaret() {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const nl = before.split("\n");
    setCaret({ line: nl.length, col: nl[nl.length - 1].length + 1 });
  }

  function onScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const { scrollTop: st, scrollLeft: sl } = e.currentTarget;
    setScrollTop(st);
    if (preRef.current) {
      preRef.current.scrollTop = st;
      preRef.current.scrollLeft = sl;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = st;
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setMuted(!next);
    if (next) playKey();
  }

  const activeLineTop = 16 + (caret.line - 1) * lineHeight - scrollTop;

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* title bar */}
      <div className="flex items-center justify-between border-b border-bg-line px-3 py-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full bg-neon-red/70" />
            <span className="size-2.5 rounded-full bg-neon-amber/70" />
            <span className="size-2.5 rounded-full bg-neon-green/70" />
          </span>
          <span className="ml-2 text-text-muted">
            {disabled ? "// você terminou!" : `digite.${language}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lang && (
            <span className="text-[10px] font-bold" style={{ color: lang.color }}>
              {lang.icon}
            </span>
          )}
          <button
            onClick={toggleSound}
            className="grid size-5 place-items-center text-text-muted hover:text-text"
            aria-label={soundOn ? "Desligar som" : "Ligar som"}
            title={soundOn ? "Som: ligado" : "Som: desligado"}
          >
            {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>
          <div className="relative">
            <button
              onClick={() => setOptionsOpen(o => !o)}
              className="grid size-5 place-items-center text-text-muted hover:text-text"
              aria-label="Opções do editor"
              title="Opções"
            >
              <Settings2 className="size-3.5" />
            </button>
            {optionsOpen && (
              <>
                <button
                  aria-hidden
                  tabIndex={-1}
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setOptionsOpen(false)}
                />
                <div className="absolute right-0 top-7 z-20 w-48 rounded-md border border-bg-line bg-bg-card p-1.5 text-[11px] shadow-glow">
                  <div className="flex items-center justify-between px-1.5 py-1">
                    <span className="text-text-muted">tamanho da fonte</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFontSize(s => Math.max(MIN_FONT, s - 1))}
                        className="grid size-5 place-items-center rounded border border-bg-line hover:border-text-dim"
                        aria-label="Diminuir fonte"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-5 text-center tabular-nums text-text">{fontSize}</span>
                      <button
                        onClick={() => setFontSize(s => Math.min(MAX_FONT, s + 1))}
                        className="grid size-5 place-items-center rounded border border-bg-line hover:border-text-dim"
                        aria-label="Aumentar fonte"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setWrap(w => !w)}
                    className="flex w-full items-center justify-between rounded px-1.5 py-1 hover:bg-bg-soft/60"
                  >
                    <span className="inline-flex items-center gap-1.5 text-text-muted">
                      <WrapText className="size-3" /> quebrar linha
                    </span>
                    <span className={wrap ? "text-neon-green" : "text-text-dim"}>
                      {wrap ? "on" : "off"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* editor body: gutter + highlighted overlay + transparent textarea */}
      <div className="relative flex min-h-[44vh] flex-1 overflow-hidden">
        {showGutter && (
          <div
            ref={gutterRef}
            aria-hidden
            className="select-none overflow-hidden border-r border-bg-line bg-bg-soft/40 py-4 text-right font-mono text-text-dim"
            style={{ width: 52, fontSize, lineHeight: `${lineHeight}px` }}
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <div
                key={i}
                className="px-2.5"
                style={{ color: i + 1 === caret.line ? "#e6edf3" : undefined }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          {showGutter && !disabled && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bg-neon-green/[0.05]"
              style={{ top: activeLineTop, height: lineHeight }}
            />
          )}

          {/* colored mirror */}
          <pre
            ref={preRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden px-4 py-4"
            style={sharedStyle}
          >
            {tokens.map((t, i) => (
              <span key={i} style={{ color: tokColor(t.type) }}>
                {t.text}
              </span>
            ))}
            {"\n"}
          </pre>

          {/* transparent input on top */}
          <textarea
            ref={taRef}
            value={value}
            onChange={e => {
              if (e.target.value.length > value.length) playKey();
              onChange(e.target.value);
              syncCaret();
            }}
            onPaste={onPaste}
            onScroll={onScroll}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            spellCheck={false}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            disabled={disabled}
            wrap={wrap ? "soft" : "off"}
            className="absolute inset-0 resize-none bg-transparent px-4 py-4 text-transparent caret-neon-green outline-none placeholder:text-text-dim disabled:opacity-50"
            style={{ ...sharedStyle, caretColor: "#00ff88", color: "transparent" }}
            placeholder={disabled ? "✅ terminou! veja a posição dos outros..." : "$ comece a digitar..."}
          />
        </div>
      </div>

      {/* status bar */}
      <div className="flex items-center justify-between border-t border-bg-line px-3 py-1.5 text-[10px] font-mono text-text-dim">
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            Ln {caret.line}, Col {caret.col}
          </span>
          <span className="tabular-nums">{value.length} chars</span>
          <span className="hidden sm:inline">paste off · backspace não pontua</span>
        </div>
        {onAbandon && (
          <button onClick={onAbandon} className="btn-danger text-[10px] px-2 py-0.5">
            <Flag className="size-3" /> desistir
          </button>
        )}
      </div>
    </div>
  );
}
