"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { charColors } from "@/lib/highlight";

/**
 * Renders the target snippet with real syntax colors, modulated by typing state:
 * - upcoming chars: full syntax color
 * - typed-correct: same color, dimmed
 * - typed-wrong: red error background
 * - char at cursor: green highlight
 */
function CodeDisplayImpl({
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

  const chars = useMemo(() => code.split(""), [code]);
  const colors = useMemo(() => charColors(code), [code]);

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

      {/* Mobile (#54): teto em px, não em vh — no iOS o teclado virtual não
          encolhe a viewport de layout, então `vh` mentiria justamente na hora em
          que o espaço aperta. ~5 linhas de contexto bastam porque o efeito acima
          mantém o caractere corrente centralizado. */}
      <div
        ref={containerRef}
        // Cortesia, não defesa: impede o arrasto mais óbvio do alvo para o editor (#61). A
        // defesa real é o `onDrop` do CodeEditor — o snippet também sai por outra aba/API.
        // Sem `user-select: none`: selecionar/copiar o alvo continua acessível.
        onDragStart={e => e.preventDefault()}
        className="font-mono text-sm md:text-[15px] leading-7 px-4 py-4 overflow-y-auto overflow-x-hidden max-h-[136px] md:max-h-[44vh] whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {chars.map((ch, i) => {
          const isCurrent = i === cursor;
          const done = i < cursor;
          const isError = done && typed[i] !== ch;

          let className = "";
          const style: React.CSSProperties = {};
          if (isError) {
            className = "char-error";
          } else if (isCurrent) {
            className = "char-current";
          } else {
            style.color = colors[i];
            if (done) style.opacity = 0.4;
          }

          return (
            <span key={i} data-i={i} className={cn(className)} style={style}>
              {ch === "\n" ? (
                <>
                  {isCurrent && (
                    <span className="text-neon-green/60 char-current px-0.5">⏎</span>
                  )}
                  {"\n"}
                </>
              ) : (
                ch
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Memo (#59): o alvo só depende de code/typed/language — nenhum deles muda
// quando um ADVERSÁRIO progride nem no tick de 200ms do relógio do TypingCore.
// Sem isso, cada mensagem de progresso alheio reconstrói um <span> por caractere
// na mesma main thread da textarea (área sagrada, HANDBOOK §2).
export const CodeDisplay = memo(CodeDisplayImpl);
