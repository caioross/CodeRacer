---
name: cr-multiplayer
description: Salas multiplayer em tempo real, leaderboard global e persistência de partidas do CodeRacer (Next.js + Supabase Realtime). Use SEMPRE que a tarefa tocar useRoom.ts, salas, presenza, broadcast, fluxo lobby→countdown→racing→finished, leaderboard, tabelas matches/scores, migrations Supabase, claim-leader, persistMatch, ou qualquer lógica de sala e ranking, mesmo que o usuário não cite "multiplayer".
---

# cr-multiplayer — Salas, Tempo Real e Leaderboard

## Quando usar
Toda vez que a tarefa envolver:
- Alterar o fluxo de estados da sala (`lobby → racing → finished`)
- Modificar `src/lib/useRoom.ts` ou `src/app/api/rooms/`
- Depurar Presence/Broadcast do Supabase Realtime
- Adicionar salas privadas, limitar acesso, ou expirar salas
- Corrigir/evoluir o leaderboard (`leaderboard/page.tsx`, `supabase/migrations/`)
- Adicionar persistência de histórico de partidas além do leaderboard atual
- Implementar modo solo vs. fantasmas (replay de `ResultRow`)
- Entender a eleição de líder ou o fluxo de desistência (`abandon`)

## Arquitetura de multiplayer (sem servidor WebSocket próprio)

O CodeRacer usa **três canais** do Supabase Realtime em paralelo por sala:

```
Supabase Realtime channel: "coderacer:room:{code}"
│
├── Presence (durável por sessão)
│   ├── track({ id, name, color, avatar, joinedAt })
│   ├── sync → rebuild do roster de jogadores em tempo real
│   ├── join → mensagem de sistema "X entrou na sala"
│   └── leave → mensagem de sistema "X saiu"
│
├── Broadcast (efêmero, não toca o banco)
│   ├── event "progress" → { id, progress, wpm, accuracy, errors, finishedAt }
│   │   throttle: PROGRESS_THROTTLE_MS = 120 ms (exceto ao finalizar)
│   └── event "chat"     → { id, playerId, name, text, at }
│
└── postgres_changes em "rooms" WHERE code = {code}
    └── qualquer UPDATE na linha → rebroad cast para todos os clientes
        (status, snippet, start_at, leader_id mudam aqui)
```

### Mutações de sala: apenas via API routes (service role)

```
POST /api/rooms/              → cria sala (nanoid código 6 letras)
POST /api/rooms/[code]
  action=settings             → atualiza language/difficulty/maxPlayers (só líder)
  action=start                → pickSnippet + define start_at = now + 4 s + status=racing
  action=finish               → status=finished + persiste matches/scores (condicional)
  action=reset                → volta para lobby, limpa snippet/results
  action=claim-leader         → elege novo líder quando o atual saiu
```

O `SUPABASE_SERVICE_ROLE_KEY` **nunca sai do servidor** — está apenas em
`src/lib/supabase.ts` (server-side) e nos API routes.
Veja `.env.example` para as variáveis necessárias.

## Fluxo de estados da sala

```
lobby ──[start]──► racing ──[todos terminaram ou abandon]──► finished
  ▲                                                              │
  └──────────────────[reset]────────────────────────────────────┘
```

- **lobby**: jogadores entram, líder configura settings. `snippet = null`, `start_at = null`.
- **racing**: `start_at` é ISO string do futuro (now + 4 s = `COUNTDOWN_MS`).
  Clientes exibem countdown derivando de `start_at - Date.now()` — sem timer server-side,
  elimina drift entre clientes.
- **finished**: `results` JSON com `ResultRow[]` persiste no row de `rooms`.
  `persistMatch()` insere em `matches` + `scores` de forma condicional
  (`.eq("status", "racing")` garante idempotência — só o primeiro `finish` persiste).
- **reset**: volta a lobby, limpa `snippet`, `start_at`, `results`.

## Eleição de líder

Quando o líder sai (detectado via `presence.leave`), o cliente com menor `joinedAt`
(desempate: menor `id` lexicográfico) chama `action=claim-leader`. O `claimingRef`
evita que múltiplos clientes chamem simultaneamente. Ver `useRoom.ts` linhas 294–306.

## Schema de banco (migrations)

Arquivo: `supabase/migrations/0001_coderacer_init.sql`

