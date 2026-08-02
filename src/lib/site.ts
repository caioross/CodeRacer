// Central site/SEO config. Single source of truth for metadata, Open Graph,
// JSON-LD, sitemap, robots and the PWA manifest.
//
// A origem pública é DESCOBERTA, não chutada: um literal hardcoded aqui vira o
// canonical, o `Host:` do robots.txt, o `<loc>` do sitemap e o `og:image` de
// todo link compartilhado — se ele não for o host que serve o site, nenhum
// unfurl carrega e o SEO é atribuído a outra origem (#117).

/** Variáveis de ambiente que podem revelar a origem pública do deploy. */
export type SiteUrlEnv = {
  /** Override explícito do dono — sempre vence (ver .env.example). */
  NEXT_PUBLIC_SITE_URL?: string;
  /** Domínio de produção do projeto na Vercel (estável entre deploys). */
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  /** Domínio do deploy corrente na Vercel (único por deploy — preview). */
  NEXT_PUBLIC_VERCEL_URL?: string;
  VERCEL_URL?: string;
};

/** Último recurso: só vale em dev, quando nada mais revela a origem. */
const DEV_FALLBACK_URL = "http://localhost:3000";

// As variáveis da Vercel chegam como hostname puro (`meu-app.vercel.app`), sem
// protocolo; `NEXT_PUBLIC_SITE_URL` chega como URL absoluta. Aceitamos as duas
// formas e devolvemos sempre origem absoluta sem barra final.
function normalizeOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
  } catch {
    return null;
  }
  return candidate.replace(/\/+$/, "");
}

/**
 * Resolve a origem pública do site na ordem: override do dono → domínio de
 * produção do provedor → domínio do deploy corrente → fallback de dev.
 *
 * Pura e exportada para teste (`site.test.ts`): o chamador injeta o ambiente.
 */
export function resolveSiteUrl(env: SiteUrlEnv): string {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.NEXT_PUBLIC_VERCEL_URL,
    env.VERCEL_URL
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }
  return DEV_FALLBACK_URL;
}

// Cada `process.env.X` precisa ser um acesso literal: é assim que o Next
// substitui as `NEXT_PUBLIC_*` no bundle do cliente em tempo de build.
const RAW_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  VERCEL_URL: process.env.VERCEL_URL
});

export const SITE = {
  name: "CodeRacer",
  shortName: "CodeRacer",
  /** Absolute origin, no trailing slash. */
  url: RAW_URL.replace(/\/+$/, ""),
  /** Marketing one-liner (used in <title> template and OG). */
  tagline: "race your friends, one keystroke at a time",
  locale: "pt_BR",
  altLocale: "en_US",

  title: {
    pt: "CodeRacer — corrida de digitação multiplayer para devs",
    en: "CodeRacer — multiplayer code-typing race for developers"
  },

  description: {
    pt: "Corrida de digitação multiplayer para programadores. Crie uma sala, mande o link pros amigos e dispute quem digita o snippet de código mais rápido — sem cadastro, sem firula. 8 linguagens, WPM e precisão em tempo real, pódio e chat.",
    en: "Multiplayer typing race for programmers. Spin up a room, share the link and battle to type the code snippet fastest — no signup, no fluff. 8 languages, live WPM & accuracy, podium and chat."
  },

  /** Short description for cards/manifest (under ~160 chars). */
  descriptionShort: {
    pt: "Dispute com amigos quem digita código mais rápido. 8 linguagens, WPM em tempo real, sem cadastro.",
    en: "Race friends to type code the fastest. 8 languages, live WPM, no signup."
  },

  author: {
    name: "Caio",
    handle: "caioross",
    url: "https://github.com/caioross"
  },

  repo: "https://github.com/caioross/CodeRacer",

  /** Twitter/X handle (without @). Leave empty if there's none. */
  twitter: "",

  keywords: [
    "CodeRacer",
    "corrida de digitação",
    "digitação de código",
    "typing race",
    "code typing game",
    "multiplayer typing",
    "jogo de digitação",
    "jogo para programadores",
    "teste de WPM",
    "WPM test",
    "velocidade de digitação",
    "typeracer para código",
    "monkeytype multiplayer",
    "typing speed test",
    "programação",
    "JavaScript",
    "TypeScript",
    "Python",
    "Rust",
    "Go"
  ],

  themeColor: "#05060a",
  accentColor: "#00ff88",

  ogImageAlt:
    "CodeRacer — corrida de digitação de código multiplayer, tema dark hacker com neon verde",

  languages: ["JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Rust"]
} as const;

export type SiteConfig = typeof SITE;
