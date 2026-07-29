import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Home, Target, Trophy, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { MatrixRain } from "@/components/MatrixRain";
import { getLeaderboard, getRecentMatches, isSupabaseConfigured } from "@/lib/supabase";
import { DIFFICULTIES, LANGUAGES, langById } from "@/lib/languages";
import { isValidDifficulty, isValidLang } from "@/lib/room";
import {
  PERIODS,
  filtersToHref,
  hasActiveFilter,
  periodSinceISO,
  resolvePeriod,
  type LeaderboardFilters
} from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ranking Global — os devs mais rápidos",
  description:
    "Veja quem digita código mais rápido no CodeRacer: ranking global de WPM, precisão e partidas recentes.",
  alternates: { canonical: "/leaderboard" }
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  return `${d} d atrás`;
}

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`);

/** Primeiro valor de um param repetido (`?lang=a&lang=b`) — o resto é ignorado. */
const firstParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

/**
 * Um chip de filtro. É `<Link>` (navegação, não toggle), então o estado do
 * filtro fica na URL — compartilhável e no histórico do navegador — e a página
 * segue 100% servidor, sem JS novo. Ativo é marcado com `aria-current="page"`.
 *
 * A cor de marca da linguagem NÃO pinta o texto do chip: são hex de terceiros,
 * nunca validados contra `--bg-card`, e 15 das 24 reprovam AA em `text-[11px]`
 * (`lua #2c2d72` = 1.58:1, `elixir #4b275f` = 1.61:1 — ilegíveis). A sigla é o
 * único portador da informação aqui, então ela usa o token do tema
 * (`text-text-muted`, ~5:1) e a identidade da linguagem fica no `aria-label` —
 * `docs/UI-AAA-OVERHAUL.md:108` regra (4) e §I.1.3.
 */
