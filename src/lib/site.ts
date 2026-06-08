// Central site/SEO config. Single source of truth for metadata, Open Graph,
// JSON-LD, sitemap, robots and the PWA manifest.
//
// The public URL is read from NEXT_PUBLIC_SITE_URL so it can be set per
// environment (see .env.example). It must be an absolute URL with no trailing
// slash — used to resolve canonical links and social images.

const RAW_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://coderacer.app";

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
