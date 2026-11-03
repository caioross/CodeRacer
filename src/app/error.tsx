"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    // Surface the error for debugging in the console / monitoring.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-lg">
        <div className="inline-flex items-center gap-2 text-neon-red font-mono text-xs mb-6">
          <TriangleAlert className="size-4" />
          <span>segfault</span>
        </div>

        <h1 className="font-mono font-extrabold text-4xl md:text-5xl text-text">
          {t("error.title")}
        </h1>

        <p className="mt-4 text-text-muted text-sm font-mono">
          <span className="text-neon-green">{"// "}</span>
          {t("error.text")}
        </p>

        {error?.digest && (
          <p className="mt-3 text-text-dim text-[11px] font-mono">
            ref: {error.digest}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary px-6 py-3">
            <RotateCcw className="size-4" />
            {t("common.tryAgain")}
          </button>
          <Link href="/" className="btn-secondary px-5 py-3 inline-flex">
            <Home className="size-4" />
            {t("common.home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
