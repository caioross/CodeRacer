import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";

// Self-hosted via next/font — no render-blocking request to fonts.googleapis.com,
// no layout shift, better Core Web Vitals (and therefore SEO).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jetbrains",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title.pt,
    template: `%s · ${SITE.name}`
  },
  description: SITE.description.pt,
  applicationName: SITE.name,
  authors: [{ name: SITE.author.name, url: SITE.author.url }],
  creator: SITE.author.name,
  publisher: SITE.author.name,
  keywords: [...SITE.keywords],
  category: "games",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    alternateLocale: SITE.altLocale,
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.title.pt,
    description: SITE.description.pt
    // social image is auto-detected from app/opengraph-image.tsx
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title.pt,
    description: SITE.descriptionShort.pt,
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
    // apple-touch-icon is auto-injected from app/apple-icon.tsx
  },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, email: false, address: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
  themeColor: SITE.themeColor
};

// Rich result for search engines: a free, browser-based multiplayer game.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  alternateName: "Code Racer",
  url: SITE.url,
  description: SITE.description.pt,
  applicationCategory: "GameApplication",
  operatingSystem: "Any (modern web browser)",
  browserRequirements: "Requires JavaScript and WebSocket support",
  inLanguage: ["pt-BR", "en"],
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Multiplayer typing race in real time",
    "8 programming languages",
    "Live WPM and accuracy metrics",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${jetbrainsMono.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          // Static, trusted JSON — safe to inline for rich results.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
