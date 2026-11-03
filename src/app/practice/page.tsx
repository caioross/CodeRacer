import type { Metadata } from "next";
import { PracticeView } from "@/components/PracticeView";
import { getServerI18n, languageAlternates } from "@/i18n/server";

// #84: /practice indexável, no idioma de quem chega, com hreflang e no sitemap.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("meta.practiceTitle"),
    description: t("meta.practiceDescription"),
    alternates: { canonical: "/practice", languages: languageAlternates("/practice") },
    openGraph: { title: t("meta.practiceTitle"), description: t("meta.practiceDescription"), url: "/practice" }
  };
}

export default function PracticePage() {
  return <PracticeView />;
}
