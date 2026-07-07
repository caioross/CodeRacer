# Índice de Skills — CodeRacer

> Corrida de digitação multiplayer em tempo real para programadores.
> Stack: Next.js 14.2 + TypeScript 5.6 + Supabase Realtime + Tailwind CSS + Framer Motion.
> Caminho do projeto: `E:\Projetos\Jogos\CodeRacer`
> Relatório completo: `E:\Projetos\Dashboards\Relatorios\Relatorio_CodeRacer.md`

---

## Skills disponíveis

### `cr-typing-engine`
**Quando usar:** qualquer tarefa que toque o motor de digitação — cálculo de WPM/precisão/erros,
modificação de `Race.tsx` ou `CodeDisplay.tsx`, broadcastProgress, anti-cheat, modo solo futuro.

**Arquivos chave do projeto:**
- `src/components/Race.tsx` — fórmulas de WPM, precisão, progresso, handleInput
- `src/components/CodeDisplay.tsx` — renderização char-a-char do snippet
- `src/lib/useRoom.ts` — broadcastProgress, throttle, sendProgress

**Scripts:**
- `scripts/validate-metrics.mjs` — 24 casos de teste das fórmulas de WPM/precisão/progresso

**Referências:**
- `references/anti-cheat.md` — plano de validação de tempo implausível e WPM suspeito (P1)

---

### `cr-multiplayer`
**Quando usar:** qualquer tarefa que toque salas, tempo real, fluxo de estado, leaderboard,
persistência de partidas, migrations Supabase, claim-leader, ou modo fantasma futuro.

**Arquivos chave do projeto:**
- `src/lib/useRoom.ts` — hub do Realtime (Presence + Broadcast + postgres_changes)
- `src/app/api/rooms/route.ts` — POST criar sala
- `src/app/api/rooms/[code]/route.ts` — actions: start, finish, reset, claim-leader, settings
- `src/lib/room.ts` — tipos de sala: RoomRow, ResultRow, ProgressMsg, PresenceMeta, LivePlayer
- `src/lib/supabase.ts` — client server-side (service role), getLeaderboard, getRecentMatches
- `src/app/leaderboard/page.tsx` — ranking global (Server Component, force-dynamic)
- `supabase/migrations/0001_coderacer_init.sql` — schema: matches, scores, view leaderboard
- `supabase/migrations/0002_realtime_rooms.sql` — habilita Realtime em rooms

**Scripts:**
- `scripts/validate-persistence.mjs` — valida sanitização de ResultRow e MatchInsert

**Referências:**
- `references/realtime-architecture.md` — detalhe dos três canais (Presence/Broadcast/postgres_changes)

---

### `cr-fleet-ops`
**Quando usar:** você é uma rotina agendada da frota (Curador 11h, Resolvedor 14h, PR Doctor 18h)
ou vai operar issues/PRs/branches `auto/*` do repo. Receitas de claim, worktree, gate, quórum,
merge/limpeza e Diário de Bordo. A lei da frota é `docs/fleet/HANDBOOK.md`.

---

## Skills transversais relevantes

| Skill | Quando usar no CodeRacer |
|---|---|
| `../web-security-audit` | Auditoria de segurança: SUPABASE_SERVICE_ROLE_KEY, RLS, headers HTTP |
| `../supabase-rls-guard` | Revisar ou adicionar policies RLS em matches/scores/rooms |
| `../secrets-guardian` | Se suspeitar que alguma chave vazou no histórico git |
| `../git-hygiene` | Commits pequenos, remover `.env.local` do histórico se necessário |
| `../test-foundation` | Adicionar Jest + RTL ou Playwright ao projeto (principal dívida técnica) |

---

## Estado do projeto

| Aspecto | Status |
|---|---|
| Funcionalidade core | Completa (MVP/Beta pronto para deploy) |
| Testes | Zero — principal dívida técnica |
| CI | Configurada (typecheck + build no GitHub Actions) |
| Deploy | Vercel zero-config; requer `SUPABASE_*` e `NEXT_PUBLIC_SITE_URL` |
| Nota de saúde | 8,5/10 |
