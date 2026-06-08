import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Ephemeral game rooms (/room/*) are intentionally kept out of the index —
// they're transient, in-memory and have no lasting content to rank.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/room/"]
      }
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url
  };
}
