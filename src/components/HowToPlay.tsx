"use client";

import { useEffect, useState } from "react";
import { Keyboard, Share2, UserRound, X } from "lucide-react";
import { useI18n } from "@/i18n/client";

const KEY = "coderacer:howto-seen";

// "Como jogar" em 3 passos — aparece na 1ª visita (o hero já explica a proposta; isto
// explica as REGRAS que surpreendem: Tab/Enter indentam, colar não vale, erro conta).
// Fechar grava no localStorage e o cartão não volta. Sem animação de entrada.
export function HowToPlay() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {}
  }, []);

  if (!open) return null;

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }

  const steps = [
    { icon: <UserRound className="size-4 text-neon-green" />, text: t("home.how1") },
    { icon: <Share2 className="size-4 text-neon-cyan" />, text: t("home.how2") },
    { icon: <Keyboard className="size-4 text-neon-violet" />, text: t("home.how3") }
  ];

  return (
    <section aria-labelledby="howto-title" className="mt-10 max-w-4xl mx-auto card p-4 md:p-5 relative">
      <button
        onClick={close}
        className="absolute top-2 end-2 grid size-7 place-items-center rounded-md text-text-dim hover:text-text"
        aria-label={t("common.close")}
      >
        <X className="size-4" />
      </button>
      <h2 id="howto-title" className="label mb-3">
        {"// "}
        {t("home.howTitle")}
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-text-muted">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-bg-line bg-bg-soft/60 font-mono text-[11px] text-text">
              {i + 1}
            </span>
            <span className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0" aria-hidden>
                {s.icon}
              </span>
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 text-end">
        <button onClick={close} className="btn-secondary px-3 py-1.5 text-xs">
          {t("home.howClose")}
        </button>
      </div>
    </section>
  );
}
