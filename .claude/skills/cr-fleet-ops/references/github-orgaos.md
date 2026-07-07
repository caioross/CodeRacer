# Órgãos do GitHub — IDs estáveis e receitas prontas (CodeRacer)

> Capturado em jul/2026. Se algum ID der 404/erro, redescubra com as queries de descoberta
> no fim deste arquivo e atualize este documento via PR.

## IDs

| Coisa | Valor |
|---|---|
| Repo (node) | `R_kgDOSzGt3A` |
| Produção | `https://code-racer-three.vercel.app` (também: `gh api repos/caioross/CodeRacer --jq .homepage`) |
| Project v2 | número **30** · id `PVT_kwHOAvpJQc4Bcq6C` · https://github.com/users/caioross/projects/30 |
| Campo Status | `PVTSSF_lAHOAvpJQc4Bcq6CzhXR-QY` |
| → opção Todo | `805175ad` |
| → opção In Progress | `2c598071` |
| → opção In Review | `34435ee9` |
| → opção Done | `e479b8a5` |
| Discussions · Announcements | `DIC_kwDOSzGt3M4DAp6_` |
| Discussions · General | `DIC_kwDOSzGt3M4DAp7A` |
| Discussions · Q&A | `DIC_kwDOSzGt3M4DAp7B` |
| Discussions · Ideas | `DIC_kwDOSzGt3M4DAp7C` |
| Discussions · Show and tell | `DIC_kwDOSzGt3M4DAp7D` |
| Discussions · Polls | `DIC_kwDOSzGt3M4DAp7E` |
| Diário de Bordo | issue **#4** |
| Manifesto da frota | discussion **#5** |

## Quadro (Projects v2 #30)

```bash
# listar itens com status
gh project item-list 30 --owner caioross --format json --jq '.items[] | {id, status, title: .content.title, number: .content.number}'

# adicionar issue ao quadro (retorna o item id)
gh project item-add 30 --owner caioross --url https://github.com/caioross/CodeRacer/issues/<N> --format json --jq .id

# mudar o Status de um item
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAvpJQc4Bcq6C \
  --field-id PVTSSF_lAHOAvpJQc4Bcq6CzhXR-QY --single-select-option-id <OPTION_ID>

# arquivar item (Done com >7 dias)
gh project item-archive 30 --owner caioross --id <ITEM_ID>
```

Mapeamento verdade→quadro (a verdade são issues/labels/PRs; o quadro é espelho):
aberta sem claim = `Todo` · `em-resolucao` = `In Progress` · PR aberta vinculada = `In Review` ·
fechada por merge = `Done`. A issue #4 (Diário) NÃO entra no quadro.

## Discussions (GraphQL — o gh não tem comando nativo)

```bash
# listar atividade recente (triagem do Curador)
gh api graphql -f query='query{repository(owner:"caioross",name:"CodeRacer"){discussions(first:15,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title url category{name} updatedAt author{login} comments(last:3){nodes{author{login} body url}}}}}}'

# criar discussion (use -f body=... para corpo multilinha seguro)
gh api graphql -f query='mutation($b:String!){createDiscussion(input:{repositoryId:"R_kgDOSzGt3A",categoryId:"<CAT_ID>",title:"<título>",body:$b}){discussion{number url}}}' -f b="<corpo>"

# pegar o node id de uma discussion pelo número
gh api graphql -f query='query{repository(owner:"caioross",name:"CodeRacer"){discussion(number:<N>){id title}}}'

# comentar numa discussion
gh api graphql -f query='mutation($b:String!){addDiscussionComment(input:{discussionId:"<D_ID>",body:$b}){comment{url}}}' -f b="<corpo>"

# marcar comentário como resposta (Q&A)
gh api graphql -f query='mutation{markDiscussionCommentAsAnswer(input:{id:"<COMMENT_ID>"}){discussion{url}}}'
```

Prefixos de título: `[Retro]` `[Plano]` `[Decisão]` `[Handoff]` `[Feedback]`.

## Parecer do Conselho (formato — 1 comentário por issue)

```markdown
### 🏛️ Parecer do Conselho · <AAAA-MM-DD>

**Veredito:** APROVADA PARA EXECUÇÃO | PRECISA FATIAR | PRECISA DECISÃO DO DONO | ARQUIVAR

- **Engenharia:** <abordagem, arquivos-alvo, riscos técnicos>
- **Segurança/Anti-cheat:** <RLS, service_role, validação, vetores de trapaça>
- **UX/Game-feel:** <coerência com docs/UI-AAA-OVERHAUL.md, reduced-motion, teclado-primeiro>
- **Performance:** <impacto na área sagrada (input da corrida), bundle, re-renders>
- **Produto:** <valor para as personas da spec §0.3, prioridade correta?>

**Plano sugerido:** <passos concretos para o Resolvedor, com arquivo:linha quando couber>

<!-- agente:coderacer/conselho | estado:<updatedAt-da-issue-no-momento> -->
```

Idempotência: antes de opinar, procure comentário existente com
`<!-- agente:coderacer/conselho`. Se existir e a issue NÃO mudou (mesmo updatedAt/corpo)
desde então, pule. Se mudou, poste parecer NOVO marcando "substitui o anterior".

## ICE para converter Ideas em issues (Curador)

`Score = Impacto(1-5) × Confiança(1-5) × Facilidade(1-5)`

- **≥ 48** → issue P1/P2 com acceptance criteria (conta no teto de 2/dia)
- **20–47** → issue P3, ou `epic` se for grande
- **< 20** → não converte; responda na thread explicando o porquê (educado e específico)

SEMPRE feche o loop: comente na Discussion com o link da issue criada (ou a razão de não criar).

## Queries de descoberta (se algum ID quebrar)

```bash
gh api graphql -f query='query{repository(owner:"caioross",name:"CodeRacer"){id discussionCategories(first:15){nodes{id name}}}}'
gh project list --owner caioross --format json --jq '.projects[] | {number,title,id}'
gh project field-list 30 --owner caioross --format json --jq '.fields[] | select(.name=="Status")'
```
