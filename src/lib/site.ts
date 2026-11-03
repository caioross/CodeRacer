// Central site/SEO config. Single source of truth for the origin, author, theme and
// keywords. Textos por idioma (título, descrição, tagline, alt do card) moram nos
// dicionários de `src/i18n/messages/` (programa 253, nov/2026).
//
// The public URL is read from NEXT_PUBLIC_SITE_URL so it can be set per
// environment (see .env.example). It must be an absolute URL with no trailing
// slash — used to resolve canonical links and social images.
//
// Fallback (#117): o padrão antigo `https://coderacer.app` é um domínio de TERCEIRO
// (responde 301 para um site Squarespace que não é do projeto) — canonical, og:image e
// sitemap trabalhavam para ele. O padrão agora é o endereço público que a casa mantém.

const RAW_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://coderacer.caiorossi.com";

export const SITE = {
  name: "CodeRacer",
  shortName: "CodeRacer",
  /** Absolute origin, no trailing slash. */
  url: RAW_URL.replace(/\/+$/, ""),

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
    "typing race",
    "code typing game",
    "multiplayer typing",
    "WPM test",
    "typing speed test",
    "typeracer for code",
    "monkeytype multiplayer",
    "corrida de digitação",
    "digitação de código",
    "jogo para programadores",
    "juego de mecanografía",
    "jeu de dactylographie",
    "Tipptrainer",
    "タイピングゲーム",
    "打字游戏",
    "JavaScript",
    "TypeScript",
    "Python",
    "Rust",
    "Go"
  ],

  themeColor: "#05060a",
  accentColor: "#00ff88",

  /** Contagem exibida em metadados; a lista real vive em `src/lib/languages.ts`. */
  codeLanguages: 24
} as const;

export type SiteConfig = typeof SITE;
