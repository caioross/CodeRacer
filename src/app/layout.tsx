import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { Providers } from "@/components/Providers";
import { LOCALE_META } from "@/i18n/config";
import { getServerI18n, languageAlternates, ogLocale } from "@/i18n/server";

// Self-hosted via next/font — no render-blocking request to fonts.googleapis.com,
// no layout shift, better Core Web Vitals (and therefore SEO).
// Só `latin`: a fonte é a do CÓDIGO (sempre ASCII). Texto de interface em japonês,
// chinês, coreano, cirílico, devanágari e árabe cai nas fontes do sistema pela pilha
// de `fallback` + a regra `:lang()` do globals.css — sem baixar MBs de fonte CJK.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jetbrains",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getServerI18n();
  const og = ogLocale(locale);
  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: t("meta.title"),
      template: `%s · ${SITE.name}`
    },
    description: t("meta.description"),
    applicationName: SITE.name,
    authors: [{ name: SITE.author.name, url: SITE.author.url }],
    creator: SITE.author.name,
    publisher: SITE.author.name,
    keywords: [...SITE.keywords],
    category: "games",
    alternates: {
      canonical: "/",
      languages: languageAlternates("/")
    },
    openGraph: {
      type: "website",
      locale: og.locale,
      alternateLocale: og.alternateLocale,
      url: SITE.url,
      siteName: SITE.name,
      title: t("meta.title"),
      description: t("meta.description")
      // social image is auto-detected from app/opengraph-image.tsx
    },
    twitter: {
      card: "summary_large_image",
      title: t("meta.title"),
      description: t("meta.descriptionShort"),
      // Sem rota twitter-image (ver o commit do EBUSY): o card do X usa a mesma imagem.
      images: ["/opengraph-image"],
      ...(SITE.twitter ? { creator: `@${SITE.twitter}`, site: `@${SITE.twitter}` } : {})
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: ["/favicon.svg"]
      // apple-touch-icon vem de app/apple-icon.png
    },
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false }
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
  themeColor: SITE.themeColor
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, messages, t } = await getServerI18n();

  // Rich result for search engines: a free, browser-based multiplayer game.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    alternateName: "Code Racer",
    url: SITE.url,
    description: t("meta.description"),
    applicationCategory: "GameApplication",
    operatingSystem: "Any (modern web browser)",
    browserRequirements: "Requires JavaScript",
    inLanguage: ["pt-BR", "en", "es", "fr", "de", "it", "ja", "zh-Hans", "ko", "ru", "hi", "ar"],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Multiplayer typing race in real time",
      `${SITE.codeLanguages} programming languages`,
      "12 interface languages",
      "Live WPM and accuracy metrics",
      "Solo practice mode",
      "Shareable room codes",
      "Podium and in-room chat",
      "No signup required"
    ],
    author: {
      "@type": "Person",
      name: SITE.author.name,
      url: SITE.author.url
    },
    image: `${SITE.url}/opengraph-image`,
    screenshot: `${SITE.url}/opengraph-image`
  };

  return (
    <html lang={locale} dir={LOCALE_META[locale].dir} className={`dark ${jetbrainsMono.variable}`}>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
        <script
          type="application/ld+json"
          // Static, trusted JSON — safe to inline for rich results.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
