// Idioma do pedido no servidor (layout, páginas, metadados, manifest).
// Ordem: `?lang=` (o middleware põe no cabeçalho interno) → cookie → Accept-Language → inglês.
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, LOCALE_HEADER, LOCALES, LOCALE_META, resolveLocale, type Locale } from "./config";
import { loadMessages } from "./messages";
import { createTranslator } from "./translator";
import { SITE } from "@/lib/site";

export function getRequestLocale(): Locale {
  const h = headers();
  return resolveLocale({
    header: h.get(LOCALE_HEADER),
    cookie: cookies().get(LOCALE_COOKIE)?.value,
    acceptLanguage: h.get("accept-language")
  });
}

export async function getServerI18n() {
  const locale = getRequestLocale();
  const messages = await loadMessages(locale);
  return createTranslator(locale, messages);
}

/**
 * `alternates.languages` para o hreflang: a mesma rota com `?lang=<idioma>` e um
 * `x-default` sem parâmetro (o servidor escolhe pelo navegador).
 */
export function languageAlternates(path: string): Record<string, string> {
  const base = path === "/" ? "" : path;
  const out: Record<string, string> = { "x-default": `${SITE.url}${base || "/"}` };
  for (const l of LOCALES) out[l] = `${SITE.url}${base || "/"}?lang=${l}`;
  return out;
}

export function ogLocale(locale: Locale): { locale: string; alternateLocale: string[] } {
  return {
    locale: LOCALE_META[locale].og,
    alternateLocale: LOCALES.filter(l => l !== locale).map(l => LOCALE_META[l].og)
  };
}
