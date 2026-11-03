import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Home, Target, Trophy, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { MatrixRain } from "@/components/MatrixRain";
import { getLeaderboard, getRecentMatches, isSupabaseConfigured } from "@/lib/supabase";
import { langById } from "@/lib/languages";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getServerI18n, languageAlternates } from "@/i18n/server";
import { renderRich } from "@/i18n/rich";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("meta.leaderboardTitle"),
    description: t("meta.leaderboardDescription"),
    alternates: { canonical: "/leaderboard", languages: languageAlternates("/leaderboard") }
  };
}

export default async function LeaderboardPage() {
  const { t, ord, ago, difficulty, num } = await getServerI18n();
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ord(i + 1));
  const configured = isSupabaseConfigured();
  const [lb, recent] = await Promise.all([getLeaderboard(25), getRecentMatches(12)]);
  const leaders = lb.rows;
  const matches = recent.rows;
  const unavailable = configured && (lb.failed || recent.failed);

  return (
    <main className="relative min-h-screen">
      <MatrixRain opacity={0.04} />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-bg-line bg-bg/50 backdrop-blur">
        <Link href="/" className="flex items-center gap-2" aria-label={t("common.backHome")}>
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/" className="btn-secondary px-3 py-1.5 text-xs">
            <Home className="size-3.5" /> {t("common.home")}
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-6 py-8">
        {/* title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-neon-amber">
            <Trophy className="size-7" />
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight gradient-text">
              {t("leaderboard.title")}
            </h1>
          </div>
          <p className="mt-3 text-text-muted text-sm font-mono">
            <span className="text-neon-green">{"// "}</span>
            {t("leaderboard.subtitle")}
          </p>
        </div>

        {!configured && (
          <div className="card p-4 mb-8 border-neon-amber/40 text-sm">
            <span className="text-neon-amber font-mono">{t("leaderboard.notConfigured")}</span>{" "}
            <span className="text-text-muted">
              {renderRich(t("leaderboard.notConfiguredHint"), {
                c: chunk => <code className="text-neon-cyan">{chunk}</code>
              })}
            </span>
          </div>
        )}

        {unavailable && (
          <div role="status" className="card border-neon-amber/40 p-4 mb-6 text-sm text-neon-amber font-mono text-center">
            {t("leaderboard.unavailable")}
          </div>
        )}

        {leaders.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-3">🏁</div>
            <p className="text-text font-mono">{t("leaderboard.empty")}</p>
            <p className="text-text-muted text-sm mt-1">
              {t("leaderboard.emptyHint")}
            </p>
            <Link href="/" className="btn-primary mt-6 inline-flex px-5 py-2.5">
              <Zap className="size-4" /> {t("leaderboard.playNow")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* leaderboard table */}
            <section className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-bg-line flex items-center gap-2">
                <Crown className="size-4 text-neon-amber" />
                <span className="label">{t("leaderboard.best")}</span>
              </div>
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-left text-text-muted text-[11px] uppercase tracking-wider border-b border-bg-line">
                    <th scope="col" className="px-4 py-2 w-14 text-start">#</th>
                    <th scope="col" className="px-2 py-2 text-start">{t("common.player")}</th>
                    <th scope="col" className="px-2 py-2 text-end">{t("common.wpm")}</th>
                    <th scope="col" className="px-2 py-2 text-end hidden sm:table-cell">{t("common.accuracy")}</th>
                    <th scope="col" className="px-3 py-2 text-end">{t("leaderboard.lang")}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((p, i) => {
                    const lang = langById(p.language);
                    const top = i < 3;
                    return (
                      <tr
                        key={`${p.name}-${i}`}
                        className={`border-b border-bg-line/60 ${top ? "bg-neon-amber/5" : ""}`}
                      >
                        <td className="px-4 py-2.5 text-text-dim">{medal(i)}</td>
                        <th scope="row" className="px-2 py-2.5 font-semibold text-text text-start">{p.name}</th>
                        <td className="px-2 py-2.5 text-end font-bold text-neon-green text-base tabular-nums">
                          {p.wpm}
                        </td>
                        <td className="px-2 py-2.5 text-end text-text-muted hidden sm:table-cell tabular-nums">
                          {p.accuracy}%
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: lang?.color || "#7d8590" }}
                          >
                            {lang?.icon || p.language}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* recent matches */}
            <aside className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-neon-cyan" />
                <span className="label">{t("leaderboard.recent")}</span>
              </div>
              {matches.length === 0 ? (
                <div className="card p-4 text-text-muted text-sm">{t("leaderboard.none")}</div>
              ) : (
                matches.map(m => {
                  const lang = langById(m.language);
                  return (
                    <div key={m.id} className="card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-text truncate">
                          🏆 {m.winner_name || "—"}
                        </span>
                        <span className="text-neon-green font-mono text-sm font-bold shrink-0">
                          {num(m.winner_wpm ?? 0)} wpm
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-text-dim font-mono">
                        <span style={{ color: lang?.color || "#7d8590" }}>
                          {lang?.label || m.language}
                        </span>
                        <span>·</span>
                        <span>{difficulty(m.difficulty)}</span>
                        <span>·</span>
                        <span>{m.player_count}p</span>
                        <span className="ms-auto">{ago(m.finished_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
