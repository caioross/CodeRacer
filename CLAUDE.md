# CodeRacer — instruções para agentes

Corrida de digitação multiplayer para programadores. Next.js 14 (App Router) + TypeScript +
Supabase (Realtime + Postgres) + Tailwind + Framer Motion. **LIVE em produção na Vercel** —
merge na `main` = deploy. Sem login; salas ao vivo em memória (Realtime), partidas terminadas
persistem em `matches`/`scores` (leaderboard).

## Comandos

- `pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint`
- Validações do domínio: `node scripts/validate-metrics.mjs` (engine de digitação) e
  `node scripts/validate-persistence.mjs` (persistência) — baratos, rode na dúvida.
- `pnpm db:migrate` aplica migrations no banco — **só o dono roda**. Agentes apenas criam
  arquivos aditivos/idempotentes em `supabase/migrations/`.

## Regras

- **Área sagrada:** latência de input na corrida (60fps; nada de trabalho pesado competindo
  com a `textarea`). `prefers-reduced-motion` sempre respeitado.
- Nunca ler/comitar `.env.local` ou segredos. `SUPABASE_SERVICE_ROLE_KEY` jamais chega ao cliente.
- Rotinas autônomas: leia **`AGENTS.md`** (contrato de agente, vale para todos os runtimes) e
  `docs/fleet/HANDBOOK.md` (a lei da frota) antes de agir. Órgãos: Diário = issue #4 ·
  Quadro = Project #30 · Discussions = retro/ideias/decisões (IDs e receitas em
  `.agents/skills/cr-fleet-ops/references/github-orgaos.md`).
- Skills do projeto em **`.agents/skills/`** — índice em `.agents/skills/_INDICE_SKILLS.md`
  (`cr-typing-engine`, `cr-multiplayer`, `cr-fleet-ops` + transversais de segurança/testes).
  Mudou de `.claude/skills/` em 2026-09-23: `.agents/skills/` é descoberto pelo Codex **e** pelo
  Antigravity **e** pelo Claude — a mesma skill serve os três, sem cópia.
- **Claim agora é ref do git** (`refs/frota/claims/issue-<N>`), não label — veja `AGENTS.md` §A.
- Roadmap/spec de qualidade: `docs/UI-AAA-OVERHAUL.md` (Parte VII = fases).
