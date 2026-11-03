// Texto com trechos estilizados: "Você é o <a>líder</a>." + { a: c => <span>{c}</span> }.
// Puro (sem hooks) — serve em Server e Client Components. Tags sem renderizador viram texto puro.
import { Fragment, type ReactNode } from "react";

export type RichRenderers = Record<string, (chunk: ReactNode) => ReactNode>;

const TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

export function renderRich(text: string, renderers: RichRenderers): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TAG)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const render = renderers[m[1]];
    out.push(<Fragment key={i++}>{render ? render(m[2]) : m[2]}</Fragment>);
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Remove as tags (para `aria-label`, `title`, texto de compartilhar). */
export function stripTags(text: string): string {
  return text.replace(TAG, "$2");
}
