// Carregador de mensagens por idioma — SÓ no servidor. Cada idioma é um chunk separado:
// o cliente recebe apenas o dicionário do idioma ativo (via props do I18nProvider),
// nunca os 12.
import type { Locale } from "../config";
import type { Messages } from "../types";

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  "pt-BR": () => import("./pt-BR"),
  en: () => import("./en"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  de: () => import("./de"),
  it: () => import("./it"),
  ja: () => import("./ja"),
  "zh-Hans": () => import("./zh-Hans"),
  ko: () => import("./ko"),
  ru: () => import("./ru"),
  hi: () => import("./hi"),
  ar: () => import("./ar")
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = await (loaders[locale] ?? loaders.en)();
  return mod.default;
}
