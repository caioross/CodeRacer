// Idiomas da interface (programa 253, nov/2026). O CÓDIGO a digitar não se traduz —
// só a interface, os metadados e o card social.
//
// Ordem = a do seletor: os dois idiomas de origem primeiro, depois os maiores públicos
// de jogo (dossiê de IA em jogos 2026, §8.4) e por fim os de escrita não latina.

export const LOCALES = [
  "pt-BR",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "ja",
  "zh-Hans",
  "ko",
  "ru",
  "hi",
  "ar"
] as const;

export type Locale = (typeof LOCALES)[number];

/** Quem chega sem nenhuma pista de idioma (crawler, `Accept-Language` vazio) cai no inglês. */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie de preferência (1 ano). Lido no servidor (layout) e escrito pelo seletor. */
export const LOCALE_COOKIE = "cr_lang";

/** Cabeçalho interno: o middleware traduz `?lang=xx` nele para o layout já renderizar no idioma pedido. */
export const LOCALE_HEADER = "x-cr-lang";

export interface LocaleMeta {
  /** Nome no próprio idioma (o seletor mostra assim). */
  native: string;
  /** Rótulo curto para o botão do seletor. */
  short: string;
  dir: "ltr" | "rtl";
  /** Valor de `og:locale`. */
  og: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  "pt-BR": { native: "Português (Brasil)", short: "PT", dir: "ltr", og: "pt_BR" },
  en: { native: "English", short: "EN", dir: "ltr", og: "en_US" },
  es: { native: "Español", short: "ES", dir: "ltr", og: "es_ES" },
  fr: { native: "Français", short: "FR", dir: "ltr", og: "fr_FR" },
  de: { native: "Deutsch", short: "DE", dir: "ltr", og: "de_DE" },
  it: { native: "Italiano", short: "IT", dir: "ltr", og: "it_IT" },
  ja: { native: "日本語", short: "JA", dir: "ltr", og: "ja_JP" },
  "zh-Hans": { native: "简体中文", short: "ZH", dir: "ltr", og: "zh_CN" },
  ko: { native: "한국어", short: "KO", dir: "ltr", og: "ko_KR" },
  ru: { native: "Русский", short: "RU", dir: "ltr", og: "ru_RU" },
  hi: { native: "हिन्दी", short: "HI", dir: "ltr", og: "hi_IN" },
  ar: { native: "العربية", short: "AR", dir: "rtl", og: "ar_AR" }
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/**
 * Casa uma etiqueta BCP 47 qualquer ("pt", "pt-PT", "zh-CN", "zh-Hant-TW", "EN_us") com um
 * idioma suportado. Devolve `null` se não houver nenhum parecido.
 * - português de qualquer região → pt-BR (é a única variante que temos);
 * - chinês de qualquer região/escrita → zh-Hans (não há tradicional ainda);
 * - o resto pela língua-base (es-MX → es, fr-CA → fr...).
 */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const clean = tag.trim().replace(/_/g, "-");
  if (!clean || clean === "*") return null;
  const exact = LOCALES.find(l => l.toLowerCase() === clean.toLowerCase());
  if (exact) return exact;
  const base = clean.split("-")[0].toLowerCase();
  if (base === "pt") return "pt-BR";
  if (base === "zh") return "zh-Hans";
  const byBase = LOCALES.find(l => l.toLowerCase() === base);
  return byBase ?? null;
}

/** Escolhe o idioma a partir de um `Accept-Language` (respeita os pesos `q`). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;
  const prefs = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag, weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter(p => p.tag && p.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const p of prefs) {
    const m = matchLocale(p.tag);
    if (m) return m;
  }
  return null;
}

/**
 * Ordem de decisão do idioma: `?lang=` (via cabeçalho do middleware) → cookie → navegador → inglês.
 */
export function resolveLocale(opts: {
  header?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return (
    matchLocale(opts.header) ??
    matchLocale(opts.cookie) ??
    negotiateLocale(opts.acceptLanguage) ??
    DEFAULT_LOCALE
  );
}
