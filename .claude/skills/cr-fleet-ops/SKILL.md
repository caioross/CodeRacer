---
name: cr-fleet-ops
description: Receitas operacionais da frota autônoma do CodeRacer — claim de issue, worktree no Windows, gate de validação, quórum adversarial, merge/limpeza, Diário de Bordo, Quadro (Project #30), Discussions (retro/ideias/decisões/Q&A), pareceres do Conselho, ICE e meta-evolução da frota. Use SEMPRE que você for uma rotina agendada do CodeRacer (Curador, Conselho, Resolvedor, PR Doctor, Persona, Meta) ou precisar operar issues/PRs/branches auto/*/Discussions/Projects no repo caioross/CodeRacer.
---

# cr-fleet-ops — Operação da Frota CodeRacer

A lei é `docs/fleet/HANDBOOK.md` (leia primeiro). Aqui estão as **receitas** prontas.
Ambiente: Windows 11, Git Bash disponível, `gh` autenticado como `caioross`, pnpm.
Clone do dono: `E:\Projetos\Jogos\CodeRacer` — **não trabalhe nele; use worktree.**

## 1. Checagem de trabalho (barata, sempre primeiro)

```bash
cd /e/Projetos/Jogos/CodeRacer
git fetch origin
gh issue list -R caioross/CodeRacer --state open --json number,title,labels,updatedAt --limit 50
gh pr list -R caioross/CodeRacer --state open --json number,title,isDraft,mergeable,headRefName,labels,updatedAt
```

Nada elegível/acionável → poste 1 linha no Diário de Bordo e encerre (silêncio = saúde).

## 2. Claim de issue (3 checagens antes)

Uma issue está livre se: (a) sem label `em-resolucao`/`blocked`/`epic`/`decisao-dono`;
(b) sem branch remota `auto/issue-<N>-*` (`git ls-remote --heads origin 'auto/issue-<N>-*'`);
(c) sem PR aberta que a referencie. Então:

```bash
gh issue edit <N> -R caioross/CodeRacer --add-label em-resolucao
```

## 3. Worktree (nunca trabalhe no clone do dono)

```bash
cd /e/Projetos/Jogos/CodeRacer
git worktree add /e/Projetos/Jogos/CodeRacer-wt/i<N> -b auto/issue-<N>-<slug-curto> origin/main
cd /e/Projetos/Jogos/CodeRacer-wt/i<N>
pnpm install --frozen-lockfile
```

Slug curto (≤4 palavras) — caminhos longos estouram MAX_PATH no Windows. Confirme base
limpa: `git rev-list --left-right --count origin/main...HEAD` deve dar `0 0`.

## 4. Gate de validação (antes de qualquer PR)

```bash
pnpm typecheck && pnpm build           # núcleo = o que a CI roda
node scripts/validate-metrics.mjs      # engine (Race.tsx, CodeDisplay.tsx, WPM/precisão)
node scripts/validate-persistence.mjs  # persistência (useRoom, supabase.ts, API rooms)
```

`pnpm lint` = **N/A**: o repo não tem `.eslintrc` (nem `eslintConfig` no `package.json`), então
`next lint` só abre o setup interativo e falha em shell headless; a CI roda só typecheck+build.
Não exija lint no gate nem escreva disclaimer de lint no PR até existir config ESLint.
Na dúvida sobre quais scripts, rode os dois (são baratos). Vermelho sem correção honesta no
escopo → PR **DRAFT** explicando o bloqueio. Nunca enfraqueça o gate.

## 5. Commit, push e PR

- Conventional Commits referenciando `#N`; capriche no 1º commit — vira título do squash.
- `git push -u origin auto/issue-<N>-<slug>` (nunca `main`, nunca `--force`).

```bash
gh pr create -R caioross/CodeRacer --base main \
  --title "<tipo>: <resumo específico>" \
  --body "<contexto · o que mudou e por quê · como foi validado (resultado real do gate) · riscos · Closes #N>"
```

- `Closes #N` só se resolve a issue INTEIRA; fatia parcial = `Refs #N`.
- Classifique pelo HANDBOOK §7: núcleo (§7.1) → `--draft` + label `decisao-dono`;
  quórum (§7.2) → non-draft com a linha exata `Solicito quórum (HANDBOOK §7)`; normal → non-draft.
- Depois do PR: `gh issue edit <N> --remove-label em-resolucao` + comentário na issue com link.

## 6. Quórum adversarial (PR Doctor, PRs §7.2)

Pré-requisitos: CI verde, `mergeable`, diff lido inteiro, gate validado localmente se houver
dúvida. Então lance **3 subagentes em paralelo**, cada um com default VETAR e obrigação de
apontar vetor concreto `arquivo:linha`:

1. **AppSec** — RLS, service_role, injeção, validação de entrada nas rotas de sala.
2. **Ofensiva** — como um jogador trapaceiro/hostil abusa disso (anti-cheat, spoof de
   progresso, flood de salas/broadcast).
3. **Lente do domínio** — corretude da mudança no contexto (engine: métricas honestas;
   multiplayer: presença/estado; infra: build/deploy).

3× APROVA → squash-merge registrando o veredito das 3 lentes no PR. Veto real → repare e
re-convoque UMA vez; persistiu → DRAFT + `decisao-dono` + parecer. Veto sem vetor concreto
não bloqueia, mas registre.

## 7. Merge e limpeza (PR Doctor)

```bash
gh pr merge <M> -R caioross/CodeRacer --squash --delete-branch   # exit 1 no delete local é esperado; confirme MERGED
git worktree list                                                 # no clone do dono
git worktree remove /e/Projetos/Jogos/CodeRacer-wt/i<N>           # worktrees de branches mergeadas
git worktree prune && git branch -D auto/issue-<N>-<slug>         # branch local já mergeada
```

Nunca remova worktree de branch NÃO mergeada sem checar se há commits não enviados.

## 8. Diário de Bordo (toda rodada, 1 comentário)

A issue fixada "📓 Diário de Bordo da Frota" (ache com
`gh issue list -R caioross/CodeRacer --search "Diário de Bordo in:title" --state open`).
Formato (≤6 linhas):

```markdown
### 🏁 <Papel> · <AAAA-MM-DD HH>h
- **Fiz:** <1-2 linhas objetivas, com #issue / PR #M>
- **Pendente/decisão:** <o que ficou, ou "nada">
<!-- agente:coderacer/<papel> -->
```

## 9. Órgãos do GitHub — Quadro, Discussions, Parecer, ICE

**Leia `references/github-orgaos.md`** (nesta skill) — tem TODOS os IDs estáveis (Project #30,
campo Status e opções, categorias de Discussions, repo node) e as receitas GraphQL/CLI prontas:
reconciliar o quadro, criar/comentar/listar discussions, marcar resposta de Q&A, o formato do
Parecer do Conselho com regra de idempotência, e a tabela ICE para converter Ideas em issues.
Não redescubra IDs por tentativa — está tudo lá; se algum quebrar, use as queries de
descoberta no fim do arquivo e atualize-o via PR.

Divisão de responsabilidade sobre o quadro: o **Curador reconcilia tudo** diariamente
(verdade = issues/labels/PRs); Resolvedor move o próprio card para In Progress/In Review ao
agir; PR Doctor move para Done ao mergear (ou deixa para a reconciliação seguinte se falhar).

## 10. Meta-evolução (só a rotina Meta, domingo)

Prompts das rotinas vivem em `C:\Users\Matrix\.claude\scheduled-tasks\coderacer-*\SKILL.md`
(o corpo depois do frontmatter é o prompt executado). Change-control (HANDBOOK §12):
- Pode editar DIRETO: prompts `coderacer-*`. Registre o diff resumido no [Retro].
- Via PR: skills do repo, HANDBOOK, este arquivo.
- Proibido: tocar qualquer task que não comece com `coderacer-`; afrouxar HANDBOOK §7.1/§8;
  mais que 3 mudanças/semana; horário novo fora de janela livre da frota SkillDepot
  (confira com a ferramenta `list_scheduled_tasks` antes).

## 11. Gotchas do ambiente

- Windows: prefira Git Bash para os comandos acima; caminhos `/e/Projetos/...`.
- `pnpm install` num worktree novo é rápido (store compartilhado), mas necessário — `.next/`
  e `node_modules/` não vêm no worktree.
- CI do repo = typecheck + build (`.github/workflows/ci.yml`). O gate local cobre mais que a CI.
- Issues de skins/UI: cheque `docs/UI-AAA-OVERHAUL.md` antes — a spec provavelmente já define
  token, duração e curva do que você quer inventar.
- Supabase: use os MCP tools só para LEITURA (advisors/logs) se disponíveis; escrita no banco
  é sempre via arquivo de migração + dono aplica (HANDBOOK §8).
