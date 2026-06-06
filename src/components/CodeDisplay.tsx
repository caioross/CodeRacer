"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders the snippet character-by-character.
 * - chars before `cursor` AND matching typed[] = .char-done
 * - chars before `cursor` that didn't match = .char-error
 * - char at `cursor` = .char-current
 * - chars after `cursor` = default
 *
 * `typed` is the string typed so far (same length as cursor in this implementation).
 */
export function CodeDisplay({
  code,
  typed,
  language
}: {
  code: string;
  typed: string;
  language: string;
}) {
  const cursor = typed.length;
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Build char tokens
  const chars = useMemo(() => code.split(""), [code]);

  // Keep current char in view
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`);
    if (el && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetTop = elRect.top - containerRect.top + containerRef.current.scrollTop;
      const center = offsetTop - containerRef.current.clientHeight / 2 + 12;
      containerRef.current.scrollTo({ top: center, behavior: "smooth" });
    }
  }, [cursor]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-bg-line px-3 py-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2.5 rounded-full bg-neon-red/70" />
            <span className="size-2.5 rounded-full bg-neon-amber/70" />
            <span className="size-2.5 rounded-full bg-neon-green/70" />
          </span>
          <span className="text-text-muted ml-2">snippet.{language}</span>
        </div>
        <span className="text-text-dim">
          {cursor}/{code.length}
        </span>
      </div>

      <div
        ref={containerRef}
        className="font-mono text-sm md:text-[15px] leading-7 px-4 py-4 overflow-y-auto max-h-[44vh] whitespace-pre"
      >
        {chars.map((ch, i) => {
          let cls = "text-text-muted";
          if (i < cursor) {
            cls = typed[i] === ch ? "char-done" : "char-error";
          } else if (i === cursor) {
            cls = "char-current";
          } else {
            cls = "text-text-muted";
          }
          const display = ch === "\n" ? "\n" : ch;
          return (
            <span key={i} data-i={i} className={cn(cls)}>
              {ch === "\n" ? (
                <>
                  {/* show ¬ on current newline, otherwise nothing extra */}
                  {i === cursor && (
                    <span className="text-neon-green/60 char-current px-0.5">⏎</span>
                  )}
                  {"\n"}
                </>
              ) : (
                display
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
