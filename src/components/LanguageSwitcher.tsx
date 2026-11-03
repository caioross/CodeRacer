"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_META, isLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

// Seletor de idioma da interface. `<select>` nativo de propósito: acessível por teclado e
// leitor de tela sem trabalho extra, e no celular abre o seletor do sistema.
// O rótulo visível é a sigla (PT, EN, 日本語…) para caber no cabeçalho.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t, switching } = useI18n();
  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-1 rounded-md border border-bg-line bg-bg-soft/60 px-2 py-1 text-xs font-mono text-text-muted transition-colors hover:border-text-dim hover:text-text focus-within:border-neon-green",
        switching && "opacity-60",
        className
      )}
      title={t("common.uiLanguage")}
    >
      <Languages className="size-3.5 shrink-0" aria-hidden />
      <span aria-hidden>{LOCALE_META[locale].short}</span>
      <select
        aria-label={t("common.uiLanguage")}
        value={locale}
        onChange={e => isLocale(e.target.value) && setLocale(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALES.map(l => (
          <option key={l} value={l} lang={l}>
            {LOCALE_META[l].native}
          </option>
        ))}
      </select>
    </label>
  );
}
