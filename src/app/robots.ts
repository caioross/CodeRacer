import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Ephemeral game rooms (/room/*) are intentionally kept out of the index —
// they're transient, in-memory and have no lasting content to rank. /harness/* is
// dev-only (renders 404 in production), so there's nothing there to crawl either.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/room/", "/harness/"]
      }
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url
  };
}
