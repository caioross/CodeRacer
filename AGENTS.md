# CodeRacer — contrato de agente

Lido automaticamente pelo **Codex** e pelo **Antigravity** (os dois descobrem `AGENTS.md`),
e pelo Claude Code via `CLAUDE.md`. É a porta de entrada; **a lei é `docs/fleet/HANDBOOK.md`** —
leia antes de agir. Este arquivo não repete a lei: registra o que vale **acima** dela agora que
mais de um runtime opera o mesmo repositório.

## O mínimo para não quebrar nada

Corrida de digitação multiplayer. Next.js + TypeScript + Supabase + Tailwind.
**`main` é produção: merge = deploy na Vercel.**

```
pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build
node scripts/validate-metrics.mjs       # tocou engine/Race/CodeDisplay
node scripts/validate-persistence.mjs   # tocou persistência/useRoom/API
```

**Área sagrada:** latência de input durante a corrida (60fps, tecla→pixel < 1 quadro). Nada de
trabalho pesado competindo com a `textarea`. `prefers-reduced-motion` sempre respeitado.

---

## §A — Claim: a ref do git, não a label *(substitui o §5 do HANDBOOK)*

**Label não é mutex.** Dois agentes leem "sem `em-resolucao`" e os dois escrevem. Isto não é
teoria: a issue **#34 tem duas branches** (`auto/issue-34-finish-coerencia` e `-finish-timing`),
de dois agentes que se acharam donos ao mesmo tempo.

O claim agora é um **compare-and-swap numa ref do git** — atômico do lado do servidor:

```
refs/frota/claims/issue-<N>     ← nome DETERMINÍSTICO, sem slug
```

Quem cria a ref primeiro é o dono; para o segundo, o push **falha**. Um slug no nome derrotaria
o mecanismo: dois nomes diferentes não colidem, e colidir é exatamente o ponto.

- O blob da ref carrega `{agent, runtime, host, pid, roundId, acquiredAt, expiresAt}`.
- **Expira em 90 min.** Rodada longa renova; rodada que morreu é reciclada por qualquer agente,
  com `--force-with-lease` — sem o lease, reciclar vira uma forma nova de roubar issue.
- Quem recicla comenta na issue: `claim de <agente> expirou <t>, liberado por <quem>`.
- A label `em-resolucao` continua, mas como **sinal para humano**, não como trava.
- A branch `auto/issue-<N>-<slug>` continua para o PR. Ela não é o claim.

**Quem faz isso é o wrapper, não você.** Se você é um agente lendo isto: o claim já foi obtido
antes de você começar, e será solto depois que você terminar, inclusive se você falhar.

## §B — Mais de um runtime no mesmo repositório

| Runtime | Papel aqui | Pode mergear? |
|---|---|---|
| **Codex** (headless, `codex exec`) | implementa e mergeia | sim |
| **Antigravity** (Hub) | dono do CaioVerso; aqui só se convidado | não |
| **Claude Code** (frota de 2026-08, hoje desativada) | se voltar, obedece ao §A | conforme o HANDBOOK |

Regras que só existem por haver mais de um:

- **Um runtime por repositório por vez.** O wrapper aborta se encontrar trava viva de outra frota.
- **Assine tudo** com `<!-- agente:<runtime>/<papel> -->`. O Diário (issue #4) é compartilhado;
  sem assinatura não se sabe quem fez.
- **Nunca edite comentário pelo `--edit-last`**: o token é o mesmo para todos, e o último
  comentário pode ser de outro agente. Edite **por ID**.
- **Nunca toque em branch, worktree ou PR que você não abriu.**

## §C — Autonomia (decisão do dono, 2026-09-23)

**Autonomia plena com quórum.** Você escolhe a issue, implementa, roda o portão, abre o PR,
convoca o quórum e **mergeia em produção** — sem esperar o dono. As duas exceções do HANDBOOK
continuam valendo e não são negociáveis:

- **§7.1 — sempre do dono.** PR nasce DRAFT + label `decisao-dono`: enfraquecer RLS/auth/anti-cheat,
  expor `SUPABASE_SERVICE_ROLE_KEY`, migração destrutiva, operação direta no banco de produção,
  `permissions`/secrets de workflow, dependência pesada, qualquer coisa que gaste dinheiro.
- **§7.2 — quórum.** API de salas, persistência, anti-cheat, migração aditiva, mudança de CI:
  PR non-draft com a linha exata `Solicito quórum (HANDBOOK §7)`.

**O quórum é orquestrado pelo wrapper, não por você.** Três processos separados, cada um em
sandbox **read-only**, um por lente (AppSec · Ofensiva · domínio). Quem conta a unanimidade é o
PowerShell. Revisor em read-only não consegue editar o que revisa — é impossibilidade física,
não boa-fé.

Um `APROVA` sem vetor concreto (`arquivo:linha`) **é rejeitado pelo wrapper**. E um "melhor um
humano ver" sem vetor **não conta como veto**. Parecer é trabalho, não formalidade.

### Tetos (o wrapper mede; você não precisa contar)
1 issue por rodada · ≤2 merges por rodada · ≤4 merges por dia · 20 min entre merges ·
**≤25 arquivos e ≤800 linhas por PR**. PR maior que isso vira fatiamento, não exceção.

## §D — O que o wrapper garante, e por que você não deve tentar

Estas travas existem **fora** de você. Não são pedidos:

- `E:\Projetos\.frota\HALT` para a frota antes de qualquer chamada de modelo. Fora de todo repo.
- Push em `main` é recusado pelo ruleset do GitHub; o token do agente não tem `administration`
  para remover o ruleset, nem `workflows` para alterar `.github/workflows/`.
- Hook `PreToolUse` nega `git push --force`, push em `main` e leitura de `.env*`,
  `mcp_config.json`, `auth.json`, `oauth_creds`.
- O resultado da rodada é derivado **do GitHub**, não do que você disse ter feito. Divergência
  entre os dois para a frota e avisa o dono.

**Nunca** use `--dangerously-bypass-approvals-and-sandbox` ou `--dangerously-bypass-hook-trust`.
O wrapper varre os próprios argumentos e aborta se achar `dangerously`.

## §E — Fim de rodada

Um comentário de ≤6 linhas no **Diário de Bordo (issue #4)**: o que fez, links, estado do portão,
se usou parecer. Assinado. **Poste assim que o PR existir** e depois edite *aquele* comentário
por ID.

**Terminar sem nada é resultado válido.** "Menos e melhor" — uma rodada que olhou, não achou
nada elegível e escreveu uma linha no Diário fez o trabalho certo.

---

**Fontes de verdade:** `docs/fleet/HANDBOOK.md` (a lei) · `.agents/skills/` (as skills, lidas
pelos dois runtimes) · `docs/UI-AAA-OVERHAUL.md` (roadmap) · issue #4 (Diário) · Project #30 (Quadro).
