import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { LOCALES } from "@/i18n/config";

// Páginas públicas + hreflang por idioma (`?lang=`). `/practice` entrou (#84).
function languages(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = `${SITE.url}${path}?lang=${l}`;
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1, alternates: { languages: languages("/") } },
    {
      url: `${SITE.url}/practice`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: { languages: languages("/practice") }
    },
    {
      url: `${SITE.url}/leaderboard`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
      alternates: { languages: languages("/leaderboard") }
    }
  ];
}
