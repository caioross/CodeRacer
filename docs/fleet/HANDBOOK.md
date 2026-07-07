# HANDBOOK da Frota CodeRacer

> A lei dos agentes autônomos que operam este repositório. v1.0 · jul/2026
> Repo: `caioross/CodeRacer` · Clone do dono: `E:\Projetos\Jogos\CodeRacer` · Base: `main`

---

## §1 Missão e ritmo

O CodeRacer é um **projeto satélite**: evolui todo dia, mas em ritmo calmo. A frota tem
exatamente **3 rodadas diárias** — Curador (11h), Resolvedor (14h), PR Doctor (18h) — e divide
tokens com a frota principal (SkillDepot) e outros projetos do dono.

Regra de ouro do ritmo: **menos e melhor**. Encerrar cedo sem entregar nada é resultado
válido ("silêncio = saúde"). Entregar algo errado, quebrado ou fora de escopo nunca é.
Nada de varreduras longas sem propósito; cada rodada é objetiva.

## §2 O produto (contexto mínimo)

Corrida de digitação multiplayer para programadores. Next.js 14 + TypeScript + Supabase
(Realtime + Postgres) + Tailwind + Framer Motion. Salas ao vivo vivem em memória (Realtime);
partidas terminadas persistem em `matches`/`scores` e alimentam o leaderboard global.
Sem login. LIVE em produção na Vercel (merge na `main` = deploy).

- Documento-mestre de evolução: `docs/UI-AAA-OVERHAUL.md` (spec AAA; roadmap na Parte VII).
- **Área sagrada:** latência de input durante a corrida. Nenhum efeito, refactor ou feature
  pode competir com a `textarea` da corrida (60fps, tecla→pixel < 1 frame).

## §3 Fluxo issue → produção

1. **Curador (11h)** mantém o backlog saudável: abre ≤2 issues/dia acionáveis, prioriza,
   poda; domingo faz retro + plano da semana.
2. **Resolvedor (14h)** pega 1 issue elegível e entrega PR validada pelo gate (§6).
3. **PR Doctor (18h)** revisa, repara, mergeia (squash) e limpa branches/worktrees.

A issue fecha pelo merge (`Closes #N` no corpo do PR) — nunca à mão. Fatia parcial usa
`Refs #N` e NÃO fecha a issue.

## §4 Labels

| Grupo | Labels | Significado |
|---|---|---|
| Prioridade | `P0` `P1` `P2` `P3` | P0 = produção quebrada · P1 = alto valor · P2 = normal · P3 = algum dia |
| Estado | `em-resolucao` | claim de um Resolvedor em andamento |
| | `blocked` | depende de algo externo |
| | `epic` | não cabe numa rodada; precisa ser fatiada |
| | `decisao-dono` | aguarda decisão humana; agentes não tocam |
| Área | `area:engine` `area:multiplayer` `area:ui` `area:infra` `area:content` `area:security` `area:docs` | roteamento e estatística |

Toda issue criada por agente tem: **1 prioridade + ≥1 área + acceptance criteria no corpo**.

## §5 Reivindicação (claim)

Issue **elegível** = aberta, sem `em-resolucao`/`blocked`/`epic`/`decisao-dono`, sem PR aberta
vinculada e sem branch `auto/issue-<N>-*` remota. Claim = adicionar `em-resolucao` + criar
branch `auto/issue-<N>-<slug>` a partir de `origin/main` (nunca do HEAD local). Ao abrir o PR,
remova `em-resolucao` — o PR passa a ser a reivindicação.

## §6 Gate de validação (obrigatório antes de qualquer PR)

No worktree:

```
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm build
node scripts/validate-metrics.mjs      # sempre que tocar engine/Race/CodeDisplay — na dúvida, rode
node scripts/validate-persistence.mjs  # sempre que tocar persistência/useRoom/API — na dúvida, rode
```

Os dois scripts são baratos; na dúvida rode ambos. Vermelho sem correção honesta dentro do
escopo = PR **DRAFT** explicando o bloqueio. Nunca enfraqueça validação para "passar".

## §7 Doutrina de autonomia

### §7.1 Núcleo irredutível — só o dono decide (PR nasce DRAFT + label `decisao-dono`)

- Enfraquecer RLS/policies, expor `SUPABASE_SERVICE_ROLE_KEY` ao cliente, afrouxar anti-cheat.
- Migração destrutiva ou não-idempotente (DROP/DELETE/UPDATE em dados) — e **qualquer**
  operação direta no banco de produção.
- Workflow do GitHub com `permissions`, secrets ou `pull_request_target`.
- Dependência de runtime pesada (>50KB gzip) ou serviço externo novo.
- Qualquer coisa que gaste dinheiro ou crie conta em serviço.

### §7.2 Área de quórum — PR non-draft com a linha exata "Solicito quórum (HANDBOOK §7)"

API de salas (`src/app/api/rooms/**`), persistência (`src/lib/supabase.ts`), anti-cheat,
migração **aditiva idempotente** (novo arquivo em `supabase/migrations/`), mudança no CI,
dependência nova leve. O PR Doctor roda 3 lentes adversariais (§ da skill `cr-fleet-ops`) e,
com 3× APROVA, mergeia sem o dono.

### §7.3 Normal — fluxo comum

UI/componentes, engine de digitação (com `validate-metrics` verde), snippets/conteúdo, docs,
testes, refactor pequeno.

## §8 Regras rígidas (invioláveis)

- Nunca commit/push na `main`; nunca `--force`; nunca reescrever histórico; nunca deletar
  branch de outro agente.
- Nunca ler/comitar/imprimir `.env.local` ou qualquer segredo. Suspeita de vazamento →
  skill `secrets-guardian`.
- Nunca aplicar migração no banco (nem `pnpm db:migrate`): agente só **cria o arquivo** de
  migração; o dono aplica.
- Nunca desabilitar teste/lint/typecheck para passar. Nunca mexer em issue/PR não relacionada.
- Tetos por rodada: Curador ≤2 issues novas · Resolvedor 1 issue · PR Doctor ≤2 merges.
- Trabalhe sempre em **worktree** (nunca na cópia principal do dono) e só no repo
  `caioross/CodeRacer` (use `gh -R caioross/CodeRacer`).

## §9 Comunicação

- Toda rodada termina com **um** comentário curto (≤6 linhas) no **Diário de Bordo** (issue
  fixada com esse título) — o que fez, links, pendências. Sem posts extras, sem status espalhado.
- Decisão que só o dono pode tomar → label `decisao-dono` + comentário objetivo do que precisa.
- Assinatura HTML no fim de todo comentário/PR de agente:
  `<!-- agente:coderacer/<papel> -->`

## §10 Fontes de verdade

1. `docs/UI-AAA-OVERHAUL.md` — spec de qualidade e roadmap (Parte VII).
2. `.claude/skills/_INDICE_SKILLS.md` — mapa de skills (`cr-typing-engine`, `cr-multiplayer`,
   transversais de segurança/testes).
3. `.claude/skills/cr-fleet-ops/SKILL.md` — receitas operacionais da frota (worktree, claim,
   gate, quórum, diário).
4. `README.md` — visão de produto.
