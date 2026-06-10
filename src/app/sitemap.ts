import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${SITE.url}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8
    }
  ];
}
