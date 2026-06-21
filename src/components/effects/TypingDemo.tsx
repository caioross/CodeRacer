"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";

// A mini editor that auto-types real code with a blinking caret, looping
// through a few languages. Shows the game in action on the title screen.
type Tok = { t: string; c?: string };
type Demo = { lang: string; lines: Tok[][] };

const KW = "text-neon-violet";
const STR = "text-neon-amber";
const FN = "text-neon-green";
const NUM = "text-neon-cyan";
const MUT = "text-text-muted";

const DEMOS: Demo[] = [
  {
    lang: "javascript",
    lines: [
      [
        { t: "const ", c: KW },
        { t: "winner ", c: FN },
        { t: "= players", c: MUT },
        { t: ".", c: MUT },
        { t: "sort", c: FN },
        { t: "(byWpm)[", c: MUT },
        { t: "0", c: NUM },
        { t: "];", c: MUT }
      ]
    ]
  },
  {
    lang: "python",
    lines: [
      [
        { t: "def ", c: KW },
        { t: "wpm", c: FN },
        { t: "(chars, secs):", c: MUT }
      ],
      [
        { t: "    return ", c: KW },
        { t: "chars / ", c: MUT },
        { t: "5 ", c: NUM },
        { t: "/ (secs / ", c: MUT },
        { t: "60", c: NUM },
        { t: ")", c: MUT }
      ]
    ]
  },
  {
    lang: "rust",
    lines: [
      [
        { t: "fn ", c: KW },
        { t: "main", c: FN },
        { t: "() {", c: MUT }
      ],
      [
        { t: "    println!", c: FN },
        { t: "(", c: MUT },
        { t: '"3 2 1 go!"', c: STR },
        { t: ");", c: MUT }
      ],
      [{ t: "}", c: MUT }]
    ]
  }
];

export function TypingDemo() {
  const reduced = useReducedMotion();
  const [demo, setDemo] = useState(0);
  const [n, setN] = useState(0);

  const flat = useMemo(() => {
    const d = DEMOS[demo];
    const out: { ch: string; c?: string }[] = [];
    d.lines.forEach((line, li) => {
      line.forEach(tok => {
        for (const ch of tok.t) out.push({ ch, c: tok.c });
      });
      if (li < d.lines.length - 1) out.push({ ch: "\n" });
    });
    return out;
  }, [demo]);

  const total = flat.length;

  useEffect(() => {
    if (reduced) {
      setN(total);
      return;
    }
    setN(0);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    const tick = () => {
      if (cancelled) return;
      count += 1;
      setN(count);
      if (count >= total) {
        timer = setTimeout(() => {
          if (!cancelled) setDemo(x => (x + 1) % DEMOS.length);
        }, 1700);
      } else {
        timer = setTimeout(tick, 34 + Math.random() * 46);
      }
    };
    timer = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [demo, total, reduced]);

  const visible = flat.slice(0, n);

  return (
    <div className="card overflow-hidden text-left">
      <div className="flex items-center justify-between border-b border-bg-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full bg-neon-red/70" />
            <span className="size-2.5 rounded-full bg-neon-amber/70" />
            <span className="size-2.5 rounded-full bg-neon-green/70" />
          </span>
          <span className="ml-2 font-mono text-xs text-text-muted">demo.{DEMOS[demo].lang}</span>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neon-green">
          <span className="size-1.5 rounded-full bg-neon-green animate-pulse" /> ao vivo
        </span>
      </div>
      <div className="min-h-[116px] whitespace-pre px-4 py-4 font-mono text-sm leading-7">
        {visible.map((c, i) => (
          <span key={i} className={c.c}>
            {c.ch}
          </span>
        ))}
        <span className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-neon-green animate-blink" />
      </div>
    </div>
  );
}
