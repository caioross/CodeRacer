import Link from "next/link";
import { Home, Terminal } from "lucide-react";
import { getServerI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getServerI18n();
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-lg">
        <div className="inline-flex items-center gap-2 text-text-dim font-mono text-xs mb-6">
          <Terminal className="size-3.5 text-neon-green" />
          <span>coderacer ~ %</span>
        </div>

        <h1 className="font-mono font-extrabold text-7xl md:text-8xl">
          <span className="gradient-text">404</span>
        </h1>

        <p className="mt-4 text-text font-mono">
          <span className="text-neon-red">Error:</span> {t("notFound.error")}
        </p>
        <p className="mt-2 text-text-muted text-sm font-mono">
          <span className="text-neon-green">{"// "}</span>
          {t("notFound.text")}
        </p>

        <div className="mt-8">
          <Link href="/" className="btn-primary px-6 py-3 inline-flex">
            <Home className="size-4" />
            {t("notFound.back")}
          </Link>
        </div>
      </div>
    </main>
  );
}
