import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getServerI18n } from "@/i18n/server";

// Manifest no idioma de quem instala (cookie/Accept-Language) e com ícones PNG — o
// Android pede 192 e 512 (e um `maskable`) para instalar o PWA direito; SVG sozinho
// não basta em todo navegador.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t, locale, dir } = await getServerI18n();
  return {
    name: `${SITE.name} — ${t("meta.tagline")}`,
    short_name: SITE.shortName,
    description: t("meta.descriptionShort"),
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#05060a",
    theme_color: SITE.themeColor,
    categories: ["games", "education", "developer"],
    lang: locale,
    dir,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ]
  };
}
