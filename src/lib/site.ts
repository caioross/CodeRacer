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
  /** `"1"` dentro de qualquer build da Vercel — lá não existe origem de dev. */
  VERCEL?: string;
};

/** Último recurso: só vale FORA da Vercel (dev/CI), nunca num deploy. */
const DEV_FALLBACK_URL = "http://localhost:3000";

// `VERCEL_URL` (a URL única do deployment) foi deliberadamente deixada de fora
// da cadeia: ela não é uma identidade pública. Medido no deploy de produção
// deste projeto — `curl -I https://code-racer-<hash>-caiorossi-projects1.vercel.app/`
// devolve `302` para o SSO da Vercel com `X-Robots-Tag: noindex`, e o valor muda
// a cada deploy. Anunciá-la como canonical seria trocar um domínio errado por um
// canonical privado, `noindex` e rotativo — pior que o bug que a #117 conserta.

// As variáveis da Vercel chegam como hostname puro (`meu-app.vercel.app`), sem
// protocolo; `NEXT_PUBLIC_SITE_URL` chega como URL absoluta. Aceitamos as duas
// formas e devolvemos SEMPRE a origem reconstruída a partir do parse — nunca a
// string crua. Reconstruir é o que descarta userinfo, query e fragmento e o que
// percent-encoda `<`, `>`, CR/LF e NUL: `SITE.url` é interpolado verbatim no
// `Host:` do robots.txt, no `<loc>` do sitemap e dentro do <script> do JSON-LD,
// que não escapam nada.
function normalizeOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // Esquema explícito que não seja http(s) é recusado de saída — sem isto,
  // `ftp://x.com` viraria `https://ftp://x.com` (host `ftp`).
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return null;
  const candidate = hasScheme ? value : `https://${value.replace(/^\/+/, "")}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    // `origin` já é `protocolo//host[:porta]` sem credencial; o `pathname` cobre
    // deploy em subcaminho. Query e fragmento não fazem parte de uma origem.
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Resolve a origem pública do site na ordem: override do dono → domínio de
 * produção do provedor → fallback de dev (só fora da Vercel).
 *
 * Pura e exportada para teste (`site.test.ts`): o chamador injeta o ambiente.
 *
 * **Lança** quando roda dentro da Vercel sem nenhuma origem descoberta: um build
 * quebrado é visível na hora e não sai do ar (a Vercel mantém o deploy anterior),
 * enquanto um canonical `http://localhost:3000` publicado em silêncio manda o
 * unfurler de todo convite bater no loopback de quem clicou.
 */
export function resolveSiteUrl(env: SiteUrlEnv): string {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }
  if (env.VERCEL) {
    throw new Error(
      "[site] Origem pública indefinida num build da Vercel. Ligue as System " +
        "Environment Variables do projeto (expõe VERCEL_PROJECT_PRODUCTION_URL) " +
        "ou defina NEXT_PUBLIC_SITE_URL com a URL que serve o site."
    );
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
  VERCEL: process.env.VERCEL
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