```sql
matches (id, room_code, language, difficulty, snippet_title,
         player_count, winner_name, winner_wpm, finished_at)
scores  (id, match_id, name, language, difficulty,
         wpm, accuracy, errors, place, finished)
view leaderboard  -- personal best por nick (distinct on lower(name), max wpm)
```

RLS: leitura pública para `anon` e `authenticated`. Escrita apenas via `service_role`
(API routes). Nunca conceda `INSERT/UPDATE` para `anon`.

Arquivo: `supabase/migrations/0002_realtime_rooms.sql`
Habilita Realtime na tabela `rooms` (publication).

Para aplicar migrations: `pnpm db:migrate` (via `scripts/migrate.mjs`).

## Leaderboard

- `leaderboard/page.tsx` é um Server Component (`force-dynamic`) que chama
  `getLeaderboard(25)` e `getRecentMatches(12)` de `src/lib/supabase.ts`.
- A view `leaderboard` usa `distinct on (lower(name))` — um nick só aparece uma vez,
  com seu melhor WPM. Nicks são case-insensitive mas exibidos como digitados.
- Para adicionar filtros (por linguagem, dificuldade): adicione WHERE na query em
  `getLeaderboard()` em `src/lib/supabase.ts`, não na view (view é simples e rápida).

## Workflow — alterar fluxo de sala

1. Entenda qual evento aciona a transição antes de mexer: Presence, Broadcast ou
   `postgres_changes` são três caminhos diferentes. Confunda os três e terá bugs
   de estado que só aparecem com 3+ jogadores simultâneos.

2. Para adicionar um novo `action` em `/api/rooms/[code]/route.ts`:
   - Adicione o case no switch
   - Valide `isLeader` se necessário
   - Retorne `{ ok: true }` ou `{ ok: false, error: "..." }`
   - Adicione o wrapper em `useRoom.ts` e exponha via `actions`

3. Antes de modificar `persistMatch()`, rode `scripts/validate-persistence.mjs`
   para garantir que matches e scores chegam ao banco com os tipos certos.

4. Ao mudar o schema, crie uma nova migration em `supabase/migrations/` numerada
   sequencialmente (ex: `0003_...`). Nunca edite migrations já aplicadas em produção —
   é uma mudança destrutiva que não pode ser revertida de forma confiável.

5. Respeite o `SUPABASE_SERVICE_ROLE_KEY`: ele nunca vai para o cliente. Se precisar
   de operação autenticada no client-side, use o `supabase-browser.ts` com anon key
   e políticas RLS apropriadas. Ver `../supabase-rls-guard` para padrões de RLS.

## Limitações conhecidas e dívida técnica

| Problema | Severidade | Solução sugerida |
|---|---|---|
| Supabase Realtime: limite de conexões no plano free | Média | Migrar para plano Pro se > ~200 conexões simultâneas |
| Salas nunca expiram no banco | Baixa | Adicionar `cron` ou `pg_cron` para deletar salas antigas |
| Nick duplicado no leaderboard se capitalização muda | Baixa | `distinct on (lower(name))` mitiga; para fixa, vincule a auth |
| Zero testes de fluxo de sala | Média | Adicionar testes com Jest + RTL ou Playwright — ver `../test-foundation` |
| `claim-leader` pode ter race condition em latência alta | Baixa | `claimingRef` mitiga na maioria dos casos |

## Critério de aceite

A tarefa está pronta quando:
- [ ] `node scripts/validate-persistence.mjs` passa todos os casos
- [ ] O fluxo completo `lobby → countdown → racing → finished → reset` funciona com
      2+ abas abertas no browser (teste manual)
- [ ] `pnpm typecheck` e `pnpm build` passam limpos
- [ ] Nenhuma chave `SUPABASE_SERVICE_ROLE_KEY` aparece no bundle client-side
      (verifique com `pnpm build` e inspecione `.next/static/`)
- [ ] Migrations novas seguem a numeração `000N_` e são idempotentes

## Segurança
- `SUPABASE_SERVICE_ROLE_KEY`: nunca expor no cliente. Já documentado em `.env.example`.
  Use `../secrets-guardian` se suspeitar de vazamento.
- Para auditoria de segurança da superfície web, use `../web-security-audit`.
- Para padrões de RLS no Supabase, use `../supabase-rls-guard`.

## Referências
- `references/realtime-architecture.md` — detalhe do Presence + Broadcast + postgres_changes
- `scripts/validate-persistence.mjs` — valida que matches/scores chegam ao Supabase com tipos corretos