function Chip({
  href,
  active,
  label,
  children
}: {
  href: string;
  active: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`px-2 py-1 rounded-md border text-[11px] font-mono font-bold ${
        active
          ? "border-neon-green/60 bg-neon-green/10 text-neon-green"
          : "border-bg-line text-text-muted hover:text-text hover:border-text-dim"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Fronteira: a query string vira predicado de Postgres, então só passa pela
  // allowlist já usada pelas rotas de sala (`room.ts`). Valor inválido numa URL
  // compartilhada NÃO é 400 — cai no default (sem filtro), que é o certo aqui.
  const rawLang = firstParam(searchParams.lang);
  const rawDiff = firstParam(searchParams.diff);
  const filters: LeaderboardFilters = {
    lang: isValidLang(rawLang) ? rawLang : undefined,
    diff: isValidDifficulty(rawDiff) ? rawDiff : undefined,
    period: resolvePeriod(firstParam(searchParams.period))
  };
  const filtered = hasActiveFilter(filters);

  const configured = isSupabaseConfigured();
  const [leaders, matches] = await Promise.all([
    getLeaderboard(25, {
      lang: filters.lang,
      diff: filters.diff,
      sinceISO: periodSinceISO(filters.period, Date.now())
    }),
    getRecentMatches(12)
  ]);

  return (
    <main className="relative min-h-screen">
      <MatrixRain opacity={0.04} />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-bg-line bg-bg/50 backdrop-blur">
        <Link href="/" className="flex items-center gap-2" aria-label="Voltar para a home">
          <Logo size="sm" />
        </Link>
        <Link href="/" className="btn-secondary px-3 py-1.5 text-xs">
          <Home className="size-3.5" /> home
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-6 py-8">
        {/* title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-neon-amber">
            <Trophy className="size-7" />
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight gradient-text">
              Ranking Global
            </h1>
          </div>
          <p className="mt-3 text-text-muted text-sm font-mono">
            <span className="text-neon-green">// </span>
            os programadores que digitam código mais rápido — recorde de WPM por jogador.
          </p>
        </div>

        {!configured && (
          <div className="card p-4 mb-8 border-neon-amber/40 text-sm">
            <span className="text-neon-amber font-mono">⚠ Supabase não configurado.</span>{" "}
            <span className="text-text-muted">
              Defina <code className="text-neon-cyan">SUPABASE_URL</code> e{" "}
              <code className="text-neon-cyan">SUPABASE_SERVICE_ROLE_KEY</code> para registrar
              partidas.
            </span>
          </div>
        )}

        {leaders.length === 0 && !filtered ? (
          <div className="card p-10 text-center">
            <div className="text-5xl mb-3">🏁</div>
            <p className="text-text font-mono">Ainda não há partidas registradas.</p>
            <p className="text-text-muted text-sm mt-1">
              Seja o primeiro recorde — chame a galera e corra!
            </p>
            <Link href="/" className="btn-primary mt-6 inline-flex px-5 py-2.5">
              <Zap className="size-4" /> jogar agora
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* leaderboard table */}
            <section className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-bg-line flex items-center gap-2">
                <Crown className="size-4 text-neon-amber" />
                <span className="label">// melhores WPM</span>
                {filtered && (
                  <Link
                    href="/leaderboard"
                    className="ml-auto text-[11px] font-mono text-text-muted hover:text-neon-green"
                  >
                    limpar filtros ✕
                  </Link>
                )}
              </div>

              {/* filtros — o ranking sem eles mede qual bucket o jogador
                  escolheu, não quem digita mais rápido (#92) */}
              <div className="px-4 py-3 border-b border-bg-line space-y-2">
                <div role="group" aria-label="Filtrar por linguagem" className="flex flex-wrap gap-1">
                  <Chip href={filtersToHref(filters, { lang: undefined })} active={!filters.lang}>
                    todas
                  </Chip>
                  {LANGUAGES.map(l => (
                    <Chip
                      key={l.id}
                      href={filtersToHref(filters, { lang: l.id })}
                      active={filters.lang === l.id}
                      label={l.label}
                    >
                      {l.icon}
                    </Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div
                    role="group"
                    aria-label="Filtrar por dificuldade"
                    className="flex flex-wrap gap-1"
                  >
                    <Chip href={filtersToHref(filters, { diff: undefined })} active={!filters.diff}>
                      todas
                    </Chip>
                    {DIFFICULTIES.map(d => (
                      <Chip
                        key={d.id}
                        href={filtersToHref(filters, { diff: d.id })}
                        active={filters.diff === d.id}
                      >
                        {d.label}
                      </Chip>
                    ))}
                  </div>
                  <div
                    role="group"
                    aria-label="Filtrar por período"
                    className="flex flex-wrap gap-1"
                  >
                    {PERIODS.map(p => (
                      <Chip
                        key={p.id}
                        href={filtersToHref(filters, { period: p.id })}
                        active={filters.period === p.id}
                      >
                        {p.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>

              {leaders.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-text-muted font-mono">
                  nenhum recorde neste filtro ainda — seja o primeiro.
                </p>
              ) : (
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="text-left text-text-muted text-[11px] uppercase tracking-wider border-b border-bg-line">
                    <th className="px-4 py-2 w-14">#</th>
                    <th className="px-2 py-2">jogador</th>
                    <th className="px-2 py-2 text-right">wpm</th>
                    <th className="px-2 py-2 text-right hidden sm:table-cell">precisão</th>
                    <th className="px-3 py-2 text-right">lang</th>
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
                        <td className="px-2 py-2.5 font-semibold text-text">{p.name}</td>
                        <td className="px-2 py-2.5 text-right font-bold text-neon-green text-base">
                          {p.wpm}
                        </td>
                        <td className="px-2 py-2.5 text-right text-text-muted hidden sm:table-cell">
                          {p.accuracy}%
                        </td>
                        <td className="px-3 py-2.5 text-right">
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
              )}
            </section>

            {/* recent matches */}
            <aside className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-neon-cyan" />
                <span className="label">// partidas recentes</span>
              </div>
              {matches.length === 0 ? (
                <div className="card p-4 text-text-muted text-sm">nenhuma ainda</div>
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
                          {m.winner_wpm ?? 0} wpm
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-text-dim font-mono">
                        <span style={{ color: lang?.color || "#7d8590" }}>
                          {lang?.label || m.language}
                        </span>
                        <span>·</span>
                        <span>{m.difficulty}</span>
                        <span>·</span>
                        <span>{m.player_count}p</span>
                        <span className="ml-auto">{timeAgo(m.finished_at)}</span>
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
