import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// #118: /room/ deixou de ser bloqueado aqui. Os robôs de prévia de link (WhatsApp,
// Slack, Discord, X, Telegram) respeitam o robots.txt — bloqueado, o convite de sala
// saía sem card. A sala continua FORA do índice pelo `noindex` da própria página
// (room/[id]/page.tsx), que é o mecanismo certo para "pode ler, não indexe".
// /harness/* é só de dev (404 em produção) e /api/ não tem o que indexar.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/harness/", "/api/"]
      }
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url
  };
}
