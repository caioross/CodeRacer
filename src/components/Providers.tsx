"use client";

import { MotionConfig } from "framer-motion";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/types";

// Provedores de raiz (client). `reducedMotion="user"` (#108): com
// `prefers-reduced-motion` ligado, TODA animação de transform/layout do framer-motion
// (countdown em tela cheia, pista, pódio, cartões) vira troca instantânea — antes só o
// CSS respeitava a preferência.
export function Providers({
  locale,
  messages,
  children
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </I18nProvider>
  );
}
