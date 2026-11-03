"use client";

// Provedor do idioma no cliente. Recebe do layout (servidor) SÓ o dicionário do idioma
// ativo. Trocar de idioma grava o cookie e pede ao servidor um novo render
// (`router.refresh()`), que devolve o dicionário novo — o estado da página fica.
//
// Área sagrada: o `t()` é uma busca em objeto; nada aqui roda por tecla além disso, e o
// valor do contexto só muda quando o idioma muda.
import { createContext, useCallback, useContext, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALE_META, type Locale } from "./config";
import { createTranslator, type Translator } from "./translator";
import type { Messages } from "./types";

type I18nValue = Translator & {
  setLocale: (l: Locale) => void;
  switching: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  const translator = useMemo(() => createTranslator(locale, messages), [locale, messages]);

  // O <html> vem certo do servidor; isto cobre a troca sem recarregar a página.
  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = LOCALE_META[locale].dir;
  }, [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      try {
        document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(l)}; path=/; max-age=31536000; samesite=lax`;
      } catch {}
      // Tira um `?lang=` antigo da URL para ele não ganhar do cookie no próximo pedido.
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("lang")) {
          url.searchParams.delete("lang");
          window.history.replaceState(window.history.state, "", url.toString());
        }
      } catch {}
      startTransition(() => router.refresh());
    },
    [router]
  );

  const value = useMemo<I18nValue>(
    () => ({ ...translator, setLocale, switching }),
    [translator, setLocale, switching]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n fora do <I18nProvider>");
  return v;
}
